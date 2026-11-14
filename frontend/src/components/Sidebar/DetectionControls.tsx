import { Loader2 } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/store/useAppStore";

interface Props {
  recentCategories: string[];
  loading: boolean;
  filesCount: number;
  batchProgress: { current: number; total: number };
  onDetect: () => void;
}

export function DetectionControls({
  recentCategories,
  loading,
  filesCount,
  batchProgress,
  onDetect,
}: Props) {
  const { t } = useTranslation();
  const {
    appMode,
    categories,
    setCategories,
    isTraining,
    useSam2,
    setUseSam2,
    useSam3,
    useSam3Seg,
    setUseSam3Seg,
    sam3Threshold,
    setSam3Threshold,
    sam3MaskThreshold,
    setSam3MaskThreshold,
    sam2ScoreThreshold,
    setSam2ScoreThreshold,
  } = useAppStore();

  return (
    <>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.categories")}</p>
        <CategoryInput
          categories={categories}
          onChange={setCategories}
          disabled={loading}
          recentCategories={recentCategories}
        />
      </div>

      {appMode === "annotate" && !useSam3 && (
        <>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={useSam2} onCheckedChange={(value) => setUseSam2(value === true)} />
            {t("home.useSam2")}
          </label>
          {useSam2 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex-shrink-0">{`Score ≥ ${sam2ScoreThreshold.toFixed(1)}`}</span>
              <input
                type="range" min="0" max="1" step="0.1"
                value={sam2ScoreThreshold}
                onChange={(e) => setSam2ScoreThreshold(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-primary-600 cursor-pointer"
              />
            </div>
          )}
        </>
      )}
      {appMode === "annotate" && useSam3 && (
        <>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={useSam3Seg} onCheckedChange={(value) => setUseSam3Seg(value === true)} />
            {t("home.useSam3Seg")}
          </label>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex-shrink-0">{`Conf ≥ ${sam3Threshold.toFixed(1)}`}</span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={sam3Threshold}
              onChange={(e) => setSam3Threshold(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-primary-600 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex-shrink-0">{`Mask ≥ ${sam3MaskThreshold.toFixed(1)}`}</span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={sam3MaskThreshold}
              onChange={(e) => setSam3MaskThreshold(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-primary-600 cursor-pointer"
            />
          </div>
        </>
      )}

      {isTraining && (
        <Alert variant="warning"><span className="inline-block size-2 animate-pulse rounded-full bg-amber-500" /><AlertTitle>{t("trainingPanel.trainingInProgress")}</AlertTitle></Alert>
      )}

      <Button
        size="lg"
        disabled={
          isTraining || loading || filesCount === 0
          || (appMode !== "validate" && categories.length === 0)
        }
        onClick={onDetect}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            {batchProgress.total > 1
              ? t("home.detectingCount", { current: batchProgress.current, total: batchProgress.total })
              : t("home.detectingDefault")}
          </>
        ) : appMode === "validate" ? (
          t("home.yoloValidation")
        ) : filesCount > 1 ? (
          t("home.detectBtnImageCount", { count: filesCount })
        ) : (
          t("home.detectBtnImage")
        )}
      </Button>
    </>
  );
}
