import { useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { downloadModel, type ModelKind } from "@/services/api";

export function ModelDownloadButton({
  kind,
  disabled,
  className = "",
}: {
  kind: ModelKind;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      await downloadModel(kind);
      toast.success(t("modelStatus.downloadStarted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modelStatus.downloadFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={handleDownload}
      title={t("modelStatus.downloadHint")}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-primary-600 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {busy ? t("modelStatus.downloading") : t("modelStatus.downloadInit")}
    </button>
  );
}
