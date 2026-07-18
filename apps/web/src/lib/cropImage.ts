export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Cover card hanya butuh resolusi kecil untuk ditampilkan — tanpa cap ini,
// foto HP resolusi tinggi menghasilkan base64 beberapa MB yang gampang
// melebihi limit ukuran dokumen Astra DB.
const MAX_COVER_WIDTH = 800;

/** Render area crop (dalam pixel gambar asli) ke data URL JPEG, di-downscale kalau lebih lebar dari MAX_COVER_WIDTH. */
export function getCroppedImageDataUrl(
  image: HTMLImageElement,
  crop: PixelCrop,
): string {
  const scale = crop.width > MAX_COVER_WIDTH ? MAX_COVER_WIDTH / crop.width : 1;
  const outputWidth = Math.round(crop.width * scale);
  const outputHeight = Math.round(crop.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

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
    outputWidth,
    outputHeight,
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
