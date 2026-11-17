import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckSquare2, Database, FolderKanban, GraduationCap, Monitor, ScanSearch, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatasetsPanel } from "@/components/project/DatasetsPanel";
import { ModelsPanel } from "@/components/project/ModelsPanel";
import { ReviewPanel } from "@/components/project/ReviewPanel";
import { ProjectTrainingPanel } from "@/components/project/TrainingPanel";
import { Home } from "@/pages/Home";
import { useAppStore } from "@/store/useAppStore";
import { getProject } from "@/services/api";

const TABS = ["annotate", "review", "datasets", "training", "validation", "models"] as const;
type TabKey = (typeof TABS)[number];

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") ?? "annotate";
  const tab: TabKey = TABS.includes(requestedTab as TabKey) ? (requestedTab as TabKey) : "annotate";
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

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    setCurrentProjectId(projectId || null);
    setAppMode(tab === "validation" ? "validate" : "annotate");
    if (tab === "validation") {
      setValidateModelSource("trained");
      const requestedJob = searchParams.get("validateJob");
      setSelectedTrainedJobId(requestedJob);
    }
    setResult(null);
    setPreviewUrl(null);
    setBatchResults([]);
    setValidateVideoId(null);
    loadedProject.current = null;
  }, [projectId, tab, searchParams, setAppMode, setBatchResults, setCurrentProjectId, setPreviewUrl, setResult, setSelectedTrainedJobId, setValidateModelSource, setValidateVideoId]);

  useEffect(() => {
    if (!project.data || loadedProject.current === project.data.id) return;
    setCategories(project.data.categories);
    loadedProject.current = project.data.id;
  }, [project.data, setCategories]);

  if (project.isLoading) {
    return <Card><CardContent className="space-y-4 pt-5"><Skeleton className="h-8 w-64" /><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></CardContent></Card>;
  }
  if (project.isError || !project.data) {
    return <Empty title={t("common.notFound")} action={<Button variant="outline" onClick={() => navigate("/")}><ArrowLeft /> {t("nav.projects")}</Button>} />;
  }

  const data = project.data;
  const stats = [
    [t("projects.images"), data.imageCount],
    [t("projects.boxes"), data.boxCount],
    [t("review.pending"), data.pendingReviewCount],
    [t("projects.jobs"), data.trainingJobCount],
    [t("projects.models"), data.modelCount],
  ];

  return (
    <div>
      <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" onClick={() => navigate("/")}>
        <ArrowLeft /> {t("nav.projects")}
      </Button>
      <PageHeader
        title={data.name}
        subtitle={data.description || t("projects.noDescription")}
        extra={
          <div className="flex flex-wrap items-center gap-2">
            {data.categories.slice(0, 3).map((category) => <Badge key={category} variant="secondary">{category}</Badge>)}
            {data.categories.length > 3 ? <Badge variant="muted">+{data.categories.length - 3}</Badge> : null}
            <Button variant="outline" asChild>
              <Link to={`/projects/${projectId}/classic`}><Monitor /> {t("project.classicWorkspace")}</Link>
            </Button>
            <Button onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("tab", "review");
              setSearchParams(next, { replace: true });
            }}>
              <CheckSquare2 /> {t("nav.review")} ({data.pendingReviewCount})
            </Button>
          </div>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <Card key={String(label)} className="py-3"><CardContent><div className="text-2xl font-semibold">{value}</div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div></CardContent></Card>
        ))}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          next.set("tab", value);
          setSearchParams(next, { replace: true });
        }}
      >
        <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0">
          {[
            { value: "annotate", icon: ScanSearch },
            { value: "review", icon: CheckSquare2 },
            { value: "datasets", icon: Database },
            { value: "training", icon: GraduationCap },
            { value: "validation", icon: ShieldCheck },
            { value: "models", icon: FolderKanban },
          ].map(({ value, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5 rounded-lg border border-transparent px-3 py-2 data-[state=active]:border-border">
              <Icon className="size-3.5" /> {t(`project.tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="annotate" className="min-h-[680px]">
          <div className="h-[calc(100vh-330px)] min-h-[640px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Home simple />
          </div>
        </TabsContent>
        <TabsContent value="review"><ReviewPanel projectId={projectId} /></TabsContent>
        <TabsContent value="datasets"><DatasetsPanel projectId={projectId} /></TabsContent>
        <TabsContent value="training"><ProjectTrainingPanel projectId={projectId} /></TabsContent>
        <TabsContent value="validation" className="min-h-[680px]">
          <div className="h-[calc(100vh-330px)] min-h-[640px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Home simple validationOnly />
          </div>
        </TabsContent>
        <TabsContent value="models"><ModelsPanel projectId={projectId} /></TabsContent>
      </Tabs>
    </div>
  );
}
