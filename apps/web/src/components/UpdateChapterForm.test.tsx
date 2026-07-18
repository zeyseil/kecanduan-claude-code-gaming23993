import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateChapterForm } from "./UpdateChapterForm";
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
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("UpdateChapterForm", () => {
  it("menampilkan nilai chapter saat ini sebagai default", () => {
    render(<UpdateChapterForm comic={COMIC} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Chapter Terakhir Dibaca")).toHaveValue(1120);
  });

  it("menampilkan error dan tidak memanggil onSubmit saat chapter tidak valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UpdateChapterForm comic={COMIC} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText("Chapter Terakhir Dibaca"));
    await user.type(screen.getByLabelText("Chapter Terakhir Dibaca"), "0");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chapter terakhir harus berupa angka lebih dari 0.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("memanggil onSubmit dengan angka baru saat valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<UpdateChapterForm comic={COMIC} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText("Chapter Terakhir Dibaca"));
    await user.type(screen.getByLabelText("Chapter Terakhir Dibaca"), "1121");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(onSubmit).toHaveBeenCalledWith(1121);
  });

  it("menampilkan error dari onSubmit tanpa menutup form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("comic tidak ditemukan"));
    render(<UpdateChapterForm comic={COMIC} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText("Chapter Terakhir Dibaca"));
    await user.type(screen.getByLabelText("Chapter Terakhir Dibaca"), "1121");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("comic tidak ditemukan");
  });

  it("memanggil onCancel saat tombol Batal ditekan", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<UpdateChapterForm comic={COMIC} onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
