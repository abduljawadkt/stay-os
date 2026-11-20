import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";

// Buttons per DESIGN.md §6: primary (one per view), secondary, quiet, destructive.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow] duration-[120ms] ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand pointer-coarse:active:opacity-75 disabled:pointer-events-none disabled:bg-surface-2 disabled:text-fg-3 disabled:shadow-none disabled:border-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white shadow-sm hover:bg-brand-hover active:bg-brand-pressed",
        default: "bg-brand text-white shadow-sm hover:bg-brand-hover active:bg-brand-pressed",
        secondary: "border-line-strong bg-surface text-fg shadow-sm hover:bg-surface-2 aria-expanded:bg-surface-2",
        outline: "border-line-strong bg-surface text-fg shadow-sm hover:bg-surface-2 aria-expanded:bg-surface-2",
        quiet: "text-fg-2 hover:bg-surface-2 hover:text-fg aria-expanded:bg-surface-2 aria-expanded:text-fg",
        ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg aria-expanded:bg-surface-2 aria-expanded:text-fg",
        destructive: "bg-danger text-white shadow-sm hover:bg-danger/90",
        link: "h-auto! px-0! text-brand-text hover:underline underline-offset-3",
      },
      size: {
        sm: "h-7 px-2.5 text-small pointer-coarse:h-9",
        default: "h-8 px-3 text-sm pointer-coarse:h-10 pointer-coarse:px-3.5",
        lg: "h-9 px-3.5 text-sm pointer-coarse:h-11 pointer-coarse:text-[15px]",
        xl: "h-12 rounded-lg px-5 text-base",
        icon: "size-8 pointer-coarse:size-10",
        "icon-sm": "size-7 pointer-coarse:size-9",
        "icon-lg": "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-6 px-2 text-xs pointer-coarse:h-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "default" },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
