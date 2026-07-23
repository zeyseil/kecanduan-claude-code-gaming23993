import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Comic } from "../types/comic";

const { isTauriMock, startInAppReadingMock, markReadingStartedMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(),
  startInAppReadingMock: vi.fn(),
  markReadingStartedMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: isTauriMock }));
vi.mock("./floatingReader", () => ({ startInAppReading: startInAppReadingMock }));
vi.mock("./readingSession", () => ({ markReadingStarted: markReadingStartedMock }));

import { launchReading } from "./openReading";

function comic(overrides: Partial<Comic> = {}): Comic {
  return {
    comic_id: "c1",
    title: "One Piece",
    aliases: [],
    type_tag: "manga",
    is_adult: false,
    latest_chapter: 1,
    status: "ongoing",
    cover_url: null,
    read_url: "https://comick.dev/x",
    release_day: null,
    note: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  isTauriMock.mockReset();
  startInAppReadingMock.mockReset();
  markReadingStartedMock.mockReset();
});

describe("launchReading", () => {
  it("does nothing when read_url is empty", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    isTauriMock.mockReturnValue(false);
    launchReading(comic({ read_url: null }));
    expect(openSpy).not.toHaveBeenCalled();
    expect(startInAppReadingMock).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("opens the in-app reader under Tauri", () => {
    isTauriMock.mockReturnValue(true);
    const c = comic();
    launchReading(c);
    expect(startInAppReadingMock).toHaveBeenCalledWith(c, "https://comick.dev/x");
  });

  it("marks the session and opens a new tab on the web", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    isTauriMock.mockReturnValue(false);
    launchReading(comic());
    expect(markReadingStartedMock).toHaveBeenCalledWith("c1");
    expect(openSpy).toHaveBeenCalledWith("https://comick.dev/x", "_blank", "noopener,noreferrer");
    expect(startInAppReadingMock).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
