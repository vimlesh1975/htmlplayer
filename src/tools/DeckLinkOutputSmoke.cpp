#include "core/RenderController.h"
#include "decklink/DeckLinkOutput.h"
#include "mock/MockHtmlRenderer.h"

#include <chrono>
#include <iostream>
#include <memory>
#include <thread>

#include <windows.h>
#include <objbase.h>

int wmain() {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);

    ceftod::RenderSettings settings;
    settings.url = L"mock://smoke-test";
    settings.mode = {L"1080p50 - 1920 x 1080 @ 50", 1920, 1080, 50, 1, false};
    settings.deckLinkDeviceIndex = 0;
    settings.mirrorOutput = false;
    settings.autoReconnect = false;

    auto controller = std::make_unique<ceftod::RenderController>(
        std::make_unique<ceftod::MockHtmlRenderer>(),
        ceftod::CreateDeckLinkOutput());

    std::wstring error;
    if (!controller->Start(settings, &error)) {
        std::wcerr << L"Smoke test start failed: " << (error.empty() ? L"Unknown error" : error) << L"\n";
        CoUninitialize();
        return 1;
    }

    std::wcout << L"Smoke test running for 5 seconds...\n";
    for (int i = 0; i < 10; ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
        const auto stats = controller->GetStats();
        std::wcout << L"FPS: " << stats.fps
                   << L" | Submitted: " << stats.framesSubmitted
                   << L" | Dropped: " << stats.framesDropped
                   << L" | Status: " << stats.status << L"\n";
    }

    controller->Stop();
    std::wcout << L"Smoke test finished.\n";

    CoUninitialize();
    return 0;
}
