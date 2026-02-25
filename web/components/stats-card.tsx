export function StatsCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="p-4 bg-surface rounded-lg border border-surface-border">
      <p className="text-xs text-faint uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold text-white mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-faint mt-1">{sub}</p>}
    </div>
  );
}
