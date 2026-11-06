import { ModelDownloadButton } from "@/components/ModelDownloadButton";

export function Sam3Status() {
  const { t } = useTranslation();
  const { sam3 } = useModelEvents();
  const [unloading, setUnloading] = useState(false);

  const loaded = sam3.status === "loaded";
  const isDownloading = sam3.status === "downloading";
  const isLoading =
    isDownloading ||
    sam3.status === "starting" ||
    sam3.status === "loading" ||
    sam3.status === "initializing";
  const progress = sam3.progress ?? 0;
  const error = sam3.error;

  const handleUnload = useCallback(async () => {
    setUnloading(true);
    try {
      await unloadSam3();
    } catch {
      toast.error(t("modelStatus.sam3UnloadFailed"));
    } finally {
      setUnloading(false);
    }
  }, [t]);

  return (
    <div className="rounded px-2.5 py-1.5 text-[11px] bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          {isLoading ? (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
          ) : (
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${loaded ? "bg-green-500" : "bg-gray-300"}`}
            />
          )}
          <span className="text-gray-500">
            {isDownloading
              ? t("modelStatus.downloading")
              : isLoading
                ? t("modelStatus.loading")
                : loaded
                  ? t("modelStatus.sam3Loaded")
                  : t("modelStatus.sam3Unloaded")}
          </span>
        </span>
        {loaded ? (
          <button
            type="button"
            disabled={unloading}
            onClick={handleUnload}
            className="text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {unloading ? t("modelStatus.unloading") : t("modelStatus.unload")}
          </button>
        ) : (
          !isLoading && <ModelDownloadButton kind="sam3" />
        )}
      </div>
      {isLoading && (
        <div className="mt-1.5">
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>{stageLabel(t, sam3.stage, isDownloading)}</span>
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
      {error && (
        <div className="mt-1 text-[10px] text-red-500 truncate max-w-[380px]" title={error}>
          {error}
        </div>
      )}
    </div>
  );
}

function stageLabel(
  t: (key: string) => string,
  stage: string | undefined,
  downloading: boolean,
) {
  if (stage === "download") return t("modelStatus.stageDownload");
  if (stage === "init") return t("modelStatus.stageInit");
  if (downloading) return t("modelStatus.stageDownload");
  return t("modelStatus.stageGpu");
}
