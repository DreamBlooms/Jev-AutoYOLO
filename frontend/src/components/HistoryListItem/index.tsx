import { ConfirmAction } from "@/components/ConfirmAction";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { VirtualItem } from "@tanstack/react-virtual";

interface HistoryListItemProps {
  det: Detection;
  virtualRow: VirtualItem;
  measureElement: (node: Element | null) => void;
  selectedSet: Set<string>;
  onSelect: (det: Detection) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export const HistoryListItem = memo(
  ({
    det,
    virtualRow,
    measureElement,
    selectedSet,
    onSelect,
    onDelete,
    isDeleting,
  }: HistoryListItemProps) => {
    const { t, i18n } = useTranslation();

    return (
      <div
        data-index={virtualRow.index}
        ref={measureElement}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${virtualRow.start}px)`,
        }}
        className="pb-1"
      >
        <div
          onClick={() => onSelect(det)}
          className="h-full cursor-pointer rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
        >
          <div className="flex gap-2">
            <img
              src={`${API_BASE}/detections/${det.id}/image`}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-12 w-12 rounded object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{det.imageName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(det.createdAt).toLocaleString(
                  i18n.language.startsWith("zh") ? "zh-CN" : "en-US",
                )}
              </p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {parseCategories(det.categories).map((c) => (
                  <span
                    key={c}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      selectedSet.has(c)
                        ? "bg-primary-500 text-white"
                        : "bg-primary-100 text-primary-700"
                    }`}
                  >
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {det.modelType && (
                  <span
                    className={`inline-block rounded px-1 py-0.5 mr-1 text-[10px] font-medium ${
                      det.modelType === "sam3"
                        ? "bg-violet-100 text-violet-700"
                        : det.modelType?.startsWith("jev")
                          ? "bg-emerald-100 text-emerald-700"
                          : det.modelType === "vlm+sam2"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {det.modelType === "sam3"
                      ? "SAM3"
                      : det.modelType?.startsWith("jev")
                        ? det.modelType === "jev+sam3"
                          ? "JEV+SAM3"
                          : det.modelType === "jev+sam2"
                            ? "JEV+SAM2"
                            : "JEV"
                        : det.modelType === "vlm+sam2"
                          ? "VLM+SAM2"
                          : "VLM"}
                  </span>
                )}
                {t("trainingPanel.targetsCount", { count: det.boxes.length })}
              </p>
              <div className="flex gap-2 mt-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-primary hover:underline"
                    >
                      {t("common.export")}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {[
                      ["yolo", "YOLO (.txt)"],
                      ["yolo-seg", "YOLO Segmentation"],
                      ["coco", "COCO (.json)"],
                      ["voc", "Pascal VOC (.xml)"],
                      ["createml", "CreateML (.json)"],
                    ].map(([key, label]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={async () => {
                          const labels: Record<string, string> = {
                            yolo: "YOLO",
                            "yolo-seg": "YOLO_Seg",
                            coco: "COCO",
                            voc: "VOC",
                            createml: "CreateML",
                          };
                          try {
                            const blob = await exportBatch([det.id], key);
                            downloadBlob(blob, `${labels[key] ?? key}_dataset.zip`);
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <ConfirmAction
                  title={t("historyList.deleteConfirm")}
                  onConfirm={() => onDelete(det.id)}
                  confirmText={t("common.delete")}
                  cancelText={t("common.cancel")}
                >
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isDeleting}
                    className="text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    {t("common.delete")}
                  </button>
                </ConfirmAction>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
