#include "app/BackendFactory.h"
#include "core/RenderController.h"

#if CEFTOD_WITH_CEF
#include "cef/CefOffscreenRenderer.h"
#endif

#include <chrono>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include <windows.h>
#include <objbase.h>

namespace ceftod {
namespace {

constexpr wchar_t kServiceName[] = L"CeftoDecklinkService";

std::mutex g_serviceMutex;
SERVICE_STATUS g_serviceStatus = {};
SERVICE_STATUS_HANDLE g_statusHandle = nullptr;
HANDLE g_stopEvent = nullptr;

VideoMode Default1080pMode() {
    return {L"1080p50 - 1920 x 1080 @ 50", 1920, 1080, 50, 1, false};
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

DWORD WINAPI ServiceHandlerEx(DWORD control, DWORD, LPVOID, LPVOID) {
    switch (control) {
    case SERVICE_CONTROL_STOP:
    case SERVICE_CONTROL_SHUTDOWN:
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
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);

    g_statusHandle = RegisterServiceCtrlHandlerExW(kServiceName, ServiceHandlerEx, nullptr);
    if (!g_statusHandle) {
        CoUninitialize();
        return;
    }

    SetServiceState(SERVICE_START_PENDING, NO_ERROR, 5000);

    g_stopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!g_stopEvent) {
        SetServiceState(SERVICE_STOPPED, GetLastError());
        CoUninitialize();
        return;
    }

    ceftod::RenderSettings settings;
    settings.url = L"http://localhost:21000/";
    settings.mode = Default1080pMode();
    settings.deckLinkDeviceIndex = 0;
    settings.mirrorOutput = false;
    settings.autoReconnect = true;

    auto controller = std::make_unique<ceftod::RenderController>(CreateFrameSource(), CreateVideoOutput(true));
    std::wstring error;
    if (!controller->Start(settings, &error)) {
        SetServiceState(SERVICE_STOPPED, ERROR_SERVICE_SPECIFIC_ERROR);
        CloseHandle(g_stopEvent);
        CoUninitialize();
        return;
    }

    SetServiceState(SERVICE_RUNNING);

    WaitForSingleObject(g_stopEvent, INFINITE);

    SetServiceState(SERVICE_STOP_PENDING, NO_ERROR, 3000);
    controller->Stop();
    CloseHandle(g_stopEvent);
    g_stopEvent = nullptr;

    SetServiceState(SERVICE_STOPPED);
    CoUninitialize();
}

} // namespace
} // namespace ceftod

int APIENTRY wWinMain(HINSTANCE instance, HINSTANCE, LPWSTR, int) {
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

    const BOOL success = StartServiceCtrlDispatcherW(serviceTable);
#if CEFTOD_WITH_CEF
    ceftod::ShutdownCefForProcess();
#endif
    return success ? 0 : 1;
}
