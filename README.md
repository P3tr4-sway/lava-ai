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
- [数据流](#数据流)
- [主题与设计系统](#主题与设计系统)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [可用脚本](#可用脚本)
- [路由说明](#路由说明)
- [开发规范](#开发规范)

---

## 项目简介

LAVA AI 是一个以 AI 为核心驱动力的音乐平台，旨在为音乐爱好者提供从学习到创作的全链路支持。用户可以通过自然语言与内置 AI 代理对话，让 AI 帮助导航界面、转录音频、生成伴奏、辅助作曲。

平台采用 **pnpm 工作区 Monorepo** 架构，前后端共享同一套 TypeScript 类型系统，保证类型安全贯穿全栈。

---

## 功能空间

| 空间 | 路由 | 功能描述 |
|---|---|---|
| **Learn（学习）** | `/learn` | 上传音频 → AI 转谱 → 跟谱练习 |
| **Jam（即兴）** | `/jam` | 自由演奏，AI 生成伴奏循环 |
| **Create（创作）** | `/create` | DAW 风格的多轨编曲与 AI 作曲辅助 |
| **Tools（工具）** | `/tools` | 独立 AI 工具集（转录、音调生成、效果器、录音机） |
| **My Projects（项目）** | `/projects` | 所有已保存项目的管理中心 |

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

### 后端

| 技术 | 版本 | 用途 |
|---|---|---|
| Fastify | 4 | 高性能 HTTP 服务器 |
| better-sqlite3 | 11 | 零依赖 SQLite 驱动 |
| Drizzle ORM | 0.33 | 类型安全的 SQL 查询构建 |
| Zod | 3 | 运行时环境变量与请求体校验 |
| tsx | — | TypeScript 直接执行（开发环境） |

### AI / LLM

| 技术 | 用途 |
|---|---|
| Anthropic SDK | Claude 模型调用（默认：`claude-opus-4-6`） |
| OpenAI SDK | GPT 模型调用（可选） |
| SSE（Server-Sent Events） | 流式输出，将 LLM 文本增量推送至客户端 |

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
│  │ (5导航)  │  │ Learn/Jam/   │  │  (AI对话抽屉)          │ │
│  │          │  │ Create/Tools │  │  ChatMessage           │ │
│  └──────────┘  │ /Projects   │  │  ChatInput             │ │
│                └──────────────┘  └───────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Zustand Stores                          │  │
│  │  agentStore │ audioStore │ projectStore │ uiStore     │  │
│  │  jamStore   │ dawStore                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Web Audio Engine（独立于React）          │  │
│  │  AudioEngine │ LoopEngine │ Metronome │ Scheduler     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP / SSE
                      │ /api/*
┌─────────────────────▼───────────────────────────────────────┐
│                     Fastify 服务器（Server）                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Routes 路由层                      │   │
│  │  /agent/chat │ /projects │ /audio │ /transcribe      │   │
│  │  /jam        │ /tools                               │   │
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
│  │  ToolRegistry ──→ ToolExecutor ──→ 13个工具处理器    │   │
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
| **Zustand 切片式状态** | 极少样板代码，无需 Provider 包裹，TypeScript 推断出色 |
| **Web Audio 引擎独立于 React** | Web Audio 以 44.1kHz 运行；若接入 React 状态更新会严重卡顿。组件通过 `requestAnimationFrame` + `ref` 读取可视化数据 |
| **LLM 提供商事件级抽象** | Claude 与 OpenAI 均向下归一化为相同的 `ProviderEvent` 流，Orchestrator 完全与提供商无关 |
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
│       │   ├── ui/                 # 基础组件：Button、Card、Input、Slider、Toggle、Tabs
│       │   ├── agent/              # AgentPanel、ChatMessage、ChatInput
│       │   └── layout/             # AppShell、Sidebar、TopBar
│       ├── spaces/                 # 5个功能空间页面
│       │   ├── learn/LearnPage.tsx
│       │   ├── jam/JamPage.tsx
│       │   ├── create/CreatePage.tsx
│       │   ├── tools/ToolsPage.tsx
│       │   └── my-projects/MyProjectsPage.tsx
│       ├── stores/                 # Zustand 状态切片
│       ├── hooks/                  # useAgent、useAudioContext、useKeyboardShortcuts
│       ├── services/               # API 客户端（agentService、projectService 等）
│       └── audio/                  # Web Audio 引擎
│           ├── AudioEngine.ts      # 核心：AudioContext、主总线、分析节点
│           ├── LoopEngine.ts       # 样本精确循环播放
│           ├── Metronome.ts        # 节拍器
│           └── Scheduler.ts       # Web Audio 时钟调度
│
└── server/                         # Fastify API 服务
    └── src/
        ├── agent/                  # AI 代理系统
        │   ├── AgentOrchestrator.ts     # 代理主循环
        │   ├── ConversationManager.ts   # 对话历史管理
        │   ├── providers/               # Claude / OpenAI 提供商适配
        │   ├── tools/                   # 工具注册表 + 执行器 + 13个工具定义
        │   └── prompts/                 # 系统提示词 + 动态上下文注入
        ├── routes/                 # HTTP 路由
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
| `start_transcription` | 对上传的音频文件启动 AI 转谱 |
| `get_transcription_status` | 查询转谱进度 |
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

---

## 主题与设计系统

LAVA AI 采用**纯黑白极简现代**设计风格：

### 色彩系统

| Token | 色值 | 用途 |
|---|---|---|
| `accent` | `#ffffff` | 主强调色（深色背景上的白色） |
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
- **充裕留白，清晰线条** — 边框最细 1px `#1e1e1e` 或无边框
- **排版驱动层级** — 用字号与字重区分信息优先级，而非颜色
- **克制的交互反馈** — 悬停/聚焦通过透明度或边框变化体现，无发光/投影效果
- **字体**：正文 Inter（无衬线），代码 JetBrains Mono（等宽）

---

## 快速开始

### 前置条件

- Node.js ≥ 20
- pnpm ≥ 9

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

# SQLite 数据库路径
DATABASE_URL=./data/lava.db

# 前端地址（CORS 配置）
CLIENT_ORIGIN=http://localhost:5173
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

所有路由共享 `AppShell` 布局（Sidebar + TopBar + AgentPanel）：

```
/              → 重定向至 /learn
/learn         → 学习空间（上传 → 转谱 → 跟练）
/learn/:id     → 加载指定学习项目
/jam           → 即兴空间（自由演奏 + AI 伴奏）
/jam/:id       → 加载指定即兴会话
/create        → 创作空间（DAW 多轨编曲）
/create/:id    → 加载指定作品
/tools         → 工具空间（独立 AI 工具集）
/tools/:id     → 指定工具视图
/projects      → 项目管理（已保存项目网格）
/projects/:id  → 项目详情
```

---

## 开发规范

### TypeScript

- 全栈严格模式（`strict: true`）
- 跨包类型通过 `@lava/shared` 共享，避免重复定义
- 服务端使用 `NodeNext` 模块解析，导入路径需包含 `.js` 扩展名

### 状态管理

- UI 状态 → Zustand store
- Web Audio 状态 → 类实例 + `requestAnimationFrame`（**不进入 React 状态**）
- 服务端状态 → SQLite（通过 service 层异步读写）

### 代码风格

- Prettier 格式化（单引号、无分号、100 字符行宽）
- 组件变体通过 `class-variance-authority` 管理，避免内联条件样式堆叠
- 路由页面负责注入 `SpaceContext`，供 AI 代理感知当前上下文

---

## 后续计划

- [ ] Learn 空间：音频上传 UI + 转谱结果展示（VexFlow/OSMD 乐谱渲染）
- [ ] Jam 空间：循环引擎对接 + 真实 AI 伴奏生成
- [ ] Create 空间：完整 DAW 时间轴 + 混音器 + AI 作曲面板
- [ ] Tools 空间：音调生成器、效果器链、独立转录工具
- [ ] 用户认证系统
- [ ] 项目版本历史
- [ ] 音频导出（WAV / MP3）

---

*由 LAVA AI 团队构建 · Powered by Claude*
