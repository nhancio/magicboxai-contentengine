import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-brand/30 bg-brand/10 text-brand",
        secondary: "border-border bg-secondary text-foreground/70",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
        outline: "border-foreground/20 text-foreground/70",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
