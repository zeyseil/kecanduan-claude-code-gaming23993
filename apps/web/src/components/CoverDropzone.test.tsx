import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoverDropzone } from "./CoverDropzone";

/**
 * `userEvent` tidak bisa mensimulasikan drag file dari OS, jadi drop diuji lewat
 * `fireEvent.drop` dengan objek `dataTransfer` buatan.
 */
function dropFile(file: File) {
  fireEvent.drop(screen.getByText("Drop a file").closest("label")!, {
    dataTransfer: { files: [file] },
  });
}

const imageFile = () => new File(["x"], "cover.png", { type: "image/png" });

describe("CoverDropzone", () => {
  it("memanggil onFileSelected saat file gambar dipilih lewat klik", async () => {
    const user = userEvent.setup();
    const onFileSelected = vi.fn();
    render(<CoverDropzone value={null} onFileSelected={onFileSelected} />);

    await user.upload(screen.getByLabelText("Cover Image"), imageFile());

    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected.mock.calls[0][0].name).toBe("cover.png");
  });

  it("memanggil onFileSelected saat file gambar di-drop", () => {
    const onFileSelected = vi.fn();
    render(<CoverDropzone value={null} onFileSelected={onFileSelected} />);

    dropFile(imageFile());

    expect(onFileSelected).toHaveBeenCalledTimes(1);
  });

  it("menolak file non-gambar tanpa memanggil onFileSelected", () => {
    const onFileSelected = vi.fn();
    render(<CoverDropzone value={null} onFileSelected={onFileSelected} />);

    dropFile(new File(["x"], "catatan.pdf", { type: "application/pdf" }));

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/bukan gambar/i)).toBeInTheDocument();
  });

  it("menampilkan indikator loading saat busy", () => {
    render(<CoverDropzone value={null} onFileSelected={vi.fn()} busy />);

    expect(screen.getByRole("status", { name: "Memproses gambar" })).toBeInTheDocument();
  });

  it("menampilkan preview saat value terisi", () => {
    render(<CoverDropzone value="data:image/png;base64,AAA" onFileSelected={vi.fn()} />);

    expect(screen.getByAltText("Preview cover")).toHaveAttribute(
      "src",
      "data:image/png;base64,AAA",
    );
  });

  it("tidak menampilkan tombol hapus cover saat onRemove tidak diberikan", () => {
    render(<CoverDropzone value="data:image/png;base64,AAA" onFileSelected={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /hapus cover/i })).not.toBeInTheDocument();
  });

  it("tidak menampilkan tombol hapus cover saat value kosong, walau onRemove diberikan", () => {
    render(<CoverDropzone value={null} onFileSelected={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /hapus cover/i })).not.toBeInTheDocument();
  });

  it("memanggil onRemove saat tombol hapus cover ditekan", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <CoverDropzone value="data:image/png;base64,AAA" onFileSelected={vi.fn()} onRemove={onRemove} />,
    );

    await user.click(screen.getByRole("button", { name: /hapus cover/i }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("menonaktifkan tombol hapus cover saat disabled", () => {
    render(
      <CoverDropzone
        value="data:image/png;base64,AAA"
        onFileSelected={vi.fn()}
        onRemove={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: /hapus cover/i })).toBeDisabled();
  });
});
