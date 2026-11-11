/** Normalize copied share links without decoding or reordering their query string. */
export function normalizeZhihuShareUrl(value: string): string {
  return value.trim().replace(/\\&/g, "&").replace(/&amp;/g, "&");
}

/** Client-safe recognition only. Restoration and credentials stay on the server. */
export function isZhihuShareUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(normalizeZhihuShareUrl(value));
    return url.protocol === "https:"
      && ["oia.zhihu.com", "soia.zhihu.com"].includes(url.hostname)
      && !url.port && !url.username && !url.password
      && url.pathname === "/km_paid_content/share";
  } catch {
    return false;
  }
}
