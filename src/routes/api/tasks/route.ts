import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "@/lib/server/prisma";
import { resolveCrawlUrl } from "@/lib/server/zhihu-share/resolve";
import { ShareRestoreError } from "@/lib/server/zhihu-share/restore";
import { errorResponse, handleApiError, jsonResponse, safeParseJson } from "@/lib/server/api-response";
import { checkRateLimit } from "@/lib/server/rate-limiter";

// GET /api/tasks - 获取任务列表
async function getTasks(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // status=active 只查询 RUNNING 和 FAILED 状态的任务
    if (status === "active") {
      const tasks = await prisma.crawlTask.findMany({
        where: {
          status: { in: ["RUNNING", "FAILED"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          url: true,
          status: true,
          error: true,
          createdAt: true,
        },
      });
      return jsonResponse(tasks);
    }

    // 默认查询所有任务（如果真的需要的话，可以加分页）
    const tasks = await prisma.crawlTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 100, // 限制最多返回 100 条
      select: {
        id: true,
        url: true,
        status: true,
        title: true,
        error: true,
        createdAt: true,
      },
    });
    return jsonResponse(tasks);
  } catch (error) {
    return handleApiError(error, "获取任务列表失败");
  }
}

// POST /api/tasks - 创建任务
export async function createTask(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
               request.headers.get("x-real-ip") ||
               "unknown";
    const { allowed } = await checkRateLimit(ip);
    if (!allowed) {
      return errorResponse("请求过于频繁，请稍后再试", 429, "RATE_LIMIT_EXCEEDED");
    }

    const body = await safeParseJson<{ url?: string }>(request);

    if (!body) {
      return errorResponse("请求体格式错误", 400, "JSON_PARSE_ERROR");
    }

    const { url } = body;

    if (typeof url !== "string" || !url.trim()) {
      return errorResponse("URL 不能为空", 400);
    }

    // 分享链接必须先还原，再按普通文章地址去重和保存。
    const cleanUrl = await resolveCrawlUrl(url);
    if (!cleanUrl) {
      return errorResponse("无效的知乎 URL 格式", 400);
    }

    // 检查是否已存在已完成的文章
    const existing = await prisma.crawlTask.findFirst({
      where: {
        url: cleanUrl,
        status: "COMPLETED",
      },
      select: {
        id: true,
        title: true,
        author: true,
        content_preview: true,
        url: true,
        createdAt: true,
      },
    });

    if (existing) {
      return jsonResponse({ existing: true, article: existing });
    }

    // 创建新任务
    const task = await prisma.crawlTask.create({
      data: { url: cleanUrl },
    });

    return jsonResponse(task);
  } catch (error) {
    if (error instanceof ShareRestoreError) {
      return errorResponse(error.message, error.status, "SHARE_RESTORE_ERROR");
    }
    return handleApiError(error, "创建任务失败");
  }
}

export const Route = createFileRoute("/api/tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => getTasks(request),
      POST: async ({ request }) => createTask(request),
    },
  },
});
