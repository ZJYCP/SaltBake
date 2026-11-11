# 拾盐记

知乎付费专栏与问答内容的采集、存储和阅读系统。

自动绕过知乎的自定义字体反爬机制，把付费内容抓取下来本地化存储，支持全文搜索、Markdown 导出和响应式阅读界面（含深色模式）。

> **⚠️ 先说清楚：本工具不是「免登录白嫖神器」。**
>
> 它不会替你登录，也不会变出会员账号。你需要自己准备一个**已开通付费会员的知乎账号 Cookie** 填进系统设置——就像你得先有冰箱，才能把菜放进去。本工具做的是「把你自己有权访问的内容搬到自家硬盘上」，仅此而已。没有会员 Cookie，它只能干瞪眼。

> **🎁 想先体验效果？**
>
> 作者维护了一个公开实例：[zhihu.artimind.top](https://zhihu.artimind.top)。**仅供体验，请勿滥用**——想长期使用或对隐私敏感，建议按下方说明自己部署一个。


## 功能特性

- 支持知乎**付费专栏**、**问答**、**oia 分享链接**和**soia 盐言故事分享链接**的内容采集
- 自动处理知乎字体反爬（解析 WOFF2 字体 → 渲染字形 → OCR 识别真实字符）
- 内容本地化存储，支持按关键词或 URL 精确搜索
- 响应式 Web 界面，支持深色模式
- 文章批量导出为 Markdown
- 管理后台：文章管理、用户反馈、运行时配置（Cookie / access_token / API Key 等在线修改，免重启）
- 知乎 Cookie 可用性定时检查与 24h 状态时间线

## 技术栈

- **框架**: TanStack Start (Vite + Nitro) + React 19
- **样式**: Tailwind CSS 4
- **数据库**: PostgreSQL + Prisma ORM
- **爬虫**: cheerio（HTML 解析）+ opentype.js（字体解析）+ sharp（图像处理）
- **OCR**: SiliconFlow API（DeepSeek-OCR）

## 前置要求

- **Node.js** ≥ 22.12.0（本地开发）
- **PostgreSQL** 数据库（本地或远程，用于存储采集内容和配置）
- **SiliconFlow API Key**（用于 OCR 识别，在 [siliconflow.cn](https://siliconflow.cn) 注册）
- 一个有效的**知乎登录 Cookie**（用于访问付费内容）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填写启动配置：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/zhihu"
ADMIN_PASSWORD="your_admin_password"
APP_SECRET="replace_with_a_long_random_secret"
PORT=3000
```

> 知乎 Cookie、SiliconFlow API Key、User-Agent、请求间隔、限流参数和 Cookie 检查 URL 不在 `.env` 里，而是在「管理后台 → 系统设置」中在线配置，保存后下一次请求立即生效，无需重启服务。

### 3. 初始化数据库

```bash
npm run db:migrate:dev
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 即可使用。首次使用请先到 `/admin` 用 `ADMIN_PASSWORD` 登录，在「系统设置」里填入知乎 Cookie 和 SiliconFlow API Key。

## 部署

项目以 Docker 部署为主，提供 `Dockerfile` 和 `docker-compose.yml`。Compose 只启动 Web 服务，不包含 PostgreSQL——请先准备一个外部 PostgreSQL，把连接串填入 `.env` 的 `DATABASE_URL`。

如果 PostgreSQL 跑在宿主机上，`DATABASE_URL` 里的主机名需要用容器可访问的地址；macOS / Windows 的 Docker Desktop 通常可以用 `host.docker.internal`。

```bash
cp .env.example .env
# 编辑 .env，填写 DATABASE_URL、ADMIN_PASSWORD、APP_SECRET、PORT

docker compose build
docker compose up -d
```


## 工作原理：字体反爬

知乎付费内容使用自定义 WOFF2 字体对文字进行混淆——字形与字符的映射表是随机生成、每次请求都不同的，直接抓 HTML 拿到的是乱码。本项目的处理流程：

1. 用 cheerio 加载页面 HTML，提取内联的 `@font-face` base64 字体
2. 用 opentype.js 解析字体文件，遍历每个字形
3. 用 sharp 把字形路径渲染成 PNG 图像，拼成网格图
4. 调用 SiliconFlow DeepSeek-OCR 识别网格图中的真实字符，建立「编码 → 字符」映射
5. 用映射表把正文从混淆编码还原为可读文本

这套流程在 `src/lib/crawler/` 下实现（`font-decoder.ts` 是核心）。

## 支持的链接格式

- **问答链接**: `https://www.zhihu.com/question/xxx/answer/xxx`
- **付费专栏**: `https://www.zhihu.com/market/paid_column/xxx/section/xxx`
- **知乎分享**: `https://oia.zhihu.com/km_paid_content/share?km_pst=...&share_code=...`
- **盐言故事分享**: `https://soia.zhihu.com/km_paid_content/share?...&mst=...`

**注意：** `oia`是普通回答等通过知乎“复制链接”按钮复制的URL，`soia`是盐言故事/小说等通过知乎“复制链接”按钮复制的URL。这两种链接形式需要配置知乎`access_token`才能正常抓取，具体参见下面说明。

**本人亲测大量盐言故事的小说内容无法轻易获取到`paid_column`链接，因此我觉得提供`oia`和`soia`的支持是很有必要的。**

### oia / soia 分享链接必读

1. 在 `/admin` →「系统设置」中填写并保存「知乎 access_token」。此项和 Cookie 一样保存在 PostgreSQL 的 `SystemConfig` 表中，作为敏感配置处理；过期后在同一位置更新即可，无需重启服务。
2. 在首页现有的链接输入框粘贴完整分享链接，点击「搜索」。服务端先还原为普通文章地址，再查重或创建抓取任务。
3. 保存的任务地址、文章原文链接和后续搜索均使用还原后的地址。不同分享链接指向同一篇已完成文章时，会返回已有文章。

`access_token` 可从自己账号的知乎网页登录响应中获取：新开一个无痕浏览器，打开知乎官网，登录前打开浏览器开发者工具的「网络」面板、勾选「保留日志」，完成登录后检查 `scan_info` 或 `sign_in` 等实际登录请求的 JSON 响应，复制 `access_token` 的值（不是 Cookie 或 `refresh_token`）。也支持带 `Bearer ` 前缀的值。

普通问答和付费专栏链接不要求配置 `access_token`。该令牌仅用于分享链接还原，不替代正文抓取所需的有效 Cookie 和内容访问权限。分享链接失效时，请在 App 中重新分享并复制完整参数。

> **原理：** 还原协议参考 [zhihu_tools issue #16](https://github.com/onewhitethreee/zhihu_tools/issues/16)；签名逻辑实现改编自 [zhihulite/zhihu_zse96](https://github.com/zhihulite/zhihu_zse96)，相关源码及 MIT 许可证位于 `src/lib/server/zhihu-share/`。接口和登录机制可能随知乎更新而变化。

## 如何获取链接

### 手机端（知乎 App）

**方法一：通过浏览器获取**
1. 在知乎 App 中打开文章，点击右上角「分享」按钮
2. 选择「更多」，然后选择一个浏览器打开
3. 在浏览器地址栏中复制完整链接

**方法二：通过微信获取**
1. 在知乎 App 中打开文章，点击右上角「分享」按钮
2. 选择「微信好友」
3. 在微信中打开分享的链接
4. 点击微信浏览器右上角「...」，选择「复制链接」

> 如果用知乎APP「复制链接」得到 oia/soia 地址，也可按上面的步骤配置`access_token`后直接提交。

### 电脑端

直接在浏览器地址栏复制当前页面的链接即可。

## 常用命令

```bash
npm run dev                 # 启动开发服务器
npm run build               # 构建生产版本
npm run start               # 启动生产服务器（需先 build）
npm run start:prod          # 应用生产迁移并启动服务
npm run db:migrate:dev      # 开发环境生成并应用 Prisma migration
npm run db:migrate:deploy   # 生产环境应用已提交的 Prisma migration
npm run db:migrate:baseline # 把已有生产库标记为基线（仅首次）
npm run db:push             # 原型期快速同步 Schema（不建议用于生产）
npm run db:studio           # 打开 Prisma Studio
npm run lint                # 代码检查
```

## 项目结构

```
src/
├── router.tsx              # 路由工厂
├── routes/                 # TanStack Start 文件路由
│   ├── __root.tsx          # 根布局
│   ├── page.tsx            # 首页（内容库）
│   ├── about/              # 关于页
│   ├── admin/              # 管理后台（文章 / 反馈 / 设置）
│   ├── stats/              # 统计页
│   ├── tasks/$id/          # 文章详情页
│   └── api/                # API 路由（crawl / tasks / articles / stats / admin / cron）
├── components/             # React 组件（Navbar / ThemeProvider / UI 基础组件）
└── lib/
    ├── crawler/            # 爬虫核心（crawler / font-decoder / ocr / config）
    ├── server/             # 服务端库（prisma / admin-auth / api-response / rate-limiter 等）
    ├── client/             # 客户端库（api-client）
    └── shared/             # 共享类型与工具
```

环境变量见 [`.env.example`](.env.example)；数据库模型见 [`prisma/schema.prisma`](prisma/schema.prisma)。

## 免责声明

- 本工具仅供个人学习和研究使用，请勿用于任何商业用途
- 用户在使用本工具时应遵守相关法律法规，尊重原创作者的知识产权
- 所采集内容版权归原作者所有
- 本工具不对用户的任何行为承担责任，因使用本工具产生的任何法律纠纷由用户自行承担
- 如有侵权，请联系删除

## License

MIT
