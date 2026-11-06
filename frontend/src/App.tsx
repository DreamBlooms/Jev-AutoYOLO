import { useEffect } from "react";
import { ConfigProvider, theme } from "antd";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { useTheme } from "./hooks/useTheme";
import { useAppStore } from "./store/useAppStore";
import { getAppConfig } from "./services/api";

export default function App() {
  const { isDark } = useTheme();
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
        // Keep the default (full) mode when the config endpoint is unavailable.
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
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : undefined,
        token: {
          colorPrimary: "#76b900",
        },
      }}
    >
      <Toaster position="top-center" />
      <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </ConfigProvider>
  );
}
