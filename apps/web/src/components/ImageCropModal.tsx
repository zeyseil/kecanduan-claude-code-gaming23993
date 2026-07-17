import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { getCroppedImageDataUrl, loadImage } from "../lib/cropImage";

/** Rasio cover ComicCard (aspect-[3/4]). */
const COVER_ASPECT = 3 / 4;

interface ImageCropModalProps {
  imageSrc: string;
  onCancel: () => void;
  onCropped: (dataUrl: string) => void;
}

export function ImageCropModal({
  imageSrc,
  onCancel,
  onCropped,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null,
  );

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const image = await loadImage(imageSrc);
    const dataUrl = getCroppedImageDataUrl(image, croppedAreaPixels);
    onCropped(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-slate-800 p-4">
        <h3 className="text-sm font-semibold text-slate-100">
          Sesuaikan Cover
        </h3>

        <div className="relative h-72 w-full overflow-hidden rounded-md bg-slate-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={COVER_ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-300">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!croppedAreaPixels}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            Gunakan Cover
          </button>
        </div>
      </div>
    </div>
  );
}
