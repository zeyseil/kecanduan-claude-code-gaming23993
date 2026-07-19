import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditComicForm } from "./EditComicForm";
import type { Comic } from "../types/comic";

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
});
