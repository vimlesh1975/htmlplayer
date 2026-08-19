#include "decklink/DeckLinkDeviceEnumerator.h"

#include <iostream>
#include <objbase.h>

int wmain() {
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    const auto result = ceftod::EnumerateDeckLinkDevices();

    std::wcout << L"API Available: " << (result.apiAvailable ? L"Yes" : L"No") << L"\n";
    std::wcout << L"Status: " << result.status << L"\n";
    std::wcout << L"Device Count: " << result.devices.size() << L"\n\n";

    for (std::size_t i = 0; i < result.devices.size(); ++i) {
        const auto& device = result.devices[i];
        std::wcout << L"[" << i << L"] Display Name: " << device.displayName << L"\n";
        std::wcout << L"    Model Name:   " << device.modelName << L"\n";
    }

    CoUninitialize();
    return result.apiAvailable ? 0 : 1;
}
