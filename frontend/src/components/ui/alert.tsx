import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "border-sky-500/30 bg-sky-500/8 text-foreground [&>svg]:text-sky-600",
        success: "border-emerald-500/30 bg-emerald-500/8 text-foreground [&>svg]:text-emerald-600",
        warning: "border-amber-500/35 bg-amber-500/8 text-foreground [&>svg]:text-amber-600",
        destructive: "border-destructive/40 bg-destructive/8 text-foreground [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />;
}
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export { Alert, AlertTitle, AlertDescription };
