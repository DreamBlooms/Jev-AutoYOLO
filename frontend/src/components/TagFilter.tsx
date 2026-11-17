import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export function TagFilter({
  tags,
  selected,
  onChange,
  className,
  showLabel = true,
}: {
  tags: [string, number][];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  className?: string;
  showLabel?: boolean;
}) {
  const { t } = useTranslation();
  if (!tags.length) return null;
  const toggle = (tag: string) => {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(next);
  };
  return (
    <div className={cn("grid gap-1.5", className)}>
      {showLabel ? (
        <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>{t("common.tags")}</span>
          {selected.size ? (
            <button type="button" className="normal-case tracking-normal text-primary hover:underline" onClick={() => onChange(new Set())}>
              {t("common.clearFilter")}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex max-h-28 flex-wrap gap-1 overflow-auto">
        <button
          type="button"
          onClick={() => onChange(new Set())}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            selected.size === 0 ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {t("filter.all")}
        </button>
        {tags.map(([tag, count]) => {
          const active = selected.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                active ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {tag} <span className="opacity-55">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
