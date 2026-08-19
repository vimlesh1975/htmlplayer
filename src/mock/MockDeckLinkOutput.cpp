#include "mock/MockDeckLinkOutput.h"

namespace ceftod {

bool MockDeckLinkOutput::Start(const VideoMode& mode, bool mirrorOutput, int deckLinkDeviceIndex, std::wstring*) {
    std::lock_guard<std::mutex> lock(mutex_);
    mode_ = mode;
    mirrorOutput_ = mirrorOutput;
    deckLinkDeviceIndex_ = deckLinkDeviceIndex;
    stats_ = {};
    stats_.running = true;
    stats_.status = L"Mock output active";
    lastFpsAt_ = std::chrono::steady_clock::now();
    lastFpsFrameCount_ = 0;
    return true;
}

void MockDeckLinkOutput::Stop() {
    std::lock_guard<std::mutex> lock(mutex_);
    stats_.running = false;
    stats_.fps = 0.0;
    stats_.status = L"Ready";
}

bool MockDeckLinkOutput::SubmitFrame(std::shared_ptr<const FrameBuffer> frame) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!stats_.running || !frame) {
        ++stats_.framesDropped;
        return false;
    }

    ++stats_.framesSubmitted;
    UpdateFps();
    return true;
}

OutputStats MockDeckLinkOutput::GetStats() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return stats_;
}

std::wstring MockDeckLinkOutput::Name() const {
    return L"Mock DeckLink output";
}

void MockDeckLinkOutput::UpdateFps() {
    const auto now = std::chrono::steady_clock::now();
    const auto elapsed = std::chrono::duration<double>(now - lastFpsAt_).count();
    if (elapsed < 0.5) {
        return;
    }

    const auto deltaFrames = stats_.framesSubmitted - lastFpsFrameCount_;
    stats_.fps = static_cast<double>(deltaFrames) / elapsed;
    lastFpsFrameCount_ = stats_.framesSubmitted;
    lastFpsAt_ = now;
}

} // namespace ceftod
