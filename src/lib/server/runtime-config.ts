import { prisma } from "@/lib/server/prisma";

export const RUNTIME_CONFIG_KEYS = [
  "zhihu_cookie",
  "zhihu_access_token",
  "siliconflow_api_key",
  "crawler_user_agent",
  "request_delay_ms",
  "rate_limit_window_ms",
  "rate_limit_max_requests",
  "cookie_check_url",
] as const;

export type RuntimeConfigKey = (typeof RUNTIME_CONFIG_KEYS)[number];

type ConfigKind = "string" | "number" | "secret";

export const CONFIG_DEFINITIONS: Record<
  RuntimeConfigKey,
  {
    label: string;
    description: string;
    defaultValue: string;
    sensitive: boolean;
    kind: ConfigKind;
  }
> = {
  zhihu_cookie: {
    label: "知乎 Cookie",
    description: "用于访问知乎内容的登录 Cookie",
    defaultValue: "",
    sensitive: true,
    kind: "secret",
  },
  zhihu_access_token: {
    label: "知乎 access_token",
    description: "用于还原 oia/soia 分享链接；普通文章链接不需要此项。可填写令牌值或 Bearer 加令牌值，过期后在此更新，保存立即生效。",
    defaultValue: "",
    sensitive: true,
    kind: "secret",
  },
  siliconflow_api_key: {
    label: "SiliconFlow API Key",
    description: "DeepSeek-OCR 使用的 SiliconFlow API Key",
    defaultValue: "",
    sensitive: true,
    kind: "secret",
  },
  crawler_user_agent: {
    label: "User-Agent",
    description: "爬取知乎页面和检查 Cookie 时使用的 User-Agent",
    defaultValue:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    sensitive: false,
    kind: "string",
  },
  request_delay_ms: {
    label: "请求间隔",
    description: "爬虫内部请求间隔，单位毫秒",
    defaultValue: "3000",
    sensitive: false,
    kind: "number",
  },
  rate_limit_window_ms: {
    label: "限流窗口",
    description: "爬取接口 IP 限流窗口，单位毫秒",
    defaultValue: String(60 * 60 * 1000),
    sensitive: false,
    kind: "number",
  },
  rate_limit_max_requests: {
    label: "限流次数",
    description: "每个限流窗口内允许的爬取请求数",
    defaultValue: "10",
    sensitive: false,
    kind: "number",
  },
  cookie_check_url: {
    label: "Cookie 检查 URL",
    description: "用于验证知乎 Cookie 是否可用的页面 URL",
    defaultValue: "https://www.zhihu.com/question/55860326/answer/2056067197",
    sensitive: false,
    kind: "string",
  },
};

export type RuntimeConfigValues = Record<RuntimeConfigKey, string>;

export async function getRuntimeConfigValue(key: RuntimeConfigKey) {
  const config = await prisma.systemConfig.findUnique({ where: { key } });
  return config?.value ?? CONFIG_DEFINITIONS[key].defaultValue;
}

export async function getRuntimeConfig(): Promise<RuntimeConfigValues> {
  const configs = await prisma.systemConfig.findMany({
    where: { key: { in: [...RUNTIME_CONFIG_KEYS] } },
  });
  const values = Object.fromEntries(
    RUNTIME_CONFIG_KEYS.map((key) => [key, CONFIG_DEFINITIONS[key].defaultValue])
  ) as RuntimeConfigValues;

  for (const config of configs) {
    if (isRuntimeConfigKey(config.key)) {
      values[config.key] = config.value;
    }
  }

  return values;
}

export function isRuntimeConfigKey(key: string): key is RuntimeConfigKey {
  return RUNTIME_CONFIG_KEYS.includes(key as RuntimeConfigKey);
}

export function coerceConfigValue(key: RuntimeConfigKey, value: string) {
  const definition = CONFIG_DEFINITIONS[key];

  if (definition.kind !== "number") {
    return value || definition.defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Number.parseInt(definition.defaultValue, 10);
  }

  return parsed;
}

export function validateConfigValue(key: RuntimeConfigKey, value: string) {
  const definition = CONFIG_DEFINITIONS[key];
  if (key === "zhihu_access_token") {
    if (!value.trim()) return null;
    const token = value.trim().replace(/^Bearer\s+/i, "");
    return token.length > 0 && token.length <= 4096 && /^[\x21-\x7e]+$/.test(token)
      ? null
      : "access_token 格式不正确，请只粘贴令牌值或 Bearer 加令牌值";
  }

  if (definition.kind !== "number") {
    return null;
  }

  if (!/^\d+$/.test(value.trim()) || Number.parseInt(value, 10) <= 0) {
    return `${definition.label} 必须是正整数`;
  }

  return null;
}

export function maskConfigValue(key: RuntimeConfigKey, value: string) {
  if (!CONFIG_DEFINITIONS[key].sensitive) return value;
  if (!value) return "";
  if (value.length <= 12) return "***";

  return `${value.slice(0, 9)}...${value.slice(-8)}`;
}

export function serializeConfig(
  key: RuntimeConfigKey,
  value: string,
  options: { revealValue?: boolean } = {}
) {
  const definition = CONFIG_DEFINITIONS[key];
  const shouldRevealValue = options.revealValue || !definition.sensitive;

  return {
    key,
    value: shouldRevealValue ? value : "",
    maskedValue: maskConfigValue(key, value),
    ...definition,
  };
}

export async function listRuntimeConfig() {
  const values = await getRuntimeConfig();
  return RUNTIME_CONFIG_KEYS.map((key) => serializeConfig(key, values[key]));
}
