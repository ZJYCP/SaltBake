import { encryptShareBody } from "./encrypt.js";
import { isZhihuShareUrl, normalizeZhihuShareUrl } from "@/lib/shared/zhihu-share-url";

const ENDPOINT = "https://api.zhihu.com/kmap/share_restore";

export class ShareRestoreError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function getShareQuery(value: unknown): string {
  if (typeof value !== "string" || value.length > 8192) {
    throw new ShareRestoreError("请填写完整的盐言故事分享链接");
  }
  if (!isZhihuShareUrl(value)) {
    throw new ShareRestoreError("请使用 soia.zhihu.com 或 oia.zhihu.com 的 km_paid_content/share 链接");
  }
  const text = normalizeZhihuShareUrl(value);
  const url = new URL(text);
  // Preserve the original bytes: do not decode/reorder the query before encryption.
  const query = text.slice(text.indexOf("?") + 1).split("#", 1)[0];
  // Share payload names vary (e.g. mst or km_pst/share_code). The restore
  // endpoint receives the full original query and validates the payload itself.
  if (!url.search || !query) {
    throw new ShareRestoreError("分享链接缺少查询参数，请在 App 中重新复制完整链接");
  }
  return query;
}

export function getAuthorization(value: unknown): string {
  if (typeof value !== "string") throw new ShareRestoreError("请填写 access_token");
  const token = value.trim().replace(/^Bearer\s+/i, "");
  if (!token || token.length > 4096 || !/^[\x21-\x7e]+$/.test(token)) {
    throw new ShareRestoreError("access_token 格式不正确，请只粘贴令牌值或 Bearer 加令牌值");
  }
  return `Bearer ${token}`;
}

export function toPaidColumnUrl(router: unknown) {
  if (typeof router !== "string") throw new ShareRestoreError("还原接口未返回文章地址", 502);
  const match = router.match(/^(?:zhihu:\/\/market|https:\/\/www\.zhihu\.com\/market)\/paid_column\/(\d+)\/section\/(\d+)(?:[?#].*)?$/);
  if (!match) throw new ShareRestoreError("该分享未返回支持的 paid_column 章节地址", 422);
  const [, columnId, sectionId] = match;
  return {
    url: `https://www.zhihu.com/market/paid_column/${columnId}/section/${sectionId}`,
    columnId,
    sectionId,
  };
}

export async function resolveAnswerUrl(
  answerId: string,
  config: { cookie: string; userAgent: string },
  fetcher: typeof fetch = fetch,
) {
  if (!/^\d+$/.test(answerId)) throw new ShareRestoreError("回答 ID 格式不正确");
  let response: Response;
  try {
    // Use the crawler's existing Cookie/UA. Read only the fixed answer endpoint's
    // redirect, never forward credentials to a redirect destination.
    response = await fetcher(`https://www.zhihu.com/answer/${answerId}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Cookie: config.cookie,
        "User-Agent": config.userAgent,
        Referer: "https://www.zhihu.com/",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
  } catch {
    throw new ShareRestoreError("获取回答地址失败或超时，请稍后重试", 502);
  }
  const location = response.headers.get("location");
  if ([301, 302, 303, 307, 308].includes(response.status) && location) {
    let target: URL;
    try { target = new URL(location, "https://www.zhihu.com"); } catch {
      throw new ShareRestoreError("知乎返回了无效的回答地址", 502);
    }
    const match = target.pathname.match(/^\/question\/(\d+)\/answer\/(\d+)\/?$/);
    if (target.protocol === "https:" && target.hostname === "www.zhihu.com"
      && !target.port && !target.username && !target.password && match?.[2] === answerId) {
      return { url: `https://www.zhihu.com/question/${match[1]}/answer/${answerId}`, questionId: match[1], answerId };
    }
  }
  throw new ShareRestoreError("该分享指向问答，但未能获取完整地址，请检查后台知乎 Cookie 和 User-Agent 后重试", 422);
}

export async function restoreShareLink(
  shareUrl: unknown,
  accessToken: unknown,
  fetcher: typeof fetch = fetch,
  answerConfig: { cookie: string; userAgent: string } = { cookie: "", userAgent: "Mozilla/5.0" },
) {
  const queryInfo = getShareQuery(shareUrl);
  const authorization = getAuthorization(accessToken);
  const body = encryptShareBody(JSON.stringify({ query_info: queryInfo, scene: "oia" }));
  let response: Response;
  try {
    response = await fetcher(ENDPOINT, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: authorization,
        "X-Zse-93": "101_1_1.0",
        "X-Api-Version": "3.0.93",
        "X-App-Version": "10.12.0",
        "Content-Type": "application/json; charset=UTF-8",
        "User-Agent": "Mozilla/5.0",
      },
      body,
    });
  } catch {
    throw new ShareRestoreError("连接知乎接口失败或请求超时，请稍后再试", 502);
  }
  if (response.status === 401 || response.status === 403) {
    throw new ShareRestoreError("知乎拒绝了授权请求，请在管理后台更新 access_token 后重试", 401);
  }
  if (!response.ok) throw new ShareRestoreError("知乎接口暂时不可用，请稍后再试", 502);
  let result: { status_code?: number; message?: string; data?: { router?: unknown } };
  try { result = await response.json(); } catch {
    throw new ShareRestoreError("知乎返回了无法识别的响应，请稍后再试", 502);
  }
  if (!result || typeof result !== "object" || result.status_code !== 200) {
    if (typeof result?.message === "string" && /链接.*(?:失效|过期)/.test(result.message)) {
      throw new ShareRestoreError("分享链接已失效，请在盐言故事 App 中重新分享后再试", 410);
    }
    throw new ShareRestoreError("知乎未能还原此链接，请检查分享链接和 access_token", 422);
  }
  const router = result.data?.router;
  const answer = typeof router === "string" && router.match(/^zhihu:\/\/answer\/(\d+)(?:[?#].*)?$/);
  if (answer) return resolveAnswerUrl(answer[1], answerConfig, fetcher);
  return toPaidColumnUrl(router);
}
