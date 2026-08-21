#include "app/BackendFactory.h"
#include "core/RenderController.h"
#include "decklink/DeckLinkDeviceEnumerator.h"

#if CEFTOD_WITH_CEF
#include "cef/CefOffscreenRenderer.h"
#endif

#include <chrono>
#include <fstream>
#include <filesystem>
#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <windows.h>
#include <shellapi.h>
#include <objbase.h>
#include <shlobj.h>

namespace ceftod {
namespace {

constexpr wchar_t kServiceName[] = L"CeftoDecklinkService";
constexpr wchar_t kTrayWndClass[] = L"CeftoDecklinkTrayWnd";
constexpr UINT WM_TRAYICON = WM_APP + 100;

constexpr UINT IDM_URL_HEADER = 100;
constexpr UINT IDM_CHANGE_URL = 101;
constexpr UINT IDM_DECKLINK_HEADER = 200;
constexpr UINT IDM_DECKLINK_BASE = 201; // 201..250 for hardware devices
constexpr UINT IDM_MOCK_OUTPUT = 299;
constexpr UINT IDM_OPEN_CONFIG = 301;
constexpr UINT IDM_OPEN_LOG = 302;
constexpr UINT IDM_RESTART = 303;
constexpr UINT IDM_EXIT = 304;

struct ServiceConfig {
    std::wstring url = L"http://localhost:21000/";
    int deckLinkDeviceIndex = 0;
    bool useMockOutput = false;
};

std::mutex g_serviceMutex;
SERVICE_STATUS g_serviceStatus = {};
SERVICE_STATUS_HANDLE g_statusHandle = nullptr;
HANDLE g_stopEvent = nullptr;

HWND g_hTrayWnd = nullptr;
NOTIFYICONDATAW g_nid = {};
ServiceConfig g_currentConfig;
std::unique_ptr<ceftod::RenderController> g_controller;

VideoMode Default1080pMode() {
    return {L"1080p50 - 1920 x 1080 @ 50", 1920, 1080, 50, 1, false};
}

std::filesystem::path GetExePath() {
    wchar_t buffer[MAX_PATH] = {};
    GetModuleFileNameW(nullptr, buffer, MAX_PATH);
    return std::filesystem::path(buffer);
}

void SetCurrentDirectoryToExe() {
    const auto exeDir = GetExePath().parent_path();
    SetCurrentDirectoryW(exeDir.c_str());
}

std::wstring GetConfigDir() {
    PWSTR programData = nullptr;
    std::filesystem::path configDir;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_ProgramData, KF_FLAG_CREATE, nullptr, &programData)) && programData) {
        configDir = std::filesystem::path(programData) / L"CeftoDecklink";
        CoTaskMemFree(programData);
    } else {
        configDir = GetExePath().parent_path();
    }
    std::error_code ec;
    std::filesystem::create_directories(configDir, ec);
    return configDir.wstring();
}

std::wstring GetConfigFilePath() {
    return (std::filesystem::path(GetConfigDir()) / L"settings.json").wstring();
}

std::wstring GetLogFilePath() {
    return (std::filesystem::path(GetConfigDir()) / L"service.log").wstring();
}

void LogServiceMessage(const std::wstring& message) {
    const auto logPath = GetLogFilePath();
    std::wofstream logFile(logPath, std::ios::app);
    if (logFile.is_open()) {
        const auto now = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
        wchar_t timeBuf[64] = {};
        std::tm timeInfo = {};
        localtime_s(&timeInfo, &now);
        wcsftime(timeBuf, 64, L"%Y-%m-%d %H:%M:%S", &timeInfo);
        logFile << L"[" << timeBuf << L"] " << message << std::endl;
    }
    std::wcout << L"[CeftoDecklinkService] " << message << std::endl;
}

