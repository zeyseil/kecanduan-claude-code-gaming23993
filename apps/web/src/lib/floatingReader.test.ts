import { describe, expect, it, vi, beforeEach } from "vitest";

const { getByLabelMock, webviewWindowCtorMock, emitMock, getAuthTokenMock } = vi.hoisted(() => ({
  getByLabelMock: vi.fn(),
  webviewWindowCtorMock: vi.fn(),
  emitMock: vi.fn(),
  getAuthTokenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: Object.assign(
    function WebviewWindow(this: unknown, ...args: unknown[]) {
      webviewWindowCtorMock(...args);
    },
    { getByLabel: getByLabelMock },
  ),
}));
vi.mock("@tauri-apps/api/event", () => ({ emit: emitMock }));
vi.mock("./storage", () => ({ getAuthToken: getAuthTokenMock }));

import { openOrFocusFloatingReader, FLOATING_READER_LABEL, FLOATING_READER_SET_COMIC_EVENT } from "./floatingReader";

describe("openOrFocusFloatingReader", () => {
  beforeEach(() => {
    getByLabelMock.mockReset();
    webviewWindowCtorMock.mockReset();
    emitMock.mockReset();
    getAuthTokenMock.mockReset();
    getAuthTokenMock.mockReturnValue("test-token");
  });

  it("creates a new always-on-top window when none exists yet", async () => {
    getByLabelMock.mockResolvedValue(null);
    await openOrFocusFloatingReader("comic-1");

    expect(webviewWindowCtorMock).toHaveBeenCalledTimes(1);
    const [label, options] = webviewWindowCtorMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(label).toBe(FLOATING_READER_LABEL);
    expect(options.alwaysOnTop).toBe(true);
    expect(options.resizable).toBe(false);
    expect(String(options.url)).toContain("comicId=comic-1");
    expect(String(options.url)).toContain("token=test-token");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("reuses an existing window: emits the new comicId and focuses instead of creating a duplicate", async () => {
    const setFocus = vi.fn().mockResolvedValue(undefined);
    getByLabelMock.mockResolvedValue({ setFocus });

    await openOrFocusFloatingReader("comic-2");

    expect(webviewWindowCtorMock).not.toHaveBeenCalled();
    expect(emitMock).toHaveBeenCalledWith(FLOATING_READER_SET_COMIC_EVENT, { comicId: "comic-2" });
    expect(setFocus).toHaveBeenCalledTimes(1);
  });
});
