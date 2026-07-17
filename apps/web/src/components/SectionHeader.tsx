interface SectionHeaderProps {
  title: string;
  count?: number;
}

export function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-baseline gap-2 border-l-4 border-indigo-500 pl-2">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      {count !== undefined && (
        <span className="text-sm text-slate-400">({count})</span>
      )}
    </div>
  );
}
