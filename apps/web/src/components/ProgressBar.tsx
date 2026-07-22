// Indikator progress reusable untuk operasi jaringan bertahap (yang makin lama
// seiring daftar komik membesar) — mis. bulk-delete. Menampilkan bar + teks
// "X dari Y". Sengaja generik: terima done/total/label saja.

interface ProgressBarProps {
  done: number;
  total: number;
  /** Teks di atas bar, mis. "Menghapus komik". */
  label: string;
}

export function ProgressBar({ done, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="font-mono">
          {done} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-indigo-500 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
