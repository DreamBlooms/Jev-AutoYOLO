import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Plus, ScanSearch, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/formatDate";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createProject, deleteProject, listProjects } from "@/services/api";

export function ProjectsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState("");

  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const create = useMutation({
    mutationFn: () =>
      createProject({
        name: name.trim(),
        description: description.trim(),
        categories: categories.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
      }),
    onSuccess: (project) => {
      toast.success(t("projects.created"));
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setName("");
      setDescription("");
      setCategories("");
      navigate(`/projects/${project.id}`);
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("projects.createFailed"))),
  });
  const remove = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      toast.success(t("projects.deleted"));
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("projects.deleteFailed"))),
  });

  return (
    <div>
      <PageHeader
        title={t("projects.title")}
        subtitle={t("projects.subtitle")}
        extra={
          <Button onClick={() => setOpen(true)}>
            <Plus /> {t("projects.new")}
          </Button>
        }
      />

      {projects.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Card key={item}><CardContent className="space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-7 w-3/4" /><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : projects.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((project) => (
            <Card key={project.id} className="group transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("projects.workspace")}</span>
                    {project.categories.slice(0, 2).map((category) => <Badge key={category} variant="secondary">{category}</Badge>)}
                    {project.categories.length > 2 ? <Badge variant="muted">+{project.categories.length - 2}</Badge> : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => {
                      if (window.confirm(t("projects.deleteConfirm", { name: project.name }))) remove.mutate(project.id);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <CardTitle className="text-xl">{project.name}</CardTitle>
                <p className="line-clamp-2 min-h-8 text-sm text-muted-foreground">{project.description || t("projects.noDescription")}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 rounded-lg border border-border/70 bg-muted/25 p-3 text-center">
                  {[
                    [t("projects.images"), project.imageCount],
                    [t("projects.boxes"), project.boxCount],
                    [t("projects.jobs"), project.trainingJobCount],
                    [t("projects.models"), project.modelCount],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <div className="text-lg font-semibold">{value}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
                {project.pendingReviewCount > 0 ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-300">
                    <ScanSearch className="size-3.5" /> {t("projects.pendingReview", { count: project.pendingReviewCount })}
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ScanSearch className="size-3.5" /> {t("projects.reviewClear")}
                  </p>
                )}
              </CardContent>
              <div className="flex items-center justify-between border-t border-border/70 px-5 pt-4">
                <span className="text-xs text-muted-foreground">{formatDate(project.createdAt, i18n.language)}</span>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${project.id}`)}>
                  <FolderOpen /> {t("projects.open")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty
          title={t("projects.empty")}
          description={t("projects.emptyHint")}
          action={<Button onClick={() => setOpen(true)}><Plus /> {t("projects.new")}</Button>}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">{t("projects.name")}</Label>
              <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("projects.namePlaceholder")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-description">{t("projects.description")}</Label>
              <Textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("projects.descriptionPlaceholder")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-categories">{t("projects.categories")}</Label>
              <Input id="project-categories" value={categories} onChange={(event) => setCategories(event.target.value)} placeholder={t("projects.categoriesPlaceholder")} />
              <p className="text-xs text-muted-foreground">{t("projects.categoriesHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>{t("projects.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
