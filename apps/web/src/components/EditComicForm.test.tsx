import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditComicForm } from "./EditComicForm";
import type { Comic } from "../types/comic";
import * as comicsApi from "../lib/api/comics";

vi.mock("../lib/api/comics", async () => {
  const actual = await vi.importActual<typeof comicsApi>("../lib/api/comics");
  return { ...actual, backfillCovers: vi.fn() };
});

const backfillCoversMock = vi.mocked(comicsApi.backfillCovers);

beforeEach(() => {
  backfillCoversMock.mockReset();
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
    backfillCoversMock.mockResolvedValue([
      { comic_id: "1", cover_url: "https://example.com/cover.jpg" },
    ]);
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /coba ambil cover otomatis/i }));

    expect(backfillCoversMock).toHaveBeenCalledWith(["1"]);
    expect(
      await screen.findByRole("img", { name: /cover/i }),
    ).toHaveAttribute("src", "https://example.com/cover.jpg");
    expect(
      screen.queryByRole("button", { name: /coba ambil cover otomatis/i }),
    ).not.toBeInTheDocument();
  });

  it("menampilkan reason saat cover tidak ditemukan, tombol tetap tampil", async () => {
    backfillCoversMock.mockResolvedValue([
      { comic_id: "1", cover_url: null, reason: "tidak ditemukan di sumber manapun" },
    ]);
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /coba ambil cover otomatis/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/tidak ditemukan di sumber manapun/i);
    expect(screen.getByRole("button", { name: /coba ambil cover otomatis/i })).toBeInTheDocument();
  });

  it("menampilkan pesan error saat backfillCovers gagal (network/exception)", async () => {
    backfillCoversMock.mockRejectedValue(new Error("Worker sedang down"));
    const user = userEvent.setup();
    render(<EditComicForm comic={COMIC} onSubmit={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /coba ambil cover otomatis/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Worker sedang down");
  });
});
