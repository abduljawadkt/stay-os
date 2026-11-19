import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

// Status chip per DESIGN.md §6: 22px pill, tint background, matching text, optional dot or icon.
const badgeVariants = cva(
  "inline-flex h-[22px] w-fit shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap transition-colors duration-200 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-fg-2",
        brand: "bg-brand-tint text-brand-tint-fg",
        success: "bg-success-tint text-success-fg",
        warning: "bg-warning-tint text-warning-fg",
        danger: "bg-danger-tint text-danger-fg",
        outline: "border border-line-strong text-fg-2",
        default: "bg-surface-2 text-fg-2",
        secondary: "bg-surface-2 text-fg-2",
        destructive: "bg-danger-tint text-danger-fg",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

const dotColor: Record<string, string> = {
  neutral: "bg-fg-3",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  outline: "bg-fg-3",
};

function Badge({
  className,
  variant = "neutral",
  dot = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean; dot?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", dotColor[variant ?? "neutral"])} />}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
