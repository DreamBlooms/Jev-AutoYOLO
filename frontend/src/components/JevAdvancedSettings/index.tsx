import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/useAppStore";

export function JevAdvancedSettings() {
  const { t } = useTranslation();
  const extraState = useAppStore((s) => s.extraState);
  const setExtraState = useAppStore((s) => s.setExtraState);
  const extraInstructions = useAppStore((s) => s.extraInstructions);
  const setExtraInstructions = useAppStore((s) => s.setExtraInstructions);
  const categories = useAppStore((s) => s.categories);
  const categoryInstructions = useAppStore((s) => s.categoryInstructions);
  const setCategoryInstructions = useAppStore((s) => s.setCategoryInstructions);
  const perCategory = categoryInstructions ?? {};

  const stateError = useMemo(() => {
    const text = extraState ?? "";
    if (!text.trim()) return "";
    try {
      const value = JSON.parse(text);
      return typeof value === "object" || typeof value === "string"
        ? ""
        : t("jevAdvanced.invalidJson");
    } catch {
      return t("jevAdvanced.invalidJson");
    }
  }, [extraState, t]);

  return (
    <details className="rounded border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs">
      <summary className="cursor-pointer select-none font-medium text-gray-600">
        {t("jevAdvanced.title")}
      </summary>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-400">{t("jevAdvanced.hint")}</p>

      <label className="mt-2 block text-[11px] font-medium text-gray-500" htmlFor="jev-extra-state">
        {t("jevAdvanced.stateLabel")}
      </label>
      <textarea
        id="jev-extra-state"
        value={extraState ?? ""}
        onChange={(e) => setExtraState(e.target.value)}
        rows={3}
        placeholder={t("jevAdvanced.statePlaceholder")}
        className={`mt-1 w-full resize-y rounded border bg-white px-2 py-1.5 font-mono text-[11px] text-gray-700 ${
          stateError ? "border-red-400" : "border-gray-200"
        }`}
      />
      {stateError && <p className="mt-1 text-[10px] text-red-500">{stateError}</p>}

      <label
        className="mt-2 block text-[11px] font-medium text-gray-500"
        htmlFor="jev-extra-instructions"
      >
        {t("jevAdvanced.instructionsLabel")}
      </label>
      <textarea
        id="jev-extra-instructions"
        value={extraInstructions ?? ""}
        onChange={(e) => setExtraInstructions(e.target.value)}
        rows={2}
        placeholder={t("jevAdvanced.instructionsPlaceholder")}
        className="mt-1 w-full resize-y rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700"
      />

      {categories.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-medium text-gray-500">
            {t("jevAdvanced.perCategoryLabel")}
          </p>
          {categories.map((category) => (
            <div key={category}>
              <label
                className="block truncate text-[10px] text-gray-400"
                htmlFor={`jev-cat-${category}`}
              >
                {category}
              </label>
              <textarea
                id={`jev-cat-${category}`}
                value={perCategory[category] ?? ""}
                onChange={(e) =>
                  setCategoryInstructions((prev) => ({
                    ...prev,
                    [category]: e.target.value,
                  }))
                }
                rows={2}
                placeholder={t("jevAdvanced.perCategoryPlaceholder")}
                className="mt-0.5 w-full resize-y rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700"
              />
            </div>
          ))}
        </div>
      )}

      {(extraState || extraInstructions || Object.values(perCategory).some(Boolean)) && (
        <button
          type="button"
          onClick={() => {
            setExtraState("");
            setExtraInstructions("");
            setCategoryInstructions({});
          }}
          className="mt-2 text-[10px] text-gray-400 hover:text-red-500"
        >
          {t("jevAdvanced.clear")}
        </button>
      )}
    </details>
  );
}
