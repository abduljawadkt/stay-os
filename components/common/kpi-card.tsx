"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CountUp } from "./count-up";
import { cn } from "@/lib/utils";

export function KpiCard({
  id, label, icon: Icon, value, format, sub, delta, deltaLabel, goodWhen = "up", spark, className,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  value: number;
  format: (n: number) => string;
  sub?: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  goodWhen?: "up" | "down";
  spark?: number[];
  className?: string;
}) {
  const good = delta === undefined ? true : goodWhen === "up" ? delta >= 0 : delta <= 0;
  return (
    <div data-tour={`kpi-${id}`} className={cn("flex min-w-0 flex-col rounded-lg border border-line bg-surface p-4 sm:p-5", className)}>
      <div className="flex items-center gap-1.5 text-small font-medium text-fg-2">
        <Icon className="size-4 text-fg-3" aria-hidden />
        <span className="leading-tight">{label}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <CountUp id={`kpi-${id}`} value={value} format={format} className="text-[24px] leading-8 font-semibold tracking-[-0.02em] text-fg tnum sm:text-kpi" />
        {spark && <span className="hidden sm:block"><Sparkline data={spark} /></span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {sub && <span className="text-xs text-fg-3 tnum">{sub}</span>}
        {delta !== undefined && deltaLabel && (
          <span className={cn("inline-flex min-h-5 items-center gap-0.5 rounded-full px-1.5 py-px text-xs leading-tight font-medium tnum", good ? "bg-success-tint text-success-fg" : "bg-danger-tint text-danger-fg")}>
            {delta >= 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
            {deltaLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 64, h = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="mb-1.5 shrink-0 overflow-visible">
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill="var(--brand)" />
    </svg>
  );
}
