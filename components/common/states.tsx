"use client";

import { AlertCircle, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, body, action, className }: { icon: React.ElementType; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <div className="mb-3 grid size-10 place-items-center rounded-lg bg-surface-2 text-fg-2">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {body && <p className="mt-1 max-w-xs text-small text-fg-2">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ what, onRetry, className }: { what: string; onRetry: () => void; className?: string }) {
  const t = useTranslations("states");
  return (
    <div role="alert" className={cn("m-4 flex items-start gap-3 rounded-lg bg-danger-tint p-4 text-danger-fg", className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t("errorTitle", { what })}</p>
        <p className="mt-0.5 text-small opacity-90">{t("errorBody")}</p>
      </div>
      <Button variant="quiet" size="sm" onClick={onRetry} className="text-danger-fg hover:bg-danger/10 hover:text-danger-fg">
        <RotateCw /> {t("retry")}
      </Button>
    </div>
  );
}

export function Sk({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-11 items-center gap-4 px-5">
          <Sk className="size-7 rounded-full" />
          <Sk className="h-3 w-40" />
          {Array.from({ length: cols - 2 }).map((__, j) => (
            <Sk key={j} className="ml-auto h-3 w-16" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-surface p-5" aria-hidden>
      <Sk className="h-3 w-24" />
      <Sk className="mt-3 h-8 w-32" />
      <Sk className="mt-3 h-3 w-20" />
    </div>
  );
}
