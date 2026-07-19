import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroBanner } from "./HeroBanner";
import type { Comic } from "../types/comic";
import { takeReadingSession } from "../lib/readingSession";

function comic(overrides: Partial<Comic> = {}): Comic {
  return {
    comic_id: "id",
    title: "Contoh Komik",
    aliases: [],
    type_tag: "manhwa",
    is_adult: false,
    latest_chapter: 32,
    status: "ongoing",
    cover_url: null,
    read_url: null,
    release_day: null,
    note: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("HeroBanner", () => {
  it("tidak merender apa pun kalau tidak ada komik", () => {
    const { container } = render(<HeroBanner comics={[]} onEdit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("menampilkan link 'Lanjutkan Membaca' saat read_url terisi", () => {
    render(
      <HeroBanner
        comics={[comic({ read_url: "https://example.com/read/x", latest_chapter: 12 })]}
        onEdit={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: /lanjutkan membaca/i });
    expect(link).toHaveAttribute("href", "https://example.com/read/x");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("menampilkan tombol 'Tambahkan link baca' yang memanggil onEdit saat read_url null", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const latest = comic({ read_url: null });
    render(<HeroBanner comics={[latest]} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: /tambahkan link baca/i }));
    expect(onEdit).toHaveBeenCalledWith(latest);
  });

  it("menandai sesi baca saat link 'Lanjutkan Membaca' diklik", async () => {
    const user = userEvent.setup();
    const latest = comic({ comic_id: "abc", read_url: "https://example.com/read/x" });
    render(<HeroBanner comics={[latest]} onEdit={vi.fn()} />);

    // jsdom tidak benar-benar menavigasi saat klik <a>, jadi cukup memicu onClick.
    await user.click(screen.getByRole("link", { name: /lanjutkan membaca/i }));

    expect(takeReadingSession()).toBe("abc");
  });
});
