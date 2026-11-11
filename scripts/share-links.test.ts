import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isZhihuShareUrl } from "../src/lib/shared/zhihu-share-url";
import { encryptShareBody } from "../src/lib/server/zhihu-share/encrypt.js";
import { getShareQuery, getAuthorization, restoreShareLink, resolveAnswerUrl, ShareRestoreError, toPaidColumnUrl } from "../src/lib/server/zhihu-share/restore";
import { resolveCrawlUrl } from "../src/lib/server/zhihu-share/resolve";
import { createTask } from "../src/routes/api/tasks/route";
import { prisma } from "../src/lib/server/prisma";

const share = "https://soia.zhihu.com/km_paid_content/share?fallback_url=zhvip%3A%2F%2Ftab%2Fhome&mst=example";
const oiaShare = "https://oia.zhihu.com/km_paid_content/share?km_pst=example%3D&share_code=example&utm_psn=123";
const router = "zhihu://market/paid_column/123/section/456?source=example";
const canonical = "https://www.zhihu.com/market/paid_column/123/section/456";

// Independent upstream vector protects the custom cipher, not just its call shape.
assert.equal(encryptShareBody(createHash("md5").update("test").digest("hex")),
  "d8bdua91enLVMK4U3JJVjr7Vo4qixwtJou5NQSMTkHnWMxNIY8OyASim2ui9oxge");
for (const host of ["oia", "soia"]) {
  assert.ok(isZhihuShareUrl(share.replace("soia.", `${host}.`)));
}
for (const bad of [share.replace("soia.zhihu.com", "soia.zhihu.com.evil.test"), share.replace("https:", "http:"), "not a URL", null]) {
  assert.equal(isZhihuShareUrl(bad), false);
}
assert.equal(getShareQuery(share), "fallback_url=zhvip%3A%2F%2Ftab%2Fhome&mst=example");
assert.equal(getShareQuery(share.replace("&mst", "\\&mst")), getShareQuery(share));
assert.equal(getShareQuery(oiaShare), "km_pst=example%3D&share_code=example&utm_psn=123");
assert.throws(() => getShareQuery("https://oia.zhihu.com/km_paid_content/share"), ShareRestoreError);
assert.equal(getAuthorization(" Bearer example-token "), "Bearer example-token");
assert.throws(() => getAuthorization("a\r\nX-Header: injected"), ShareRestoreError);
assert.equal(toPaidColumnUrl(router).url, canonical);
assert.throws(() => toPaidColumnUrl("https://evil.test/market/paid_column/1/section/2"), ShareRestoreError);
const answerConfig = { cookie: "example-cookie", userAgent: "example-UA" };
const answerFetch: typeof fetch = async (url, options) => {
  assert.equal(url, "https://www.zhihu.com/answer/9876543210123456789");
  assert.equal(options?.redirect, "manual");
  assert.equal(new Headers(options?.headers).get("Cookie"), answerConfig.cookie);
  assert.equal(new Headers(options?.headers).has("Authorization"), false);
  return new Response(null, { status: 301, headers: { location: "/question/1234567890123456789/answer/9876543210123456789?source=example" } });
};
const answerUrl = "https://www.zhihu.com/question/1234567890123456789/answer/9876543210123456789";
assert.equal((await resolveAnswerUrl("9876543210123456789", answerConfig, answerFetch)).url, answerUrl);
for (const location of ["https://evil.test/question/1/answer/9876543210123456789", "/question/1/answer/999"]) {
  await assert.rejects(resolveAnswerUrl("9876543210123456789", answerConfig, async () =>
    new Response(null, { status: 301, headers: { location } })), ShareRestoreError);
}

const success: typeof fetch = async (url, options) => {
  assert.equal(url, "https://api.zhihu.com/kmap/share_restore");
  assert.equal(options?.redirect, "error");
  const headers = new Headers(options?.headers);
  assert.equal(headers.get("Authorization"), "Bearer example-token");
  assert.equal(headers.has("Cookie"), false);
  assert.equal(headers.has("X-Zse-96"), false);
  assert.equal(options?.body, encryptShareBody(JSON.stringify({ query_info: getShareQuery(share), scene: "oia" })));
  return Response.json({ status_code: 200, data: { router } });
};
assert.equal((await restoreShareLink(share, "example-token", success)).url, canonical);
await restoreShareLink(oiaShare, "example-token", async (_url, options) => {
  assert.equal(options?.body, encryptShareBody(JSON.stringify({ query_info: getShareQuery(oiaShare), scene: "oia" })));
  return Response.json({ status_code: 200, data: { router } });
});
assert.equal((await restoreShareLink(oiaShare, "example-token", async (url, options) => {
  if (url === "https://api.zhihu.com/kmap/share_restore") {
    return Response.json({ status_code: 200, data: { router: "zhihu://answer/9876543210123456789?share_code=example" } });
  }
  return answerFetch(url, options);
}, answerConfig)).url, answerUrl);
for (const [response, status] of [
  [Response.json({ status_code: 400, message: "您访问的链接已失效" }), 410],
  [Response.json({}, { status: 403 }), 401],
  [new Response("<html>verification</html>"), 502],
] as const) {
  await assert.rejects(restoreShareLink(share, "example-token", async () => response),
    (error: unknown) => error instanceof ShareRestoreError && error.status === status);
}
await assert.rejects(restoreShareLink(share, "example-token", async () => { throw new Error("secret must not leak"); }),
  (error: unknown) => error instanceof ShareRestoreError && !error.message.includes("secret"));

