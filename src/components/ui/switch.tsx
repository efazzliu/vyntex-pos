"use client";
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils.ts";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        /* `group` so thumb translate reacts to Root `data-state` (Tailwind `peer` only works for siblings, not children). */
        "group peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 shadow-sm transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "data-[state=unchecked]:border-slate-300 data-[state=unchecked]:bg-slate-200",
        "dark:data-[state=unchecked]:border-white/20 dark:data-[state=unchecked]:bg-white/10",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full border border-slate-300/90 bg-white shadow-md transition-transform duration-200",
          "translate-x-0.5 dark:border-white/25 dark:bg-slate-100",
          "group-data-[state=checked]:translate-x-[22px] group-data-[state=checked]:border-primary-foreground/20 group-data-[state=checked]:bg-primary-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
