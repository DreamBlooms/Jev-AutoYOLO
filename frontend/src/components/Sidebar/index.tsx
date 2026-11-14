import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImageUploader } from "@/components/ImageUploader";
import { HistoryList } from "@/components/HistoryList";
import { BatchProgress } from "@/components/BatchProgress";
import { ModelStatus } from "@/components/ModelStatus";
import { DeviceSelector } from "@/components/DeviceSelector";
import { JevAdvancedSettings } from "@/components/JevAdvancedSettings";
import { Sam3Status } from "@/components/Sam3Status";
import { TrainingPanel } from "@/components/TrainingPanel";
import { AnnotationExportPanel } from "@/components/AnnotationExportPanel";
import { VideoPanel } from "@/components/VideoPanel";
import { ValidationSettings } from "@/components/ValidationSettings";
import { FilterPanel } from "@/components/FilterPanel";
import { HistorySkeleton } from "@/components/LoadingSkeleton";
import { DetectionControls } from "./DetectionControls";
import type { Detection } from "@/types";
import { useAppStore } from "@/store/useAppStore";

export interface SidebarProps {
  recentCategories: string[];
  handleFiles: (fs: File[]) => void;
  handleDetect: () => void;
  handleSelectHistory: (det: Detection) => void;
  loading: boolean;
  batchProgress: { current: number; total: number };
  batchResults: Detection[];
  cancel: () => void;
  historyQuery: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
  allItems: Detection[];
  total: number;
  result: Detection | null;
  setResult: (result: Detection | null) => void;
  handleSelectKeyframe: (files: File[]) => void;
}

