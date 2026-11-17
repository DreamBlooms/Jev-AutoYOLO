import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileBox, PlayCircle, RefreshCw, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/formatDate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cancelTrainingJob, deleteTrainingJob, downloadDatasetUrl, downloadModelUrl, downloadOnnxUrl, fetchTrainingJobs, listProjects } from "@/services/api";
import type { TrainingJob } from "@/types";

function JobStatus({ status }: { status: TrainingJob["status"] }) {
  const { t } = useTranslation();
  const variant = status === "completed" ? "success" : status === "failed" ? "destructive" : status === "running" ? "info" : "warning";
  return <Badge variant={variant}>{t(`training.status.${status}`)}</Badge>;
}

export function ModelsPanel({ projectId, showProjectFilter = false }: { projectId: string; showProjectFilter?: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterProject, setFilterProject] = useState(projectId);
  const activeProject = showProjectFilter ? filterProject : projectId;

  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled: showProjectFilter });
  const jobs = useQuery({
    queryKey: ["project-jobs", activeProject || "all"],
    queryFn: () => fetchTrainingJobs(1, 1000, activeProject || undefined),
    refetchInterval: (query) => query.state.data?.items.some((job) => job.status === "pending" || job.status === "running") ? 8000 : false,
  });

  const cancel = useMutation({
    mutationFn: cancelTrainingJob,
    onSuccess: () => { toast.success(t("training.cancelled")); queryClient.invalidateQueries({ queryKey: ["project-jobs"] }); },
    onError: (error) => toast.error(apiErrorMessage(error, t("training.cancelFailed"))),
  });
  const remove = useMutation({
    mutationFn: deleteTrainingJob,
    onSuccess: () => { toast.success(t("training.deleted")); queryClient.invalidateQueries({ queryKey: ["project-jobs"] }); queryClient.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (error) => toast.error(apiErrorMessage(error, t("training.deleteFailed"))),
  });

  const validate = (job: TrainingJob) => {
    const target = job.projectId || activeProject;
    navigate(`/projects/${target}?tab=validation&validateJob=${job.id}`);
  };

  const items = jobs.data?.items ?? [];
  const projectName = (id: string | null) => projects.data?.find((project) => project.id === id)?.name ?? id?.slice(0, 8) ?? "—";

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {showProjectFilter ? (
            <Select className="w-56" value={filterProject} onChange={(event) => setFilterProject(event.target.value)}>
              <option value="">{t("review.allProjects")}</option>
              {projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
          ) : null}
          <Badge variant="secondary">{t("models.total", { count: items.length })}</Badge>
          <Badge variant="success">{t("models.ready", { count: items.filter((job) => job.status === "completed").length })}</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => jobs.refetch()}><RefreshCw /> {t("common.refresh")}</Button>
      </div>

      {jobs.isLoading ? <Skeleton className="h-72 w-full" /> : items.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((job) => (
            <Card key={job.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate">{job.name || job.modelVariant}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{showProjectFilter ? `${projectName(job.projectId)} · ` : ""}{job.taskType} · {job.epochs} epochs · imgsz {job.imgsz}</p>
                </div>
                <JobStatus status={job.status} />
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-4 gap-2 rounded-lg border border-border bg-muted/20 p-3 text-center">
                  {[
                    ["mAP50", job.metrics?.mAP50],
                    ["mAP50-95", job.metrics?.["mAP50-95"]],
                    [t("models.precision"), job.metrics?.precision],
                    [t("models.recall"), job.metrics?.recall],
                  ].map(([label, value]) => (
                    <div key={String(label)}><div className="text-base font-semibold">{typeof value === "number" ? value.toFixed(3) : "—"}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{String(label)}</div></div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(job.createdAt, i18n.language)}</span>
                  <span className="flex items-center gap-1"><FileBox className="size-3.5" /> {job.detectionIds.length} {t("datasets.images")}</span>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {job.status === "completed" ? (
                    <>
                      <Button size="sm" asChild><a href={downloadModelUrl(job.id)}><Download /> .pt</a></Button>
                      <Button size="sm" variant="outline" asChild><a href={downloadOnnxUrl(job.id)}><Download /> ONNX</a></Button>
                      <Button size="sm" variant="outline" asChild><a href={downloadDatasetUrl(job.id)}><Download /> {t("models.dataset")}</a></Button>
                      <Button size="sm" onClick={() => validate(job)}><PlayCircle /> {t("models.validate")}</Button>
                    </>
                  ) : job.status === "running" || job.status === "pending" ? (
                    <Button size="sm" variant="outline" className="text-destructive" disabled={cancel.isPending} onClick={() => cancel.mutate(job.id)}><Square /> {t("common.cancel")}</Button>
                  ) : null}
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive" disabled={remove.isPending} onClick={() => { if (window.confirm(t("training.deleteConfirm"))) remove.mutate(job.id); }}><Trash2 /> {t("common.delete")}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <Empty title={t("models.empty")} description={t("models.emptyHint")} />}
    </div>
  );
}
