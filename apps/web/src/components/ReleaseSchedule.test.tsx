import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReleaseSchedule } from "./ReleaseSchedule";
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
    cover_url: null,
    read_url: null,
    release_day: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReleaseSchedule", () => {
  it("tidak merender apa pun kalau tidak ada komik", () => {
    const { container } = render(<ReleaseSchedule comics={[]} onEdit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mengelompokkan komik ke hari release_day masing-masing", () => {
    render(
      <ReleaseSchedule
        comics={[
          comic({ title: "Senin Punya", release_day: 1 }),
          comic({ title: "Tidak Tentu", release_day: null }),
        ]}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Senin Punya")).toBeInTheDocument();
    expect(screen.queryByText("Tidak Tentu")).not.toBeInTheDocument();
  });

  it("menampilkan blok batasan fitur", () => {
    render(<ReleaseSchedule comics={[comic()]} onEdit={vi.fn()} />);
    expect(screen.getByText(/batasan fitur ini/i)).toBeInTheDocument();
  });
});
