import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComicCard } from "./ComicCard";
import type { Comic } from "../types/comic";

function comic(overrides: Partial<Comic> = {}): Comic {
  return {
    comic_id: "id",
    title: "Contoh Komik",
    aliases: [],
    type_tag: "manhwa",
    is_adult: false,
    latest_chapter: 32,
    status: "ongoing",
    cover_url: "https://example.com/cover.jpg",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("ComicCard", () => {
  it("menampilkan judul, jenis, dan nomor chapter", () => {
    render(<ComicCard comic={comic()} />);
    expect(screen.getByText("Contoh Komik")).toBeInTheDocument();
    expect(screen.getByText("Manhwa")).toBeInTheDocument();
    expect(screen.getByText(/Ch 32/)).toBeInTheDocument();
  });

  it("menampilkan badge 18+ hanya saat is_adult true", () => {
    const { rerender } = render(<ComicCard comic={comic({ is_adult: false })} />);
    expect(screen.queryByText("18+")).not.toBeInTheDocument();

    rerender(<ComicCard comic={comic({ is_adult: true })} />);
    expect(screen.getByText("18+")).toBeInTheDocument();
  });

  it("menampilkan placeholder saat cover_url null", () => {
    render(<ComicCard comic={comic({ cover_url: null })} />);
    expect(screen.getByTestId("cover-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("menampilkan gambar cover saat cover_url ada", () => {
    render(<ComicCard comic={comic({ cover_url: "https://x/c.jpg" })} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://x/c.jpg");
  });

  it("menampilkan chapter desimal apa adanya", () => {
    render(<ComicCard comic={comic({ latest_chapter: 11.5 })} />);
    expect(screen.getByText(/Ch 11\.5/)).toBeInTheDocument();
  });

  it("menandai komik tamat dengan badge", () => {
    render(<ComicCard comic={comic({ status: "completed" })} />);
    expect(screen.getByText("Tamat")).toBeInTheDocument();
  });

  it("tidak menampilkan tombol update chapter kalau onUpdateChapter tidak diisi", () => {
    render(<ComicCard comic={comic()} />);
    expect(
      screen.queryByRole("button", { name: "Update chapter" }),
    ).not.toBeInTheDocument();
  });

  it("memanggil onUpdateChapter dengan comic yang benar saat tombol diklik", async () => {
    const user = userEvent.setup();
    const onUpdateChapter = vi.fn();
    const c = comic({ comic_id: "abc" });
    render(<ComicCard comic={c} onUpdateChapter={onUpdateChapter} />);

    await user.click(screen.getByRole("button", { name: "Update chapter" }));

    expect(onUpdateChapter).toHaveBeenCalledWith(c);
  });
});
