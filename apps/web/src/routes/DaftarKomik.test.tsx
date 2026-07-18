import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DaftarKomik } from "./DaftarKomik";
import * as api from "../lib/api/comics";
import type { Comic } from "../types/comic";

vi.mock("../lib/api/comics", async () => {
  const actual = await vi.importActual<typeof api>("../lib/api/comics");
  return {
    ...actual,
    fetchComics: vi.fn(),
    postComic: vi.fn(),
  };
});

const ONE_PIECE: Comic = {
  comic_id: "1",
  title: "One Piece",
  aliases: [],
  type_tag: "manga",
  is_adult: false,
  latest_chapter: 1120,
  status: "ongoing",
  cover_url: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const BERSERK: Comic = {
  comic_id: "2",
  title: "Berserk",
  aliases: [],
  type_tag: "manga",
  is_adult: true,
  latest_chapter: 364,
  status: "ongoing",
  cover_url: null,
  created_at: "2026-01-02T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const fetchComicsMock = vi.mocked(api.fetchComics);
const postComicMock = vi.mocked(api.postComic);

beforeEach(() => {
  fetchComicsMock.mockReset();
  postComicMock.mockReset();
});

describe("DaftarKomik", () => {
  it("menampilkan loading lalu list saat fetch berhasil", async () => {
    fetchComicsMock.mockResolvedValue([ONE_PIECE]);
    render(<DaftarKomik />);

    expect(screen.getByText("Memuat komik…")).toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));
  });

  it("menampilkan pesan error dan tombol coba lagi saat fetch gagal", async () => {
    fetchComicsMock.mockRejectedValue(new Error("Worker tidak merespons"));
    render(<DaftarKomik />);

    expect(await screen.findByText("Worker tidak merespons")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
  });

  it("menambah comic baru lewat form dan menampilkannya di grid", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([]);
    postComicMock.mockResolvedValue(BERSERK);
    render(<DaftarKomik />);

    await screen.findByText("Semua Komik");

    await user.click(screen.getByRole("button", { name: "+ Tambah Komik" }));
    await user.type(screen.getByLabelText("Nama"), "Berserk");
    await user.type(screen.getByLabelText("Chapter Terakhir Dibaca"), "364");
    await user.click(screen.getByRole("button", { name: "Tambah Komik" }));

    await waitFor(() => expect(postComicMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText("Berserk").length).toBeGreaterThan(0));
  });
});