ServiceConfig LoadServiceConfig() {
    ServiceConfig config;
    const auto configPath = GetConfigFilePath();
    std::ifstream file(configPath);
    if (file.is_open()) {
        std::string line;
        while (std::getline(file, line)) {
            if (line.find("\"url\"") != std::string::npos) {
                auto start = line.find(':', line.find("\"url\""));
                if (start != std::string::npos) {
                    auto q1 = line.find('"', start);
                    auto q2 = line.find('"', q1 + 1);
                    if (q1 != std::string::npos && q2 != std::string::npos) {
                        std::string urlStr = line.substr(q1 + 1, q2 - q1 - 1);
                        if (!urlStr.empty()) {
                            config.url = std::wstring(urlStr.begin(), urlStr.end());
                        }
                    }
                }
            }
            if (line.find("\"deckLinkDeviceIndex\"") != std::string::npos) {
                auto start = line.find(':', line.find("\"deckLinkDeviceIndex\""));
                if (start != std::string::npos) {
                    try {
                        config.deckLinkDeviceIndex = std::stoi(line.substr(start + 1));
                    } catch (...) {}
                }
            }
            if (line.find("\"useMockOutput\"") != std::string::npos) {
                if (line.find("true") != std::string::npos) {
                    config.useMockOutput = true;
                }
            }
        }
    } else {
        // Create default config file if it doesn't exist
        std::wofstream outFile(configPath);
        if (outFile.is_open()) {
            outFile << L"{\n";
            outFile << L"  \"url\": \"http://localhost:21000/\",\n";
            outFile << L"  \"deckLinkDeviceIndex\": 0,\n";
            outFile << L"  \"useMockOutput\": false\n";
            outFile << L"}\n";
        }
    }
    return config;
}

void SaveServiceConfig(const ServiceConfig& config) {
    const auto configPath = GetConfigFilePath();
    std::wofstream outFile(configPath);
    if (outFile.is_open()) {
        outFile << L"{\n";
        outFile << L"  \"url\": \"" << config.url << L"\",\n";
        outFile << L"  \"deckLinkDeviceIndex\": " << config.deckLinkDeviceIndex << L",\n";
        outFile << L"  \"useMockOutput\": " << (config.useMockOutput ? L"true" : L"false") << L"\n";
        outFile << L"}\n";
    }
}

void SetServiceState(DWORD state, DWORD exitCode = NO_ERROR, DWORD waitHintMs = 0) {
    std::lock_guard<std::mutex> lock(g_serviceMutex);
    g_serviceStatus.dwServiceType = SERVICE_WIN32_OWN_PROCESS;
    g_serviceStatus.dwCurrentState = state;
    g_serviceStatus.dwWin32ExitCode = exitCode;
    g_serviceStatus.dwWaitHint = waitHintMs;
    g_serviceStatus.dwControlsAccepted = (state == SERVICE_RUNNING) ? SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN : 0;

    if (state == SERVICE_RUNNING || state == SERVICE_STOPPED) {
        g_serviceStatus.dwCheckPoint = 0;
    } else {
        static DWORD checkPoint = 1;
        g_serviceStatus.dwCheckPoint = checkPoint++;
    }

    if (g_statusHandle) {
        SetServiceStatus(g_statusHandle, &g_serviceStatus);
    }
}

