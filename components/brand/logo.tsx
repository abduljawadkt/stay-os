import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export function LogoMark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <rect width="24" height="24" rx="6" className="fill-brand" />
      <path d="M8 18.5V10a4 4 0 0 1 8 0v8.5" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="12.6" r="1.35" fill="white" />
      <rect x="11.4" y="13.2" width="1.2" height="2.6" rx="0.6" fill="white" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-fg">{brand.name}</span>
    </span>
  );
}
