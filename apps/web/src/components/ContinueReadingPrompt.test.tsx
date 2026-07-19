import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContinueReadingPrompt } from "./ContinueReadingPrompt";
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

describe("ContinueReadingPrompt", () => {
  it("default input chapter ke latest_chapter + 1", () => {
    render(
      <ContinueReadingPrompt comic={comic({ latest_chapter: 1120 })} onUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByRole("spinbutton")).toHaveValue(1121);
  });

  it("submit memanggil onUpdate dengan angka chapter yang diisi", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<ContinueReadingPrompt comic={comic()} onUpdate={onUpdate} onDismiss={vi.fn()} />);

    const input = screen.getByRole("spinbutton");
    await user.clear(input);
    await user.type(input, "1125");
    await user.click(screen.getByRole("button", { name: "Update" }));

    expect(onUpdate).toHaveBeenCalledWith(1125);
  });

  it("tombol 'Belum selesai' memanggil onDismiss tanpa memanggil onUpdate", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();
    render(<ContinueReadingPrompt comic={comic()} onUpdate={onUpdate} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Belum selesai" }));

    expect(onDismiss).toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("menampilkan blok Batasan fitur ini", () => {
    render(<ContinueReadingPrompt comic={comic()} onUpdate={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("Batasan fitur ini:")).toBeInTheDocument();
  });
});