bool StartOrRestartController(const ServiceConfig& config, std::wstring* outInfo) {
    if (g_controller) {
        g_controller->Stop();
        g_controller.reset();
    }

    ceftod::RenderSettings settings;
    settings.url = config.url;
    settings.mode = Default1080pMode();
    settings.deckLinkDeviceIndex = config.deckLinkDeviceIndex;
    settings.mirrorOutput = false;
    settings.autoReconnect = true;

    std::wstring error;
    bool useDeckLink = !config.useMockOutput;

    g_controller = std::make_unique<ceftod::RenderController>(CreateFrameSource(), CreateVideoOutput(useDeckLink));
    if (g_controller->Start(settings, &error)) {
        if (outInfo) {
            *outInfo = useDeckLink 
                ? L"Started rendering URL [" + config.url + L"] to DeckLink Device " + std::to_wstring(config.deckLinkDeviceIndex)
                : L"Started rendering URL [" + config.url + L"] to Mock Video Output.";
        }
        return true;
    }

    if (useDeckLink) {
        LogServiceMessage(L"DeckLink Device " + std::to_wstring(config.deckLinkDeviceIndex) + L" failed (" + error + L"). Falling back to Mock Output.");
        g_controller = std::make_unique<ceftod::RenderController>(CreateFrameSource(), CreateVideoOutput(false));
        if (g_controller->Start(settings, &error)) {
            if (outInfo) *outInfo = L"Started rendering URL [" + config.url + L"] to Mock Video Output (DeckLink device unavailable).";
            return true;
        }
    }

    if (outInfo) *outInfo = L"Failed to start renderer: " + error;
    return false;
}

// Lightweight Win32 Modal Dialog for URL Entry
struct UrlDialogState {
    std::wstring url;
    HWND hEdit = nullptr;
};

LRESULT CALLBACK UrlDialogProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    auto pState = reinterpret_cast<UrlDialogState*>(GetWindowLongPtrW(hWnd, GWLP_USERDATA));
    switch (msg) {
    case WM_CREATE: {
        CREATESTRUCTW* cs = reinterpret_cast<CREATESTRUCTW*>(lParam);
        pState = reinterpret_cast<UrlDialogState*>(cs->lpCreateParams);
        SetWindowLongPtrW(hWnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(pState));

        CreateWindowW(L"STATIC", L"Enter HTML Graphics Playout URL:", WS_CHILD | WS_VISIBLE, 15, 15, 380, 20, hWnd, nullptr, nullptr, nullptr);
        pState->hEdit = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", pState->url.c_str(), WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL, 15, 40, 370, 25, hWnd, (HMENU)1001, nullptr, nullptr);
        CreateWindowW(L"BUTTON", L"OK", WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON, 200, 75, 85, 28, hWnd, (HMENU)IDOK, nullptr, nullptr);
        CreateWindowW(L"BUTTON", L"Cancel", WS_CHILD | WS_VISIBLE, 300, 75, 85, 28, hWnd, (HMENU)IDCANCEL, nullptr, nullptr);
        SetFocus(pState->hEdit);
        return 0;
    }
    case WM_COMMAND: {
        if (LOWORD(wParam) == IDOK) {
            wchar_t buf[2048] = {};
            GetWindowTextW(pState->hEdit, buf, 2048);
            pState->url = buf;
            DestroyWindow(hWnd);
            return 0;
        } else if (LOWORD(wParam) == IDCANCEL) {
            pState->url.clear();
            DestroyWindow(hWnd);
            return 0;
        }
        break;
    }
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hWnd, msg, wParam, lParam);
}

