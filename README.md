# LAVA AI

AI 驱动的吉他乐谱智能编辑平台。输入一首歌、或一个乐谱，AI 帮你生成多风格可演奏的吉他谱面，并在编辑器中实时协作修改。

## 核心功能

- **AI 风格化乐谱** — 用自然语言描述你想要的吉他风格版本，AI 自动生成乐谱和指法谱
- **多格式导入** — 支持音频文件、MusicXML、GP、PDF
- **谱面编辑器** — 五线谱 + TAB 谱实时渲染，支持音高、时值、和弦、调号、拍号等编辑
- **AI 对话面板** — 在编辑器内与 AI 对话，基于当前谱面上下文进行智能修改
- **版本管理** — 版本预览、对比、回滚、应用

## 页面结构

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | Home | 搜索式首页，输入提示词或上传素材创建新项目 |
| `/songs` | My Songs | 项目库，搜索、打开、删除已有项目 |
| `/pack/:id` | Pack Editor | 核心编辑工作区，谱面编辑 + AI 协作 |
| `/profile` | Profile | 用户信息、主题切换 |
| `/pricing` | Pricing | 订阅方案 |
| `/login` `/signup` | Auth | 登录 / 注册 |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite 5 + TypeScript 5 (strict) |
| 样式 | Tailwind CSS 3 + CSS 自定义属性 |
| 状态管理 | Zustand |
| 路由 | React Router 6 |
| 乐谱渲染 | OSMD (OpenSheetMusicDisplay) + AlphaTab |
| 音频合成 | Tone.js |
| 波形显示 | WaveSurfer.js |
| 后端 | Fastify 4 + better-sqlite3 + Drizzle ORM |
| AI 接入 | Anthropic SDK / OpenAI SDK（可选腾讯云 VOD AIGC） |
| 校验 | Zod |

## 项目结构

```
├── client/              # React 前端 (port 5173)
│   └── src/
│       ├── spaces/      # 页面组件 (home, songs, pack, auth, profile, pricing)
│       ├── components/  # UI 组件、布局、功能模块
│       ├── stores/      # Zustand 状态管理
│       ├── services/    # API 调用
│       ├── lib/         # 工具函数 (乐谱引擎、音高处理、导出)
│       └── styles/      # 设计令牌 + Tailwind 配置
├── server/              # Fastify API (port 3001)
│   └── src/
│       ├── routes/      # API 路由 (agent, projects, audio, transcribe, etc.)
│       ├── agent/       # AI 编排、工具注册、Provider 实现
│       └── db/          # Schema + 数据库操作
├── packages/shared/     # 前后端共享类型与 Zod Schema
└── scripts/dev.mjs      # 本地开发启动脚本
```

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9

### 安装与启动

```bash
# 安装依赖
pnpm install

# 复制环境变量并填写 API Key
cp .env.example .env

# 启动开发服务（前端 5173 + 后端 3001）
pnpm dev
```

### 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `LLM_PROVIDER` | AI 提供商，`claude` 或 `openai` | `claude` |
| `ANTHROPIC_API_KEY` | Anthropic API Key | — |
| `OPENAI_API_KEY` | OpenAI API Key（可选） | — |
| `DATABASE_URL` | SQLite 数据库路径 | `./data/lava.db` |
| `PORT` | 后端端口 | `3001` |
| `CLIENT_ORIGIN` | CORS 来源 | `http://localhost:5173` |

腾讯云 VOD AIGC 模式需额外配置 `TENCENT_VOD_SECRET_ID`、`TENCENT_VOD_SECRET_KEY`、`TENCENT_VOD_SUB_APP_ID`，详见 `.env.example`。

### 其他命令

```bash
pnpm build        # 构建所有工作区
pnpm lint         # 代码检查
pnpm typecheck    # 类型检查
pnpm clean        # 清理 dist/ 和 node_modules/
```

## API 概览

前端通过 Vite 代理 `/api` 访问后端，主要接口：

| 路由组 | 用途 |
|---|---|
| `/api/agent/chat` | AI 对话（SSE 流式） |
| `/api/projects` | 项目 CRUD |
| `/api/projects/:id/versions` | 版本管理 |
| `/api/audio` | 音频处理 |
| `/api/transcribe` | 音频转谱 |
| `/api/youtube` | YouTube 链接解析 |
| `/api/pdf` | PDF 谱面处理 |
