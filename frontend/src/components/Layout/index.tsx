import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { value: "zh", label: "中" },
  { value: "en", label: "EN" },
  { value: "ja", label: "日" },
] as const;

export function Layout() {
  const { t, i18n } = useTranslation();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isLoading = isFetching > 0 || isMutating > 0;
  const { themeMode, setThemeMode } = useTheme();

  const cycleTheme = () => {
    setThemeMode(themeMode === "light" ? "dark" : themeMode === "dark" ? "system" : "light");
  };
  const ThemeIcon = themeMode === "light" ? Sun : themeMode === "dark" ? Moon : Monitor;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {isLoading ? (
        <div className="absolute left-0 top-0 z-[9999] h-[2px] w-full overflow-hidden bg-primary/20">
          <div className="h-full w-1/3 animate-[slideRight_1.5s_infinite_linear] bg-primary" />
        </div>
      ) : null}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight">Jev-AutoYOLO</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {t("app.tagline", { defaultValue: "Auto-labeling · YOLO training · Local deployment" })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 sm:flex">
            <Languages className="ml-1 size-3.5 text-muted-foreground" />
            {LANGUAGES.map((language) => {
              const active = i18n.language.startsWith(language.value);
              return (
                <button
                  key={language.value}
                  type="button"
                  onClick={() => i18n.changeLanguage(language.value)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors",
                    active && "bg-background text-foreground shadow-sm ring-1 ring-inset ring-border",
                  )}
                >
                  {language.label}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" onClick={cycleTheme} title={themeMode}>
            <ThemeIcon className="size-4" />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
