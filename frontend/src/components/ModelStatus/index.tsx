import { ModelDownloadButton } from "@/components/ModelDownloadButton";

export function ModelStatus({ mode = "jev" }: { mode?: "jev" | "vlm" }) {
  const { t } = useTranslation();
  const { jev, vlm, sam2 } = useModelEvents();
  const [unloadingSam2, setUnloadingSam2] = useState(false);
  const [unloadingVlm, setUnloadingVlm] = useState(false);

  const active = mode === "vlm" ? vlm : jev;
  const state = active.state;
  const loaded = state === "loaded";
  const isError = state === "error";
  const isDownloading = state === "downloading";
  const isLoading = state === "loading";
  const progress = active.progress;
  const stage = active.stage;
  const error = active.error;
  const model = mode === "vlm" ? "LocateAnything-3B" : jev.model;

  const sam2State = sam2.state;
  const sam2Loaded = sam2State === "loaded";
  const sam2Downloading = sam2State === "downloading";
  const sam2Loading = sam2State === "loading";
  const sam2Progress = sam2.progress;
  const sam2Stage = sam2.stage;
  const sam2Error = sam2.error;

  const handleUnloadVlm = useCallback(async () => {
    setUnloadingVlm(true);
    try {
      await unloadModel();
      optimisticModelUnloaded("vlm");
      toast.success(t("modelStatus.vlmUnloadSuccess"));
    } catch {
      toast.error(t("modelStatus.vlmUnloadFailed"));
    } finally {
      setUnloadingVlm(false);
    }
  }, [t]);

  const handleUnloadSam2 = useCallback(async () => {
    setUnloadingSam2(true);
    try {
      await unloadSam2();
      optimisticModelUnloaded("sam2");
      toast.success(t("modelStatus.sam2UnloadSuccess"));
    } catch {
      toast.error(t("modelStatus.sam2UnloadFailed"));
    } finally {
      setUnloadingSam2(false);
    }
  }, [t]);

  const stageLabels: Record<string, string> = {
    starting: t("modelStatus.stageStarting"),
    tokenizer: t("modelStatus.stageTokenizer"),
    processor: t("modelStatus.stageProcessor"),
    model: t("modelStatus.stageModel"),
    gpu: t("modelStatus.stageGpu"),
  };

  const unloadedLabel =
    mode === "vlm" ? t("modelStatus.vlmNotConfigured") : t("modelStatus.jevNotConfigured");

  const modeLabel =
    mode === "vlm"
      ? t("modelStatus.localModel")
      : jev.mode === "local-fallback"
        ? t("modelStatus.localFallback")
        : jev.mode === "unconfigured"
          ? t("modelStatus.notConfigured")
          : t("modelStatus.remote");

  return (
    <div className="space-y-1">
      {/* Primary model */}
      <div
        className={`rounded px-2.5 py-1.5 text-[11px] ${
          isError ? "bg-red-50 border border-red-200" : "bg-gray-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {isDownloading || isLoading ? (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
            ) : isError ? (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            ) : (
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${loaded ? "bg-green-500" : "bg-gray-300"}`}
              />
            )}
            <span className={`${isError ? "text-red-600" : "text-gray-500"}`}>
              {isDownloading
                ? t("modelStatus.downloading")
                : isLoading
                  ? t("modelStatus.loading")
                  : isError
                    ? t("modelStatus.error")
                    : loaded
                      ? t("modelStatus.loaded")
                      : unloadedLabel}
            </span>
            <span className="text-[10px] text-gray-400">{modeLabel}</span>
          </span>
          <span className="flex items-center gap-1">
            {model && <span className="text-[10px] text-gray-400 truncate">{model}</span>}
            {mode === "vlm" && !loaded && !isDownloading && !isLoading && (
              <ModelDownloadButton kind="vlm" />
            )}
            {mode === "vlm" && loaded && (
              <button
                type="button"
                disabled={unloadingVlm}
                onClick={handleUnloadVlm}
                className="text-[10px] text-gray-400 hover:text-red-500 disabled:opacity-50"
              >
                {unloadingVlm ? t("modelStatus.unloading") : t("modelStatus.unload")}
              </button>
            )}
          </span>
        </div>
        {(isDownloading || isLoading) && (
          <div className="mt-1.5">
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>{stageLabels[stage] || stage || t("modelStatus.preparing")}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div
                className="bg-primary-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {isError && error && (
          <div className="mt-1 text-[10px] text-red-500 truncate max-w-[380px]" title={error}>
            {error}
          </div>
        )}
      </div>

      {/* SAM2 Model */}
      <div
        className={`rounded px-2.5 py-1.5 text-[11px] ${
          sam2State === "error" ? "bg-red-50 border border-red-200" : "bg-gray-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {sam2Downloading || sam2Loading ? (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
            ) : sam2State === "error" ? (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            ) : (
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${sam2Loaded ? "bg-green-500" : "bg-gray-300"}`}
              />
            )}
            <span className={`${sam2State === "error" ? "text-red-600" : "text-gray-500"}`}>
              {sam2Downloading
                ? t("modelStatus.downloading")
                : sam2Loading
                  ? t("modelStatus.loading")
                  : sam2State === "error"
                    ? t("modelStatus.error")
                    : sam2Loaded
                      ? t("modelStatus.sam2Loaded")
                      : t("modelStatus.sam2Unloaded")}
            </span>
          </span>
          {sam2Loaded ? (
            <button
              type="button"
              disabled={unloadingSam2}
              onClick={handleUnloadSam2}
              className="text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {unloadingSam2 ? t("modelStatus.unloading") : t("modelStatus.unload")}
            </button>
          ) : (
            !sam2Downloading && !sam2Loading && <ModelDownloadButton kind="sam2" />
          )}
        </div>
        {(sam2Downloading || sam2Loading) && (
          <div className="mt-1.5">
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>
                {sam2Stage ? stageLabels[sam2Stage] || sam2Stage : t("modelStatus.preparing")}
              </span>
              <span>{sam2Progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div
                className="bg-primary-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${sam2Progress}%` }}
              />
            </div>
          </div>
        )}
        {sam2State === "error" && sam2Error && (
          <div className="mt-1 text-[10px] text-red-500 truncate max-w-[380px]" title={sam2Error}>
            {sam2Error}
          </div>
        )}
      </div>
    </div>
  );
}
