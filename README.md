# LAVA AI — 智能音乐创作平台

> 一体化 AI 音乐平台，集学习、即兴演奏、创作、工具与项目管理于一身。

---

## 目录

- [项目简介](#项目简介)
- [功能空间](#功能空间)
- [技术栈](#技术栈)
- [架构设计](#架构设计)
- [目录结构](#目录结构)
- [AI 智能代理](#ai-智能代理)
- [后台任务系统](#后台任务系统)
- [YouTube 集成](#youtube-集成)
- [数据流](#数据流)
- [主题与设计系统](#主题与设计系统)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [可用脚本](#可用脚本)
- [路由说明](#路由说明)
- [开发规范](#开发规范)

---

## 项目简介

LAVA AI 是一个以 AI 为核心驱动力的音乐平台，旨在为音乐爱好者提供从学习到创作的全链路支持。用户可以通过自然语言与内置 AI 代理对话，让 AI 帮助导航界面、搜索并分析 YouTube 视频转谱、生成伴奏、辅助作曲。

平台采用 **pnpm 工作区 Monorepo** 架构，前后端共享同一套 TypeScript 类型系统，保证类型安全贯穿全栈。

---

## 功能空间

| 空间 | 路由 | 功能描述 |
|---|---|---|
| **Home（首页）** | `/` | 快速入口卡片（搜索 / 录音 / 创作 / 浏览） |
| **Learn（学习）** | `/learn` | 推荐曲目、每日练习、乐曲分析 |
| **Songs（曲谱编辑器）** | `/learn/songs` | DAW + 和弦网格 + 乐谱浏览器；支持 YouTube 分析结果导入 |
| **Jam（即兴）** | `/jam` | 多轨 DAW + AI 伴奏，带节拍器与调式选择 |
| **Play Hub（伴奏库）** | `/jam/play` | 内置伴奏曲目浏览与播放 |
| **Create（创作）** | `/create` | DAW 多轨编曲 + AI 作曲辅助 |
| **Lead Sheet（曲谱编辑器）** | `/editor/lead-sheet` | 完整和弦谱编辑与 PDF 导出 |
| **Search（搜索）** | `/search` | YouTube 实时搜索，一键触发 AI 转谱后台任务 |
| **Files（文件库）** | `/files` | Chord charts、backing tracks、effects presets 统一管理 |
| **Backing Tracks（伴奏曲库）** | `/backing-tracks` | 预录伴奏浏览与播放 |
| **Tools（工具）** | `/tools` | 独立 AI 实验性工具集 |
| **My Projects（项目）** | `/projects` | 已保存项目管理中心（分类筛选 + 删除） |
| **Pricing（定价）** | `/pricing` | 订阅套餐展示 |
| **Settings（设置）** | `/settings` | 账号、订阅、偏好设置 |

---

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|---|---|---|
| React | 18 | UI 框架 |
| Vite | 5 | 构建工具与开发服务器 |
| Tailwind CSS | 3 | 原子化样式 |
| Zustand | 4 | 轻量状态管理 |
| React Router | 6 | 客户端路由 |
| class-variance-authority | 0.7 | 组件变体管理 |
| lucide-react | — | 图标库 |
| tone.js | 15 | Web Audio 合成引擎 |
| wavesurfer.js | 7 | 波形可视化 |

### 后端

| 技术 | 版本 | 用途 |
|---|---|---|
| Fastify | 4 | 高性能 HTTP 服务器 |
| @fastify/cors | 9 | CORS 中间件 |
| @fastify/multipart | 8 | 文件上传 |
| @fastify/rate-limit | 9 | 接口限流 |
| better-sqlite3 | 11 | 零依赖 SQLite 驱动 |
| Drizzle ORM | 0.33 | 类型安全的 SQL 查询构建 |
| Zod | 3 | 运行时环境变量与请求体校验 |
| pino | 9 | 结构化日志 |
| tsx | — | TypeScript 直接执行（开发环境） |

### AI / LLM

| 技术 | 用途 |
|---|---|
| Anthropic SDK | Claude 模型调用（默认：`claude-opus-4-6`） |
| OpenAI SDK | GPT 模型调用（可选，支持官方 OpenAI 或腾讯 VOD OpenAI-compatible 网关） |
| SSE（Server-Sent Events） | 流式输出，将 LLM 文本增量推送至客户端 |

### 外部依赖

| 工具 | 用途 |
|---|---|
| yt-dlp | YouTube 搜索与音频下载（需系统安装） |
| ChordMiniApp | 和弦与节拍分析服务 |

### 共享包

`@lava/shared` 包含前后端通用的 TypeScript 类型、常量和 Zod 校验 Schema，确保类型一致性。

---

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器（Client）                       │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Sidebar  │  │   Space页面   │  │     AgentPanel        │ │
│  │ (导航)   │  │ Learn/Jam/   │  │  (AI对话抽屉)          │ │
│  │          │  │ Create/Tools │  │  ChatMessage           │ │
│  └──────────┘  │ /Projects   │  │  ChatInput             │ │
│                └──────────────┘  └───────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Zustand Stores                          │  │
│  │  agentStore │ taskStore  │ audioStore │ projectStore  │  │
│  │  uiStore    │ dawPanelStore │ jamStore │ authStore    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Web Audio Engine（独立于 React）              │  │
│  │  AudioEngine │ LoopEngine │ Metronome │ Scheduler     │  │
│  │  tone.js (合成) │ wavesurfer.js (波形可视化)           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP / SSE
                      │ /api/*
┌─────────────────────▼───────────────────────────────────────┐
│                     Fastify 服务器（Server）                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Routes 路由层                      │   │
│  │  /agent/chat │ /projects │ /audio │ /transcription   │   │
│  │  /youtube    │ /jam      │ /pdf   │ /tools           │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │              AI Agent 系统                            │   │
│  │                                                      │   │
│  │  AgentOrchestrator                                   │   │
│  │      ↓                                               │   │
│  │  ConversationManager ──→ ProviderFactory             │   │
│  │                              ↓                       │   │
│  │                    ClaudeProvider / OpenAIProvider   │   │
│  │      ↓                                               │   │
│  │  ToolRegistry ──→ ToolExecutor ──→ 13 个工具处理器   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SQLite + Drizzle ORM                    │   │
│  │  projects │ project_versions │ audio_files           │   │
│  │  transcriptions                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 关键架构决策

| 决策 | 原因 |
|---|---|
| **Fastify 而非 Express** | 原生 TypeScript 支持，内置 Schema 校验，插件架构，性能更高 |
| **SQLite + Drizzle** | 零基础设施，适合 Demo；类型安全查询；后续可无缝迁移至 PostgreSQL |
| **SSE 流式传输** | 比 WebSocket 更简单，无需升级协议，天然支持代理穿透，满足文本流需求 |
| **后台任务轮询** | YouTube 分析耗时较长，任务与 UI 解耦，用户可在任意页面查看进度 |
| **Zustand 切片式状态** | 极少样板代码，无需 Provider 包裹，TypeScript 推断出色 |
| **Web Audio 引擎独立于 React** | Web Audio 以 44.1kHz 运行；若接入 React 状态更新会严重卡顿 |
| **LLM 提供商事件级抽象** | Claude 与 OpenAI 均归一化为相同的 `ProviderEvent` 流，Orchestrator 与提供商无关 |
| **pnpm 工作区（不使用 Turborepo）** | 3 个包的 Monorepo 无需额外构建编排，pnpm 已足够简洁高效 |

---

## 目录结构

```
LavaAI-demo/
├── package.json                    # 根工作区脚本
├── pnpm-workspace.yaml             # 工作区声明
├── tsconfig.base.json              # 共享 TS 基础配置
├── .env.example                    # 环境变量模板
│
├── packages/shared/                # @lava/shared — 全栈共享
│   └── src/
│       ├── types/                  # AgentMessage、Score、Track、Project 等类型
│       ├── constants/              # 音频参数、调式、空间路由常量
│       └── validators/             # Zod Schema（ChatRequest、CreateProject 等）
│
├── client/                         # React SPA（Vite）
│   └── src/
│       ├── components/
│       │   ├── ui/                 # 基础组件：Button、Card、Input、Slider、Toggle、Tabs、
│       │   │                       # Dialog、Avatar、Badge、Toast、SaveButton、
│       │   │                       # TaskCard、TaskNotifications
│       │   ├── agent/              # AgentPanel、ChatMessage、ChatInput、SpaceAgentInput
│       │   ├── layout/             # AppShell、Sidebar、TopBar、BottomNav、MobileHeader
│       │   ├── daw/                # DawPanel、TrackLaneView、TrackControls、ClipView、
│       │   │                       # LiveWaveformCanvas、PanKnob
│       │   ├── score/              # ChordGrid、MetadataBar、PdfViewer
│       │   ├── library/            # LibraryModal、LibraryContent
│       │   ├── auth/               # AuthPromptModal
│       │   ├── onboarding/         # OnboardingModal、GuestWelcomeModal
│       │   ├── marketing/          # PricingCards
│       │   └── settings/           # AccountSection、SubscriptionSection、PreferencesSection
│       ├── spaces/                 # 功能页面
│       │   ├── home/               # HomePage
│       │   ├── learn/              # LearnPage、SongsPage
│       │   ├── jam/                # JamPage、PlayHubPage
│       │   ├── create/             # CreatePage
│       │   ├── editor/             # LeadSheetPage
│       │   ├── search/             # SearchResultsPage
│       │   ├── library/            # LibraryPage（Files）
│       │   ├── backing-tracks/     # BackingTracksPage
│       │   ├── chord-charts/       # Legacy ChordChartsPage（redirected to Files）
│       │   ├── tools/              # ToolsPage
│       │   ├── my-projects/        # MyProjectsPage
│       │   ├── pricing/            # PricingPage
│       │   ├── settings/           # SettingsPage
│       │   └── auth/               # LoginPage、SignupPage
│       ├── stores/                 # Zustand 状态切片
│       │   ├── agentStore.ts       # AI 对话状态
│       │   ├── taskStore.ts        # 后台任务追踪
│       │   ├── audioStore.ts       # 音频引擎状态
│       │   ├── projectStore.ts     # 项目 CRUD
│       │   ├── uiStore.ts          # 全局 UI 状态
│       │   ├── dawPanelStore.ts    # DAW 轨道/片段
│       │   ├── jamStore.ts         # 即兴会话状态
│       │   ├── leadSheetStore.ts   # 曲谱编辑状态
│       │   └── authStore.ts        # 认证状态
│       ├── hooks/                  # useAgent、useTaskPoller、useKeyboardShortcuts、
│       │                           # useTheme、useIsMobile、useAutoSave、useMutation、
│       │                           # useQuery、useRequireAuth、useCrossTabSync
│       ├── services/               # API 客户端（agentService、projectService、youtubeService 等）
│       └── audio/                  # Web Audio 引擎
│           ├── AudioEngine.ts      # 核心：AudioContext、主总线、分析节点
│           ├── LoopEngine.ts       # 样本精确循环播放
│           ├── Metronome.ts        # 节拍器
│           └── Scheduler.ts        # Web Audio 时钟调度
│
└── server/                         # Fastify API 服务
    └── src/
        ├── agent/                  # AI 代理系统
        │   ├── AgentOrchestrator.ts     # 代理主循环
        │   ├── ConversationManager.ts   # 对话历史管理
        │   ├── providers/               # Claude / OpenAI 提供商适配
        │   ├── tools/                   # 工具注册表 + 执行器 + 13 个工具定义
        │   └── prompts/                 # 系统提示词 + 动态上下文注入
        ├── routes/                 # HTTP 路由
        │   ├── agent.routes.ts     # POST /chat（SSE 流式）
        │   ├── project.routes.ts   # CRUD /projects
        │   ├── youtube.routes.ts   # GET /search、POST /start-analysis、GET /poll-analysis
        │   ├── audio.routes.ts     # 音频文件上传与处理
        │   ├── transcription.routes.ts # 转谱状态查询
        │   ├── jam.routes.ts       # 即兴会话
        │   ├── pdf.routes.ts       # PDF 导出
        │   └── tools.routes.ts     # 杂项工具
        ├── db/                     # SQLite Schema + Drizzle 客户端
        ├── config/                 # Zod 环境变量解析
        └── utils/                  # logger、errors
```

---

## AI 智能代理

### 工具列表

代理内置 13 个工具，覆盖平台全部核心操作：

| 工具名 | 功能 |
|---|---|
| `navigate_to_space` | 导航至指定空间（Learn / Jam / Create / Tools / Projects） |
| `create_project` | 在指定空间创建新项目 |
| `list_projects` | 列出用户已保存的项目 |
| `load_project` | 按 ID 加载已有项目 |
| `start_jam` | 初始化即兴会话（设置节拍、调式） |
| `set_tempo` | 设置当前会话的 BPM |
| `set_key` | 设置当前会话的调式 |
| `start_transcription` | 触发 YouTube 视频的 AI 分析（和弦 + 节拍） |
| `get_transcription_status` | 查询转谱任务进度 |
| `add_track` | 在 Create 空间新增轨道 |
| `ai_compose` | 通过 AI 生成音乐创意或旋律片段 |
| `upload_audio` | 引用已上传的音频文件 |
| `process_audio` | 对音频文件应用处理/效果器 |

### 代理工作流

```
用户输入消息
     ↓
agentStore.sendMessage()
     ↓
agentService.streamChat() — 建立 SSE 连接
     ↓
[服务端] AgentOrchestrator.run()
     ↓
ConversationManager.normalize() — 整理对话历史
     ↓
Provider.stream(messages, tools, systemPrompt)
     ↓
LLM 返回：文本增量 → SSE text_delta 事件 → 客户端实时显示
         工具调用 → ToolExecutor.execute() → 工具结果
              ↓
         若 navigate_to_space：客户端 useAgent hook 触发 router.navigate()
     ↓
SSE [DONE] → finalizeStream() → 消息入库
```

---

## 后台任务系统

长耗时操作（YouTube 下载与音频分析）通过独立的后台任务系统跟踪，不阻塞用户交互。

### 任务生命周期

```
SearchResultsPage / AI 代理发起分析
     ↓
POST /api/youtube/start-analysis/:videoId
     ↓
返回 transcriptionId → taskStore.addTask()
     ↓
useTaskPoller（挂载于 AppShell，每 2 秒轮询）
     ↓
GET /api/youtube/poll-analysis/:transcriptionId
     ↓
taskStore.updateTask() → TaskNotifications 实时更新进度
     ↓
任务完成 → "查看结果" 按钮 → 导航至 SongsPage（?generate=1）
```

### 任务阶段与进度

| 阶段 | 进度 | 说明 |
|---|---|---|
| `downloading` | 10% | 正在下载 YouTube 音频 |
| `analyzing_chords` | 35% | AI 分析和弦 |
| `analyzing_beats` | 65% | AI 分析节拍 |
| `processing` | 85% | 生成最终谱面数据 |
| `completed` | 100% | 分析完成，可查看结果 |

### UI 组件

- **TaskCard** — 单条任务卡片：进度条、耗时、阶段标签、重试/关闭按钮
- **TaskNotifications** — 固定在页面右上角，最多展示 3 条；超出时显示"+N 更多"折叠

---

## YouTube 集成

### 搜索与分析流程

```
用户在 SearchResultsPage 输入关键词
     ↓
GET /api/youtube/search?q=...
     ↓
[服务端] yt-dlp CLI 搜索，返回标题/频道/时长/缩略图
     ↓
用户点击「分析」按钮
     ↓
POST /api/youtube/start-analysis/:videoId → 调用 ChordMiniApp 服务
     ↓
创建后台任务 → 轮询直至完成
     ↓
SongsPage 加载分析结果（和弦、节拍、小节结构）
```

> **依赖**：系统需安装 `yt-dlp` 并配置 ChordMiniApp 服务地址（见环境变量）。

---

## 数据流

### 标准 CRUD

```
组件 → Zustand Action → Service（fetch） → 服务端路由
     → Service → Drizzle → SQLite
     → 响应 → Store 更新 → React 重渲染
```

### AI 流式对话

```
用户输入 → POST /api/agent/chat（SSE）
         → AgentOrchestrator → LLM Provider
         → text_delta 事件流（实时显示）
         → tool_use → ToolExecutor → 工具结果
         → [DONE]
```

### 音频处理流水线

```
拖拽上传 → POST /api/audio/upload → 服务端存储
         → POST /api/transcribe → AI 处理
         → Score JSON 返回 → ScoreViewer 渲染
         → PlaybackCursor 与 AudioPlayer 实时同步
```

### YouTube 分析流水线

```
搜索结果页 → POST /api/youtube/start-analysis
           → 服务端 yt-dlp 下载 → ChordMiniApp 分析
           → 每 2 秒轮询 poll-analysis
           → completed → SongsPage 渲染和弦谱 + DAW
```

---

## 主题与设计系统

LAVA AI 采用**纯黑白极简现代**设计风格，支持深色/浅色/跟随系统三种主题。

### 色彩系统（深色模式）

| Token | 色值 | 用途 |
|---|---|---|
| `accent` | `#e5e5e5` | 主强调色 |
| `accent-dim` | `#a0a0a0` | 次要操作的柔和强调 |
| `surface-0` | `#000000` | 纯黑，最深层背景 |
| `surface-1` | `#0a0a0a` | 主背景 |
| `surface-2` | `#141414` | 卡片 / 面板 |
| `surface-3` | `#1e1e1e` | 悬浮层 |
| `surface-4` | `#282828` | 悬停状态 |
| `border` | `#1e1e1e` | 细边框 |
| `border-hover` | `#333333` | 悬停边框 |
| `text-primary` | `#ffffff` | 主文字 |
| `text-secondary` | `#888888` | 次要文字 |
| `text-muted` | `#555555` | 辅助文字 |

### 设计原则

- **纯黑背景，白色文字与强调色** — 除功能性指示色（错误红、成功绿）外无其他颜色
- **充裕留白，清晰线条** — 边框最细 1px 或无边框
- **排版驱动层级** — 用字号与字重区分信息优先级，而非颜色
- **克制的交互反馈** — 悬停/聚焦通过透明度或边框变化体现，无发光/投影效果
- **字体**：正文 Inter（无衬线），代码 JetBrains Mono（等宽）
- **响应式**：桌面端侧边栏 + 内容区 + 代理面板；移动端顶部汉堡菜单 + 底部导航栏

---

## 快速开始

### 前置条件

- Node.js ≥ 20
- pnpm ≥ 9
- yt-dlp（YouTube 搜索功能需要）：`brew install yt-dlp` / `pip install yt-dlp`

```bash
# 1. 克隆项目
git clone <repo-url>
cd LavaAI-demo

# 2. 安装依赖（自动构建 better-sqlite3 原生模块）
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 API Key

# 4. 启动开发服务器（前后端并行）
pnpm dev
```

浏览器打开 **http://localhost:5173** 即可访问。

---

## 环境变量

编辑根目录的 `.env` 文件：

```env
# 服务器端口
PORT=3001
NODE_ENV=development

# LLM 提供商："claude"（默认）或 "openai"
LLM_PROVIDER=claude

# Anthropic API Key（使用 Claude 时必填）
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI API Key（使用 OpenAI 时必填）
OPENAI_API_KEY=sk-...

# OpenAI 模型（默认已改为 gpt-5.1）
OPENAI_MODEL=gpt-5.1

# 可选：OpenAI 兼容网关地址
# OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1

# 腾讯 VOD AIGC（可选）
# 配置后，服务端会先用 SecretId / SecretKey / SubAppId 自动换取 ApiToken，
# 再调用 OpenAI-compatible 的 chat/completions 接口。
# TENCENT_VOD_SECRET_ID=AKID...
# TENCENT_VOD_SECRET_KEY=...
# TENCENT_VOD_SUB_APP_ID=1234567890
TENCENT_VOD_CHAT_BASE_URL=https://text-aigc.vod-qcloud.com/v1

# SQLite 数据库路径
DATABASE_URL=./data/lava.db

# 前端地址（CORS 配置）
CLIENT_ORIGIN=http://localhost:5173

# ChordMiniApp 服务地址（YouTube 和弦分析）
CHORD_MINI_APP_URL=http://localhost:5001
```

---

## 可用脚本

在项目根目录执行：

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 并行启动前端（:5173）和后端（:3001） |
| `pnpm build` | 构建所有包 |
| `pnpm typecheck` | 对所有包执行 TypeScript 类型检查 |
| `pnpm lint` | 对所有包执行 ESLint 检查 |
| `pnpm clean` | 清除所有构建产物和 node_modules |

---

## 路由说明

所有路由共享 `AppShell` 布局（Sidebar + TopBar + AgentPanel + TaskNotifications）：

```
/                  → 首页（快速入口卡片）
/learn             → 学习空间（推荐曲目 + 每日练习）
/learn/songs       → 曲谱编辑器（DAW + 和弦谱 + YouTube 分析导入）
/jam               → 即兴空间（多轨 DAW + AI 伴奏）
/jam/play          → 伴奏曲库浏览
/create            → 创作空间（DAW 多轨编曲）
/editor/lead-sheet → 和弦谱编辑器（导出 PDF）
/search            → YouTube 搜索结果
/files             → 文件管理（Chord Charts / Backing Tracks / Effects Presets）
/backing-tracks    → 预录伴奏库
/tools             → 实验性工具集
/projects          → 项目管理（已保存项目网格 + 分类筛选）
/pricing           → 订阅套餐
/settings          → 账号与偏好设置
/login             → 用户登录
/signup            → 用户注册
```

---

## 开发规范

### TypeScript

- 全栈严格模式（`strict: true`）
- 跨包类型通过 `@lava/shared` 共享，避免重复定义
- 服务端使用 `NodeNext` 模块解析，导入路径需包含 `.js` 扩展名
- 所有组件 props 使用接口定义，无 `any` 类型

### 状态管理

- UI 状态 → Zustand store
- 后台任务状态 → taskStore（与 UI 解耦，通过 useTaskPoller 轮询更新）
- Web Audio 状态 → 类实例 + `requestAnimationFrame`（**不进入 React 状态**）
- 服务端状态 → SQLite（通过 service 层异步读写）

### 代码风格

- Prettier 格式化（单引号、无分号、100 字符行宽）
- 组件变体通过 `class-variance-authority` 管理，避免内联条件样式堆叠
- 路由页面负责调用 `setSpaceContext`，供 AI 代理感知当前上下文
- 跨标签页状态同步通过 `useCrossTabSync` + localStorage 事件实现

---

*由 LAVA AI 团队构建 · Powered by Claude*
