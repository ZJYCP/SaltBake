import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const apiDir = new URL("../src/routes/api", import.meta.url);

// 管理员鉴权守卫：直接调用 requireAdminRequest 或经 withAdmin 高阶包装均视为受保护
const ADMIN_GUARDS = ["requireAdminRequest", "withAdmin"];
function isAdminGuarded(source: string): boolean {
  return ADMIN_GUARDS.some((guard) => source.includes(guard));
}
const expectedRoutes = new Map([
  ["admin/announcements/$id/route.ts", "/api/admin/announcements/$id"],
  ["admin/announcements/route.ts", "/api/admin/announcements"],
  ["admin/articles/$id/route.ts", "/api/admin/articles/$id"],
  ["admin/articles/route.ts", "/api/admin/articles"],
  ["admin/auth/route.ts", "/api/admin/auth"],
  ["admin/check-cookie/route.ts", "/api/admin/check-cookie"],
  ["admin/config/route.ts", "/api/admin/config"],
  ["admin/cookie-status/route.ts", "/api/admin/cookie-status"],
  ["admin/feedback/$id/route.ts", "/api/admin/feedback/$id"],
  ["admin/feedback/route.ts", "/api/admin/feedback"],
  ["announcements/route.ts", "/api/announcements"],
  ["articles/route.ts", "/api/articles"],
  ["crawl/route.ts", "/api/crawl"],
  ["external/config/route.ts", "/api/external/config"],
  ["tasks/$id/feedback/route.ts", "/api/tasks/$id/feedback"],
  ["stats/route.ts", "/api/stats"],
  ["tasks/$id/route.ts", "/api/tasks/$id"],
  ["tasks/clear-failed/route.ts", "/api/tasks/clear-failed"],
  ["tasks/route.ts", "/api/tasks"],
]);

async function listRouteFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return listRouteFiles(path);
      }

      return entry.name === "route.ts" ? [path] : [];
    })
  );

  return files.flat();
}

const routeFiles = await listRouteFiles(apiDir.pathname);
assert.deepEqual(
  routeFiles.map((file) => relative(apiDir.pathname, file)).sort(),
  Array.from(expectedRoutes.keys()).sort()
);

for (const file of routeFiles) {
  const relativeFile = relative(apiDir.pathname, file);
  const expectedRoute = expectedRoutes.get(relativeFile);

  assert.equal(file.includes("[id]"), false, `${file} should use $id params`);

  const source = await readFile(file, "utf8");
  assert.equal(source.includes("next/server"), false, `${file} imports next/server`);
  assert.equal(source.includes("NextRequest"), false, `${file} uses NextRequest`);
  assert.equal(source.includes("NextResponse"), false, `${file} uses NextResponse`);
  assert.match(source, /export\s+const\s+Route\s*=\s*createFileRoute/, `${file} must export TanStack Route`);
  assert.match(
    source,
    new RegExp(`createFileRoute\\("${expectedRoute?.replaceAll("$", "\\$")}"\\)`),
    `${file} must route to ${expectedRoute}`
  );
}

const cookieStatusSource = await readFile(
  join(apiDir.pathname, "admin/cookie-status/route.ts"),
  "utf8"
);
assert.equal(
  isAdminGuarded(cookieStatusSource),
  false,
  "/api/admin/cookie-status must expose public, read-only service status",
);

const checkCookieSource = await readFile(
  join(apiDir.pathname, "admin/check-cookie/route.ts"),
  "utf8"
);
assert.ok(
  isAdminGuarded(checkCookieSource),
  "/api/admin/check-cookie must stay admin-only because it triggers a live Cookie check",
);

const configSource = await readFile(
  join(apiDir.pathname, "admin/config/route.ts"),
  "utf8"
);
assert.ok(
  isAdminGuarded(configSource),
  "/api/admin/config must be admin-only because it exposes runtime configuration",
);

const publicFeedbackSource = await readFile(
  join(apiDir.pathname, "tasks/$id/feedback/route.ts"),
  "utf8"
);
assert.equal(
  isAdminGuarded(publicFeedbackSource),
  false,
  "/api/tasks/$id/feedback must be a public feedback submission endpoint",
);
assert.match(
  publicFeedbackSource,
  /POST:\s*async/,
  "/api/tasks/$id/feedback must accept public POST submissions",
);

const adminFeedbackSource = await readFile(
  join(apiDir.pathname, "admin/feedback/route.ts"),
  "utf8"
);
assert.ok(
  isAdminGuarded(adminFeedbackSource),
  "/api/admin/feedback must be admin-only because it lists user feedback",
);

const adminFeedbackDetailSource = await readFile(
  join(apiDir.pathname, "admin/feedback/$id/route.ts"),
  "utf8"
);
assert.ok(
  isAdminGuarded(adminFeedbackDetailSource),
  "/api/admin/feedback/$id must be admin-only because it updates feedback status",
);
assert.match(
  adminFeedbackDetailSource,
  /PUT:\s*(async|withAdmin)/,
  "/api/admin/feedback/$id must support PUT because the admin API client uses apiPut",
);

const publicAnnouncementsSource = await readFile(
  join(apiDir.pathname, "announcements/route.ts"),
  "utf8"
);
assert.equal(
  isAdminGuarded(publicAnnouncementsSource),
  false,
  "/api/announcements must be public for the homepage banner",
);

const adminAnnouncementsSource = await readFile(
  join(apiDir.pathname, "admin/announcements/route.ts"),
  "utf8"
);
assert.ok(
  isAdminGuarded(adminAnnouncementsSource),
  "/api/admin/announcements must be admin-only because it publishes announcements",
);

const adminAnnouncementDetailSource = await readFile(
  join(apiDir.pathname, "admin/announcements/$id/route.ts"),
  "utf8"
);
assert.ok(
  isAdminGuarded(adminAnnouncementDetailSource),
  "/api/admin/announcements/$id must be admin-only because it manages announcements",
);

console.log("api route migration contract ok");
