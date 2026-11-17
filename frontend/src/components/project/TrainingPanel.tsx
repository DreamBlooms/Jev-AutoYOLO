import { Database, GraduationCap, Layers3 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDetectionHistory } from "@/hooks/useDetectionHistory";
import { TrainingPanel as LegacyTrainingPanel } from "@/components/TrainingPanel";
import { cn } from "@/lib/utils";

export function ProjectTrainingPanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { allItems, total, historyQuery } = useDetectionHistory();
  const accepted = allItems.filter((item) => item.reviewStatus === "accepted").length;
  const pending = allItems.filter((item) => item.reviewStatus === "pending").length;
  const classes = new Set(allItems.flatMap((item) => item.categories)).size;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GraduationCap className="size-4" /> {t("training.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("training.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <LegacyTrainingPanel
            detections={allItems}
            total={total}
            hasNextPage={historyQuery.hasNextPage ?? false}
            isFetchingNextPage={historyQuery.isFetchingNextPage}
            fetchNextPage={() => historyQuery.fetchNextPage()}
          />
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader><CardTitle>{t("training.datasetReadiness")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {[
              [t("datasets.images"), allItems.length, "neutral"],
              [t("review.accepted"), accepted, "success"],
              [t("review.pending"), pending, "warning"],
              [t("datasets.classes"), classes, "info"],
            ].map(([label, value, variant]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Badge variant={variant as "success" | "warning" | "info" | "muted"}>{value}</Badge>
              </div>
            ))}
            <p className={cn("rounded-lg border border-border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground", pending > 0 && "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300")}>
              {pending > 0 ? t("training.reviewHint", { count: pending }) : t("training.readyHint")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="size-4" /> {t("training.tipsTitle")}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-xs leading-relaxed text-muted-foreground">
            <p>{t("training.tip1")}</p>
            <p>{t("training.tip2")}</p>
            <p>{t("training.tip3")}</p>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-border p-2">
              <Database className="size-4 shrink-0" />
              <span>{t("training.projectScoped", { id: projectId.slice(0, 8) })}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