bool ShowUrlInputDialog(HWND hParent, std::wstring& inOutUrl) {
    WNDCLASSW wc = {};
    wc.lpfnWndProc = UrlDialogProc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
    wc.lpszClassName = L"CeftodUrlDialogClass";
    RegisterClassW(&wc);

    UrlDialogState state;
    state.url = inOutUrl;

    HWND hDlg = CreateWindowExW(
        WS_EX_DLGMODALFRAME | WS_EX_TOPMOST,
        wc.lpszClassName,
        L"Set HTML Graphics URL",
        WS_POPUP | WS_CAPTION | WS_SYSMENU,
        CW_USEDEFAULT, CW_USEDEFAULT, 415, 145,
        hParent, nullptr, wc.hInstance, &state);

    if (!hDlg) return false;

    // Center dialog on screen
    RECT rc = {};
    GetWindowRect(hDlg, &rc);
    int screenW = GetSystemMetrics(SM_CXSCREEN);
    int screenH = GetSystemMetrics(SM_CYSCREEN);
    SetWindowPos(hDlg, HWND_TOPMOST, (screenW - (rc.right - rc.left)) / 2, (screenH - (rc.bottom - rc.top)) / 2, 0, 0, SWP_NOSIZE | SWP_SHOWWINDOW);

    EnableWindow(hParent, FALSE);

    MSG msg = {};
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        if (!IsDialogMessageW(hDlg, &msg)) {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

    EnableWindow(hParent, TRUE);
    UnregisterClassW(wc.lpszClassName, wc.hInstance);

    if (!state.url.empty()) {
        inOutUrl = state.url;
        return true;
    }
    return false;
}

void ShowTrayContextMenu(HWND hWnd) {
    POINT pt;
    GetCursorPos(&pt);

    HMENU hMenu = CreatePopupMenu();
    if (!hMenu) return;

    // 1. Current URL Header
    std::wstring urlLabel = L"URL: " + g_currentConfig.url;
    if (urlLabel.length() > 40) urlLabel = urlLabel.substr(0, 37) + L"...";
    AppendMenuW(hMenu, MF_STRING | MF_DISABLED, IDM_URL_HEADER, urlLabel.c_str());
    AppendMenuW(hMenu, MF_STRING, IDM_CHANGE_URL, L"🌐 Set HTML Graphics URL...");
    AppendMenuW(hMenu, MF_SEPARATOR, 0, nullptr);

    // 2. DeckLink Card Selection Submenu / Items
    AppendMenuW(hMenu, MF_STRING | MF_DISABLED, IDM_DECKLINK_HEADER, L"--- Select DeckLink Output Card ---");
    
    auto enumResult = EnumerateDeckLinkDevices();
    if (enumResult.devices.empty()) {
        AppendMenuW(hMenu, MF_STRING | MF_DISABLED, 0, L"  (No DeckLink Cards Detected)");
    } else {
        for (std::size_t i = 0; i < enumResult.devices.size() && i < 20; ++i) {
            const auto& dev = enumResult.devices[i];
            std::wstring itemText = L"  Device " + std::to_wstring(i) + L": " + dev.displayName;
            UINT flags = MF_STRING;
            if (!g_currentConfig.useMockOutput && static_cast<int>(i) == g_currentConfig.deckLinkDeviceIndex) {
                flags |= MF_CHECKED;
            }
            AppendMenuW(hMenu, flags, IDM_DECKLINK_BASE + static_cast<UINT>(i), itemText.c_str());
        }
    }

    UINT mockFlags = MF_STRING;
    if (g_currentConfig.useMockOutput) mockFlags |= MF_CHECKED;
    AppendMenuW(hMenu, mockFlags, IDM_MOCK_OUTPUT, L"  Mock Video Output (Virtual)");

    AppendMenuW(hMenu, MF_SEPARATOR, 0, nullptr);

    // 3. Management Actions
    AppendMenuW(hMenu, MF_STRING, IDM_OPEN_CONFIG, L"⚙️ Open Settings File (settings.json)");
    AppendMenuW(hMenu, MF_STRING, IDM_OPEN_LOG, L"📜 View Service Log (service.log)");
    AppendMenuW(hMenu, MF_STRING, IDM_RESTART, L"🔄 Restart Video Playout");
    AppendMenuW(hMenu, MF_SEPARATOR, 0, nullptr);
    AppendMenuW(hMenu, MF_STRING, IDM_EXIT, L"❌ Exit Service");

    SetForegroundWindow(hWnd);
    const UINT cmd = TrackPopupMenu(hMenu, TPM_RIGHTBUTTON | TPM_RETURNCMD, pt.x, pt.y, 0, hWnd, nullptr);
    DestroyMenu(hMenu);

    if (cmd == IDM_CHANGE_URL) {
        std::wstring newUrl = g_currentConfig.url;
        if (ShowUrlInputDialog(hWnd, newUrl)) {
            g_currentConfig.url = newUrl;
            SaveServiceConfig(g_currentConfig);
            std::wstring info;
            StartOrRestartController(g_currentConfig, &info);
            LogServiceMessage(L"Updated URL from tray: " + info);
        }
    } else if (cmd >= IDM_DECKLINK_BASE && cmd < IDM_DECKLINK_BASE + 20) {
        int selectedIndex = static_cast<int>(cmd - IDM_DECKLINK_BASE);
        g_currentConfig.deckLinkDeviceIndex = selectedIndex;
        g_currentConfig.useMockOutput = false;
        SaveServiceConfig(g_currentConfig);
        std::wstring info;
        StartOrRestartController(g_currentConfig, &info);
        LogServiceMessage(L"Switched to DeckLink Device " + std::to_wstring(selectedIndex) + L": " + info);
    } else if (cmd == IDM_MOCK_OUTPUT) {
        g_currentConfig.useMockOutput = true;
        SaveServiceConfig(g_currentConfig);
        std::wstring info;
        StartOrRestartController(g_currentConfig, &info);
        LogServiceMessage(L"Switched to Mock Output: " + info);
    } else if (cmd == IDM_OPEN_CONFIG) {
        ShellExecuteW(nullptr, L"open", GetConfigFilePath().c_str(), nullptr, nullptr, SW_SHOW);
    } else if (cmd == IDM_OPEN_LOG) {
        ShellExecuteW(nullptr, L"open", GetLogFilePath().c_str(), nullptr, nullptr, SW_SHOW);
    } else if (cmd == IDM_RESTART) {
        g_currentConfig = LoadServiceConfig();
        std::wstring info;
        StartOrRestartController(g_currentConfig, &info);
        LogServiceMessage(L"Manual restart: " + info);
    } else if (cmd == IDM_EXIT) {
        if (g_stopEvent) SetEvent(g_stopEvent);
        PostQuitMessage(0);
    }
}

LRESULT CALLBACK TrayWndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
    case WM_TRAYICON:
        if (lParam == WM_RBUTTONUP || lParam == WM_CONTEXTMENU) {
            ShowTrayContextMenu(hWnd);
        }
        return 0;

    case WM_DESTROY:
        Shell_NotifyIconW(NIM_DELETE, &g_nid);
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hWnd, msg, wParam, lParam);
}

