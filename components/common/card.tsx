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
    <div className={cn("mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[32px] leading-10 font-bold tracking-[-0.02em] text-fg sm:text-page sm:font-semibold sm:tracking-[-0.015em]">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-fg-2 sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">{actions}</div>}
    </div>
  );
}
