import { useState, useEffect, useCallback, Suspense } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Search,
  FileText,
  RefreshCw,
  X,
  TrendingUp,
  Clock,
  AlertCircle,
  Download,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/client/api-client";
import type {
  ArticleListItem as Article,
  ArticlesListResponse as ArticlesResponse,
  Stats,
  Announcement,
} from "@/lib/shared/types";

interface Task {
  id: string;
  url: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error: string | null;
}

interface TaskResponse {
  id: string;
  url: string;
  existing?: boolean;
  article?: Article;
}

interface CrawlResponse {
  id: string;
  status: string;
  error?: string;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page) || 1,
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: Home,
});

// 判断输入类型
type InputType = "keyword" | "valid_url" | "invalid_url";

function getInputType(text: string): InputType {
  const trimmed = text.trim();
  if (!trimmed) return "keyword";

  // 检查是否像 URL
  if (trimmed.includes("zhihu.com") || trimmed.startsWith("http")) {
    // 检查是否是付费专栏格式
    const paidColumnMatch = trimmed.match(
      /https?:\/\/(?:www\.)?zhihu\.com\/market\/paid_column\/(\d+)\/section\/(\d+)/
    );
    if (paidColumnMatch) {
      return "valid_url";
    }
    // 检查是否是问答格式
    const questionMatch = trimmed.match(
      /https?:\/\/(?:www\.)?zhihu\.com\/question\/(\d+)\/answer\/(\d+)/
    );
    if (questionMatch) {
      return "valid_url";
    }
    return "invalid_url";
  }

  return "keyword";
}

