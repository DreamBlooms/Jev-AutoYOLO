import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/PageHeader";
import { ReviewPanel } from "@/components/project/ReviewPanel";

export function ReviewPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t("review.title")} subtitle={t("review.subtitle")} />
      <ReviewPanel projectId="" showProjectFilter />
    </div>
  );
}
