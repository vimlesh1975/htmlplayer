#pragma once

#include <string>
#include <vector>

namespace ceftod {

struct DeckLinkDeviceInfo {
    std::wstring modelName;
    std::wstring displayName;
};

struct DeckLinkEnumerationResult {
    bool apiAvailable = false;
    std::wstring status;
    std::vector<DeckLinkDeviceInfo> devices;
};

DeckLinkEnumerationResult EnumerateDeckLinkDevices();

} // namespace ceftod
