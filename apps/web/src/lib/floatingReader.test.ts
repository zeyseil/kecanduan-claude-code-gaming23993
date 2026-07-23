import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Comic } from "../types/comic";

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

function comic(overrides: Partial<Comic> = {}): Comic {
  return {
    comic_id: "comic-1",
    title: "One Piece",
    aliases: [],
    type_tag: "manga",
    is_adult: false,
    latest_chapter: 1120,
    status: "ongoing",
    cover_url: null,
    read_url: "https://example.com/read/one-piece",
    release_day: null,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("openOrFocusFloatingReader", () => {
  beforeEach(() => {
    getByLabelMock.mockReset();
    webviewWindowCtorMock.mockReset();
    emitMock.mockReset();
    getAuthTokenMock.mockReset();
    getAuthTokenMock.mockReturnValue("test-token");
  });

  it("creates a new always-on-top window with comic data in the URL, so it can render without its own fetch", async () => {
    getByLabelMock.mockResolvedValue(null);
    await openOrFocusFloatingReader(comic({ comic_id: "comic-1", title: "One Piece", latest_chapter: 1120 }));

    expect(webviewWindowCtorMock).toHaveBeenCalledTimes(1);
    const [label, options] = webviewWindowCtorMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(label).toBe(FLOATING_READER_LABEL);
    expect(options.alwaysOnTop).toBe(true);
    expect(options.resizable).toBe(false);
    expect(String(options.url)).toContain("comicId=comic-1");
    expect(String(options.url)).toContain("title=One+Piece");
    expect(String(options.url)).toContain("latestChapter=1120");
    expect(String(options.url)).toContain("token=test-token");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("reuses an existing window: emits the new comic's data and focuses instead of creating a duplicate", async () => {
    const setFocus = vi.fn().mockResolvedValue(undefined);
    getByLabelMock.mockResolvedValue({ setFocus });

    await openOrFocusFloatingReader(comic({ comic_id: "comic-2", title: "Naruto", latest_chapter: 700 }));

    expect(webviewWindowCtorMock).not.toHaveBeenCalled();
    expect(emitMock).toHaveBeenCalledWith(FLOATING_READER_SET_COMIC_EVENT, {
      comicId: "comic-2",
      title: "Naruto",
      latestChapter: 700,
    });
    expect(setFocus).toHaveBeenCalledTimes(1);
  });
});
