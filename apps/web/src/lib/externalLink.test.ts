import { describe, expect, it, vi, beforeEach } from "vitest";

const { isTauriMock, openMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(),
  openMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: isTauriMock }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: openMock }));

import { handleExternalLinkClick } from "./externalLink";

function fakeEvent() {
  return { preventDefault: vi.fn() } as unknown as React.MouseEvent<HTMLAnchorElement>;
}

describe("handleExternalLinkClick", () => {
  beforeEach(() => {
    isTauriMock.mockReset();
    openMock.mockReset();
  });

  it("no-op di luar Tauri — tidak preventDefault, tidak panggil shell.open", () => {
    isTauriMock.mockReturnValue(false);
    const event = fakeEvent();
    handleExternalLinkClick("https://example.com", event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(openMock).not.toHaveBeenCalled();
  });

  it("di dalam Tauri — preventDefault lalu buka via shell.open", () => {
    isTauriMock.mockReturnValue(true);
    const event = fakeEvent();
    handleExternalLinkClick("https://example.com", event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith("https://example.com");
  });
});
