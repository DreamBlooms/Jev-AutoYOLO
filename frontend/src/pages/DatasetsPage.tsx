import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/PageHeader";
import { DatasetsPanel } from "@/components/project/DatasetsPanel";

export function DatasetsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t("datasets.title")} subtitle={t("datasets.subtitle")} />
      <DatasetsPanel projectId="" showProjectFilter />
    </div>
  );
}
