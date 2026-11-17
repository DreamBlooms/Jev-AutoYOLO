import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { DetectionCanvas } from "@/components/DetectionCanvas";
import { ResultTable } from "@/components/ResultTable";
import { TagFilter } from "@/components/TagFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import { addBox, deleteBox, listDetections, listProjects, redetectDetection, reviewDetection } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import type { BBox, Detection } from "@/types";

const PREVIEW_PAGE_SIZE = 10000;

function ReviewAnnotator({ detection, onChanged }: { detection: Detection; onChanged: () => void }) {
  const { t } = useTranslation();
  const [boxes, setBoxes] = useState<BBox[]>(detection.boxes);
  const [canvasMode, setCanvasMode] = useState<"view" | "draw">("view");
  const [hiddenIndices, setHiddenIndices] = useState<Set<string>>(new Set());
  const [drawCategory, setDrawCategory] = useState(detection.categories[0] ?? detection.boxes[0]?.className ?? "");
  const drawCategories = useMemo(
    () => [...new Set([...detection.categories, ...boxes.map((box) => box.className)])].filter(Boolean),
    [detection.categories, boxes],
  );

  const handleDraw = useCallback(async (raw: { x1: number; y1: number; x2: number; y2: number }) => {
    if (!drawCategory.trim()) {
      toast.error(t("home.drawCategoryRequired"));
      return;
    }
    try {
      const box = await addBox(detection.id, { ...raw, className: drawCategory.trim() });
      setBoxes((current) => [...current, box]);
      toast.success(t("review.boxAdded"));
      onChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, t("review.boxFailed")));
    }
  }, [detection.id, drawCategory, onChanged, t]);

  const handleDelete = useCallback(async (boxId: string) => {
    try {
      await deleteBox(detection.id, boxId);
      setBoxes((current) => current.filter((box) => box.id !== boxId));
      setHiddenIndices((current) => {
        const next = new Set(current);
        next.delete(boxId);
        return next;
      });
      toast.success(t("review.boxDeleted"));
      onChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, t("review.deleteBoxFailed")));
    }
  }, [detection.id, onChanged, t]);

  const toggleVisibility = useCallback((boxId: string) => {
    setHiddenIndices((current) => {
      const next = new Set(current);
      if (next.has(boxId)) next.delete(boxId);
      else next.add(boxId);
      return next;
    });
  }, []);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {t("review.annotations")}
            <Badge variant={canvasMode === "draw" ? "warning" : "muted"}>{canvasMode === "draw" ? t("common.draw") : t("common.view")}</Badge>
          </CardTitle>
          <span className="text-xs text-muted-foreground">{t("review.manualHint")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 w-44"
            value={drawCategory}
            onChange={(event) => setDrawCategory(event.target.value)}
            placeholder={t("detectionResult.drawCategoryPlaceholder")}
          />
          {drawCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setDrawCategory(category)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                drawCategory === category ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DetectionCanvas
          imageUrl={`${API_BASE}/detections/${detection.id}/image`}
          boxes={boxes}
          imgWidth={detection.imageWidth}
          imgHeight={detection.imageHeight}
          mode={canvasMode}
          hiddenIndices={hiddenIndices}
          onModeChange={setCanvasMode}
          onDrawBox={handleDraw}
        />
        <ResultTable
          boxes={boxes}
          hiddenIndices={hiddenIndices}
          onToggleVisibility={toggleVisibility}
          onDelete={handleDelete}
        />
      </CardContent>
    </Card>
  );
}

