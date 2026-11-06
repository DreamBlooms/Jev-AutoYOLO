import { useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { downloadBlob, exportAll } from "@/services/api";

const FORMATS = [
  { value: "yolo", label: "YOLO (.txt)" },
  { value: "yolo-seg", label: "YOLO Segmentation" },
  { value: "coco", label: "COCO JSON" },
  { value: "voc", label: "Pascal VOC" },
  { value: "createml", label: "CreateML JSON" },
] as const;

export function AnnotationExportPanel({ total }: { total: number }) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<(typeof FORMATS)[number]["value"]>("yolo");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportAll(format);
      downloadBlob(blob, `annotations_${format}.zip`);
      toast.success(t("annotationExport.success"));
    } catch {
      toast.error(t("annotationExport.failed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-600">{t("annotationExport.title")}</p>
      <p className="text-[11px] leading-relaxed text-gray-400">{t("annotationExport.hint")}</p>
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as (typeof FORMATS)[number]["value"])}
        className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
      >
        {FORMATS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={exporting || total === 0}
        onClick={handleExport}
        className="w-full rounded bg-primary-600 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {exporting
          ? t("annotationExport.exporting")
          : t("annotationExport.exportAll", { count: total })}
      </button>
    </div>
  );
}
