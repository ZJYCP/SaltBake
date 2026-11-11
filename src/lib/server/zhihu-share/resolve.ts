import { cleanZhihuUrl, getCrawlerConfig } from "@/lib/crawler/config";
import { isZhihuShareUrl } from "@/lib/shared/zhihu-share-url";
import { getRuntimeConfigValue } from "@/lib/server/runtime-config";
import { restoreShareLink, ShareRestoreError } from "./restore";

/** Resolve before deduplication/task creation so only canonical URLs are persisted. */
export async function resolveCrawlUrl(url: string): Promise<string | null> {
  if (!isZhihuShareUrl(url)) return cleanZhihuUrl(url);

  const token = await getRuntimeConfigValue("zhihu_access_token");
  if (!token.trim()) {
    throw new ShareRestoreError(
      "抓取 oia/soia 分享链接需要 access_token，请先在管理后台 → 系统设置中配置知乎 access_token",
      503,
    );
  }
  return (await restoreShareLink(url, token, fetch, await getCrawlerConfig())).url;
}
