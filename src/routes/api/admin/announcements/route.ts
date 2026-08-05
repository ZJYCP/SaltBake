import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "@/lib/server/prisma";
import { withAdmin } from "@/lib/server/admin-auth";
import { errorResponse, handleApiError, jsonResponse, safeParseJson } from "@/lib/server/api-response";

// GET /api/admin/announcements - 获取公告列表
async function getAdminAnnouncements() {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
    });

    return jsonResponse(announcements);
  } catch (error) {
    return handleApiError(error, "获取公告列表失败");
  }
}

// POST /api/admin/announcements - 创建公告
async function createAnnouncement(request: Request) {
  try {
    const body = await safeParseJson<{ title?: string; content?: string; enabled?: boolean }>(request);

    if (!body) {
      return errorResponse("请求体格式错误", 400, "JSON_PARSE_ERROR");
    }

    const title = body.title?.trim();
    const content = body.content?.trim();

    if (!title || !content) {
      return errorResponse("标题和内容不能为空", 400);
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        enabled: body.enabled ?? true,
      },
    });

    return jsonResponse(announcement, { status: 201 });
  } catch (error) {
    return handleApiError(error, "创建公告失败");
  }
}

export const Route = createFileRoute("/api/admin/announcements")({
  server: {
    handlers: {
      GET: withAdmin(() => getAdminAnnouncements()),
      POST: withAdmin(({ request }) => createAnnouncement(request)),
    },
  },
});