void SetupSystemTrayIcon(HINSTANCE hInstance) {
    WNDCLASSW wc = {};
    wc.lpfnWndProc = TrayWndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = kTrayWndClass;
    RegisterClassW(&wc);

    g_hTrayWnd = CreateWindowW(kTrayWndClass, L"CeftoDecklinkTray", 0, 0, 0, 0, 0, nullptr, nullptr, hInstance, nullptr);
    if (!g_hTrayWnd) return;

    g_nid.cbSize = sizeof(NOTIFYICONDATAW);
    g_nid.hWnd = g_hTrayWnd;
    g_nid.uID = 1;
    g_nid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    g_nid.uCallbackMessage = WM_TRAYICON;
    g_nid.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
    wcscpy_s(g_nid.szTip, L"CeftoDecklink Service - Right-click for options");
    Shell_NotifyIconW(NIM_ADD, &g_nid);
}

DWORD WINAPI ServiceHandlerEx(DWORD control, DWORD, LPVOID, LPVOID) {
    switch (control) {
    case SERVICE_CONTROL_STOP:
    case SERVICE_CONTROL_SHUTDOWN:
        LogServiceMessage(L"Received service stop/shutdown request.");
        SetServiceState(SERVICE_STOP_PENDING, NO_ERROR, 5000);
        if (g_stopEvent) {
            SetEvent(g_stopEvent);
        }
        return NO_ERROR;

    case SERVICE_CONTROL_INTERROGATE:
        return NO_ERROR;

    default:
        return ERROR_CALL_NOT_IMPLEMENTED;
    }
}

