import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-wide cursor-pointer transition-all duration-250 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:brightness-110 glow-hover shadow-sm",
        destructive: "bg-destructive text-white hover:brightness-110 shadow-sm",
        outline: "border border-border bg-transparent hover:bg-background-interactive hover:border-accent/40 hover:shadow-[0_0_12px_color-mix(in_srgb,var(--accent)_10%,transparent)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:border-border-emphasis border border-transparent",
        ghost: "hover:bg-background-interactive hover:shadow-sm",
        link: "text-accent underline-offset-4 hover:underline",
        // Status variants
        nominal: "bg-status-nominal text-background hover:brightness-110 shadow-sm",
        warning: "bg-status-warning text-background hover:brightness-110 shadow-sm",
        critical: "bg-status-critical text-white hover:brightness-110 shadow-sm",
        info: "bg-status-info text-white hover:brightness-110 shadow-sm"
      },
      size: {
        default: "h-9 px-5 py-2",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-11 px-7 text-base",
        icon: "size-9",
        "icon-sm": "size-8"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
