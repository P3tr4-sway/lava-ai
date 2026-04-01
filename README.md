# LAVA AI

> 一个围绕 AI guitar practice pack 工作流构建的前后端 Monorepo。

## 项目现状

当前版本已经不再是早期那种「Learn / Jam / Create / Tools」并列的多空间音乐平台。
根据现有代码和真实路由，产品已经收敛成一条更清晰的主流程：

1. 登录或注册
2. 在 Home 输入提示词，或上传素材开始导入
3. 创建一个新的 practice pack
4. 进入 `/pack/:id` 做编辑、试听和 AI 协作
5. 在 `My Songs` 中管理和重新打开已有 pack

如果后续需要继续更新介绍文案、产品截图或导航说明，请以 [client/src/router.tsx](/Users/p3tr4/Documents/LavaAI-demo/client/src/router.tsx) 为最终准绳。

## 当前真实路由

| 路由 | 页面 | 状态 |
| --- | --- | --- |
| `/` | Home | 在线 |
| `/songs` | My Songs | 在线 |
| `/profile` | Profile | 在线 |
| `/pack/:id` | Pack Editor | 在线 |
| `/login` | Login | 在线 |
| `/signup` | Signup | 在线 |
| `/settings` | 重定向到 `/profile` | 兼容旧入口 |
| `/projects` | 重定向到 `/songs` | 兼容旧入口 |
| `/files` | 重定向到 `/songs` | 兼容旧入口 |
| `/play/:id` | 重定向到 `/pack/:id` | 兼容旧入口 |
| `*` | 重定向到 `/` | 兜底 |

以下页面在当前 UI 中并不存在，不应再被写成“在线功能”：

- `/learn`
- `/jam`
- `/create`
- `/search`
- `/tools`
- `/pricing`
- `/backing-tracks`

## 当前产品主线

### Home

Home 位于 [client/src/spaces/home/HomePage.tsx](/Users/p3tr4/Documents/LavaAI-demo/client/src/spaces/home/HomePage.tsx)。

当前支持三种主要入口：

- 输入自然语言提示词，直接创建新的 pack
- 点击 quick actions 预填提示词
- 上传文件或贴入 YouTube 链接，进入导入流程

当前导入识别类型包括：

- 音频文件
- YouTube 链接
- MusicXML / MXL / XML
- PDF 或图片谱面

Home 目前还包含：

- 最近 pack 快捷入口
- 导入中的 processing / review / setup / success / error 状态
- `NewPackDialog`，用于设置 bars、tempo、key、layout、tuning、capo

### My Songs

`/songs` 位于 [client/src/spaces/songs/MySongsPage.tsx](/Users/p3tr4/Documents/LavaAI-demo/client/src/spaces/songs/MySongsPage.tsx)。

当前页面能力：

- 从后端加载项目列表
- 按名称搜索
- 打开某个 pack
- 删除 pack 并二次确认

### Pack Editor

`/pack/:id` 是当前最核心的工作区，位于 [client/src/spaces/pack/EditorPage.tsx](/Users/p3tr4/Documents/LavaAI-demo/client/src/spaces/pack/EditorPage.tsx)。

现有编辑器能力包括：

- 项目加载与自动保存
- pack 标题编辑和保存状态显示
- notation / tab 编辑界面
- 播放控制和 playback style 选项
- 与当前谱面上下文绑定的 AI chat panel
- 版本预览、对比、放弃、应用流程

### Profile

`/profile` 位于 [client/src/spaces/profile/ProfilePage.tsx](/Users/p3tr4/Documents/LavaAI-demo/client/src/spaces/profile/ProfilePage.tsx)。

当前范围很轻量：

- 显示 mock 用户信息
- 切换主题
- 登出

### Auth

认证页面位于：

- [client/src/spaces/auth/LoginPage.tsx](/Users/p3tr4/Documents/LavaAI-demo/client/src/spaces/auth/LoginPage.tsx)
- [client/src/spaces/auth/SignupPage.tsx](/Users/p3tr4/Documents/LavaAI-demo/client/src/spaces/auth/SignupPage.tsx)

当前认证逻辑是前端 demo/mock 方案，状态保存在 [client/src/stores/authStore.ts](/Users/p3tr4/Documents/LavaAI-demo/client/src/stores/authStore.ts) 中，支持邮箱密码和 provider 风格按钮。

## 当前导航

真实导航定义在 [client/src/components/layout/navItems.ts](/Users/p3tr4/Documents/LavaAI-demo/client/src/components/layout/navItems.ts)。

无论桌面端还是移动端，当前只暴露 3 个主导航：

- Home
- My Songs
- Profile

## 技术栈

### 前端

- React 18
- Vite 5
- React Router 6
- Zustand
- Tailwind CSS
- Tone.js
- WaveSurfer.js

### 后端

- Fastify 4
- Drizzle ORM
- better-sqlite3
- Zod

### 共享包

- `@lava/shared`：共享类型、常量和校验 schema

## 仓库结构

```text
LavaAI-demo/
├── client/            # React 前端
├── server/            # Fastify API
├── packages/shared/   # 前后端共享 TS 类型与 schema
├── docs/              # 产品和实现文档
└── scripts/dev.mjs    # 本地同时启动前后端
```

建议优先查看的入口文件：

- [client/src/router.tsx](/Users/p3tr4/Documents/LavaAI-demo/client/src/router.tsx)
- [client/src/components/layout/AppShell.tsx](/Users/p3tr4/Documents/LavaAI-demo/client/src/components/layout/AppShell.tsx)
- [server/src/app.ts](/Users/p3tr4/Documents/LavaAI-demo/server/src/app.ts)
- [packages/shared/src/index.ts](/Users/p3tr4/Documents/LavaAI-demo/packages/shared/src/index.ts)

## 当前 API 面

前端通过 [client/vite.config.ts](/Users/p3tr4/Documents/LavaAI-demo/client/vite.config.ts) 中的 `/api` 代理访问后端。

当前服务端路由分组包括：

- `/api/agent`
- `/api/projects`
- `/api/audio`
- `/api/transcribe`
- `/api/jam`
- `/api/tools`
- `/api/pdf`
- `/api/youtube`
- `/api/health`

当前在线 UI 主流程最直接依赖的是：

- `POST /api/agent/chat`
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/versions`
- `POST /api/projects/:id/versions`

## 本地开发

### 要求

- Node.js 20+
- pnpm 9+

### 安装依赖

```bash
pnpm install
```

### 启动前后端

```bash
pnpm dev
```

这个命令会调用 [scripts/dev.mjs](/Users/p3tr4/Documents/LavaAI-demo/scripts/dev.mjs)，先清理当前仓库占用 `3001` 和 `5173` 的旧开发进程，再并行启动 workspace 中的开发服务。

### 其他常用命令

```bash
pnpm build
pnpm lint
pnpm typecheck
```

## 环境变量

参考 [.env.example](/Users/p3tr4/Documents/LavaAI-demo/.env.example)。

常用变量：

- `PORT`
- `CLIENT_ORIGIN`
- `DATABASE_URL`
- `LLM_PROVIDER`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `CHORD_MINI_APP_URL`

## 文档维护说明

- 不要再把已经下线的空间重新写进 README，除非 router 和导航已经恢复。
- 当旧规划文档与现有实现冲突时，以 `client/src/router.tsx` 为准。
- 代码内部仍然保留了一些历史命名和旧 schema，这些可以视为演进痕迹，不代表当前真实产品结构。
