import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "@/lib/server/prisma";
import { handleApiError, jsonResponse } from "@/lib/server/api-response";

// GET /api/announcements - 获取启用的公告列表（公开）
async function getAnnouncements() {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
      },
    });

    return jsonResponse(announcements);
  } catch (error) {
    return handleApiError(error, "获取公告失败");
  }
}

export const Route = createFileRoute("/api/announcements")({
  server: {
    handlers: {
      GET: async () => getAnnouncements(),
    },
  },
});
