#pragma once

#include "core/RendererInterfaces.h"

#include <atomic>
#include <thread>

namespace ceftod {

class MockHtmlRenderer final : public IFrameSource {
public:
    ~MockHtmlRenderer() override;

    bool Start(const std::wstring& url, const VideoMode& mode, FrameCallback callback, std::wstring* error) override;
    void Stop() override;
    bool IsRunning() const override;
    std::wstring Name() const override;

private:
    void Run();

    std::atomic_bool running_{false};
    std::wstring url_;
    VideoMode mode_;
    FrameCallback callback_;
    std::thread worker_;
};

} // namespace ceftod
