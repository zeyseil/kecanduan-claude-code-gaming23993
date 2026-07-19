/**
 * Placeholder saat data komik sedang dimuat. Kelas grid di SkeletonGrid harus
 * tetap sinkron manual dengan ComicGrid.tsx supaya tidak ada layout shift
 * begitu data asli masuk.
 */

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg bg-slate-800" data-testid="skeleton-card">
      <div className="aspect-[3/4] animate-pulse bg-slate-700" />
      <div className="flex flex-col gap-2 p-2">
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-slate-700/60" />
        <div className="mt-auto h-3 w-1/2 animate-pulse rounded bg-slate-700/60" />
      </div>
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div
      data-testid="skeleton-grid"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: 10 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div
      data-testid="skeleton-hero"
      className="mb-6 h-40 animate-pulse rounded-xl border border-slate-800 bg-slate-800/60 sm:h-48"
    />
  );
}

export function SkeletonPanel() {
  return (
    <div
      data-testid="skeleton-panel"
      className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
    >
      <div className="mb-3 h-4 w-2/3 animate-pulse rounded bg-slate-700/60" />
      <div className="space-y-2">
        <div className="h-3 animate-pulse rounded bg-slate-700/60" />
        <div className="h-3 animate-pulse rounded bg-slate-700/60" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-slate-700/60" />
      </div>
    </div>
  );
}
