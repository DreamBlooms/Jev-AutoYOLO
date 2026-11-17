import { useEffect } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { ClassicWorkspacePage } from "@/pages/ClassicWorkspacePage";
import { DatasetsPage } from "@/pages/DatasetsPage";
import { FullStepsPage } from "@/pages/FullStepsPage";
import { ModelsPage } from "@/pages/ModelsPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { getAppConfig } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";

function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return <Empty title="404" description={t("common.notFound")} action={<Button onClick={() => navigate("/")}>{t("nav.projects")}</Button>} />;
}

export default function App() {
  const setAnnotationOnly = useAppStore((s) => s.setAnnotationOnly);
  const setGpuAvailable = useAppStore((s) => s.setGpuAvailable);
  const setConfigLoaded = useAppStore((s) => s.setConfigLoaded);
  const setDevicePreference = useAppStore((s) => s.setDevicePreference);
  const setActiveDevice = useAppStore((s) => s.setActiveDevice);
  const setAvailableDevices = useAppStore((s) => s.setAvailableDevices);
  const setRocm = useAppStore((s) => s.setRocm);
  const setGpuName = useAppStore((s) => s.setGpuName);

  useEffect(() => {
    getAppConfig()
      .then((config) => {
        setAnnotationOnly(config.annotationOnly);
        setGpuAvailable(config.gpuAvailable);
        setDevicePreference(config.devicePreference);
        setActiveDevice(config.device);
        setAvailableDevices(config.availableDevices);
        setRocm(config.rocm);
        setGpuName(config.gpuName);
      })
      .catch(() => {
        // Keep full mode when the config endpoint is unavailable.
      })
      .finally(() => setConfigLoaded(true));
  }, [
    setAnnotationOnly,
    setGpuAvailable,
    setConfigLoaded,
    setDevicePreference,
    setActiveDevice,
    setAvailableDevices,
    setRocm,
    setGpuName,
  ]);

  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      <Routes>
        <Route path="/projects/:projectId/classic" element={<ClassicWorkspacePage />} />
        <Route path="/full-steps" element={<FullStepsPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
