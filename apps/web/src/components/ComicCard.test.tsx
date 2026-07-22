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
    read_url: null,
    release_day: null,
    note: null,
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

  it("tidak menampilkan icon edit kalau tidak isPressed", () => {
    render(<ComicCard comic={comic()} onPress={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it("memanggil onPress dengan comic_id saat card diklik", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<ComicCard comic={comic({ comic_id: "abc" })} onPress={onPress} />);

    await user.click(screen.getByText("Contoh Komik"));

    expect(onPress).toHaveBeenCalledWith("abc");
  });

  it("menampilkan icon edit saat isPressed dan memanggil onEdit dengan comic yang benar", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const c = comic({ comic_id: "abc" });
    render(<ComicCard comic={c} isPressed onPress={vi.fn()} onEdit={onEdit} />);

    const editButton = screen.getByRole("button", { name: `Edit ${c.title}` });
    await user.click(editButton);

    expect(onEdit).toHaveBeenCalledWith(c);
  });

  it("di mode pilih, klik card memanggil onToggleSelect (bukan onPress)", async () => {
    const user = userEvent.setup();
    const onToggleSelect = vi.fn();
    const onPress = vi.fn();
    render(
      <ComicCard
        comic={comic({ comic_id: "abc" })}
        isSelectable
        onToggleSelect={onToggleSelect}
        onPress={onPress}
      />,
    );

    await user.click(screen.getByText("Contoh Komik"));

    expect(onToggleSelect).toHaveBeenCalledWith("abc");
    expect(onPress).not.toHaveBeenCalled();
  });

  it("menampilkan tanda terpilih dengan glow merah saat isSelected", () => {
    const { container } = render(
      <ComicCard comic={comic()} isSelectable isSelected onToggleSelect={vi.fn()} />,
    );
    expect(screen.getByLabelText("Terpilih untuk dihapus")).toBeInTheDocument();
    expect(container.querySelector(".shadow-glow-danger")).not.toBeNull();
  });

  it("tidak menampilkan tombol status kalau tidak isPressed", () => {
    render(<ComicCard comic={comic()} onPress={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Tandai/ })).not.toBeInTheDocument();
  });

  it("menampilkan tombol 'Tandai sebagai tamat' saat status ongoing dan isPressed", async () => {
    const user = userEvent.setup();
    const onToggleStatus = vi.fn();
    const onPress = vi.fn();
    const c = comic({ status: "ongoing" });
    render(<ComicCard comic={c} isPressed onPress={onPress} onToggleStatus={onToggleStatus} />);

    const button = screen.getByRole("button", { name: `Tandai ${c.title} sebagai tamat` });
    await user.click(button);

    expect(onToggleStatus).toHaveBeenCalledWith(c);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("menampilkan tombol 'Tandai sebagai ongoing' saat status completed", () => {
    const c = comic({ status: "completed" });
    render(<ComicCard comic={c} isPressed onPress={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: `Tandai ${c.title} sebagai ongoing` }),
    ).toBeInTheDocument();
  });

  it("menyensor cover 18+ saat blurred (overlay NSFW), bukan komik biasa", () => {
    const { rerender } = render(<ComicCard comic={comic({ is_adult: true })} blurred />);
    expect(screen.getByTestId("nsfw-overlay")).toBeInTheDocument();

    // Komik non-18+ tidak disensor walau blurred aktif.
    rerender(<ComicCard comic={comic({ is_adult: false })} blurred />);
    expect(screen.queryByTestId("nsfw-overlay")).not.toBeInTheDocument();
  });

  it("tidak menyensor cover 18+ kalau blurred tidak aktif", () => {
    render(<ComicCard comic={comic({ is_adult: true })} />);
    expect(screen.queryByTestId("nsfw-overlay")).not.toBeInTheDocument();
  });

  it("memanggil onReveal saat tombol 'Tampilkan' ditekan pada cover tersensor", async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    const c = comic({ is_adult: true });
    render(<ComicCard comic={c} blurred onReveal={onReveal} />);

    await user.click(screen.getByRole("button", { name: "Tampilkan" }));

    expect(onReveal).toHaveBeenCalledWith(c);
  });

  it("tidak menampilkan tombol 'Tampilkan' kalau onReveal tidak diberikan (mis. RecentStrip)", () => {
    render(<ComicCard comic={comic({ is_adult: true })} blurred />);
    expect(screen.queryByRole("button", { name: "Tampilkan" })).not.toBeInTheDocument();
  });
});
