import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentStrip } from "./RecentStrip";
import type { Comic } from "../types/comic";

function comic(overrides: Partial<Comic> = {}): Comic {
  return {
    comic_id: "id",
    title: "Contoh Komik",
    aliases: [],
    type_tag: "manhwa",
    is_adult: false,
    latest_chapter: 1,
    status: "ongoing",
    cover_url: null,
    read_url: null,
    release_day: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("RecentStrip", () => {
  it("tidak merender apa-apa saat array kosong", () => {
    const { container } = render(<RecentStrip comics={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("merender satu card per komik", () => {
    render(
      <RecentStrip
        comics={[
          comic({ comic_id: "a", title: "Komik A" }),
          comic({ comic_id: "b", title: "Komik B" }),
        ]}
      />,
    );
    expect(screen.getByText("Komik A")).toBeInTheDocument();
    expect(screen.getByText("Komik B")).toBeInTheDocument();
  });
});
