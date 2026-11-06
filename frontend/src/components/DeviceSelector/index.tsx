import { useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { setInferenceDevice } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";

const ORDER = ["auto", "cpu", "cuda", "mps"] as const;

export function DeviceSelector() {
  const { t } = useTranslation();
  const devicePreference = useAppStore((s) => s.devicePreference);
  const setDevicePreference = useAppStore((s) => s.setDevicePreference);
  const activeDevice = useAppStore((s) => s.activeDevice);
  const setActiveDevice = useAppStore((s) => s.setActiveDevice);
  const availableDevices = useAppStore((s) => s.availableDevices);
  const setAvailableDevices = useAppStore((s) => s.setAvailableDevices);
  const rocm = useAppStore((s) => s.rocm);
  const setRocm = useAppStore((s) => s.setRocm);
  const gpuName = useAppStore((s) => s.gpuName);
  const setGpuName = useAppStore((s) => s.setGpuName);
  const [busy, setBusy] = useState(false);

  const available = new Set(["auto", "cpu", ...availableDevices]);
  const choices = ORDER.filter((item) => available.has(item));
  const labels: Record<string, string> = {
    auto: t("deviceSelector.auto"),
    cpu: t("deviceSelector.cpu"),
    cuda: rocm ? t("deviceSelector.rocm") : t("deviceSelector.cuda"),
    mps: t("deviceSelector.mps"),
  };

  const handleChange = async (value: string) => {
    const previous = devicePreference;
    setDevicePreference(value);
    setBusy(true);
    try {
      const config = await setInferenceDevice(value);
      setDevicePreference(config.devicePreference);
      setActiveDevice(config.device);
      setAvailableDevices(config.availableDevices);
      setRocm(config.rocm);
      setGpuName(config.gpuName);
      toast.success(t("deviceSelector.success", { device: config.device }));
    } catch (err) {
      setDevicePreference(previous);
      toast.error(err instanceof Error ? err.message : t("deviceSelector.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded bg-gray-50 px-2.5 py-1.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-500">{t("deviceSelector.label")}</span>
        <select
          value={devicePreference}
          disabled={busy}
          onChange={(e) => void handleChange(e.target.value)}
          className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 disabled:opacity-50"
        >
          {choices.map((item) => (
            <option key={item} value={item}>
              {labels[item]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-0.5 text-[10px] text-gray-400">
        {busy
          ? t("deviceSelector.switching")
          : t("deviceSelector.active", {
              device: activeDevice === "cuda" && gpuName ? `${activeDevice} · ${gpuName}` : activeDevice,
            })}
      </div>
    </div>
  );
}
