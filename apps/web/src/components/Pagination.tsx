// Kontrol nomor halaman untuk grid komik. Disembunyikan total saat cuma ada
// satu halaman — tidak perlu mengganggu tampilan koleksi kecil.

interface PaginationProps {
  /** 0-based. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Navigasi halaman"
      className="mt-4 flex items-center justify-center gap-3 text-sm text-slate-300"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="rounded-md border border-slate-600 px-3 py-1.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Sebelumnya
      </button>
      <span>
        Halaman {page + 1} dari {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="rounded-md border border-slate-600 px-3 py-1.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Selanjutnya
      </button>
    </nav>
  );
}
