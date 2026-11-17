import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Languages, Moon, Sun } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { Home } from "@/pages/Home";
import { getProject } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { value: "zh", label: "中" },
  { value: "en", label: "EN" },
  { value: "ja", label: "日" },
] as const;

export function ClassicWorkspacePage() {
  const { projectId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const validateJob = searchParams.get("validateJob");
  const { isDark, setThemeMode } = useTheme();
  const setCurrentProjectId = useAppStore((state) => state.setCurrentProjectId);
  const setCategories = useAppStore((state) => state.setCategories);
  const setResult = useAppStore((state) => state.setResult);
  const setPreviewUrl = useAppStore((state) => state.setPreviewUrl);
  const setBatchResults = useAppStore((state) => state.setBatchResults);
  const setValidateVideoId = useAppStore((state) => state.setValidateVideoId);
  const setAppMode = useAppStore((state) => state.setAppMode);
  const setSelectedTrainedJobId = useAppStore((state) => state.setSelectedTrainedJobId);
  const setValidateModelSource = useAppStore((state) => state.setValidateModelSource);
  const loadedProject = useRef<string | null>(null);
  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId), enabled: Boolean(projectId) });
  const language = i18n.language.slice(0, 2);

  useEffect(() => {
    setCurrentProjectId(projectId || null);
    if (validateJob) {
      setAppMode("validate");
      setValidateModelSource("trained");
      setSelectedTrainedJobId(validateJob);
    } else {
      setAppMode("annotate");
    }
    setResult(null);
    setPreviewUrl(null);
    setBatchResults([]);
    setValidateVideoId(null);
    loadedProject.current = null;
  }, [projectId, validateJob, setAppMode, setBatchResults, setCurrentProjectId, setPreviewUrl, setResult, setSelectedTrainedJobId, setValidateModelSource, setValidateVideoId]);

  useEffect(() => {
    if (!project.data || loadedProject.current === project.data.id) return;
    setCategories(project.data.categories);
    loadedProject.current = project.data.id;
  }, [project.data, setCategories]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-background/80 px-4 py-2.5 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/projects/${projectId}?tab=annotate`} className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-7 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-tight tracking-tight">AutoYOLO · {t("project.classicWorkspace")}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{project.data?.name ?? t("app.tagline")}</span>
            </span>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/projects/${projectId}?tab=annotate`}><ArrowLeft /> {t("project.backToAnnotation")}</Link>
          </Button>
          <div className="hidden items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 sm:flex">
            <Languages className="ml-1 size-3.5 text-muted-foreground" />
            {LANGUAGES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => i18n.changeLanguage(item.value)}
                className={cn("rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors", language === item.value && "bg-background text-foreground shadow-sm ring-1 ring-inset ring-border")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setThemeMode(isDark ? "light" : "dark")} aria-label="Toggle theme">
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Home />
      </div>
    </div>
  );
}
