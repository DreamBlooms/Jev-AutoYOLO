import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { BrandMark } from "@/components/BrandMark";
import { MockStep } from "@/components/Onboarding";
import type { StepKey } from "@/components/Onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listProjects } from "@/services/api";

const PREVIEW_WIDTH = 760;

function ScaledPreview({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setScale(element.clientWidth / PREVIEW_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      <div className="origin-top-left" style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

const WORKFLOW = [
  { key: "project", tab: null, title: "onboarding.steps.project.title", desc: "onboarding.steps.project.desc", mock: "project" },
  { key: "annotate", tab: "annotate", title: "onboarding.steps.annotate.title", desc: "onboarding.steps.annotate.desc", mock: "annotate" },
  { key: "review", tab: "review", title: "onboarding.steps.review.title", desc: "onboarding.steps.review.desc", mock: "review" },
  { key: "dataset", tab: "datasets", title: "onboarding.steps.dataset.title", desc: "onboarding.steps.dataset.desc", mock: "dataset" },
  { key: "training", tab: "training", title: "onboarding.steps.training.title", desc: "onboarding.steps.training.desc", mock: "training" },
  { key: "validation", tab: "validation", title: "onboarding.steps.validation.title", desc: "onboarding.steps.validation.desc", mock: "validation" },
  { key: "models", tab: "models", title: "fullSteps.workflow.models.title", desc: "fullSteps.workflow.models.desc", mock: "done" },
  { key: "classic", tab: null, classic: true, title: "fullSteps.workflow.classic.title", desc: "fullSteps.workflow.classic.desc", mock: "classic" },
] as const;

export function FullStepsPage() {
  const { t } = useTranslation();
  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const projectId = projects.data?.[0]?.id;

  const hrefFor = (step: (typeof WORKFLOW)[number]) => {
    if (step.key === "project") return "/";
    if (!projectId) return "/";
    if ("classic" in step && step.classic) return `/projects/${projectId}/classic`;
    return `/projects/${projectId}?tab=${step.tab}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-3 sm:px-6 lg:min-h-0">
        <div className="flex shrink-0 items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">AutoYOLO showcase</div>
          <Button variant="ghost" size="sm" asChild><Link to="/"><ArrowLeft /> {t("fullSteps.back")}</Link></Button>
        </div>

        <header className="flex shrink-0 flex-col gap-3 border-b border-border/70 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <BrandMark className="size-14 text-foreground" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">AutoYOLO</h1>
              <div className="mt-1 flex items-center gap-2"><span className="text-sm text-muted-foreground">{t("fullSteps.title")}</span><Badge variant="muted">{WORKFLOW.length - 1} {t("fullSteps.steps")}</Badge></div>
            </div>
          </div>
          <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground lg:text-right">
            <p className="font-semibold text-foreground">{t("fullSteps.intro1")}</p>
            <p className="mt-1">{t("fullSteps.intro2")}</p>
          </div>
        </header>

        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          {WORKFLOW.map((step, index) => (
            <article key={step.key} className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border border-border text-[10px] font-semibold", index === 0 ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground")}>{step.key === "classic" ? "?" : index + 1}</span>
                <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{t(step.title)}</h2><p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{t(step.desc)}</p></div>
              </div>
              <div className="group relative mt-2 min-h-[150px] flex-1 overflow-hidden rounded-lg">
                <div className="pointer-events-none h-full w-full [&_[data-mock-sidebar]]:hidden">
                  <ScaledPreview><MockStep step={step.mock as StepKey} /></ScaledPreview>
                </div>
                <Link to={hrefFor(step)} aria-label={`${t("fullSteps.open")}: ${t(step.title)}`} className="absolute inset-0 z-20 flex items-end justify-end rounded-lg p-2 outline-none ring-inset transition-shadow focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-2.5 py-1 text-[10px] font-medium shadow-sm opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{t("fullSteps.open")} <ArrowUpRight className="size-3" /></span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
