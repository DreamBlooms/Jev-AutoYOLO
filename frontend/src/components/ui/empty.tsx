import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Empty({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid min-h-44 place-items-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center", className)}>
      <div>
        <div className="text-sm font-medium">{title}</div>
        {description ? <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
