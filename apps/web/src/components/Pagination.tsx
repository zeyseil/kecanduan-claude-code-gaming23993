// Kontrol nomor halaman untuk grid komik. Disembunyikan total saat cuma ada
// satu halaman — tidak perlu mengganggu tampilan koleksi kecil.

interface PaginationProps {
  /** 0-based. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const ELLIPSIS = "…";

/**
 * Daftar nomor halaman (1-based) yang ditampilkan, dengan "…" untuk rentang
 * yang dilewati — supaya koleksi besar (mis. 12 halaman) tidak menampilkan
 * semua nomor sekaligus. Selalu menyertakan halaman pertama, terakhir, dan
 * satu di kiri-kanan halaman saat ini.
 */
function pageNumbers(currentPage: number, totalPages: number): Array<number | typeof ELLIPSIS> {
  const current = currentPage + 1;
  const items: Array<number | typeof ELLIPSIS> = [];
  let prev = 0;

  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - current) <= 1) {
      if (prev && p - prev > 1) items.push(ELLIPSIS);
      items.push(p);
      prev = p;
    }
  }

  return items;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Navigasi halaman"
      className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-300"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        aria-label="Halaman sebelumnya"
        className="rounded-md border border-slate-600 px-2.5 py-1.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        &lt;
      </button>

      {pageNumbers(page, totalPages).map((p, i) =>
        p === ELLIPSIS ? (
          <span key={`ellipsis-${i}`} className="px-1 text-slate-500">
            {ELLIPSIS}
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p - 1)}
            aria-current={p === page + 1 ? "page" : undefined}
            className={`min-w-[2.25rem] rounded-md border px-2.5 py-1.5 ${
              p === page + 1
                ? "border-indigo-500 bg-indigo-600 text-white"
                : "border-slate-600 hover:bg-slate-800"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        aria-label="Halaman selanjutnya"
        className="rounded-md border border-slate-600 px-2.5 py-1.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        &gt;
      </button>
    </nav>
  );
}
