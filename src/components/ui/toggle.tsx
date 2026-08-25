"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
        // Segmented "pill" look, same idea as shadcn's Tabs component —
        // but kept on ToggleGroup (role="group" + pressed buttons) so a
        // form control that picks one of a few values doesn't borrow
        // Tabs' tablist/tabpanel semantics, which are for switching
        // content panels, not this. Pair with `ToggleGroup`'s own
        // `variant="tabs"` for the muted track background.
        tabs: "text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
      },
      size: {
        default:
          "h-9 min-w-9 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-8 min-w-8 rounded-[min(var(--radius-md),8px)] px-2.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 min-w-10 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
