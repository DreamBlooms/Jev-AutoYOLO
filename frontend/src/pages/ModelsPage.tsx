import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/PageHeader";
import { ModelsPanel } from "@/components/project/ModelsPanel";

export function ModelsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t("models.title")} subtitle={t("models.subtitle")} />
      <ModelsPanel projectId="" showProjectFilter />
    </div>
  );
}
