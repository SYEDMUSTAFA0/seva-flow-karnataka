import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva("chip", {
  variants: {
    tone: {
      neutral: "border-line-2 bg-canvas-2 text-ink-2",
      navy: "border-navy-200 bg-navy-50 text-navy-700",
      saffron: "border-saffron-200 bg-saffron-50 text-saffron-700",
      green: "border-forest-200 bg-forest-50 text-forest-700",
      amber: "border-amber/20 bg-amber-bg text-amber",
      rose: "border-rose/20 bg-rose-bg text-rose",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
