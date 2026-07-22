import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChapterUpdateForm } from "./ChapterUpdateForm";
import type { Comic } from "../types/comic";

function comic(overrides: Partial<Comic> = {}): Comic {
  return {
    comic_id: "1",
    title: "One Piece",
    aliases: [],
    type_tag: "manga",
    is_adult: false,
    latest_chapter: 1120,
    status: "ongoing",
    cover_url: null,
    read_url: "https://example.com/read/one-piece",
    release_day: null,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ChapterUpdateForm", () => {
  it("default input chapter ke latest_chapter + 1", () => {
    render(<ChapterUpdateForm comic={comic({ latest_chapter: 1120 })} onUpdate={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(1121);
  });

  it("submit memanggil onUpdate dengan angka chapter yang diisi", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<ChapterUpdateForm comic={comic()} onUpdate={onUpdate} onDismiss={vi.fn()} />);

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "1125");
    await user.click(screen.getByRole("button", { name: "Update" }));

    expect(onUpdate).toHaveBeenCalledWith(1125);
  });

  it("menampilkan error saat chapter tidak valid, tanpa memanggil onUpdate", async () => {
    const onUpdate = vi.fn();
    const { container } = render(<ChapterUpdateForm comic={comic()} onUpdate={onUpdate} onDismiss={vi.fn()} />);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByText("Nomor chapter tidak valid.")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("tombol 'Belum selesai' memanggil onDismiss tanpa memanggil onUpdate", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();
    render(<ChapterUpdateForm comic={comic()} onUpdate={onUpdate} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Belum selesai" }));

    expect(onDismiss).toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("menampilkan blok Batasan fitur ini", () => {
    render(<ChapterUpdateForm comic={comic()} onUpdate={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("Batasan fitur ini:")).toBeInTheDocument();
  });
});
