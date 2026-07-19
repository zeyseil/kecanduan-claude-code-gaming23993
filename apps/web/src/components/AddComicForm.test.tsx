import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddComicForm } from "./AddComicForm";

describe("AddComicForm", () => {
  it("menampilkan error dan tidak memanggil onSubmit saat nama kosong", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddComicForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("Chapter Terakhir Dibaca"), "12");
    await user.click(screen.getByRole("button", { name: "Tambah Komik" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nama komik wajib diisi.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("menampilkan error saat chapter bukan angka valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddComicForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("Nama"), "Judul Baru");
    await user.click(screen.getByRole("button", { name: "Tambah Komik" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chapter terakhir harus berupa angka lebih dari 0.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("memanggil onSubmit dengan payload benar saat valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddComicForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("Nama"), "Judul Baru");
    await user.selectOptions(screen.getByLabelText("Tipe Komik"), "manhua");
    await user.click(screen.getByLabelText("Konten 18+"));
    await user.type(screen.getByLabelText("Chapter Terakhir Dibaca"), "12.5");
    await user.click(screen.getByRole("button", { name: "Tambah Komik" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Judul Baru",
      type_tag: "manhua",
      is_adult: true,
      latest_chapter: 12.5,
      cover_url: null,
      read_url: null,
      release_day: null,
    });
  });

  it("memanggil onCancel saat tombol Batal ditekan", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<AddComicForm onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
