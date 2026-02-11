import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent/90 text-accent-foreground shadow-sm",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-white shadow-sm",
        outline: "border-border text-foreground",
        // Status variants with neon glow
        nominal: "border-status-nominal/40 bg-status-nominal/15 text-status-nominal shadow-[0_0_8px_color-mix(in_srgb,var(--status-nominal)_15%,transparent)]",
        warning: "border-status-warning/40 bg-status-warning/15 text-status-warning shadow-[0_0_8px_color-mix(in_srgb,var(--status-warning)_15%,transparent)]",
        critical: "border-status-critical/30 bg-status-critical/15 text-status-critical",
        info: "border-status-info/30 bg-status-info/15 text-status-info"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
