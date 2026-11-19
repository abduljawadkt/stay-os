"use client";

import { cn } from "@/lib/utils";

/** Recharts tooltip in the popover style: surface, border, shadow, values right-aligned. */
export function ChartTooltip({ active, payload, label, labelFormat, rows }: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number; color?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  labelFormat?: (l: string) => string;
  rows: { key: string; name: string; color: string; format: (v: number) => string; dashed?: boolean }[];
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload ?? {};
  return (
    <div className="min-w-44 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-fg">{labelFormat ? labelFormat(String(label)) : label}</p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span aria-hidden className={cn("h-0.5 w-3 rounded-full", r.dashed && "border-t border-dashed")} style={{ background: r.dashed ? "transparent" : r.color, borderColor: r.color }} />
            <span className="flex-1 text-fg-2">{r.name}</span>
            <span className="font-medium text-fg tnum">{r.format(Number(datum[r.key] ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-2">
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-xs" style={dashed ? { border: `1.5px dashed ${color}` } : { background: color }} />
      {label}
    </span>
  );
}

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--text-3)", fontSize: 12 },
} as const;
