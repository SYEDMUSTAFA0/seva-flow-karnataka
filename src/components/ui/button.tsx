import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

const buttonVariants = cva("btn-base", {
  variants: {
    variant: {
      primary: "bg-navy-800 text-white hover:bg-navy-700",
      secondary: "border border-line-2 bg-surface text-ink hover:bg-canvas-2",
      accent: "bg-saffron-500 text-white hover:bg-saffron-600",
      success: "bg-forest-600 text-white hover:bg-forest-500",
      danger: "bg-rose text-white hover:bg-rose/90",
      ghost: "text-ink-2 hover:bg-canvas-2",
      outline: "border border-navy-300 text-navy-700 hover:bg-navy-50",
    },
    size: {
      sm: "h-8 px-3 text-xs",
      md: "h-9 px-4 text-sm",
      lg: "h-11 px-5 text-sm",
      icon: "h-9 w-9",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({ className, variant, size, loading, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
