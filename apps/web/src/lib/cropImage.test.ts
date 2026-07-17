import { describe, it, expect, vi } from "vitest";
import { getCroppedImageDataUrl } from "./cropImage";

describe("getCroppedImageDataUrl", () => {
  it("menggambar area crop ke canvas berukuran crop dan mengembalikan data URL", () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => "data:image/jpeg;base64,MOCK");

    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage }),
          toDataURL,
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement(tag);
    });

    const image = {} as HTMLImageElement;
    const crop = { x: 10, y: 20, width: 300, height: 400 };

    const result = getCroppedImageDataUrl(image, crop);

    expect(drawImage).toHaveBeenCalledWith(
      image,
      10,
      20,
      300,
      400,
      0,
      0,
      300,
      400,
    );
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.9);
    expect(result).toBe("data:image/jpeg;base64,MOCK");

    vi.restoreAllMocks();
  });
});
