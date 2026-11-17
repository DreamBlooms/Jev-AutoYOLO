import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Compass, Cpu, Globe2, HardDrive, Laptop, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { ModelDownloadButton } from "@/components/ModelDownloadButton";
import { useTheme } from "@/hooks/useTheme";
import { getAppConfig, getModelStatus, getSam2Status, checkSam3Health, setInferenceDevice } from "@/services/api";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { isDark, setThemeMode } = useTheme();
  const config = useQuery({ queryKey: ["config"], queryFn: getAppConfig });
  const model = useQuery({ queryKey: ["model-status"], queryFn: getModelStatus, refetchInterval: 5000 });
  const sam2 = useQuery({ queryKey: ["sam2-status"], queryFn: getSam2Status, refetchInterval: 5000 });
  const sam3 = useQuery({ queryKey: ["sam3-status"], queryFn: checkSam3Health, refetchInterval: 5000 });
  const updateDevice = useMutation({
    mutationFn: setInferenceDevice,
    onSuccess: () => {
      toast.success(t("settings.deviceSaved"));
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("settings.saveFailed"))),
  });

  const language = i18n.language.slice(0, 2);

  if (config.isLoading) return <Card><CardContent className="space-y-3 pt-5"><Skeleton className="h-8 w-60" /><Skeleton className="h-48 w-full" /></CardContent></Card>;
  const data = config.data;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const modelState = model.data?.state ?? "unloaded";

  return (
    <div>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Laptop className="size-4" /> {t("settings.runtime")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t("settings.runtimeHint")}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <Badge variant="success">{data.device.toUpperCase()}</Badge>
              <Badge variant={data.rocm ? "warning" : "muted"}>{data.rocm ? "ROCm" : "CUDA/CPU"}</Badge>
              <Badge variant={data.jevConfigured ? "success" : "muted"}>Jev</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t("settings.device")}</span>
                <Select value={data.devicePreference} disabled={updateDevice.isPending} onChange={(event) => updateDevice.mutate(event.target.value)}>
                  <option value="auto">auto · {data.device}</option>
                  {data.availableDevices.map((device) => <option key={device} value={device}>{device}</option>)}
                </Select>
              </div>
              <div className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t("settings.available")}</span>
                <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/20 px-3 py-1.5">
                  {data.availableDevices.map((device) => <Badge key={device} variant={device === data.device ? "success" : "muted"}>{device}</Badge>)}
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Cpu className="size-3.5" /> GPU</div>
                <div className="mt-2 truncate text-sm font-medium" title={data.gpuName}>{data.gpuName || t("settings.noGpu")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{data.gpuAvailable ? t("settings.gpuReady") : t("settings.cpuOnly")}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Globe2 className="size-3.5" /> {t("settings.provider")}</div>
                <div className="mt-2 text-sm font-medium">{data.jevProvider}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground" title={data.jevModel}>{data.jevModel || "—"}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><HardDrive className="size-3.5" /> {t("settings.mode")}</div>
                <div className="mt-2 text-sm font-medium">{data.annotationOnly ? t("settings.annotationOnly") : t("settings.fullMode")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{data.trainingEnabled ? t("settings.trainingEnabled") : t("settings.trainingDisabled")}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="size-4" /> {t("settings.models")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {[
              { key: "vlm", label: t("settings.visionModel"), state: modelState, detail: model.data?.error || model.data?.stage || modelState },
              { key: "sam2", label: "SAM2", state: sam2.data?.state ?? "unloaded", detail: sam2.data?.error || sam2.data?.stage || sam2.data?.state || "unloaded" },
              { key: "sam3", label: "SAM3", state: sam3.data?.status ?? "unloaded", detail: sam3.data?.status ?? "unloaded" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{item.detail}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant={item.state === "loaded" ? "success" : item.state === "loading" || item.state === "downloading" ? "info" : "muted"}>{item.state}</Badge>
                  {item.key !== "sam3" ? <ModelDownloadButton kind={item.key as "vlm" | "sam2"} /> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>{t("settings.preferences")}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t("common.language")}</span>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                {[{ value: "zh", label: "中文" }, { value: "en", label: "English" }, { value: "ja", label: "日本語" }].map((item) => (
                  <button key={item.value} type="button" className={`rounded-md px-3 py-2 text-sm ${language === item.value ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => i18n.changeLanguage(item.value)}>{item.label}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t("settings.theme")}</span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                <Button variant={isDark ? "ghost" : "secondary"} className="shadow-none" onClick={() => setThemeMode("light")}><Sun /> {t("common.light")}</Button>
                <Button variant={isDark ? "secondary" : "ghost"} className="shadow-none" onClick={() => setThemeMode("dark")}><Moon /> {t("common.dark")}</Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 md:col-span-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{t("settings.guideTitle")}</div>
                <p className="mt-1 text-xs text-muted-foreground">{t("settings.guideHint")}</p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => window.dispatchEvent(new Event("autoyolo:onboarding"))}><Compass /> {t("settings.showGuide")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
