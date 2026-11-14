import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface Props {
  selectedJobId: string | null;
  onSelectJob: (id: string | null) => void;
  modelSource: "trained" | "upload";
  onSourceChange: (s: "trained" | "upload") => void;
  externalFile: File | null;
  onExternalFile: (f: File | null) => void;
}

export function ModelSelector({
  selectedJobId,
  onSelectJob,
  modelSource,
  onSourceChange,
  externalFile,
  onExternalFile,
}: Props) {
  const { t, i18n } = useTranslation();
  const { data: jobs } = useQuery({
    // Keep a separate key from the training panel's infinite query. Sharing
    // ["training-jobs"] makes this query read the infinite-query cache shape.
    queryKey: ["training-jobs", "model-selector"],
    queryFn: () => fetchTrainingJobs(1, 1000),
    staleTime: 5_000,
  });

  const completedJobs = (jobs?.items ?? []).filter((j: TrainingJob) => j.status === "completed");

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-2">
      <div className="flex gap-2">
        {(["trained", "upload"] as const).map((source) => (
          <Button
            key={source}
            type="button"
            size="sm"
            variant={modelSource === source ? "default" : "outline"}
            onClick={() => onSourceChange(source)}
          >
            {source === "trained" ? t("validationSettings.trainedModel") : t("validationSettings.uploadModel")}
          </Button>
        ))}
      </div>

      {modelSource === "trained" && (
        <Select
          value={selectedJobId ?? ""}
          onChange={(event) => onSelectJob(event.target.value || null)}
          className="w-full"
        >
          <option value="">{t("validationSettings.selectTrainedModel")}</option>
          {completedJobs.map((j) => (
            <option key={j.id} value={j.id}>
              {`${j.modelVariant} — ${new Date(j.completedAt || j.createdAt).toLocaleString(i18n.language.startsWith("zh") ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}${j.metrics?.mAP50 != null ? ` (mAP50: ${(j.metrics.mAP50 as number).toFixed(2)})` : ""}`}
            </option>
          ))}
        </Select>
      )}

      {modelSource === "upload" && (
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 transition-colors hover:border-primary/50">
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {externalFile ? externalFile.name : t("validationSettings.selectPtModel")}
          </span>
          <span className="ml-2 flex-shrink-0 text-[10px] text-muted-foreground">
            {externalFile ? t("validationSettings.selected") : t("validationSettings.browse")}
          </span>
          <input
            type="file"
            accept=".pt"
            className="hidden"
            onChange={(e) => onExternalFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}
