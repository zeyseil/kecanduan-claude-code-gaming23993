import { describe, expect, it, vi, beforeEach } from "vitest";

const { isTauriMock, openUrlMock, isNativePlatformMock, browserOpenMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(),
  openUrlMock: vi.fn(),
  isNativePlatformMock: vi.fn(),
  browserOpenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: isTauriMock }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: openUrlMock }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));
vi.mock("@capacitor/browser", () => ({ Browser: { open: browserOpenMock } }));

import { handleExternalLinkClick } from "./externalLink";

function fakeEvent() {
  return { preventDefault: vi.fn() } as unknown as React.MouseEvent<HTMLAnchorElement>;
}

describe("handleExternalLinkClick", () => {
  beforeEach(() => {
    isTauriMock.mockReset().mockReturnValue(false);
    openUrlMock.mockReset();
    isNativePlatformMock.mockReset().mockReturnValue(false);
    browserOpenMock.mockReset();
  });

  it("no-op di browser biasa — tidak preventDefault, tidak panggil openUrl/Browser.open", () => {
    const event = fakeEvent();
    handleExternalLinkClick("https://example.com", event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(openUrlMock).not.toHaveBeenCalled();
    expect(browserOpenMock).not.toHaveBeenCalled();
  });

  it("di dalam Tauri — preventDefault lalu buka via openUrl", () => {
    isTauriMock.mockReturnValue(true);
    const event = fakeEvent();
    handleExternalLinkClick("https://example.com", event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com");
    expect(browserOpenMock).not.toHaveBeenCalled();
  });

  it("di dalam Capacitor (Android) — preventDefault lalu buka in-app Custom Tab", () => {
    isNativePlatformMock.mockReturnValue(true);
    const event = fakeEvent();
    handleExternalLinkClick("https://example.com", event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(browserOpenMock).toHaveBeenCalledWith({ url: "https://example.com" });
    expect(openUrlMock).not.toHaveBeenCalled();
  });
});