export function ReviewPanel({ projectId, showProjectFilter = false }: { projectId: string; showProjectFilter?: boolean }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [filterProject, setFilterProject] = useState(projectId);
  const [status, setStatus] = useState<"pending" | "accepted" | "rejected">("pending");
  const [selectedId, setSelectedId] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [revision, setRevision] = useState(0);
  const activeProject = showProjectFilter ? filterProject : projectId;

  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects, enabled: showProjectFilter });
  const queue = useQuery({
    queryKey: ["review-detections", activeProject, status],
    queryFn: () => listDetections(1, PREVIEW_PAGE_SIZE, activeProject || undefined, status),
  });

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    (queue.data?.items ?? []).forEach((item) => item.categories.forEach((category) => counts.set(category, (counts.get(category) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [queue.data]);
  const filteredItems = useMemo(() => {
    const items = queue.data?.items ?? [];
    if (selectedTags.size === 0) return items;
    return items.filter((item) => item.categories.some((category) => selectedTags.has(category)));
  }, [queue.data, selectedTags]);
  const selected = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const visibleCheckedIds = useMemo(
    () => new Set([...checkedIds].filter((id) => filteredItems.some((item) => item.id === id))),
    [checkedIds, filteredItems],
  );
  const allChecked = filteredItems.length > 0 && filteredItems.every((item) => visibleCheckedIds.has(item.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["review-detections"] });
    queryClient.invalidateQueries({ queryKey: ["detections"] });
    queryClient.invalidateQueries({ queryKey: ["project-detections"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project"] });
  };

  const review = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "accepted" | "rejected" }) => reviewDetection(id, next),
    onSuccess: (_, variables) => {
      toast.success(variables.next === "accepted" ? t("review.accepted") : t("review.rejected"));
      setSelectedId("");
      setCheckedIds((current) => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
      invalidate();
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("review.actionFailed"))),
  });

  const redetect = useMutation({
    mutationFn: () => {
      if (!selected) return Promise.reject(new Error(t("review.selectItem")));
      const state = useAppStore.getState();
      return redetectDetection(selected.id, {
        categories: selected.categories,
        useVlm: state.useVlm,
        useSam2: state.useSam2,
        useSam3: state.useSam3,
        useSam3Seg: state.useSam3Seg,
        sam2ScoreThreshold: state.sam2ScoreThreshold,
        sam3Text: state.sam3Text,
        sam3Threshold: state.sam3Threshold,
        sam3MaskThreshold: state.sam3MaskThreshold,
        extraState: state.extraState,
        extraInstructions: state.extraInstructions,
        categoryInstructions: state.categoryInstructions,
      });
    },
    onSuccess: async () => {
      toast.success(t("review.redetected"));
      setRevision((current) => current + 1);
      await queue.refetch();
      invalidate();
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("review.redetectFailed"))),
  });

  const batch = useMutation({
    mutationFn: async ({ ids, next }: { ids: string[]; next: "accepted" | "rejected" }) => {
      const results = await Promise.allSettled(ids.map((id) => reviewDetection(id, next)));
      return results.filter((item) => item.status === "rejected").length;
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("review.actionFailed"))),
    onSuccess: (failed, { next }) => {
      if (failed) toast.error(t("review.batchPartial", { count: failed }));
      else toast.success(next === "accepted" ? t("review.allAccepted") : t("review.allRejected"));
      setSelectedId("");
      setCheckedIds(new Set());
      invalidate();
    },
  });

  const toggleChecked = (id: string) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedBoxes = selected?.boxes ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{t("review.queue")}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedTags.size ? `${filteredItems.length} / ${queue.data?.total ?? 0}` : `${queue.data?.total ?? 0}`} {t("review.items")}
            </p>
          </div>
          <Select className="w-32" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setSelectedId(""); setCheckedIds(new Set()); }}>
            <option value="pending">{t("review.pending")}</option>
            <option value="accepted">{t("review.accepted")}</option>
            <option value="rejected">{t("review.rejected")}</option>
          </Select>
        </CardHeader>
        <CardContent className="grid gap-3">
          {showProjectFilter ? (
            <Select value={filterProject} onChange={(event) => { setFilterProject(event.target.value); setSelectedId(""); setSelectedTags(new Set()); }}>
              <option value="">{t("review.allProjects")}</option>
              {projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
          ) : null}
          <TagFilter tags={tags} selected={selectedTags} onChange={(next) => { setSelectedTags(next); setSelectedId(""); setCheckedIds(new Set()); }} />
          <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 text-xs font-medium text-muted-foreground">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(checked) => setCheckedIds(checked === true ? new Set(filteredItems.map((item) => item.id)) : new Set())}
            />
            {t("review.selectAll")}
            {visibleCheckedIds.size ? <span className="ml-auto text-foreground">{t("review.selectedCount", { count: visibleCheckedIds.size })}</span> : null}
          </label>
          <div className="scrollbar-thin max-h-[calc(100vh-390px)] space-y-2 overflow-auto">
            {queue.isLoading ? <Skeleton className="h-56 w-full" /> : filteredItems.length ? filteredItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex gap-2 rounded-lg border border-border p-2 transition-colors hover:bg-muted/50",
                  selected?.id === item.id && "border-primary/40 bg-primary/5",
                )}
              >
                <Checkbox
                  className="mt-1"
                  checked={visibleCheckedIds.has(item.id)}
                  onCheckedChange={() => toggleChecked(item.id)}
                />
                <button type="button" onClick={() => setSelectedId(item.id)} className="flex min-w-0 flex-1 gap-2 text-left">
                  <img src={`${API_BASE}/detections/${item.id}/image`} alt="" className="size-14 shrink-0 rounded-md object-cover" loading="lazy" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{item.imageName}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.boxes.length} {t("review.boxes")} · {item.categories.join(", ") || "—"}</span>
                    <span className="mt-1 flex items-center gap-1">
                      <Badge variant={status === "accepted" ? "success" : status === "rejected" ? "destructive" : "warning"}>{t(`review.${status}`)}</Badge>
                      <span className="text-[10px] text-muted-foreground">{formatDate(item.createdAt, i18n.language)}</span>
                    </span>
                  </span>
                </button>
              </div>
            )) : <Empty title={selectedTags.size ? t("review.noTagMatch") : t("review.emptyQueue")} description={selectedTags.size ? undefined : t("review.emptyQueueHint")} />}
          </div>
          {visibleCheckedIds.size ? (
            <div className="grid gap-2 border-t border-border pt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("review.selectedCount", { count: visibleCheckedIds.size })}</span>
                <button type="button" className="text-primary hover:underline" onClick={() => setCheckedIds(new Set())}>{t("common.clearFilter")}</button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" disabled={batch.isPending} onClick={() => batch.mutate({ ids: [...visibleCheckedIds], next: "accepted" })}><Check /> {t("review.acceptSelected")}</Button>
                <Button size="sm" variant="destructive" className="flex-1" disabled={batch.isPending} onClick={() => batch.mutate({ ids: [...visibleCheckedIds], next: "rejected" })}><X /> {t("review.rejectSelected")}</Button>
              </div>
            </div>
          ) : null}
          {filteredItems.length > 1 && visibleCheckedIds.size === 0 ? (
            <div className="flex gap-2 border-t border-border pt-3">
              <Button size="sm" variant="outline" className="flex-1" disabled={batch.isPending} onClick={() => batch.mutate({ ids: filteredItems.map((item) => item.id), next: "accepted" })}><CheckCheck /> {t("review.acceptAll")}</Button>
              <Button size="sm" variant="outline" className="flex-1" disabled={batch.isPending} onClick={() => { if (window.confirm(t("review.rejectAllConfirm"))) batch.mutate({ ids: filteredItems.map((item) => item.id), next: "rejected" }); }}><X /> {t("review.rejectAll")}</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div>
        {!selected ? <Empty title={t("review.selectItem")} description={t("review.selectItemHint")} /> : (
          <div className="grid gap-4">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate">{selected.imageName}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">#{selected.id.slice(0, 8)} · {selected.modelName}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={redetect.isPending} onClick={() => redetect.mutate()}>
                    {redetect.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} {t("detectionResult.redetect")}
                  </Button>
                  <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: selected.id, next: "accepted" })}><Check /> {t("review.accept")}</Button>
                  <Button size="sm" variant="destructive" disabled={review.isPending} onClick={() => review.mutate({ id: selected.id, next: "rejected" })}><X /> {t("review.reject")}</Button>
                </div>
              </CardHeader>
            </Card>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                [t("review.boxes"), selectedBoxes.length],
                [t("review.categories"), selected.categories.length],
                [t("review.imageSize"), `${selected.imageWidth}×${selected.imageHeight}`],
                [t("review.elapsed"), selected.elapsedMs ? `${selected.elapsedMs} ms` : "—"],
              ].map(([label, value]) => (
                <Card key={String(label)} className="py-3"><CardContent><div className="text-lg font-semibold">{value}</div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div></CardContent></Card>
              ))}
            </div>
            <ReviewAnnotator key={`${selected.id}-${revision}`} detection={selected} onChanged={invalidate} />
          </div>
        )}
      </div>
    </div>
  );
}
