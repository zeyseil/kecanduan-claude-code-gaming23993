import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("tidak render apa pun kalau cuma satu halaman", () => {
    const { container } = render(<Pagination page={0} totalPages={1} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("menampilkan tombol nomor halaman dan menandai halaman saat ini", () => {
    render(<Pagination page={0} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "2" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("disable panah < di halaman pertama, > tetap aktif", () => {
    render(<Pagination page={0} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /halaman sebelumnya/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /halaman selanjutnya/i })).toBeEnabled();
  });

  it("disable panah > di halaman terakhir, < tetap aktif", () => {
    render(<Pagination page={2} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /halaman selanjutnya/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /halaman sebelumnya/i })).toBeEnabled();
  });

  it("memanggil onPageChange lewat panah < dan >", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalPages={3} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /halaman selanjutnya/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByRole("button", { name: /halaman sebelumnya/i }));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("memanggil onPageChange saat nomor halaman diklik langsung", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("menyingkat nomor halaman jadi ellipsis untuk koleksi banyak halaman", () => {
    render(<Pagination page={5} totalPages={12} onPageChange={vi.fn()} />);
    // Halaman saat ini (6) dan tetangganya (5,7), plus halaman 1 dan 12 (pertama/terakhir).
    expect(screen.getByRole("button", { name: "6" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2" })).not.toBeInTheDocument();
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
  });
});
