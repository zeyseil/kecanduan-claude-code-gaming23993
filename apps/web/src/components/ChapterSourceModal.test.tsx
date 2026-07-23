import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChapterSourceModal } from "./ChapterSourceModal";
import * as comicsApi from "../lib/api/comics";

vi.mock("../lib/api/comics", async () => {
  const actual = await vi.importActual<typeof comicsApi>("../lib/api/comics");
  return { ...actual, fetchNextChapterReadUrl: vi.fn() };
});

const fetchMock = vi.mocked(comicsApi.fetchNextChapterReadUrl);

beforeEach(() => fetchMock.mockReset());

describe("ChapterSourceModal", () => {
  it("menampilkan semua layanan", () => {
    render(<ChapterSourceModal title="Solo Leveling" afterChapter={200} onResult={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "comick.dev" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MangaDex" })).toBeInTheDocument();
  });

  it("menampilkan judul comic sebagai konteks di header", () => {
    render(<ChapterSourceModal title="Solo Leveling" afterChapter={200} onResult={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("untuk: Solo Leveling")).toBeInTheDocument();
  });

  it("memanggil onResult dengan read_url saat sukses", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    fetchMock.mockResolvedValue({ read_url: "https://mangadex.org/chapter/x" });
    render(<ChapterSourceModal title="Solo Leveling" afterChapter={200} onResult={onResult} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "MangaDex" }));

    expect(fetchMock).toHaveBeenCalledWith("Solo Leveling", 200, "mangadex");
    await vi.waitFor(() =>
      expect(onResult).toHaveBeenCalledWith("https://mangadex.org/chapter/x"),
    );
  });

  it("menampilkan reason saat tidak ditemukan", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ read_url: null, reason: "Komik tidak ditemukan di comick.dev" });
    render(<ChapterSourceModal title="Solo Leveling" afterChapter={200} onResult={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "comick.dev" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Komik tidak ditemukan di comick.dev");
  });
});