export function Sidebar({
  recentCategories,
  handleFiles,
  handleDetect,
  handleSelectHistory,
  loading,
  batchProgress,
  batchResults,
  cancel,
  historyQuery,
  allItems,
  total,
  result,
  setResult,
  handleSelectKeyframe,
}: SidebarProps) {
  const { t } = useTranslation();
  const {
    annotationOnly,
    useVlm, setUseVlm,
    appMode, setAppMode,
    validateModelSource, setValidateModelSource,
    selectedTrainedJobId, setSelectedTrainedJobId,
    inputMode, setInputMode,
    files, setFiles,
    setPreviewUrl,
    setBatchResults: setBatch,
    useSam3, setUseSam3,
    validateVideoId, setValidateVideoId,
    setValidateRunKey,
    externalModelFile, setExternalModelFile,
    validateConf, setValidateConf,
    validateIou, setValidateIou,
    filterMode, setFilterMode,
    nmsIou, setNmsIou,
    setHiddenIndices,
  } = useAppStore();

  return (
    <aside
      className="relative flex h-full w-full shrink-0 flex-col gap-3 overflow-y-auto border-b border-border bg-muted/20 p-3 text-foreground lg:w-[420px] lg:border-b-0 lg:border-r"
    >
      <div className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      {/* Model selector */}
      <div className="relative flex min-h-9 rounded-lg bg-muted p-1">
        {(["jev", "vlm", "sam3"] as const).map((mode) => {
          const active =
            mode === "sam3" ? useSam3 : mode === "vlm" ? useVlm && !useSam3 : !useSam3 && !useVlm;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => {
                if (mode === "sam3") {
                  setUseSam3(true);
                  setUseVlm(false);
                } else {
                  setUseSam3(false);
                  setUseVlm(mode === "vlm");
                }
              }}
              className={`relative z-10 flex-1 cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                active
                  ? "bg-background text-primary shadow-sm ring-1 ring-inset ring-border"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              }`}
            >
              {mode === "sam3" ? "SAM3" : mode === "vlm" ? "VLM" : "Jev"}
            </button>
          );
        })}
      </div>

      {useSam3 ? <Sam3Status /> : <ModelStatus mode={useVlm ? "vlm" : "jev"} />}
      <DeviceSelector />
      </div>

      {/* Mode tabs */}
      <div className="mb-1 flex border-b border-border">
        {(["annotate", "validate"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setAppMode(m); setResult(null); setValidateVideoId(null); }}
            className={`flex-1 pb-3 pt-1 text-sm font-bold transition-all duration-200 relative text-center cursor-pointer ${
              appMode === m
                ? "border-b-2 border-primary text-primary"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {{ annotate: t("common.annotate"), validate: t("common.validate") }[m]}
          </button>
        ))}
      </div>

      {appMode === "validate" && (
        <ValidationSettings
          selectedJobId={selectedTrainedJobId}
          onSelectJob={setSelectedTrainedJobId}
          modelSource={validateModelSource}
          onSourceChange={setValidateModelSource}
          externalFile={externalModelFile}
          onExternalFile={setExternalModelFile}
          validateConf={validateConf}
          onConfChange={setValidateConf}
          validateIou={validateIou}
          onIouChange={setValidateIou}
        />
      )}

      {/* Input mode: Image / Video */}
      <div>
        <div className="mb-2 flex gap-1 rounded-lg bg-muted p-1">
          {(["image", "video"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { setInputMode(mode); setFiles([]); setPreviewUrl(null); setBatch([]); }}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                inputMode === mode
                  ? "bg-background text-primary shadow-sm ring-1 ring-inset ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {{ image: t("common.image"), video: t("common.video") }[mode]}
            </button>
          ))}
        </div>
        {inputMode === "image" ? (
          <ImageUploader
            onFiles={handleFiles}
            onClear={() => { setFiles([]); setPreviewUrl(null); setBatch([]); }}
            disabled={loading}
          />
        ) : (
          <VideoPanel
            onLoadKeyframes={handleSelectKeyframe}
            onValidateVideo={
              appMode === "validate"
                ? (videoId) => { setValidateVideoId(videoId); setValidateRunKey((k) => k + 1); }
                : undefined
            }
            disabled={loading}
          />
        )}
      </div>

      {!(appMode === "validate" && inputMode === "video" && validateVideoId) && (
        <>
          <DetectionControls
            recentCategories={recentCategories}
            loading={loading}
            filesCount={files.length}
            batchProgress={batchProgress}
            onDetect={handleDetect}
          />
          {!useSam3 && !useVlm && <JevAdvancedSettings />}
        </>
      )}

      {appMode === "validate" && inputMode === "video" && (
        <div className="py-2 text-center text-xs text-muted-foreground">
          {validateVideoId ? t("home.placeholderVideoRunning") : t("home.placeholderSelectVideo")}
        </div>
      )}

      <BatchProgress
        current={batchProgress.current}
        total={batchProgress.total}
        completed={batchResults.length}
        onCancel={cancel}
      />

      {result && (
        <FilterPanel
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          nmsIou={nmsIou}
          onNmsIouChange={setNmsIou}
          setHiddenIndices={setHiddenIndices}
        />
      )}

      <hr className="border-border" />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.history")}</p>
        <Suspense fallback={<HistorySkeleton />}>
          <ErrorBoundary>
            <HistoryList
              allItems={allItems}
              total={total}
              hasNextPage={historyQuery.hasNextPage}
              isFetchingNextPage={historyQuery.isFetchingNextPage}
              fetchNextPage={historyQuery.fetchNextPage}
              onSelect={handleSelectHistory}
            />
          </ErrorBoundary>
        </Suspense>
      </div>

      <hr className="border-border" />

      {annotationOnly ? (
        <AnnotationExportPanel total={total} />
      ) : (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.yoloTrain")}</p>
          <TrainingPanel
            detections={allItems}
            total={total}
            hasNextPage={historyQuery.hasNextPage}
            isFetchingNextPage={historyQuery.isFetchingNextPage}
            fetchNextPage={historyQuery.fetchNextPage}
          />
        </div>
      )}
    </aside>
  );
}
