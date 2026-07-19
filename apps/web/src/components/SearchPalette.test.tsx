import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPalette } from "./SearchPalette";
import type { Comic } from "../types/comic";

const ONE_PIECE: Comic = {
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
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const BERSERK: Comic = {
  comic_id: "2",
  title: "Berserk",
  aliases: [],
  type_tag: "manga",
  is_adult: true,
  latest_chapter: 364,
  status: "ongoing",
  cover_url: null,
  read_url: null,
  release_day: null,
  created_at: "2026-01-02T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

describe("SearchPalette", () => {
  it("menampilkan hasil live saat mengetik query", async () => {
    const user = userEvent.setup();
    render(
      <SearchPalette comics={[ONE_PIECE, BERSERK]} onSelect={vi.fn()} onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Cari judul komik"), "one");

    expect(screen.getByText("One Piece")).toBeInTheDocument();
    expect(screen.queryByText("Berserk")).not.toBeInTheDocument();
  });

  it("memanggil onSelect saat hasil diklik", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SearchPalette comics={[ONE_PIECE, BERSERK]} onSelect={onSelect} onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Cari judul komik"), "berserk");
    await user.click(screen.getByText("Berserk"));

    expect(onSelect).toHaveBeenCalledWith(BERSERK);
  });

  it("memanggil onClose saat Escape ditekan", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SearchPalette comics={[ONE_PIECE]} onSelect={vi.fn()} onClose={onClose} />);

    await user.type(screen.getByLabelText("Cari judul komik"), "{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});
