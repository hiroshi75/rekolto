import Link from "next/link";

export function TagChip({ name, count }: { name: string; count?: number }) {
  return (
    <Link
      href={`/tags/${encodeURIComponent(name)}`}
      className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-hover text-muted text-xs rounded-md hover:text-accent hover:bg-surface-hover/80 transition-colors duration-150 cursor-pointer"
    >
      <span>{name}</span>
      {count != null && <span className="text-faint">({count})</span>}
    </Link>
  );
}
