import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, extra, className }: { title: string; subtitle?: string; extra?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {extra ? <div className="shrink-0">{extra}</div> : null}
    </div>
  );
}
