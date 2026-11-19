"use client";

import * as React from "react";
import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";

// 36×20 on desktop, 44×26 ("lg") on mobile. Brand when on.
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { size?: "default" | "lg" }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent p-px transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand data-[state=checked]:bg-brand data-[state=unchecked]:bg-line-input disabled:cursor-not-allowed disabled:opacity-50",
        size === "lg" ? "h-[26px] w-11" : "h-5 w-9",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] data-[state=unchecked]:translate-x-0",
          size === "lg" ? "size-[22px] data-[state=checked]:translate-x-[18px]" : "size-4 data-[state=checked]:translate-x-4"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
