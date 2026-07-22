import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("tidak render apa pun kalau cuma satu halaman", () => {
    const { container } = render(<Pagination page={0} totalPages={1} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("menampilkan halaman saat ini dari total, disable Sebelumnya di halaman pertama", () => {
    render(<Pagination page={0} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByText(/halaman 1 dari 3/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sebelumnya/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /selanjutnya/i })).toBeEnabled();
  });

  it("disable Selanjutnya di halaman terakhir", () => {
    render(<Pagination page={2} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /selanjutnya/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /sebelumnya/i })).toBeEnabled();
  });

  it("memanggil onPageChange dengan halaman berikutnya/sebelumnya", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalPages={3} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /selanjutnya/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByRole("button", { name: /sebelumnya/i }));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });
});
