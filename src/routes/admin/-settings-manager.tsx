import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/client/api-client";
import type { ConfigItem, CookieStatus } from "@/lib/shared/types";
import { AnnouncementManager } from "./-announcement-manager";

// 系统设置组件
export function SettingsManager() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [cookieStatus, setCookieStatus] = useState<CookieStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const fetchConfigs = useCallback(async () => {
    const result = await apiGet<ConfigItem[]>("/api/admin/config", false);
    if (result.success) {
      setConfigs(result.data);
      setValues(
        Object.fromEntries(result.data.map((config) => [config.key, config.value]))
      );

      const sensitiveConfigs = result.data.filter((config) => config.sensitive);
      const sensitiveValues = await Promise.all(
        sensitiveConfigs.map(async (config) => {
          const detail = await apiGet<ConfigItem>(
            `/api/admin/config?key=${encodeURIComponent(config.key)}`,
            false
          );
          return [config.key, detail.success ? detail.data.value : ""] as const;
        })
      );

      setValues((current) => ({
        ...current,
        ...Object.fromEntries(sensitiveValues),
      }));
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchCookieStatus();
  }, [fetchConfigs]);

  const fetchCookieStatus = async () => {
    const result = await apiGet<CookieStatus>("/api/admin/cookie-status", false);
    if (result.success) {
      setCookieStatus(result.data);
    }
  };

  const saveConfig = async (key: string) => {
    setSavingKey(key);
    const result = await apiPost<ConfigItem>("/api/admin/config", {
      key,
      value: values[key] ?? "",
    });
    setSavingKey(null);
    if (result.success) {
      toast.success("配置已保存");
      setConfigs((current) =>
        current.map((config) => (config.key === key ? result.data : config))
      );
      setValues((current) => ({
        ...current,
        [key]: result.data.sensitive ? values[key] ?? "" : result.data.value,
      }));
    }
  };

  const checkCookieNow = async () => {
    setChecking(true);
    const result = await apiGet("/api/admin/check-cookie", false);
    await fetchCookieStatus();
    setChecking(false);
    if (result.success) {
      toast.success("Cookie 检查完成");
    }
  };

  return (
    <div className="space-y-6">
      {/* 公告发布 */}
      <AnnouncementManager />

      {/* 运行时配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">运行时配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {configs.map((config) => (
            <div key={config.key} className="border-b pb-5 last:border-b-0 last:pb-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <label className="text-sm font-medium">{config.label}</label>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {config.description}
                  </p>
                </div>
                {config.sensitive && config.maskedValue && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    当前：{config.maskedValue}
                  </span>
                )}
              </div>
              {config.sensitive || config.key === "crawler_user_agent" ? (
                <textarea
                  value={values[config.key] ?? ""}
                  onChange={(e) =>
                    setValues((current) => ({
                      ...current,
                      [config.key]: e.target.value,
                    }))
                  }
                  className="w-full h-24 p-3 border rounded-lg bg-[hsl(var(--background))] text-sm font-mono resize-none"
                  placeholder={config.defaultValue || config.label}
                />
              ) : (
                <Input
                  type={config.kind === "number" ? "number" : "text"}
                  value={values[config.key] ?? ""}
                  onChange={(e) =>
                    setValues((current) => ({
                      ...current,
                      [config.key]: e.target.value,
                    }))
                  }
                  placeholder={config.defaultValue}
                />
              )}
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveConfig(config.key)}
                  disabled={savingKey === config.key}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingKey === config.key ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" onClick={checkCookieNow} disabled={checking}>
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
              立即检查
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cookie 状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Cookie 可用性
            {cookieStatus?.latest && (
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  cookieStatus.latest.success
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                }`}
              >
                {cookieStatus.latest.success ? "正常" : "异常"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cookieStatus?.latest && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">
                最近检查：
                {new Date(cookieStatus.latest.checkedAt).toLocaleString("zh-CN")}
              </span>
              <span className="text-[hsl(var(--muted-foreground))]">
                24h 成功率：{cookieStatus.successRate}%
              </span>
            </div>
          )}

          {/* 状态时间线 */}
          {cookieStatus?.logs && cookieStatus.logs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                最近 24 小时状态
              </p>
              <div className="flex gap-1 flex-wrap">
                {cookieStatus.logs
                  .slice()
                  .reverse()
                  .map((log, i) => (
                    <div
                      key={i}
                      className={`w-3 h-8 rounded-sm ${
                        log.success
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                      title={`${new Date(log.checkedAt).toLocaleString("zh-CN")} - ${
                        log.success ? "正常" : "异常"
                      }`}
                    />
                  ))}
              </div>
            </div>
          )}

          {!cookieStatus?.logs?.length && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              暂无检查记录，点击"立即检查"进行首次检查
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
