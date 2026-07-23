import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Comic } from "../types/comic";

const { patchComicMock, emitMock, listenMock, getByLabelMock, setAuthTokenMock } = vi.hoisted(() => ({
  patchComicMock: vi.fn(),
  emitMock: vi.fn(),
  listenMock: vi.fn(),
  getByLabelMock: vi.fn(),
  setAuthTokenMock: vi.fn(),
}));

vi.mock("../lib/api/comics", async () => {
  const actual = await vi.importActual<typeof import("../lib/api/comics")>("../lib/api/comics");
  return { ...actual, patchComic: patchComicMock };
});
vi.mock("../lib/storage", async () => {
  const actual = await vi.importActual<typeof import("../lib/storage")>("../lib/storage");
  return { ...actual, setAuthToken: setAuthTokenMock };
});
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: { getByLabel: getByLabelMock },
}));
vi.mock("@tauri-apps/api/event", () => ({ emit: emitMock, listen: listenMock }));

import { FloatingReader } from "./FloatingReader";

function renderAt(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/floating-reader?${query}`]}>
      <FloatingReader />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  patchComicMock.mockReset();
  emitMock.mockReset();
  listenMock.mockReset().mockResolvedValue(() => {});
  getByLabelMock.mockReset();
  setAuthTokenMock.mockReset();
});

describe("FloatingReader", () => {
  it("renders title/chapter immediately from query params, without fetching", () => {
    renderAt("comicId=1&title=One+Piece&latestChapter=1120");
    expect(screen.getByText("One Piece")).toBeInTheDocument();
    expect(screen.getByText("Chapter 1120")).toBeInTheDocument();
  });

  it("stores the token from query string into localStorage as a fallback", () => {
    renderAt("comicId=1&title=One+Piece&latestChapter=1120&token=abc123");
    expect(setAuthTokenMock).toHaveBeenCalledWith("abc123");
  });

  it("shows a message instead of crashing when comicId is missing", () => {
    renderAt("");
    expect(screen.getByText("Data komik tidak lengkap.")).toBeInTheDocument();
  });

  it("'Kembali ke App' focuses the main window without closing itself", async () => {
    const show = vi.fn().mockResolvedValue(undefined);
    const setFocus = vi.fn().mockResolvedValue(undefined);
    getByLabelMock.mockResolvedValue({ show, setFocus });
    const user = userEvent.setup();
    renderAt("comicId=1&title=One+Piece&latestChapter=1120");

    await user.click(screen.getByRole("button", { name: "Kembali ke App" }));

    expect(getByLabelMock).toHaveBeenCalledWith("main");
    expect(show).toHaveBeenCalledTimes(1);
    expect(setFocus).toHaveBeenCalledTimes(1);
  });

  it("'Update Chapter' opens the inline form, submits patchComic, and emits comic-updated", async () => {
    const updated: Comic = {
      comic_id: "1",
      title: "One Piece",
      aliases: [],
      type_tag: "manga",
      is_adult: false,
      latest_chapter: 1121,
      status: "ongoing",
      cover_url: null,
      read_url: null,
      release_day: null,
      note: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    patchComicMock.mockResolvedValue(updated);
    const user = userEvent.setup();
    renderAt("comicId=1&title=One+Piece&latestChapter=1120");

    await user.click(screen.getByRole("button", { name: "Update Chapter" }));
    await user.click(screen.getByRole("button", { name: "Update" }));

    expect(patchComicMock).toHaveBeenCalledWith("1", { latest_chapter: 1121 });
    expect(emitMock).toHaveBeenCalledWith("komik-tracker://comic-updated", updated);
    expect(await screen.findByText("Chapter 1121")).toBeInTheDocument();
  });
});
