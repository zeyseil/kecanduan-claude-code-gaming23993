import type { Comic } from "../types/comic";
import { ChapterUpdateForm } from "./ChapterUpdateForm";

interface ContinueReadingPromptProps {
  comic: Comic;
  onUpdate: (latestChapter: number) => Promise<void>;
  onDismiss: () => void;
}

/**
 * Muncul saat user kembali ke tab aplikasi setelah membuka link baca dari
 * HeroBanner. Hanya jalur non-Tauri — di Tauri, FloatingReader menggantikan
 * peran ini (lihat DaftarKomik.tsx dan HeroBanner.tsx, keduanya digate
 * `!isTauri()` untuk mekanisme ini).
 */
export function ContinueReadingPrompt({ comic, onUpdate, onDismiss }: ContinueReadingPromptProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-lg bg-slate-800 p-4">
        <ChapterUpdateForm comic={comic} onUpdate={onUpdate} onDismiss={onDismiss} />
      </div>
    </div>
  );
}
