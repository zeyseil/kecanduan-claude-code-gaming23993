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
    patchComic: vi.fn(),
    deleteComic: vi.fn(),
    bulkDeleteComics: vi.fn(),
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
const patchComicMock = vi.mocked(api.patchComic);
const deleteComicMock = vi.mocked(api.deleteComic);
const bulkDeleteComicsMock = vi.mocked(api.bulkDeleteComics);

beforeEach(() => {
  fetchComicsMock.mockReset();
  postComicMock.mockReset();
  patchComicMock.mockReset();
  deleteComicMock.mockReset();
  bulkDeleteComicsMock.mockReset();
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

  it("membuka modal edit lewat card, menyimpan perubahan, dan menampilkan hasilnya di grid", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE]);
    patchComicMock.mockResolvedValue({ ...ONE_PIECE, latest_chapter: 1121 });
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    const titleElements = screen.getAllByText("One Piece");
    await user.click(titleElements[titleElements.length - 1]);
    await user.click(screen.getByRole("button", { name: `Edit ${ONE_PIECE.title}` }));

    expect(await screen.findByText(`Edit Komik — ${ONE_PIECE.title}`)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Chapter Terakhir Dibaca"));
    await user.type(screen.getByLabelText("Chapter Terakhir Dibaca"), "1121");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(patchComicMock).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ latest_chapter: 1121 }),
      ),
    );
    await waitFor(() => expect(screen.getAllByText(/Ch 1121/).length).toBeGreaterThan(0));
  });

  it("membuka search palette lewat tombol dan memilih hasil membuka modal edit", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE, BERSERK]);
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: /cari judul/i }));
    await user.type(screen.getByLabelText("Cari judul komik"), "berserk");
    await user.click(screen.getByRole("button", { name: /berserk/i }));

    expect(await screen.findByText(`Edit Komik — ${BERSERK.title}`)).toBeInTheDocument();
  });

  it("menghapus comic lewat modal edit setelah konfirmasi", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE]);
    deleteComicMock.mockResolvedValue(undefined);
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    const titleElements = screen.getAllByText("One Piece");
    await user.click(titleElements[titleElements.length - 1]);
    await user.click(screen.getByRole("button", { name: `Edit ${ONE_PIECE.title}` }));
    await screen.findByText(`Edit Komik — ${ONE_PIECE.title}`);

    await user.click(screen.getByRole("button", { name: "Hapus" }));
    await user.click(screen.getByRole("button", { name: "Ya, hapus" }));

    await waitFor(() => expect(deleteComicMock).toHaveBeenCalledWith("1"));
    await waitFor(() => expect(screen.queryByText("One Piece")).not.toBeInTheDocument());
  });

  it("bulk-delete: pilih beberapa komik, konfirmasi, lalu hilang dari grid", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE, BERSERK]);
    bulkDeleteComicsMock.mockResolvedValue([
      { comic_id: "1", deleted: true },
      { comic_id: "2", deleted: true },
    ]);
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    // Masuk mode pilih.
    await user.click(screen.getByRole("button", { name: "Pilih" }));

    // Pilih kedua komik dari grid (klik judul di dalam card).
    const opTitles = screen.getAllByText("One Piece");
    await user.click(opTitles[opTitles.length - 1]);
    const bkTitles = screen.getAllByText("Berserk");
    await user.click(bkTitles[bkTitles.length - 1]);

    expect(screen.getByText("2 dipilih")).toBeInTheDocument();

    // Buka konfirmasi lalu konfirmasi.
    await user.click(screen.getByRole("button", { name: "Hapus 2 komik" }));
    await user.click(screen.getByRole("button", { name: "Ya, hapus 2 komik" }));

    await waitFor(() =>
      expect(bulkDeleteComicsMock).toHaveBeenCalledWith(expect.arrayContaining(["1", "2"])),
    );
    await waitFor(() => expect(screen.queryByText("Berserk")).not.toBeInTheDocument());
  });
});
