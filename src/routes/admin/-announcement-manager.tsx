import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Megaphone, Plus, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/client/api-client";
import type { Announcement } from "@/lib/shared/types";

// 公告管理组件
export function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    const result = await apiGet<Announcement[]>("/api/admin/announcements", false);
    if (result.success) {
      setAnnouncements(result.data);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("请输入公告标题和内容");
      return;
    }

    setSaving(true);
    const result = await apiPost<Announcement>("/api/admin/announcements", {
      title: title.trim(),
      content: content.trim(),
    });
    setSaving(false);

    if (result.success) {
      toast.success("公告已发布");
      setTitle("");
      setContent("");
      await fetchAnnouncements();
    }
  };

  const toggleEnabled = async (announcement: Announcement) => {
    const result = await apiPut<Announcement>(
      `/api/admin/announcements/${announcement.id}`,
      { enabled: !announcement.enabled }
    );

    if (result.success) {
      toast.success(announcement.enabled ? "公告已停用" : "公告已启用");
      setAnnouncements((current) =>
        current.map((a) => (a.id === announcement.id ? result.data : a))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const result = await apiDelete(`/api/admin/announcements/${id}`, undefined, false);
    if (result.success) {
      toast.success("公告已删除");
      setAnnouncements((current) => current.filter((a) => a.id !== id));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          公告发布
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 发布新公告 */}
        <div className="border-b pb-5">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">标题</label>
              <Input
                className="mt-1"
                placeholder="公告标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-sm font-medium">内容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-24 mt-1 p-3 border rounded-lg bg-[hsl(var(--background))] text-sm resize-none"
                placeholder="公告内容，发布后将显示在首页顶部横幅"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={saving}>
                <Plus className="h-4 w-4 mr-2" />
                {saving ? "发布中..." : "发布公告"}
              </Button>
            </div>
          </div>
        </div>

        {/* 公告列表 */}
        <div>
          <p className="text-sm font-medium mb-3">
            已发布公告（{announcements.length}）
          </p>
          {announcements.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              暂无公告，发布后将在首页顶部展示
            </p>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="border rounded-lg p-4 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {announcement.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs shrink-0 ${
                          announcement.enabled
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                        }`}
                      >
                        {announcement.enabled ? "展示中" : "已停用"}
                      </span>
                    </div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2 break-all">
                      {announcement.content}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                      {new Date(announcement.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleEnabled(announcement)}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(announcement.id)}
                    >
                      <Trash2 className="h-4 w-4 text-[hsl(var(--destructive))]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
