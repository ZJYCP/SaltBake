import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "@/lib/server/prisma";
import { withAdmin } from "@/lib/server/admin-auth";
import { errorResponse, handleApiError, jsonResponse, safeParseJson } from "@/lib/server/api-response";

// PUT /api/admin/announcements/$id - 更新公告
async function updateAnnouncement(request: Request, id: string) {
  try {
    const body = await safeParseJson<{
      title?: string;
      content?: string;
      enabled?: boolean;
    }>(request);

    if (!body) {
      return errorResponse("请求体格式错误", 400, "JSON_PARSE_ERROR");
    }

    const updateData: Record<string, string | boolean> = {};

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) return errorResponse("标题不能为空", 400);
      updateData.title = title;
    }

    if (body.content !== undefined) {
      const content = body.content.trim();
      if (!content) return errorResponse("内容不能为空", 400);
      updateData.content = content;
    }

    if (body.enabled !== undefined) {
      updateData.enabled = body.enabled;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse("没有要更新的字段", 400);
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: updateData,
    });

    return jsonResponse(announcement);
  } catch (error) {
    return handleApiError(error, "更新公告失败");
  }
}

// DELETE /api/admin/announcements/$id - 删除公告
async function deleteAnnouncement(id: string) {
  try {
    await prisma.announcement.delete({ where: { id } });
    return jsonResponse({ success: true });
  } catch (error) {
    return handleApiError(error, "删除公告失败");
  }
}

export const Route = createFileRoute("/api/admin/announcements/$id")({
  server: {
    handlers: {
      PUT: withAdmin(({ request, params }) => updateAnnouncement(request, params.id)),
      DELETE: withAdmin(({ params }) => deleteAnnouncement(params.id)),
    },
  },
});