// 清理 URL，去除查询参数
function cleanZhihuUrl(text: string): string {
  // 付费专栏格式
  const paidColumnMatch = text.match(
    /https?:\/\/(?:www\.)?zhihu\.com\/market\/paid_column\/(\d+)\/section\/(\d+)/
  );
  if (paidColumnMatch) {
    return `https://www.zhihu.com/market/paid_column/${paidColumnMatch[1]}/section/${paidColumnMatch[2]}`;
  }
  // 问答格式
  const questionMatch = text.match(
    /https?:\/\/(?:www\.)?zhihu\.com\/question\/(\d+)\/answer\/(\d+)/
  );
  if (questionMatch) {
    return `https://www.zhihu.com/question/${questionMatch[1]}/answer/${questionMatch[2]}`;
  }
  return text;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Home() {
  return (
    <Suspense fallback={
      <main className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });

  // 从 URL 参数初始化状态
  const initialPage = search.page;
  const initialSearch = search.q;

  const [input, setInput] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [initialLoading, setInitialLoading] = useState(true);
  // 是否处于爬取模式（不显示搜索提示）
  const [crawlingUrl, setCrawlingUrl] = useState<string | null>(null);
  // 首页公告
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const inputType = getInputType(input);
  const hasRunningTask = tasks.some((t) => t.status === "RUNNING");

  // 更新 URL 参数（不刷新页面）
  const updateUrl = useCallback((newPage: number, newSearch: string) => {
    navigate({
      to: "/",
      search: {
        page: newPage > 1 ? newPage : undefined,
        q: newSearch || undefined,
      },
      replace: true,
    });
  }, [navigate]);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    const result = await apiGet<Stats>("/api/stats", false);
    if (result.success) {
      setStats(result.data);
    }
  }, []);

  // 获取文章列表
  const fetchArticles = useCallback(
    async (p: number, search: string, searchByUrl = false) => {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (search) {
        params.set("search", search);
        if (searchByUrl) params.set("type", "url");
      }
      const result = await apiGet<ArticlesResponse>(`/api/articles?${params}`, false);
      if (result.success) {
        setArticles(result.data.articles);
        setTotalPages(result.data.totalPages);
        setTotal(result.data.total);
        setPage(p);
        return result.data;
      }
      return { articles: [], total: 0, totalPages: 1 };
    },
    []
  );

  // 获取公告
  const fetchAnnouncements = useCallback(async () => {
    const result = await apiGet<Announcement[]>("/api/announcements", false);
    if (result.success) {
      setAnnouncements(result.data);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    const isUrlSearch = initialSearch.includes("zhihu.com");
    Promise.all([
      fetchArticles(initialPage, initialSearch, isUrlSearch),
      fetchStats(),
      fetchAnnouncements(),
    ]).finally(() => {
      setInitialLoading(false);
    });
  }, [fetchArticles, fetchStats, fetchAnnouncements, initialPage, initialSearch]);

  // 提交搜索
  const handleSubmit = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // 无效 URL 不处理
    if (inputType === "invalid_url") return;

    if (inputType === "valid_url") {
      // URL 搜索路径
      const cleanUrl = cleanZhihuUrl(trimmedInput);

      setLoading(true);
      // 搜索是否已存在
      const data = await fetchArticles(1, cleanUrl, true);
      setLoading(false);

      if (data.total > 0) {
        // 已存在，展示搜索结果
        setSearchQuery(cleanUrl);
        setInput("");
        updateUrl(1, cleanUrl);
        return;
      }

      // 不存在，开始爬取（不设置 loading，不显示搜索提示）
      setCrawlingUrl(cleanUrl);
      setSearchQuery(""); // 清除搜索提示

      const taskResult = await apiPost<TaskResponse>("/api/tasks", { url: cleanUrl });
      if (!taskResult.success) {
        setCrawlingUrl(null);
        return;
      }

      const task = taskResult.data;

      // 如果返回了已存在的文章（后端二次检查）
      if (task.existing && task.article) {
        setArticles([task.article]);
        setTotal(1);
        setTotalPages(1);
        setSearchQuery(cleanUrl);
        setInput("");
        setCrawlingUrl(null);
        return;
      }

      setInput("");
      setTasks((prev) => [{ id: task.id, url: cleanUrl, status: "RUNNING", error: null }, ...prev]);

      // 开始爬取
      const crawlResult = await apiPost<CrawlResponse>("/api/crawl", { taskId: task.id }, false);

      if (crawlResult.success) {
        // 爬取成功
        toast.success("文章爬取成功");
        await fetchArticles(1, cleanUrl, true);
        setSearchQuery(cleanUrl);
        updateUrl(1, cleanUrl);
        fetchStats();
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: "FAILED", error: crawlResult.error } : t
          )
        );
      }
      setCrawlingUrl(null);
    } else {
      // 关键词搜索路径
      setLoading(true);
      setSearchQuery(trimmedInput);
      await fetchArticles(1, trimmedInput);
      updateUrl(1, trimmedInput);
      setLoading(false);
    }
  };

  // 重试任务
  const retryTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setCrawlingUrl(task.url);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "RUNNING", error: null } : t))
    );

    const result = await apiPost<CrawlResponse>("/api/crawl", { taskId }, false);

    if (result.success) {
      toast.success("文章爬取成功");
      setSearchQuery(task.url);
      await fetchArticles(1, task.url, true);
      updateUrl(1, task.url);
      fetchStats();
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "FAILED", error: result.error } : t
        )
      );
    }
    setCrawlingUrl(null);
  };

  // 删除任务
  const deleteTask = async (taskId: string) => {
    const result = await apiDelete(`/api/tasks/${taskId}`, undefined, false);
    if (result.success) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  // 清除搜索
  const clearSearch = async () => {
    setInput("");
    setSearchQuery("");
    setLoading(true);
    await fetchArticles(1, "");
    updateUrl(1, "");
    setLoading(false);
  };

  // 翻页
  const handlePageChange = async (newPage: number) => {
    setLoading(true);
    await fetchArticles(newPage, searchQuery, searchQuery.includes("zhihu.com"));
    updateUrl(newPage, searchQuery);
    setLoading(false);
  };

  // 输入提示
  const renderInputHint = () => {
    if (!input.trim()) return null;

    if (inputType === "invalid_url") {
      return (
        <p className="text-xs text-amber-600 mt-2 flex gap-1 break-all">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>
            暂不支持此 URL 格式，支持付费专栏和问答链接。
            <Link to="/about" className="text-blue-500 hover:underline ml-1">
              如何获取链接？
            </Link>
          </span>
        </p>
      );
    }

    if (inputType === "valid_url") {
      return (
        <p className="text-xs text-blue-600 mt-2">
          检测到知乎 URL，点击搜索查找或爬取
        </p>
      );
    }

    return null;
  };

  // 爬取进度卡片
  const renderCrawlingCard = () => {
    const runningTasks = tasks.filter((t) => t.status === "RUNNING");
    const failedTasks = tasks.filter((t) => t.status === "FAILED");

    if (runningTasks.length === 0 && failedTasks.length === 0) return null;

    return (
      <div className="mb-6 space-y-3">
        {/* 正在爬取 */}
        {runningTasks.map((task) => (
          <Card
            key={task.id}
            className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 dark:border-blue-800 overflow-hidden"
          >
            <CardContent className="p-0">
              {/* 进度条动画 */}
              <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]" />
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                      <Loader2 className="h-3 w-3 text-white animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">正在爬取文章...</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5">{task.url}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                    onClick={() => deleteTask(task.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* 失败的任务 */}
        {failedTasks.map((task) => (
          <Card
            key={task.id}
            className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 dark:border-red-800"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">爬取失败</p>
                  <p className="text-xs text-red-600 dark:text-red-400 truncate mt-0.5">{task.url}</p>
                  {task.error && (
                    <p className="text-xs text-red-500 mt-1">{task.error}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900"
                    onClick={() => retryTask(task.id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    重试
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900"
                    onClick={() => deleteTask(task.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <main className="container mx-auto max-w-6xl px-4 py-6">
      {/* 添加 shimmer 动画样式 */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 公告横幅 */}
      {announcements.length > 0 && (
        <div className="mb-6 space-y-3">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="relative overflow-hidden rounded-lg border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Megaphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {announcement.title}
                  </p>
                  <p className="text-sm text-blue-700/80 dark:text-blue-300/80 mt-1 leading-relaxed whitespace-pre-wrap break-all">
                    {announcement.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 统计摘要 */}
      {stats && !searchQuery && !crawlingUrl && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">文章总数</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.totalArticles}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">本周新增</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.weekArticles}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 搜索框 */}
      <Card className="mb-6 shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <Input
                className="pl-10 h-11"
                placeholder="输入知乎 URL 或关键词搜索..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    handleSubmit();
                  }
                }}
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading || hasRunningTask || !input.trim() || inputType === "invalid_url"}
              className={cn(
                "h-11 px-6",
                inputType === "valid_url" && "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "搜索"}
            </Button>
          </div>
          {renderInputHint()}
        </CardContent>
      </Card>

      {/* 爬取进度卡片 */}
      {renderCrawlingCard()}

      {/* 搜索结果提示（爬取时不显示） */}
      {searchQuery && !crawlingUrl && !hasRunningTask && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            搜索 &quot;{searchQuery}&quot; 找到 {total} 篇文章
          </p>
          <Button variant="ghost" size="sm" onClick={clearSearch}>
            清除搜索
          </Button>
        </div>
      )}

      {/* 列表标题 */}
      {!searchQuery && !crawlingUrl && !hasRunningTask && articles.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">最近采集</h2>
        </div>
      )}

      {/* 文章列表 */}
      {initialLoading || loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : hasRunningTask ? (
        // 爬取中时显示占位提示
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <Download className="h-10 w-10 text-blue-500" />
          </div>
          <p className="text-lg font-medium mb-2 text-blue-900 dark:text-blue-100">正在爬取内容</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            请稍候，爬取完成后将自动展示文章
          </p>
        </div>
      ) : articles.length > 0 ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((article) => (
              <Link key={article.id} to="/tasks/$id" params={{ id: article.id }}>
                <Card className="h-full group cursor-pointer overflow-hidden border-transparent bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 mb-4 group-hover:w-20 transition-all duration-300" />

                    <h3 className="font-semibold line-clamp-2 mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-relaxed">
                      {article.title || "无标题"}
                    </h3>

                    <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-3 flex-1 mb-4 leading-relaxed">
                      {article.content_preview?.slice(0, 120)}...
                    </p>

                    <div className="flex items-center gap-3 pt-3 border-t border-[hsl(var(--border))]/50">
                      {article.author && (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                            <span className="text-xs text-white font-medium">
                              {article.author.charAt(0)}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-[hsl(var(--foreground))]/80">
                            {article.author}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">
                        {formatDate(article.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-8">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => handlePageChange(page - 1)}
                className="rounded-full px-4"
              >
                上一页
              </Button>
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={cn(
                        "h-8 w-8 rounded-full text-sm font-medium transition-all cursor-pointer",
                        page === pageNum
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                          : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="rounded-full px-4"
              >
                下一页
              </Button>
            </div>
          )}

          <p className="text-center text-sm text-[hsl(var(--muted-foreground))] pt-4">
            共 {total} 篇文章
          </p>
        </div>
      ) : searchQuery ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center">
            <FileText className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-lg font-medium mb-2">
            {searchQuery ? "未找到匹配的文章" : ""}
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
            {searchQuery ? "尝试其他关键词，建议直接使用文章链接进行采集" : ""}
          </p>
        </div>
      ): null}
    </main>
  );
}
