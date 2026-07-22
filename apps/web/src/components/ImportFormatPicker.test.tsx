import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportFormatPicker } from "./ImportFormatPicker";

describe("ImportFormatPicker", () => {
  it("memanggil onInsertExample dengan contoh RAW saat tombol diklik", async () => {
    const onInsertExample = vi.fn();
    const user = userEvent.setup();
    render(<ImportFormatPicker onInsertExample={onInsertExample} />);

    await user.click(screen.getByRole("button", { name: /default \(raw\)/i }));

    expect(onInsertExample).toHaveBeenCalledWith(
      "162. Judul komik(manga) : ch11\n172.Judul lain(2022)(manhwa):ch32",
    );
  });
});
