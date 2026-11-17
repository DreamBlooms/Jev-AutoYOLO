import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FolderArchive, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/formatDate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty } from "@/components/ui/empty";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TagFilter } from "@/components/TagFilter";
import { useAppStore } from "@/store/useAppStore";
import {
  deleteDetection,
  downloadBlob,
  exportAll,
  exportBatch,
  listDetections,
  listProjects,
} from "@/services/api";
import { DatasetImportModal } from "@/components/DatasetImportModal";

const PAGE_SIZE = 10000;

export function DatasetsPanel({ projectId, showProjectFilter = false }: { projectId: string; showProjectFilter?: boolean }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const [filterProject, setFilterProject] = useState(projectId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const activeProject = showProjectFilter ? filterProject : projectId;

  useEffect(() => {
    if (activeProject) setCurrentProjectId(activeProject);
  }, [activeProject, setCurrentProjectId]);

  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled: showProjectFilter });
  const detections = useQuery({
    queryKey: ["project-detections", activeProject || "all"],
    queryFn: () => listDetections(1, PAGE_SIZE, activeProject || undefined),
  });

  const allItems = useMemo(() => detections.data?.items ?? [], [detections.data]);
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    allItems.forEach((item) => item.categories.forEach((category) => counts.set(category, (counts.get(category) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allItems]);
  const items = useMemo(
    () => selectedTags.size === 0 ? allItems : allItems.filter((item) => item.categories.some((category) => selectedTags.has(category))),
    [allItems, selectedTags],
  );

  const exportMutation = useMutation({
    mutationFn: ({ format, ids }: { format: string; ids?: string[] }) =>
      ids?.length ? exportBatch(ids, format) : exportAll(format, activeProject || undefined),
    onSuccess: (blob, variables) => {
      downloadBlob(blob, `${variables.format}_dataset.zip`);
      toast.success(t("datasets.downloaded"));
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("datasets.downloadFailed"))),
  });
  const remove = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map((id) => deleteDetection(id))),
    onSuccess: () => {
      toast.success(t("datasets.deleted"));
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["detections"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("datasets.deleteFailed"))),
  });

  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const accepted = items.filter((item) => item.reviewStatus === "accepted").length;
  const pending = items.filter((item) => item.reviewStatus === "pending").length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {showProjectFilter ? (
            <Select className="w-56" value={filterProject} onChange={(event) => { setFilterProject(event.target.value); setSelected(new Set()); setSelectedTags(new Set()); }}>
              <option value="">{t("review.allProjects")}</option>
              {projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
          ) : null}
          <Badge variant="secondary">{t("datasets.images")}: {selectedTags.size ? `${items.length} / ${allItems.length}` : allItems.length}</Badge>
          <Badge variant="success">{t("review.accepted")}: {accepted}</Badge>
          <Badge variant="warning">{t("review.pending")}: {pending}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => detections.refetch()}><RefreshCw /> {t("common.refresh")}</Button>
          {activeProject ? <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload /> {t("datasets.import")}</Button> : null}
          <Button size="sm" disabled={exportMutation.isPending || !items.length} onClick={() => exportMutation.mutate(selectedTags.size ? { format: "yolo-seg", ids: items.map((item) => item.id) } : { format: "yolo-seg" })}><FolderArchive /> {t("datasets.exportAll")}</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>{t("datasets.records")}</CardTitle>
            <div className="flex gap-2">
              {selected.size ? (
                <>
                  <Button size="sm" variant="outline" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate({ format: "yolo-seg", ids: [...selected] })}><Download /> {t("datasets.exportSelected", { count: selected.size })}</Button>
                  <Button size="sm" variant="destructive" disabled={remove.isPending} onClick={() => { if (window.confirm(t("datasets.deleteSelectedConfirm", { count: selected.size }))) remove.mutate([...selected]); }}><Trash2 /> {t("common.delete")}</Button>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {detections.isLoading ? <Skeleton className="h-64 w-full" /> : items.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={(checked) => setSelected(checked === true ? new Set(items.map((item) => item.id)) : new Set())} />
                    </TableHead>
                    <TableHead>{t("datasets.image")}</TableHead>
                    <TableHead>{t("datasets.categories")}</TableHead>
                    <TableHead>{t("datasets.review")}</TableHead>
                    <TableHead>{t("datasets.boxes")}</TableHead>
                    <TableHead>{t("datasets.created")}</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Checkbox checked={selected.has(item.id)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked === true) next.add(item.id); else next.delete(item.id); return next; })} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img src={`${API_BASE}/detections/${item.id}/image`} alt="" className="size-10 rounded object-cover" loading="lazy" />
                          <div className="min-w-0"><div className="max-w-56 truncate font-medium">{item.imageName}</div><div className="text-[11px] text-muted-foreground">{item.imageWidth}×{item.imageHeight}</div></div>
                        </div>
                      </TableCell>
                      <TableCell><div className="flex max-w-56 flex-wrap gap-1">{item.categories.slice(0, 3).map((category) => <Badge key={category} variant="muted">{category}</Badge>)}</div></TableCell>
                      <TableCell><Badge variant={item.reviewStatus === "accepted" ? "success" : item.reviewStatus === "rejected" ? "destructive" : "warning"}>{t(`review.${item.reviewStatus}`)}</Badge></TableCell>
                      <TableCell>{item.boxes.length}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(item.createdAt, i18n.language)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => exportMutation.mutate({ format: "yolo", ids: [item.id] })}><Download /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm(t("datasets.deleteConfirm"))) remove.mutate([item.id]); }}><Trash2 /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Empty title={selectedTags.size ? t("datasets.noTagMatch") : t("datasets.empty")} description={selectedTags.size ? undefined : t("datasets.emptyHint")} />}
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader><CardTitle>{t("common.tags")}</CardTitle></CardHeader>
            <CardContent>
              {tags.length ? (
                <TagFilter tags={tags} selected={selectedTags} onChange={(next) => { setSelectedTags(next); setSelected(new Set()); }} showLabel={false} />
              ) : <p className="text-sm text-muted-foreground">{t("datasets.noClasses")}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("datasets.export")}</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {[
                ["yolo", "YOLO"],
                ["yolo-seg", t("datasets.yoloSeg")],
                ["coco", "COCO"],
                ["voc", "Pascal VOC"],
                ["createml", "CreateML"],
              ].map(([format, label]) => (
                <Button key={format} variant="outline" className="justify-start" disabled={!items.length || exportMutation.isPending} onClick={() => exportMutation.mutate({ format })}>
                  <Download /> {label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <DatasetImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
