import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const n = (hash(name) % 6) + 1;
  return (
    <span
      aria-hidden
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-medium select-none", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        background: `color-mix(in srgb, var(--chart-${n}) 15%, var(--surface))`,
        color: `color-mix(in srgb, var(--chart-${n}) 72%, var(--text))`,
      }}
    >
      {initials(name)}
    </span>
  );
}
