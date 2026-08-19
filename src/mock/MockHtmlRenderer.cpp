#include "mock/MockHtmlRenderer.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

namespace ceftod {

MockHtmlRenderer::~MockHtmlRenderer() {
    Stop();
}

bool MockHtmlRenderer::Start(const std::wstring& url, const VideoMode& mode, FrameCallback callback, std::wstring*) {
    Stop();

    url_ = url;
    mode_ = mode;
    callback_ = std::move(callback);
    running_.store(true);

    worker_ = std::thread(&MockHtmlRenderer::Run, this);
    return true;
}

void MockHtmlRenderer::Stop() {
    running_.store(false);
    if (worker_.joinable()) {
        worker_.join();
    }
    callback_ = nullptr;
}

bool MockHtmlRenderer::IsRunning() const {
    return running_.load();
}

std::wstring MockHtmlRenderer::Name() const {
    return L"Mock HTML renderer";
}

void MockHtmlRenderer::Run() {
    const double fps = std::max(1.0, mode_.FramesPerSecond());
    const auto frameDuration = std::chrono::duration<double>(1.0 / fps);
    std::uint64_t sequence = 0;
    auto nextFrameTime = std::chrono::steady_clock::now();

    while (running_.load()) {
        auto frame = std::make_shared<FrameBuffer>();
        frame->width = mode_.width;
        frame->height = mode_.height;
        frame->strideBytes = mode_.width * 4;
        frame->sequence = sequence++;
        frame->timestamp = std::chrono::steady_clock::now();
        frame->bgra.resize(static_cast<std::size_t>(frame->strideBytes) * frame->height);

        const double phase = static_cast<double>(sequence % 100) / 100.0;
        const auto red = static_cast<std::uint8_t>(127.0 + 127.0 * std::sin(phase * 6.283185307179586));
        const auto blue = static_cast<std::uint8_t>(127.0 + 127.0 * std::cos(phase * 6.283185307179586));

        for (int y = 0; y < frame->height; ++y) {
            auto* row = frame->bgra.data() + (static_cast<std::size_t>(y) * frame->strideBytes);
            for (int x = 0; x < frame->width; ++x) {
                auto* pixel = row + (x * 4);
                pixel[0] = blue;
                pixel[1] = static_cast<std::uint8_t>((x * 255) / std::max(1, frame->width - 1));
                pixel[2] = red;
                pixel[3] = 255;
            }
        }

        if (callback_) {
            callback_(std::move(frame));
        }

        nextFrameTime += std::chrono::duration_cast<std::chrono::steady_clock::duration>(frameDuration);
        const auto now = std::chrono::steady_clock::now();
        if (nextFrameTime < now - std::chrono::milliseconds(200)) {
            nextFrameTime = now;
        }
        std::this_thread::sleep_until(nextFrameTime);
    }
}

} // namespace ceftod
