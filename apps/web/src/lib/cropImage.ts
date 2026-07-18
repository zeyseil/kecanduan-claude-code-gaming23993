export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Render area crop (dalam pixel gambar asli) ke data URL JPEG. */
export function getCroppedImageDataUrl(
  image: HTMLImageElement,
  crop: PixelCrop,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context tidak tersedia");
  }

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Muat File terpilih user jadi data URL, untuk dipakai sebagai sumber cropper. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Muat data URL jadi HTMLImageElement siap-gambar (dibutuhkan getCroppedImageDataUrl). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
