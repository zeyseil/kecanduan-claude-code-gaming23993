import { afterEach, describe, it, expect, vi } from "vitest";
import { getCroppedImageDataUrl } from "./cropImage";

function mockCanvas() {
  const drawImage = vi.fn();
  const toDataURL = vi.fn(() => "data:image/jpeg;base64,MOCK");
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toDataURL,
  } as unknown as HTMLCanvasElement;

  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") return canvas;
    return document.createElement(tag);
  });

  return { drawImage, toDataURL, canvas };
}

describe("getCroppedImageDataUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("menggambar area crop ke canvas berukuran crop dan mengembalikan data URL, tanpa downscale untuk crop kecil", () => {
    const { drawImage, toDataURL, canvas } = mockCanvas();

    const image = {} as HTMLImageElement;
    const crop = { x: 10, y: 20, width: 300, height: 400 };

    const result = getCroppedImageDataUrl(image, crop);

    expect(drawImage).toHaveBeenCalledWith(image, 10, 20, 300, 400, 0, 0, 300, 400);
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(400);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.9);
    expect(result).toBe("data:image/jpeg;base64,MOCK");
  });

  it("men-downscale proporsional untuk crop area lebih lebar dari 800px", () => {
    const { drawImage, canvas } = mockCanvas();

    const image = {} as HTMLImageElement;
    const crop = { x: 0, y: 0, width: 1600, height: 2000 };

    getCroppedImageDataUrl(image, crop);

    // scale = 800/1600 = 0.5 -> output 800x1000
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(1000);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 1600, 2000, 0, 0, 800, 1000);
  });
});
