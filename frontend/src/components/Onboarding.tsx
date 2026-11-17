import {
  ArrowRight,
  Boxes,
  Check,
  CheckSquare2,
  CircleCheckBig,
  Compass,
  Database,
  FolderKanban,
  GraduationCap,
  Images,
  MousePointerClick,
  ScanSearch,
  ShieldCheck,
  Timer,
  Upload,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { BrandMark } from "@/components/BrandMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "autoyolo-onboarding-v1";
const OPEN_EVENT = "autoyolo:onboarding";

const STEPS = [
  { key: "intro", icon: Compass },
  { key: "project", icon: FolderKanban },
  { key: "annotate", icon: ScanSearch },
  { key: "review", icon: CheckSquare2 },
  { key: "dataset", icon: Database },
  { key: "training", icon: GraduationCap },
  { key: "validation", icon: ShieldCheck },
  { key: "done", icon: CircleCheckBig },
] as const;

const MOCK_NAV = [
  { key: "projects", icon: FolderKanban },
  { key: "review", icon: CheckSquare2 },
  { key: "datasets", icon: Database },
  { key: "models", icon: Boxes },
  { key: "settings", icon: Workflow },
] as const;

const PROJECT_TABS = ["annotate", "review", "datasets", "training", "validation", "models"] as const;

export type StepKey = (typeof STEPS)[number]["key"] | "classic";
type NavKey = (typeof MOCK_NAV)[number]["key"];
type ProjectTab = (typeof PROJECT_TABS)[number];

function Dim({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("opacity-60", className)}>{children}</div>;
}

function Focus({ children, marker, className }: { children: ReactNode; marker: string; className?: string }) {
  return (
    <div className={cn("relative z-10 rounded-lg shadow-md shadow-sky-500/15 ring-2 ring-sky-500 ring-offset-2 ring-offset-background", className)}>
      {children}
      <span className="pointer-events-none absolute -right-2 -top-2 z-20 inline-flex items-center gap-1 rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-md">
        <MousePointerClick className="size-2.5" /> {marker}
      </span>
    </div>
  );
}

function MockApp({ navKey, title, subtitle, tabs, activeTab, children }: { navKey: NavKey; title: string; subtitle: string; tabs?: boolean; activeTab?: ProjectTab; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <aside data-mock-sidebar className="hidden w-28 shrink-0 border-r border-border bg-muted/30 p-2 opacity-70 sm:block">
        <div className="px-1 text-[10px] font-semibold tracking-tight">AutoYOLO</div>
        <div className="mt-2 grid gap-0.5">
          {MOCK_NAV.map((item) => {
            const Icon = item.icon;
            const active = item.key === navKey;
            return (
              <div key={item.key} className={cn("flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[9px]", active ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
                <Icon className="size-3" /> {t(`nav.${item.key}`)}
              </div>
            );
          })}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 border-b border-border p-3 opacity-80">
          <div className="min-w-0"><div className="truncate text-sm font-semibold">{title}</div><div className="truncate text-[10px] text-muted-foreground">{subtitle}</div></div>
          <div className="flex shrink-0 gap-1"><Badge variant="secondary">EN</Badge><Badge variant="secondary">中文</Badge></div>
        </div>
        {tabs ? (
          <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2 text-[10px] opacity-80">
            {PROJECT_TABS.map((tab) => <span key={tab} className={cn("rounded-md px-1.5 py-0.5", tab === activeTab ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{t(`project.tabs.${tab}`)}</span>)}
          </div>
        ) : null}
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

function IntroMock() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-7 text-center">
      <BrandMark className="size-24 text-foreground" />
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">{t("onboarding.intro.welcome")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("onboarding.intro.desc")}</p>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm"><Timer className="size-3.5" /> {t("onboarding.intro.time")}</div>
    </div>
  );
}

function ProjectMock() {
  const { t } = useTranslation();
  return (
    <MockApp navKey="projects" title={t("projects.title")} subtitle={t("projects.subtitle")}>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
        <Focus marker="1">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-[10px] text-muted-foreground">{t("projects.createTitle")}</div>
            <div className="mt-2 h-7 rounded-md border border-border px-2 py-1.5 text-[10px]">{t("onboarding.mock.projectName")}</div>
            <div className="mt-1.5 flex flex-wrap gap-1"><Badge variant="secondary">helmet</Badge><Badge variant="secondary">vest</Badge><Badge variant="secondary">person</Badge></div>
            <div className="mt-2 inline-flex h-7 items-center rounded-md bg-primary px-2 text-[10px] text-primary-foreground">{t("projects.create")}</div>
          </div>
        </Focus>
        <Dim className="rounded-lg border border-border p-3"><div className="text-[10px] font-medium">{t("projects.workspace")}</div><div className="mt-2 grid gap-1 text-[9px] text-muted-foreground"><span>42 {t("projects.images")}</span><span>96 {t("projects.boxes")}</span><span>0 {t("projects.jobs")}</span></div></Dim>
      </div>
    </MockApp>
  );
}

function AnnotateMock() {
  const { t } = useTranslation();
  return (
    <MockApp navKey="projects" title={t("onboarding.mock.projectName")} subtitle={t("onboarding.mock.domain")} tabs activeTab="annotate">
      <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <Dim><div className="rounded-lg border-2 border-dashed border-border p-2 text-center text-[9px] text-muted-foreground"><Upload className="mx-auto mb-1 size-4" />{t("imageUploader.dragToUpload")}</div></Dim>
          <div className="flex flex-wrap gap-1"><Badge variant="secondary">helmet</Badge><Badge variant="secondary">vest</Badge><Badge variant="secondary">person</Badge></div>
          <Focus marker="1"><Button size="sm" className="w-full"><ScanSearch /> {t("home.detectBtnImage")}</Button></Focus>
        </div>
        <div className="relative min-h-40 overflow-hidden rounded-lg border border-border bg-muted/40 p-2">
          <div className="absolute inset-2 rounded bg-[linear-gradient(135deg,var(--muted),var(--background))]" />
          <div className="absolute left-[22%] top-[18%] h-[38%] w-[24%] rounded border-2 border-emerald-500"><span className="absolute -top-4 left-0 rounded bg-emerald-500 px-1 text-[8px] text-white">person</span></div>
          <div className="absolute left-[46%] top-[24%] h-[20%] w-[18%] rounded border-2 border-sky-500"><span className="absolute -top-4 left-0 rounded bg-sky-500 px-1 text-[8px] text-white">helmet</span></div>
          <div className="absolute right-[12%] top-[44%] h-[28%] w-[20%] rounded border-2 border-amber-500"><span className="absolute -top-4 left-0 rounded bg-amber-500 px-1 text-[8px] text-white">vest</span></div>
          <Dim className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[9px]"><Images className="size-3" /> warehouse_042.jpg</Dim>
        </div>
      </div>
    </MockApp>
  );
}

function ReviewMock() {
  const { t } = useTranslation();
  return (
    <MockApp navKey="review" title={t("review.title")} subtitle={t("review.subtitle")}>
      <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <Focus marker="1"><div className="rounded-lg border border-primary/40 bg-primary/5 p-2 text-[9px]"><div className="flex items-center gap-1"><input type="checkbox" readOnly checked /><span className="font-medium">warehouse_042.jpg</span></div><p className="mt-1 text-muted-foreground">3 boxes · helmet, vest, person</p></div></Focus>
          <Dim><div className="rounded-lg border border-border p-2 text-[9px]"><div className="flex items-center gap-1"><input type="checkbox" readOnly /><span>warehouse_041.jpg</span></div><p className="mt-1 text-muted-foreground">2 boxes · helmet, person</p></div></Dim>
          <Dim><div className="rounded-lg border border-border p-2 text-[9px]"><div className="flex items-center gap-1"><input type="checkbox" readOnly /><span>warehouse_040.jpg</span></div><p className="mt-1 text-muted-foreground">1 box · person</p></div></Dim>
        </div>
        <div className="grid content-start gap-2">
          <div className="relative min-h-36 rounded-lg border border-border bg-muted/40 p-2">
            <div className="absolute left-[20%] top-[22%] h-[42%] w-[28%] rounded border-2 border-emerald-500" />
            <div className="absolute right-[18%] top-[28%] h-[30%] w-[24%] rounded border-2 border-amber-500" />
          </div>
          <div className="flex justify-end gap-1"><Dim><Button size="sm" variant="outline"><CheckSquare2 /> {t("review.reject")}</Button></Dim><Focus marker="2"><Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-600/90"><Check /> {t("review.accept")}</Button></Focus></div>
        </div>
      </div>
    </MockApp>
  );
}

function DatasetMock() {
  const { t } = useTranslation();
  return (
    <MockApp navKey="datasets" title={t("datasets.title")} subtitle={t("datasets.subtitle")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1"><Badge variant="secondary">helmet: 38</Badge><Badge variant="secondary">vest: 31</Badge><Badge variant="secondary">person: 42</Badge></div>
        <Focus marker="1"><Button size="sm"><Database /> {t("datasets.exportAll")}</Button></Focus>
      </div>
      <Dim className="mt-2 overflow-hidden rounded-lg border border-border">
        {[["warehouse_042.jpg", "helmet, vest, person", "3"], ["warehouse_041.jpg", "helmet, person", "2"], ["warehouse_040.jpg", "person", "1"]].map(([name, tags, boxes]) => (
          <div key={name} className="grid grid-cols-[minmax(0,1fr)_90px_30px] gap-2 border-b border-border px-2 py-1.5 text-[9px] last:border-0"><span className="truncate font-medium">{name}</span><span className="truncate text-muted-foreground">{tags}</span><span className="text-right">{boxes}</span></div>
        ))}
      </Dim>
    </MockApp>
  );
}

function TrainingMock() {
  const { t } = useTranslation();
  return (
    <MockApp navKey="projects" title={t("onboarding.mock.projectName")} subtitle={t("onboarding.mock.domain")} tabs activeTab="training">
      <div className="grid gap-2 sm:grid-cols-3">
        {[[t("datasets.images"), "42"], [t("review.accepted"), "38"], [t("datasets.classes"), "3"]].map(([label, value]) => (
          <Dim key={label} className="rounded-lg border border-border p-2"><div className="text-[9px] text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></Dim>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[[t("trainingPanel.series"), "YOLO11"], [t("trainingPanel.specification"), "yolo11n"], [t("trainingPanel.epochs"), "100"], [t("trainingPanel.imgsz"), "640"]].map(([label, value], index) => (
          <div key={label} className={cn("rounded-md border border-border p-2", index === 1 && "border-primary/40 bg-primary/5")}><div className="text-[9px] text-muted-foreground">{label}</div><div className="text-[10px] font-medium">{value}</div></div>
        ))}
      </div>
      <Dim className="mt-2 flex flex-wrap gap-1"><Badge variant="secondary">batch: 16</Badge><Badge variant="secondary">70 / 20 / 10</Badge><Badge variant="info">detect</Badge></Dim>
      <div className="mt-3 flex justify-end"><Focus marker="1"><Button size="sm"><GraduationCap /> {t("trainingPanel.startTrain")}</Button></Focus></div>
    </MockApp>
  );
}

function ValidationMock() {
  const { t } = useTranslation();
  return (
    <MockApp navKey="projects" title={t("onboarding.mock.projectName")} subtitle={t("onboarding.mock.domain")} tabs activeTab="validation">
      <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <Focus marker="1"><div className="rounded-lg border border-border p-2"><div className="text-[9px] text-muted-foreground">{t("common.project")}</div><div className="mt-1 rounded-md border border-border px-2 py-1 text-[10px]">yolo11n · mAP50 0.91</div></div></Focus>
          <Dim className="grid grid-cols-2 gap-1"><div className="rounded border border-border p-1 text-[8px]">conf 0.25</div><div className="rounded border border-border p-1 text-[8px]">iou 0.70</div></Dim>
          <Focus marker="2"><Button size="sm" className="w-full"><ShieldCheck /> {t("home.yoloValidation")}</Button></Focus>
        </div>
        <div className="relative min-h-36 rounded-lg border border-border bg-muted/40 p-2">
          <div className="absolute left-[24%] top-[22%] h-[42%] w-[26%] rounded border-2 border-emerald-500"><span className="absolute -top-4 left-0 rounded bg-emerald-500 px-1 text-[8px] text-white">person 0.94</span></div>
          <div className="absolute right-[18%] top-[30%] h-[28%] w-[22%] rounded border-2 border-sky-500"><span className="absolute -top-4 left-0 rounded bg-sky-500 px-1 text-[8px] text-white">helmet 0.88</span></div>
        </div>
      </div>
    </MockApp>
  );
}

function DoneMock() {
  const { t } = useTranslation();
  return (
    <MockApp navKey="models" title={t("models.title")} subtitle={t("models.subtitle")}>
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 opacity-90">
        <div className="flex items-center gap-2 text-[11px] font-semibold"><CircleCheckBig className="size-4 text-emerald-600" /> {t("trainingPanel.trainCompleted")}</div>
        <Progress value={100} className="mt-2" />
        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[9px]">
          {[["0.91", "mAP50"], ["0.72", "mAP50-95"], ["3", t("datasets.classes")], ["yolo11n", t("models.validate")]].map(([value, label]) => <div key={label} className="rounded bg-background/80 p-1.5"><div className="text-sm font-semibold">{value}</div><div className="text-muted-foreground">{label}</div></div>)}
        </div>
      </div>
      <Dim className="mt-2 rounded-lg border border-border p-2"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">{t("trainingPanel.model")}</div><div className="mt-1 font-mono text-[10px]">{t("onboarding.mock.projectName")} · yolo11n · 8f3c2a1d</div></Dim>
      <div className="mt-3 flex flex-wrap justify-end gap-2"><Dim><Button size="sm" variant="outline">ONNX</Button></Dim><Focus marker="1"><Button size="sm"><ShieldCheck /> {t("models.validate")}</Button></Focus></div>
    </MockApp>
  );
}

function ClassicMock() {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-border p-2"><div className="flex items-center gap-1.5 text-[10px] font-semibold"><BrandMark className="size-4" /> AutoYOLO · {t("project.classicWorkspace")}</div><Badge variant="muted">127.0.0.1:8001</Badge></div>
      <div className="grid gap-2 p-2 sm:grid-cols-[110px_minmax(0,1fr)]">
        <div className="grid content-start gap-1"><Badge variant="secondary">JEV</Badge><div className="rounded border border-border p-1.5 text-[8px] text-muted-foreground">{t("deviceSelector.label")}: auto</div><div className="flex gap-1"><Badge variant="muted">helmet</Badge><Badge variant="muted">vest</Badge></div><Focus marker="1"><div className="rounded bg-primary px-2 py-1 text-center text-[9px] text-primary-foreground">{t("home.detectBtnImage")}</div></Focus><Dim><div className="rounded border border-border p-1 text-[8px]">History · 42</div></Dim><Dim><div className="rounded border border-border p-1 text-[8px]">YOLO Train</div></Dim></div>
        <div className="relative min-h-40 rounded-lg border border-border bg-muted/40"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,var(--muted),var(--background))]" /><div className="absolute left-[26%] top-[24%] h-[40%] w-[25%] rounded border-2 border-emerald-500" /><div className="absolute right-[20%] top-[34%] h-[26%] w-[22%] rounded border-2 border-amber-500" /></div>
      </div>
    </div>
  );
}

export function MockStep({ step }: { step: StepKey }) {
  if (step === "intro") return <IntroMock />;
  if (step === "project") return <ProjectMock />;
  if (step === "annotate") return <AnnotateMock />;
  if (step === "review") return <ReviewMock />;
  if (step === "dataset") return <DatasetMock />;
  if (step === "training") return <TrainingMock />;
  if (step === "validation") return <ValidationMock />;
  if (step === "done") return <DoneMock />;
  return <ClassicMock />;
}

export function Onboarding() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "done");
    setOpen(false);
  };

  useEffect(() => {
    const reopen = () => { setStep(0); setOpen(true); };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) finish(); }}>
      <DialogContent className="max-w-6xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">{t("onboarding.badge")}</DialogTitle>
        <div className="grid h-[82vh] max-h-[82vh] lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground lg:block">
            <div className="px-1">
              <div className="text-[17px] font-semibold tracking-tight">AutoYOLO</div>
              <div className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/55">{t("app.tagline")}</div>
              <div className="mt-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">{t("onboarding.badge")}</div>
            </div>
            <div className="mt-3 grid gap-1">
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                const active = index === step;
                const done = index < step;
                return (
                  <button key={item.key} type="button" onClick={() => setStep(index)} className={cn("flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors", active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm ring-1 ring-inset ring-sidebar-border dark:ring-white/15" : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-[10px]", active ? "border-sidebar-border bg-background/40 text-sidebar-primary dark:bg-white/10 dark:text-white" : done ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 dark:text-emerald-300" : "border-sidebar-border text-sidebar-foreground/55")}>{done ? <Check className="size-3" /> : <Icon className="size-3" />}</span>
                    <span>{t(`onboarding.steps.${item.key}.title`)}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-lg border border-sidebar-border/80 bg-sidebar-accent/50 p-3 text-[9px] leading-relaxed">
              <p className="text-sidebar-foreground/45">{t("onboarding.mockNote1")}</p>
              <p className="mt-1 text-sidebar-foreground/70">{t("onboarding.mockNote2")}</p>
            </div>
          </aside>
          <section className="flex min-h-0 min-w-0 flex-col">
            {current.key === "intro" ? (
              <div className="flex items-center justify-between border-b border-border p-4 pr-12"><Badge variant="info">{t("onboarding.step", { current: step, total: STEPS.length - 1 })}</Badge><span className="text-xs text-muted-foreground lg:hidden">AutoYOLO</span></div>
            ) : (
              <div className="border-b border-border p-5 pr-12">
                <div className="flex flex-wrap items-center gap-2"><Badge variant="info">{t("onboarding.step", { current: step, total: STEPS.length - 1 })}</Badge><span className="text-xs text-muted-foreground lg:hidden">{t(`onboarding.steps.${current.key}.title`)}</span></div>
                <h2 className="mt-2 text-xl font-semibold">{t(`onboarding.steps.${current.key}.title`)}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`onboarding.steps.${current.key}.desc`)}</p>
              </div>
            )}
            <div className="flex-1 overflow-y-auto bg-muted/10 p-4 sm:p-5"><MockStep step={current.key} /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
              <Button variant="ghost" onClick={finish}>{t("onboarding.skip")}</Button>
              <div className="flex gap-2">
                <Button variant="outline" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>{t("onboarding.back")}</Button>
                {step === STEPS.length - 1 ? <Button className="bg-emerald-600 text-white hover:bg-emerald-600/90" onClick={finish}>{t("onboarding.finish")}</Button> : <Button onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>{t("onboarding.next")} <ArrowRight /></Button>}
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