void WINAPI ServiceMain(DWORD, LPWSTR*) {
    SetCurrentDirectoryToExe();
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);

    LogServiceMessage(L"ServiceMain starting...");

    g_statusHandle = RegisterServiceCtrlHandlerExW(kServiceName, ServiceHandlerEx, nullptr);
    if (!g_statusHandle) {
        LogServiceMessage(L"RegisterServiceCtrlHandlerExW failed.");
        CoUninitialize();
        return;
    }

    SetServiceState(SERVICE_START_PENDING, NO_ERROR, 5000);

    g_stopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!g_stopEvent) {
        LogServiceMessage(L"CreateEventW failed.");
        SetServiceState(SERVICE_STOPPED, GetLastError());
        CoUninitialize();
        return;
    }

    g_currentConfig = LoadServiceConfig();

    std::wstring startInfo;
    if (!StartOrRestartController(g_currentConfig, &startInfo)) {
        LogServiceMessage(startInfo);
        SetServiceState(SERVICE_STOPPED, ERROR_SERVICE_SPECIFIC_ERROR);
        CloseHandle(g_stopEvent);
        CoUninitialize();
        return;
    }

    LogServiceMessage(startInfo);
    SetServiceState(SERVICE_RUNNING);

    WaitForSingleObject(g_stopEvent, INFINITE);

    SetServiceState(SERVICE_STOP_PENDING, NO_ERROR, 3000);
    if (g_controller) {
        g_controller->Stop();
        g_controller.reset();
    }
    CloseHandle(g_stopEvent);
    g_stopEvent = nullptr;

    LogServiceMessage(L"Service stopped successfully.");
    SetServiceState(SERVICE_STOPPED);
    CoUninitialize();
}

int RunStandaloneConsole() {
    SetCurrentDirectoryToExe();
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);

    HINSTANCE hInstance = GetModuleHandleW(nullptr);
    SetupSystemTrayIcon(hInstance);

    if (!AttachConsole(ATTACH_PARENT_PROCESS)) {
        AllocConsole();
    }

    LogServiceMessage(L"Running CeftoDecklinkService in interactive / tray mode.");
    
    g_currentConfig = LoadServiceConfig();

    std::wstring startInfo;
    if (!StartOrRestartController(g_currentConfig, &startInfo)) {
        LogServiceMessage(L"Error starting controller: " + startInfo);
    } else {
        LogServiceMessage(startInfo);
    }

    LogServiceMessage(L"Service active. Right-click System Tray Icon (next to Windows Clock) to configure URL and DeckLink cards.");

    MSG msg = {};
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (g_controller) {
        g_controller->Stop();
        g_controller.reset();
    }
    CoUninitialize();
    return 0;
}

} // namespace
} // namespace ceftod

int APIENTRY wWinMain(HINSTANCE instance, HINSTANCE, LPWSTR, int) {
    ceftod::SetCurrentDirectoryToExe();

#if CEFTOD_WITH_CEF
    const CefMainArgs mainArgs(instance);
    const int cefExitCode = CefExecuteProcess(mainArgs, ceftod::CreateCefApplication(), nullptr);
    if (cefExitCode >= 0) {
        return cefExitCode;
    }
#endif

    SERVICE_TABLE_ENTRYW serviceTable[] = {
        {const_cast<LPWSTR>(ceftod::kServiceName), ceftod::ServiceMain},
        {nullptr, nullptr}
    };

    if (!StartServiceCtrlDispatcherW(serviceTable)) {
        const DWORD err = GetLastError();
        if (err == ERROR_FAILED_SERVICE_CONTROLLER_CONNECT) {
            // Ran interactively / manually by user
            return ceftod::RunStandaloneConsole();
        }
    }

#if CEFTOD_WITH_CEF
    ceftod::ShutdownCefForProcess();
#endif
    return 0;
}
