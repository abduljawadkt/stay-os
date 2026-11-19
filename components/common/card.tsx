import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-lg border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, meta, action, className, id }: { title: React.ReactNode; meta?: React.ReactNode; action?: React.ReactNode; className?: string; id?: string }) {
  return (
    <header className={cn("flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-fg">{title}</h2>
        {meta && <p className="mt-0.5 text-small text-fg-3">{meta}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
    </header>
  );
}

export function PageHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-page font-semibold tracking-[-0.015em] text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
