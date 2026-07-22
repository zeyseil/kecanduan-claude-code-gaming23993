import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkImportPanel } from "./BulkImportPanel";
import * as comicsApi from "../lib/api/comics";

vi.mock("../lib/api/comics", async () => {
  const actual = await vi.importActual<typeof comicsApi>("../lib/api/comics");
  return { ...actual, bulkImportComics: vi.fn(), backfillCovers: vi.fn(), detectTypes: vi.fn() };
});

const bulkImportComicsMock = vi.mocked(comicsApi.bulkImportComics);
const backfillCoversMock = vi.mocked(comicsApi.backfillCovers);
const detectTypesMock = vi.mocked(comicsApi.detectTypes);

function fakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  bulkImportComicsMock.mockReset();
  backfillCoversMock.mockReset();
  detectTypesMock.mockReset();
  vi.stubGlobal("localStorage", fakeLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BulkImportPanel", () => {
  it("menampilkan preview dengan jumlah baris ok dan gagal, tanpa memanggil API", async () => {
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(
      screen.getByLabelText(/teks data historis/i),
      "Judul benar(manga):ch1\nbaris sampah",
    );
    await user.click(screen.getByRole("button", { name: /import data/i }));

    expect(
      await screen.findByText(/1 siap import, 0 perlu deteksi jenis, 1 baris gagal/i),
    ).toBeInTheDocument();
    expect(bulkImportComicsMock).not.toHaveBeenCalled();
  });

  it("mengimpor entri hasil parse lalu menampilkan ringkasan", async () => {
    bulkImportComicsMock.mockResolvedValue([
      { title: "Judul benar", action: "created", comic_id: "c-1" },
    ]);
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(screen.getByLabelText(/teks data historis/i), "Judul benar(manga):ch1");
    await user.click(screen.getByRole("button", { name: /import data/i }));
    await user.click(screen.getByRole("button", { name: /import 1 entri/i }));

    expect(await screen.findByText(/1 dibuat, 0 diupdate, 0 dilewati, 0 gagal/i)).toBeInTheDocument();
    expect(bulkImportComicsMock).toHaveBeenCalledWith([
      { title: "Judul benar", type_tag: "manga", is_adult: false, latest_chapter: 1, status: "ongoing", note: null },
    ]);
  });

  it("menawarkan ambil cover hanya kalau ada entri yang dibuat, lalu memanggil backfillCovers", async () => {
    bulkImportComicsMock.mockResolvedValue([
      { title: "Judul benar", action: "created", comic_id: "c-1" },
    ]);
    backfillCoversMock.mockResolvedValue([{ comic_id: "c-1", cover_url: "https://example.com/cover.jpg" }]);
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(screen.getByLabelText(/teks data historis/i), "Judul benar(manga):ch1");
    await user.click(screen.getByRole("button", { name: /import data/i }));
    await user.click(screen.getByRole("button", { name: /import 1 entri/i }));

    const coverButton = await screen.findByRole("button", { name: /ambil cover/i });
    await user.click(coverButton);

    expect(await screen.findByText(/cover selesai diambil/i)).toBeInTheDocument();
    expect(backfillCoversMock).toHaveBeenCalledWith(["c-1"]);
  });

  it("tidak menawarkan ambil cover kalau tidak ada entri yang dibuat (semua updated/skipped)", async () => {
    bulkImportComicsMock.mockResolvedValue([
      { title: "Judul benar", action: "skipped", comic_id: "c-1", reason: "sudah terbaru" },
    ]);
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(screen.getByLabelText(/teks data historis/i), "Judul benar(manga):ch1");
    await user.click(screen.getByRole("button", { name: /import data/i }));
    await user.click(screen.getByRole("button", { name: /import 1 entri/i }));

    expect(await screen.findByText(/0 dibuat, 0 diupdate, 1 dilewati, 0 gagal/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ambil cover/i })).not.toBeInTheDocument();
  });

  it("menampilkan pesan error kalau bulkImportComics gagal", async () => {
    bulkImportComicsMock.mockRejectedValue(new Error("Worker sedang down"));
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(screen.getByLabelText(/teks data historis/i), "Judul benar(manga):ch1");
    await user.click(screen.getByRole("button", { name: /import data/i }));
    await user.click(screen.getByRole("button", { name: /import 1 entri/i }));

    // Muncul dua kali: panel error di kolom kanan DAN entri baru di kartu Riwayat Impor.
    expect(await screen.findAllByText(/worker sedang down/i)).toHaveLength(2);
  });

  it("baris tanpa (jenis) masuk 'perlu deteksi', dan tombol import hanya menghitung yang siap", async () => {
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(
      screen.getByLabelText(/teks data historis/i),
      "Judul lengkap(manga):ch1\nJudul tanpa jenis:ch5",
    );
    await user.click(screen.getByRole("button", { name: /import data/i }));

    expect(
      await screen.findByText(/1 siap import, 1 perlu deteksi jenis, 0 baris gagal/i),
    ).toBeInTheDocument();
    // Tombol import hanya menghitung 1 yang siap, bukan 2.
    expect(screen.getByRole("button", { name: /import 1 entri/i })).toBeInTheDocument();
  });

  it("deteksi jenis mengisi type_tag, lalu entri itu ikut terhitung untuk import", async () => {
    detectTypesMock.mockResolvedValue([{ title: "Solo Leveling", type_tag: "manhwa" }]);
    bulkImportComicsMock.mockResolvedValue([
      { title: "Solo Leveling", action: "created", comic_id: "c-1" },
    ]);
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(screen.getByLabelText(/teks data historis/i), "Solo Leveling:ch179");
    await user.click(screen.getByRole("button", { name: /import data/i }));
    await user.click(screen.getByRole("button", { name: /deteksi jenis otomatis/i }));

    // Setelah deteksi, entri jadi siap import (1 siap, 0 perlu deteksi).
    expect(
      await screen.findByText(/1 siap import, 0 perlu deteksi jenis/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /import 1 entri/i }));
    expect(detectTypesMock).toHaveBeenCalledWith(["Solo Leveling"]);
    expect(bulkImportComicsMock).toHaveBeenCalledWith([
      {
        title: "Solo Leveling",
        type_tag: "manhwa",
        is_adult: false,
        latest_chapter: 179,
        status: "ongoing",
        note: null,
        cover_url: null,
        source_api: null,
      },
    ]);
  });

  it("meneruskan cover_url/source_api dari deteksi jenis, dan melewati tombol Ambil cover kalau semua sudah dapat cover", async () => {
    detectTypesMock.mockResolvedValue([
      { title: "Solo Leveling", type_tag: "manhwa", cover_url: "https://cdn/sl.jpg", source_api: "mangadex" },
    ]);
    bulkImportComicsMock.mockResolvedValue([
      { title: "Solo Leveling", action: "created", comic_id: "c-1", cover_url: "https://cdn/sl.jpg" },
    ]);
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(screen.getByLabelText(/teks data historis/i), "Solo Leveling:ch179");
    await user.click(screen.getByRole("button", { name: /import data/i }));
    await user.click(screen.getByRole("button", { name: /deteksi jenis otomatis/i }));
    await screen.findByText(/1 siap import, 0 perlu deteksi jenis/i);
    await user.click(screen.getByRole("button", { name: /import 1 entri/i }));

    expect(bulkImportComicsMock).toHaveBeenCalledWith([
      {
        title: "Solo Leveling",
        type_tag: "manhwa",
        is_adult: false,
        latest_chapter: 179,
        status: "ongoing",
        note: null,
        cover_url: "https://cdn/sl.jpg",
        source_api: "mangadex",
      },
    ]);
    expect(
      await screen.findByText(/semua 1 komik baru sudah dapat cover otomatis/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ambil cover/i })).not.toBeInTheDocument();
    expect(backfillCoversMock).not.toHaveBeenCalled();
  });

  it("judul yang gagal dideteksi tetap tidak bisa diimport (tidak ditebak)", async () => {
    detectTypesMock.mockResolvedValue([
      { title: "Judul Antah Berantah", type_tag: null, reason: "tidak ditemukan di MangaDex" },
    ]);
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(screen.getByLabelText(/teks data historis/i), "Judul Antah Berantah:ch1");
    await user.click(screen.getByRole("button", { name: /import data/i }));
    await user.click(screen.getByRole("button", { name: /deteksi jenis otomatis/i }));

    // Masih 0 siap import — tidak ada tebakan yang tersimpan.
    expect(await screen.findByText(/0 siap import/i)).toBeInTheDocument();
    expect(screen.getByText(/jenis tidak terdeteksi/i)).toBeInTheDocument();
  });

  it("tombol Default (RAW) mengisi textarea dengan contoh", async () => {
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.click(screen.getByRole("button", { name: /default \(raw\)/i }));

    expect(screen.getByLabelText(/teks data historis/i)).toHaveValue(
      "162. Judul komik(manga) : ch11\n172.Judul lain(2022)(manhwa):ch32",
    );
  });

  it("Hapus Baris Kosong membuang baris kosong dari textarea", async () => {
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    const textarea = screen.getByLabelText(/teks data historis/i);
    await user.type(textarea, "Judul benar(manga):ch1{Enter}{Enter}Judul lain(manga):ch2");
    await user.click(screen.getByRole("button", { name: /hapus baris kosong/i }));

    expect(textarea).toHaveValue("Judul benar(manga):ch1\nJudul lain(manga):ch2");
  });

  it("Validasi Format menampilkan ringkasan tanpa memicu deteksi/import", async () => {
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(
      screen.getByLabelText(/teks data historis/i),
      "Judul benar(manga):ch1\nbaris sampah",
    );
    await user.click(screen.getByRole("button", { name: /validasi format/i }));

    expect(await screen.findByText(/1 valid, 1 gagal/i)).toBeInTheDocument();
    // Masih di fase editing (bukan preview) — textarea tetap bisa diedit.
    expect(screen.getByLabelText(/teks data historis/i)).toBeInTheDocument();
    expect(bulkImportComicsMock).not.toHaveBeenCalled();
  });

  it("mencatat riwayat sukses setelah import selesai", async () => {
    bulkImportComicsMock.mockResolvedValue([
      { title: "Judul benar", action: "created", comic_id: "c-1" },
    ]);
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(screen.getByLabelText(/teks data historis/i), "Judul benar(manga):ch1");
    await user.click(screen.getByRole("button", { name: /import data/i }));
    await user.click(screen.getByRole("button", { name: /import 1 entri/i }));

    await screen.findByText(/1 dibuat, 0 diupdate, 0 dilewati, 0 gagal/i);
    // Muncul dua kali: ringkasan fase "done" DAN entri baru di kartu Riwayat Impor.
    expect(await screen.findAllByText(/1 dibuat, 0 diupdate/i)).toHaveLength(2);
  });

  it("mencatat riwayat gagal saat ada baris parsing error", async () => {
    const user = userEvent.setup();
    render(<BulkImportPanel />);

    await user.type(screen.getByLabelText(/teks data historis/i), "baris sampah");
    await user.click(screen.getByRole("button", { name: /import data/i }));

    expect(await screen.findByText(/parsing error baris 1/i)).toBeInTheDocument();
  });
});
