import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DaftarKomik } from "./DaftarKomik";
import * as api from "../lib/api/comics";
import type { Comic } from "../types/comic";
import { markReadingStarted } from "../lib/readingSession";

/** Simulasikan tab kembali terlihat (dipicu HeroBanner via markReadingStarted). */
function simulateTabVisible() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

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
  read_url: null,
  release_day: null,
  note: null,
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
  read_url: null,
  release_day: null,
  note: null,
  created_at: "2026-01-02T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

/** Judul komik bisa muncul berkali-kali (hero/sidebar/grid) — scope ke grid saja. */
function gridTitle(title: string): HTMLElement {
  return within(screen.getByTestId("comic-grid")).getByText(title);
}

const fetchComicsMock = vi.mocked(api.fetchComics);
const postComicMock = vi.mocked(api.postComic);
const patchComicMock = vi.mocked(api.patchComic);
const deleteComicMock = vi.mocked(api.deleteComic);
const bulkDeleteComicsMock = vi.mocked(api.bulkDeleteComics);

/** Stub localStorage per test (pola storage.test.ts) supaya cache komik
 * (lib/comicCache.ts) deterministik dan tidak bocor antar test. */
function makeFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeFakeStorage());
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

    expect(screen.getAllByTestId("skeleton-grid").length).toBeGreaterThan(0);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));
  });

  it("merender data cache seketika tanpa skeleton, lalu diganti hasil fetch (stale-while-revalidate)", async () => {
    globalThis.localStorage.setItem("komik-tracker:comics-cache", JSON.stringify([ONE_PIECE]));
    fetchComicsMock.mockResolvedValue([ONE_PIECE, BERSERK]);
    render(<DaftarKomik />);

    // Data cache langsung tampil — tidak ada skeleton sama sekali.
    expect(screen.queryByTestId("skeleton-grid")).toBeNull();
    expect(gridTitle("One Piece")).toBeInTheDocument();

    // Hasil server menggantikan cache diam-diam.
    await waitFor(() => expect(gridTitle("Berserk")).toBeInTheDocument());
  });

  it("refresh background yang gagal membiarkan data cache tetap tampil (bukan layar error)", async () => {
    globalThis.localStorage.setItem("komik-tracker:comics-cache", JSON.stringify([ONE_PIECE]));
    fetchComicsMock.mockRejectedValue(new Error("Worker tidak merespons"));
    render(<DaftarKomik />);

    expect(gridTitle("One Piece")).toBeInTheDocument();
    await waitFor(() => expect(fetchComicsMock).toHaveBeenCalled());
    expect(screen.queryByText("Worker tidak merespons")).toBeNull();
    expect(gridTitle("One Piece")).toBeInTheDocument();
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

    await user.click(gridTitle("One Piece"));
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

  it("toggle status komik lewat tombol di card tanpa membuka modal", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE]);
    patchComicMock.mockResolvedValue({ ...ONE_PIECE, status: "completed" });
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    await user.click(gridTitle("One Piece"));
    await user.click(screen.getByRole("button", { name: `Tandai ${ONE_PIECE.title} sebagai tamat` }));

    await waitFor(() =>
      expect(patchComicMock).toHaveBeenCalledWith("1", { status: "completed" }),
    );
    await waitFor(() => expect(gridTitle("One Piece")).toBeInTheDocument());
    expect(screen.queryByText(`Edit Komik — ${ONE_PIECE.title}`)).not.toBeInTheDocument();
  });

  it("menampilkan prompt lanjut baca saat tab kembali terlihat setelah markReadingStarted", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE]);
    patchComicMock.mockResolvedValue({ ...ONE_PIECE, latest_chapter: 1121 });
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    markReadingStarted(ONE_PIECE.comic_id);
    simulateTabVisible();

    expect(await screen.findByText("Selesai baca?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() =>
      expect(patchComicMock).toHaveBeenCalledWith("1", { latest_chapter: 1121 }),
    );
    expect(screen.queryByText("Selesai baca?")).not.toBeInTheDocument();
  });

  it("prompt lanjut baca tidak muncul lagi setelah dismiss tanpa sesi baru", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE]);
    render(<DaftarKomik />);
    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    markReadingStarted(ONE_PIECE.comic_id);
    simulateTabVisible();
    expect(await screen.findByText("Selesai baca?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Belum selesai" }));
    expect(screen.queryByText("Selesai baca?")).not.toBeInTheDocument();

    simulateTabVisible();
    expect(screen.queryByText("Selesai baca?")).not.toBeInTheDocument();
  });

  it("membuka search palette lewat tombol dan memilih hasil membuka modal edit", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE, BERSERK]);
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: /cari judul/i }));
    await user.type(screen.getByLabelText("Cari judul komik"), "berserk");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /berserk/i }),
    );

    expect(await screen.findByText(`Edit Komik — ${BERSERK.title}`)).toBeInTheDocument();
  });

  it("menghapus comic lewat modal edit setelah konfirmasi", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE]);
    deleteComicMock.mockResolvedValue(undefined);
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    await user.click(gridTitle("One Piece"));
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
    await user.click(gridTitle("One Piece"));
    await user.click(gridTitle("Berserk"));

    expect(screen.getByText("2 dipilih")).toBeInTheDocument();

    // Buka konfirmasi lalu konfirmasi.
    await user.click(screen.getByRole("button", { name: "Hapus 2 komik" }));
    await user.click(screen.getByRole("button", { name: "Ya, hapus 2 komik" }));

    await waitFor(() =>
      expect(bulkDeleteComicsMock).toHaveBeenCalledWith(expect.arrayContaining(["1", "2"])),
    );
    await waitFor(() => expect(screen.queryByText("Berserk")).not.toBeInTheDocument());
  });

  it("bulk-delete >25 komik dipecah jadi beberapa request tanpa perlu pilih ulang", async () => {
    const user = userEvent.setup();
    const many: Comic[] = Array.from({ length: 30 }, (_, i) => ({
      ...ONE_PIECE,
      comic_id: `c${i}`,
      title: `Komik ${i}`,
      is_adult: false,
    }));
    fetchComicsMock.mockResolvedValue(many);
    bulkDeleteComicsMock.mockImplementation(async (ids: string[]) =>
      ids.map((id) => ({ comic_id: id, deleted: true })),
    );
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("Komik 0").length).toBeGreaterThan(0));

    await user.click(screen.getByRole("button", { name: "Pilih" }));
    await user.click(screen.getByRole("button", { name: "Pilih semua" }));
    expect(screen.getByText("30 dipilih")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hapus 30 komik" }));
    await user.click(screen.getByRole("button", { name: "Ya, hapus 30 komik" }));

    // 30 dipecah jadi 2 request (25 + 5).
    await waitFor(() => expect(bulkDeleteComicsMock).toHaveBeenCalledTimes(2));
    expect(bulkDeleteComicsMock.mock.calls[0][0]).toHaveLength(25);
    expect(bulkDeleteComicsMock.mock.calls[1][0]).toHaveLength(5);
    await waitFor(() =>
      expect(screen.getByText("Tidak ada komik yang cocok.")).toBeInTheDocument(),
    );
  });

  it("Mode Aman: default ON menyensor cover 18+, toggle OFF membukanya", async () => {
    const user = userEvent.setup();
    fetchComicsMock.mockResolvedValue([ONE_PIECE, BERSERK]);
    render(<DaftarKomik />);

    await waitFor(() => expect(screen.getAllByText("One Piece").length).toBeGreaterThan(0));

    // Default ON → cover Berserk (is_adult) tersensor.
    expect(screen.getAllByTestId("nsfw-overlay").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Mode Aman/ }));

    // OFF → tidak ada sensor lagi.
    expect(screen.queryByTestId("nsfw-overlay")).toBeNull();
  });
});