// Exercise the real task handler without a live database, credentials, or paid content.
const originals = {
  findUnique: prisma.systemConfig.findUnique,
  findMany: prisma.systemConfig.findMany,
  deleteLimits: prisma.rateLimitLog.deleteMany,
  countLimits: prisma.rateLimitLog.count,
  createLimit: prisma.rateLimitLog.create,
  findTask: prisma.crawlTask.findFirst,
  createTask: prisma.crawlTask.create,
  fetch: globalThis.fetch,
};
let token = "";
let duplicate = false;
let upstreamStatus = 200;
let answerMode = false;
const created: string[] = [];
const lookedUp: string[] = [];
let tokenReads = 0;
let upstreamCalls = 0;
const makeRequest = (url: unknown) => new Request("http://localhost:3000/api/tasks", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
});
try {
  prisma.systemConfig.findUnique = (async () => {
    tokenReads++;
    return { id: "config", key: "zhihu_access_token", value: token, updatedAt: new Date() };
  }) as typeof prisma.systemConfig.findUnique;
  prisma.systemConfig.findMany = (async () => []) as typeof prisma.systemConfig.findMany;
  prisma.rateLimitLog.deleteMany = (async () => ({ count: 0 })) as typeof prisma.rateLimitLog.deleteMany;
  prisma.rateLimitLog.count = (async () => 0) as typeof prisma.rateLimitLog.count;
  prisma.rateLimitLog.create = (async () => ({ id: "rate", ip: "test", createdAt: new Date() })) as typeof prisma.rateLimitLog.create;
  prisma.crawlTask.findFirst = (async (args: any) => {
    lookedUp.push(args.where.url);
    return duplicate ? { id: "existing", url: canonical, title: "Existing article" } : null;
  }) as typeof prisma.crawlTask.findFirst;
  prisma.crawlTask.create = (async (args: any) => {
    created.push(args.data.url);
    return { id: "new-task", status: "PENDING", url: args.data.url };
  }) as typeof prisma.crawlTask.create;
  globalThis.fetch = async (url, options) => {
    upstreamCalls++;
    if (String(url).startsWith("https://www.zhihu.com/answer/")) {
      assert.equal(options?.redirect, "manual");
      return new Response(null, { status: 301, headers: { location: "/question/1234567890123456789/answer/9876543210123456789" } });
    }
    assert.equal(new Headers(options?.headers).get("Authorization"), `Bearer ${token}`);
    return Response.json({ status_code: upstreamStatus, message: upstreamStatus === 200 ? "" : "您访问的链接已失效", data: { router: answerMode ? "zhihu://answer/9876543210123456789" : router } });
  };

  const missing = await createTask(makeRequest(share));
  assert.equal(missing.status, 503);
  assert.match((await missing.json()).error, /管理后台/);
  assert.equal(created.length, 0);
  assert.equal(upstreamCalls, 0);

  for (const host of ["oia", "soia"]) {
    token = `example-${host}`;
    const response = await createTask(makeRequest(share.replace("soia.", `${host}.`)));
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(JSON.parse(text).url, canonical);
    assert.ok(!text.includes(token));
    assert.equal(created.at(-1), canonical);
    assert.equal(lookedUp.at(-1), canonical);
  }
  const oiaResponse = await createTask(makeRequest(oiaShare));
  assert.equal(oiaResponse.status, 200);
  assert.equal((await oiaResponse.json()).url, canonical);
  assert.equal(created.at(-1), canonical);
  answerMode = true;
  const answerResponse = await createTask(makeRequest(oiaShare));
  assert.equal(answerResponse.status, 200);
  assert.equal((await answerResponse.json()).url, answerUrl);
  assert.equal(created.at(-1), answerUrl);
  assert.equal(lookedUp.at(-1), answerUrl);
  answerMode = false;
  duplicate = true;
  const beforeDuplicate = created.length;
  const existing = await (await createTask(makeRequest(share))).json();
  assert.equal(existing.existing, true);
  assert.equal(existing.article.url, canonical);
  assert.equal(created.length, beforeDuplicate);

  duplicate = false;
  upstreamStatus = 400;
  assert.equal((await createTask(makeRequest(share))).status, 410);
  assert.equal(created.length, beforeDuplicate);

  // Existing supported formats work without any access_token/config read/upstream call.
  token = "";
  const beforeNormal = { tokenReads, upstreamCalls };
  for (const url of [canonical, "https://www.zhihu.com/question/123/answer/456"]) {
    assert.equal(await resolveCrawlUrl(url + "?source=test"), url);
    const response = await createTask(makeRequest(url + "?source=test"));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).url, url);
  }
  assert.deepEqual({ tokenReads, upstreamCalls }, beforeNormal);
  assert.equal((await createTask(makeRequest({ url: share }))).status, 400);
} finally {
  prisma.systemConfig.findUnique = originals.findUnique;
  prisma.systemConfig.findMany = originals.findMany;
  prisma.rateLimitLog.deleteMany = originals.deleteLimits;
  prisma.rateLimitLog.count = originals.countLimits;
  prisma.rateLimitLog.create = originals.createLimit;
  prisma.crawlTask.findFirst = originals.findTask;
  prisma.crawlTask.create = originals.createTask;
  globalThis.fetch = originals.fetch;
}
console.log("Share links: cipher vector, validation, upstream failures, required token, canonical task storage/deduplication and legacy URLs passed.");
