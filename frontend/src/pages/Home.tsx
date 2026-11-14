import { useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Sidebar } from "@/components/Sidebar";
import { VideoValidator } from "@/components/VideoValidator";
import { DetectionResult } from "@/components/DetectionResult";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/useAppStore";
import { useDetectionProcess } from "@/hooks/useDetectionProcess";
import { useDetectionHistory } from "@/hooks/useDetectionHistory";
import { useDetectionAnnotation } from "@/hooks/useDetectionAnnotation";

export function Home() {
  const { t } = useTranslation();
  const {
    appMode,
    validateModelSource,
    selectedTrainedJobId,
    externalModelFile,
    validateConf,
    validateIou,
    validateVideoId,
    validateRunKey,
    previewUrl,
    setPreviewUrl,
    files,
    categories,
    canvasMode,
    drawCategory,
    hiddenIndices,
    setCanvasMode,
    setDrawCategory,
    result,
    setResult,
    batchResults,
  } = useAppStore();

  const {
    elapsedMs,
    batchProgress,
    handleFiles,
    handleSelectKeyframe,
    handleBatchSelect,
    handleDetect,
    handleReDetect,
    cancel,
    loading,
    isRedetecting,
  } = useDetectionProcess();

  const { historyQuery, allItems, total, recentCategories, handleSelectHistory } = useDetectionHistory();

  const {
    handleDrawBox,
    handleDeleteBox,
    handleSaveBoxes,
    toggleBoxVisibility,
    displayResult,
  } = useDetectionAnnotation();

  // Keyboard navigation for batch results
  useEffect(() => {
    if (batchResults.length <= 1) return;
    const handler = (e: KeyboardEvent) => {
      const idx = result ? batchResults.findIndex((r) => r.id === result.id) : -1;
      if (e.key === "ArrowLeft" && idx > 0) {
        handleBatchSelect(batchResults[idx - 1], files[idx - 1]);
      } else if (e.key === "ArrowRight" && idx < batchResults.length - 1) {
        handleBatchSelect(batchResults[idx + 1], files[idx + 1]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [batchResults, result, files, handleBatchSelect]);

  const sidebarProps = {
    recentCategories,
    handleFiles,
    handleDetect,
    handleSelectHistory,
    loading,
    batchProgress,
    batchResults,
    cancel,
    historyQuery: {
      hasNextPage: historyQuery.hasNextPage ?? false,
      isFetchingNextPage: historyQuery.isFetchingNextPage,
      fetchNextPage: () => historyQuery.fetchNextPage(),
    } as const,
    allItems,
    total,
    result,
    setResult,
    handleSelectKeyframe,
  };

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <Sidebar {...sidebarProps} />

      <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="flex min-h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
        {validateVideoId && appMode === "validate" && (
          <VideoValidator
            key={validateRunKey}
            videoId={validateVideoId}
            jobId={
              validateModelSource === "trained" ? (selectedTrainedJobId ?? undefined) : undefined
            }
            modelFile={
              validateModelSource === "upload" ? (externalModelFile ?? undefined) : undefined
            }
            conf={validateConf}
            iou={validateIou}
          />
        )}

        {!validateVideoId && !displayResult && !previewUrl && (
          <div className="grid min-h-[60vh] flex-1 place-items-center rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            {t("home.placeholderDefault")}
          </div>
        )}
        
        {previewUrl && !validateVideoId && (
          <ErrorBoundary>
            <DetectionResult
              result={displayResult}
              previewUrl={previewUrl}
              batchResults={batchResults}
              batchFiles={files}
              loading={loading}
              elapsedMs={elapsedMs}
              categories={categories}
              canvasMode={canvasMode}
              drawCategory={drawCategory}
              recentCategories={recentCategories}
              hiddenIndices={hiddenIndices}
              onToggleVisibility={toggleBoxVisibility}
              isValidation={appMode === "validate"}
              onCanvasModeChange={setCanvasMode}
              onDrawCategoryChange={setDrawCategory}
              onDeleteBox={handleDeleteBox}
              onSelectBatch={handleBatchSelect}
              onSelectPending={(url) => {
                setPreviewUrl(url);
                setResult(null);
              }}
              onReDetect={handleReDetect}
              onSaveBoxes={handleSaveBoxes}
              onDrawBox={handleDrawBox}
              isRedetecting={isRedetecting}
            />
          </ErrorBoundary>
        )}
        </div>
      </main>
    </div>
  );
}
