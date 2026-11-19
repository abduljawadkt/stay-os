"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LocaleToggle } from "@/components/shell/locale-toggle";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Frame for sign-in, sign-up and onboarding: a header, the form, and an optional side panel. */
export function AuthShell({ children, aside, className }: { children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="Home">
          <Logo />
        </Link>
        <div className="flex items-center gap-1.5">
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className={cn("mx-auto grid w-full max-w-5xl flex-1 items-start gap-6 px-4 pt-6 pb-12 sm:px-6 lg:pt-14", aside ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10" : "max-w-xl", className)}>
        <div className="w-full">{children}</div>
        {aside && <div className="w-full">{aside}</div>}
      </main>
    </div>
  );
}

export function Field({
  id, label, hint, error, className, ...props
}: { id: string; label: string; hint?: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className="h-10 md:h-9" {...props} />
      {error ? (
        <p id={`${id}-error`} className="text-small text-danger-fg">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-small text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-small text-danger-fg">
      {message}
    </p>
  );
}
