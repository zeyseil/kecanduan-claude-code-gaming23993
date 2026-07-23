import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditComicForm } from "./EditComicForm";
import type { Comic } from "../types/comic";
import * as comicsApi from "../lib/api/comics";

vi.mock("../lib/api/comics", async () => {
  const actual = await vi.importActual<typeof comicsApi>("../lib/api/comics");
  return { ...actual, detectTypes: vi.fn(), fetchNextChapterReadUrl: vi.fn() };
});

const detectTypesMock = vi.mocked(comicsApi.detectTypes);
const fetchNextChapterReadUrlMock = vi.mocked(comicsApi.fetchNextChapterReadUrl);

beforeEach(() => {
  detectTypesMock.mockReset();
  fetchNextChapterReadUrlMock.mockReset();
});

const COMIC: Comic = {
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

describe("EditComicForm", () => {
  it("menampilkan nilai comic saat ini sebagai default", () => {
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Nama")).toHaveValue("One Piece");
    expect(screen.getByLabelText("Chapter Terakhir Dibaca")).toHaveValue(1120);
  });

  it("menampilkan error dan tidak memanggil onSubmit saat nama kosong", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EditComicForm comic={COMIC} onSubmit={onSubmit} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText("Nama"));
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nama komik wajib diisi.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("memanggil onSubmit dengan payload lengkap saat valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<EditComicForm comic={COMIC} onSubmit={onSubmit} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText("Chapter Terakhir Dibaca"));
    await user.type(screen.getByLabelText("Chapter Terakhir Dibaca"), "1121");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "One Piece",
      type_tag: "manga",
      is_adult: false,
      latest_chapter: 1121,
      cover_url: null,
      read_url: null,
      release_day: null,
      note: null,
    });
  });

  it("memanggil onCancel saat tombol Batal ditekan", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("menampilkan konfirmasi saat klik Hapus, dan memanggil onDelete setelah konfirmasi", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={onDelete} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Hapus" }));
    expect(screen.getByText('Yakin hapus "One Piece"?')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Ya, hapus" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("kembali ke form biasa saat Batal ditekan di layar konfirmasi hapus", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={onDelete} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Hapus" }));
    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(screen.getByLabelText("Nama")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("menampilkan tombol coba ambil cover otomatis hanya saat cover kosong", () => {
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /coba ambil cover otomatis/i })).toBeInTheDocument();
  });

  it("menyembunyikan tombol coba ambil cover otomatis saat comic sudah punya cover", () => {
    render(
      <EditComicForm
        comic={{ ...COMIC, cover_url: "https://example.com/cover.jpg" }}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /coba ambil cover otomatis/i }),
    ).not.toBeInTheDocument();
  });

  it("mengisi cover dan menyembunyikan tombol setelah berhasil ambil cover", async () => {
    detectTypesMock.mockResolvedValue([
      { title: "One Piece", type_tag: "manga", cover_url: "https://example.com/cover.jpg" },
    ]);
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /coba ambil cover otomatis/i }));

    expect(detectTypesMock).toHaveBeenCalledWith(["One Piece"]);
    expect(
      await screen.findByRole("img", { name: /cover/i }),
    ).toHaveAttribute("src", "https://example.com/cover.jpg");
    expect(
      screen.queryByRole("button", { name: /coba ambil cover otomatis/i }),
    ).not.toBeInTheDocument();
  });

  it("mencari cover pakai judul yang baru diketik di field Nama, bukan judul tersimpan (belum tekan Simpan)", async () => {
    detectTypesMock.mockResolvedValue([
      { title: "Judul Baru", type_tag: "manga", cover_url: "https://example.com/baru.jpg" },
    ]);
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText("Nama"));
    await user.type(screen.getByLabelText("Nama"), "Judul Baru");
    await user.click(screen.getByRole("button", { name: /coba ambil cover otomatis/i }));

    expect(detectTypesMock).toHaveBeenCalledWith(["Judul Baru"]);
    expect(
      await screen.findByRole("img", { name: /cover/i }),
    ).toHaveAttribute("src", "https://example.com/baru.jpg");
  });

  it("menonaktifkan tombol coba ambil cover otomatis saat Nama kosong", async () => {
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText("Nama"));

    expect(screen.getByRole("button", { name: /coba ambil cover otomatis/i })).toBeDisabled();
    expect(detectTypesMock).not.toHaveBeenCalled();
  });

  it("menampilkan reason saat cover tidak ditemukan, tombol tetap tampil", async () => {
    detectTypesMock.mockResolvedValue([
      { title: "One Piece", type_tag: null, cover_url: null, reason: "tidak ditemukan di sumber manapun" },
    ]);
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /coba ambil cover otomatis/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/tidak ditemukan di sumber manapun/i);
    expect(screen.getByRole("button", { name: /coba ambil cover otomatis/i })).toBeInTheDocument();
  });

  it("menghapus cover yang ada lewat tombol Hapus cover, lalu tombol coba ambil otomatis muncul lagi", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <EditComicForm
        comic={{ ...COMIC, cover_url: "https://example.com/cover.jpg" }}
        onSubmit={onSubmit}
        onDelete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: /cover/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /coba ambil cover otomatis/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /hapus cover/i }));

    expect(screen.queryByRole("img", { name: /cover/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /coba ambil cover otomatis/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Simpan" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cover_url: null }));
  });

  it("menampilkan pesan error saat detectTypes gagal (network/exception)", async () => {
    detectTypesMock.mockRejectedValue(new Error("Worker sedang down"));
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /coba ambil cover otomatis/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Worker sedang down");
  });

  it("tombol 'Cari link chapter berikutnya' selalu tampil, meski read_url sudah terisi", () => {
    render(
      <EditComicForm
        comic={{ ...COMIC, read_url: "https://comick.dev/comic/x/y-chapter-1-en" }}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /cari link chapter berikutnya/i })).toBeInTheDocument();
  });

  it("tombol membuka modal pemilih layanan, lalu memilih layanan mengisi Link Baca tanpa auto-save", async () => {
    fetchNextChapterReadUrlMock.mockResolvedValue({
      read_url: "https://comick.dev/comic/one-piece/abc-chapter-1121-en",
    });
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EditComicForm comic={COMIC} onSubmit={onSubmit} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /cari link chapter berikutnya/i }));
    // Modal muncul dengan pilihan layanan.
    await user.click(screen.getByRole("button", { name: "comick.dev" }));

    expect(fetchNextChapterReadUrlMock).toHaveBeenCalledWith(COMIC.comic_id, "comick");
    expect(await screen.findByLabelText(/link baca/i)).toHaveValue(
      "https://comick.dev/comic/one-piece/abc-chapter-1121-en",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("bisa memilih MangaDex sebagai layanan", async () => {
    fetchNextChapterReadUrlMock.mockResolvedValue({
      read_url: "https://mangadex.org/chapter/xyz",
    });
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /cari link chapter berikutnya/i }));
    await user.click(screen.getByRole("button", { name: "MangaDex" }));

    expect(fetchNextChapterReadUrlMock).toHaveBeenCalledWith(COMIC.comic_id, "mangadex");
    expect(await screen.findByLabelText(/link baca/i)).toHaveValue("https://mangadex.org/chapter/xyz");
  });

  it("menampilkan reason di modal saat chapter berikutnya tidak ditemukan", async () => {
    fetchNextChapterReadUrlMock.mockResolvedValue({
      read_url: null,
      reason: "Chapter berikutnya tidak ditemukan di comick.dev",
    });
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /cari link chapter berikutnya/i }));
    await user.click(screen.getByRole("button", { name: "comick.dev" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chapter berikutnya tidak ditemukan di comick.dev",
    );
  });
});
