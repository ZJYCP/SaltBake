import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  Smartphone,
  Monitor,
  Globe,
  Copy,
  ChevronRight,
  Activity,
  Sparkles,
} from "lucide-react"
import type { PublicCookieStatus } from "@/lib/server/service-status"
import { getServiceStatusForAbout } from "./-service-status.functions"

export const Route = createFileRoute("/about/")({
  head: () => ({
    meta: [
      { title: "关于 | 拾盐记" },
      { name: "description", content: "了解拾盐记的服务状态、使用方式和免责声明" },
    ],
  }),
  loader: () => getServiceStatusForAbout(),
  component: AboutPage,
})

function AboutPage() {
  const cookieStatus = Route.useLoaderData()

  return (
    <main className="container mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold mb-8">关于</h1>

      <div className="space-y-6">
        {/* 服务状态 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4" />
              服务状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceStatusSummary status={cookieStatus} />
          </CardContent>
        </Card>

        {/* 如何获取链接 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">如何获取文章链接</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 支持的链接格式 */}
            <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
              <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                支持的链接格式
              </p>
              <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-400 break-all">
                <li className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3" />
                  <span>问答链接：zhihu.com/question/xxx/answer/xxx</span>
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3" />
                  <span>
                    付费专栏：zhihu.com/market/paid_column/xxx/section/xxx
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3" />
                  <span>知乎分享：oia.zhihu.com/km_paid_content/share?…</span>
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3" />
                  <span>盐言故事分享：soia.zhihu.com/km_paid_content/share?…</span>
                </li>
              </ul>
              <p className="mt-3 text-sm text-blue-600 dark:text-blue-400">
                oia/soia 分享链接需先在管理后台的“系统设置”中保存知乎 access_token，随后在首页直接提交即可自动还原并抓取。文章原文地址保存为还原后的 paid_column 或问答链接。
              </p>
            </div>
            {/* 手机端 */}
            <div>
              <h3 className="font-medium flex items-center gap-2 mb-3">
                <Smartphone className="h-4 w-4" />
                手机端（知乎 App）
              </h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
                复制得到 oia/soia 分享链接时，可配置 access_token 后直接提交首页。
                如需获取普通文章链接，也可以尝试以下两种方式。
              </p>
              <div className="space-y-4 text-sm text-[hsl(var(--muted-foreground))]">
                {/* 方法一 */}
                <div className="p-4 rounded-lg bg-[hsl(var(--muted))]/50">
                  <p className="font-medium text-[hsl(var(--foreground))] mb-2">
                    方法一：通过浏览器获取
                  </p>
                  <ol className="space-y-2 list-decimal list-inside">
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">1.</span>
                      <span>在知乎 App 中打开文章，点击右上角「分享」按钮</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">2.</span>
                      <span>
                        在微信、QQ
                        等一排中选择最右侧的「更多」，然后选择一个浏览器打开
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">3.</span>
                      <span>
                        <b>稍等片刻</b>，在浏览器地址栏中复制完整链接即可
                      </span>
                    </li>
                  </ol>
                  {/* 图片占位 */}
                  <div className="mt-3 p-8 border-2 border-dashed border-[hsl(var(--border))] rounded-lg text-center text-[hsl(var(--muted-foreground))]">
                    <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">
                      示意图，暂时没有，聪明的你一定知道在哪里
                    </p>
                  </div>
                </div>

                {/* 方法二 */}
                <div className="p-4 rounded-lg bg-[hsl(var(--muted))]/50">
                  <p className="font-medium text-[hsl(var(--foreground))] mb-2">
                    <s>方法二：通过微信获取</s> 可能存在获取文章不完整的情况，推荐用方法一
                  </p>
                  <ol className="space-y-2 list-decimal list-inside">
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">1.</span>
                      <span>在知乎 App 中打开文章，点击右上角「分享」图标</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">2.</span>
                      <span>选择「微信好友」</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">3.</span>
                      <span>在微信中打开分享的链接</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">4.</span>
                      <span>点击微信浏览器右上角「...」，选择「复制链接」</span>
                    </li>
                  </ol>
                  {/* 微信截图 */}
                  <div className="mt-3 flex justify-center">
                    <img
                      src="/images/wechat.png"
                      alt="微信浏览器复制链接示意图"
                      width={280}
                      height={500}
                      className="rounded-lg border border-[hsl(var(--border))] shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 电脑端 */}
            <div>
              <h3 className="font-medium flex items-center gap-2 mb-3">
                <Monitor className="h-4 w-4" />
                电脑端
              </h3>
              <div className="p-4 rounded-lg bg-[hsl(var(--muted))]/50 text-sm text-[hsl(var(--muted-foreground))]">
                <p>直接在浏览器地址栏复制当前页面的链接即可。</p>
                <div className="mt-3 flex items-center gap-2 p-2 rounded bg-[hsl(var(--background))] font-mono text-xs">
                  <Copy className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    https://www.zhihu.com/question/xxx/answer/xxx
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 流星 API 赞助 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                流星 API · AI 模型中转站
              </CardTitle>
              <span className="rounded px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]">
                赞助
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-[hsl(var(--muted-foreground))]">
              <p>
                一个聚合 OpenAI、Claude、Gemini
                等主流大模型的 API 中转平台，统一接口格式，一个 Key
                即可调用多家模型，按量计费，比官方更灵活省心。
              </p>
              <a
                href="https://hub.meteorlab.top"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-medium text-[hsl(var(--background))] transition-opacity hover:opacity-90"
              >
                前往流星 API
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* 关于 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">关于拾盐记</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
              <p>拾盐记 v1.0</p>
              <p>基于 TanStack Start + Prisma + PostgreSQL 构建</p>
            </div>
          </CardContent>
        </Card>

        {/* 免责声明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              免责声明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-[hsl(var(--muted-foreground))]">
              <p>本工具仅供个人学习和研究使用，请勿用于任何商业用途。</p>
              <p>
                用户在使用本工具时应遵守相关法律法规，尊重原创作者的知识产权。所采集的内容版权归原作者所有。
              </p>
              <p>
                本工具不对用户的任何行为承担责任，因使用本工具产生的任何法律纠纷由用户自行承担。
              </p>
              <p>如有侵权，请联系删除。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function ServiceStatusSummary({ status }: { status: PublicCookieStatus }) {
  const latest = status.latest
  const checkedAt = latest
    ? new Date(latest.checkedAt).toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "暂无检查记录"

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {latest && (
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              latest.success
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}
          >
            {latest.success ? "正常" : "异常"}
          </span>
        )}
        <span className="text-[hsl(var(--muted-foreground))]">
          最近检查：{checkedAt}
        </span>
        {latest?.message && (
          <span className="text-[hsl(var(--muted-foreground))]">
            {latest.message}
          </span>
        )}
      </div>

      {status.logs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            最近 24 小时状态
          </p>
          <div className="flex flex-wrap gap-1">
            {status.logs
              .slice()
              .reverse()
              .map((log, index) => (
                <div
                  key={`${log.checkedAt}-${index}`}
                  className={`h-8 w-3 rounded-sm ${
                    log.success ? "bg-green-500" : "bg-red-500"
                  }`}
                  title={`${new Date(log.checkedAt).toLocaleString("zh-CN")} - ${
                    log.success ? "正常" : "异常"
                  }`}
                />
              ))}
          </div>
        </div>
      ) : (
        <p className="text-[hsl(var(--muted-foreground))]">
          暂无检查记录。
        </p>
      )}
    </div>
  )
}
