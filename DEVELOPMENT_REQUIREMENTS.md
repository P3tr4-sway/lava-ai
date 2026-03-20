# LAVA AI — 开发需求文档

> 最后更新：2026-03-19

---

## 一、项目概述

### 1.1 什么是 LAVA AI？

LAVA AI 是一个**以 AI 为核心驱动力的一体化音乐平台**，面向音乐爱好者和创作者，提供从**学习 → 练习 → 即兴演奏 → 创作 → 项目管理**的全链路支持。

用户可以通过**自然语言对话**与内置 AI 代理交互，让 AI 帮助完成：导航界面、转录音频为乐谱、生成伴奏、辅助作曲、管理项目等操作。

### 1.2 核心理念

- **AI 原生**：AI 不是附加功能，而是贯穿所有空间的核心交互方式
- **全链路覆盖**：从"听到一首歌想学" → "上传转谱" → "跟谱练习" → "即兴演奏" → "多轨创作" → "保存管理"，一个平台完成
- **自然语言优先**：用户可以直接说"帮我转录这首歌"、"开一个 D 小调 Jazz 的 Jam Session"，AI 自动调用对应工具执行

### 1.3 目标用户

- 吉他/钢琴/贝斯等乐器的学习者
- 独立音乐创作者
- 需要快速出 demo 的制作人
- 想在线 jam 并记录灵感的音乐爱好者

---

## 二、技术架构

### 2.1 整体架构

```
pnpm Monorepo
├── packages/shared/   → @lava/shared（全栈共享的类型、常量、校验）
├── client/            → React SPA（前端）
└── server/            → Fastify API（后端）
```

### 2.2 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| **前端框架** | React 18 + Vite 5 | SPA，端口 5173 |
| **样式** | Tailwind CSS 3 | 原子化，纯黑白极简设计系统 |
| **状态管理** | Zustand 4 | 切片式 store，无 Provider |
| **路由** | React Router 6 | 客户端路由 |
| **音频引擎** | Web Audio API | 独立于 React 状态，44.1kHz |
| **后端框架** | Fastify 4 | 高性能 HTTP |
| **数据库** | SQLite + Drizzle ORM | 零基础设施，类型安全 |
| **AI 模型** | Claude claude-opus-4-6（默认）/ OpenAI（可选） | 通过 `LLM_PROVIDER` 环境变量切换 |
| **AI 通信** | SSE（Server-Sent Events） | 流式输出 LLM 文本 |
| **校验** | Zod | 运行时请求体 + 环境变量校验 |

### 2.3 数据库表结构

| 表名 | 说明 | 关键字段 |
|---|---|---|
| `projects` | 项目主表 | id, name, description, space, metadata, createdAt, updatedAt |
| `project_versions` | 项目版本快照 | id, projectId, version, snapshot, createdAt |
| `audio_files` | 上传的音频文件 | id, name, format, duration, sampleRate, channels, size, filePath, projectId |
| `transcriptions` | 音频转谱任务 | id, audioFileId, status(pending/processing/done/error), scoreJson, error |

### 2.4 前端状态 Store

| Store | 职责 | 关键状态 |
|---|---|---|
| `agentStore` | AI 对话 | messages, isStreaming, streamingContent, spaceContext |
| `audioStore` | 全局音频 | playbackState, bpm, key, masterVolume, metronomeEnabled |
| `jamStore` | Jam 空间 | session, availableTracks, selectedTrackId, isRecording |
| `dawStore` | Create 空间 | tracks, playheadPosition, zoom, selectedTrackId, loopStart/End |
| `projectStore` | 项目管理 | projects, activeProject, isDirty |
| `uiStore` | UI 状态 | agentPanelOpen, sidebarCollapsed, activeModal, theme |

---

## 三、平台布局与导航

### 3.1 全局布局（AppShell）

```
┌─────────┬───────────────────────────┬──────────────┐
│         │                           │              │
│ Sidebar │       Space 内容区         │  AgentPanel  │
│ (左侧   │       (中间)              │  (右侧AI面板) │
│  导航)   │                           │              │
│         │                           │              │
└─────────┴───────────────────────────┴──────────────┘
```

- **Sidebar**：左侧导航栏，包含 6 个入口（Home / Learn / Jam / Create / Library / Projects），支持折叠/展开，底部有主题切换（System/Light/Dark）
- **主内容区**：根据路由渲染对应 Space 页面
- **AgentPanel**：右侧 AI 对话抽屉（360px），包含消息列表 + 快捷操作 + 输入框，非首页时显示
- **浮动 AI 按钮**：右下角 Bot 图标，点击切换 AgentPanel 打开/关闭

### 3.2 移动端适配

- Sidebar 变为左滑抽屉 + 背景遮罩
- 增加 MobileHeader（顶部栏）+ BottomNav（底部导航栏）
- AgentPanel 全屏覆盖
- 底部安全区适配（pb-safe）

### 3.3 路由结构

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | HomePage | 首页，搜索框 + 推荐 + 项目列表 + 排行榜 |
| `/learn` | LearnPage | 学习空间 |
| `/learn/:id` | LearnPage | 加载指定学习项目 |
| `/jam` | JamPage | 即兴空间 |
| `/jam/:id` | JamPage | 加载指定 Jam 会话 |
| `/create` | CreatePage | 创作空间（DAW） |
| `/create/:id` | CreatePage | 加载指定作品 |
| `/library` | LibraryPage | 音频素材库 |
| `/projects` | MyProjectsPage | 项目管理 |
| `/projects/:id` | MyProjectsPage | 项目详情 |

---

## 四、首页（Home）

### 4.1 功能描述

首页是用户进入平台的第一个界面，**首页不显示 AI Agent 面板和浮动按钮**，主要作为入口和发现页。

### 4.2 UI 构成

1. **Hero 搜索框**：居中的大搜索框，提示文字"What do you want to make?"，支持自然语言输入，回车后发送给 AI Agent 并跳转到 `/learn`
2. **推荐标签**：横向可滚动的推荐按钮（如"Learn Autumn Leaves"、"Jam in D minor"等），点击跳转到对应空间
3. **My Projects**：用户项目卡片横滚列表，右上角"View all"跳转 `/projects`
4. **排行榜区**：三列并排卡片
   - Top Sheet Music（热门乐谱）
   - Top Songs（热门歌曲）
   - Top Pedal Effects（热门效果器）

### 4.3 待实现

- [ ] 推荐算法（当前为 mock 数据）
- [ ] 排行榜数据源对接
- [ ] 搜索框连接真实 AI Agent 后的跳转逻辑优化
- [ ] 项目列表从 API 拉取

---

## 五、六大功能空间

---

### 5.1 Learn 空间（学习空间）

**路由**：`/learn`、`/learn/:id`

**核心功能**：上传音频 → AI 自动转谱 → 分声部查看乐谱 → 分段跟练

#### 5.1.1 已实现 UI

| 区块 | 说明 |
|---|---|
| **上传区** | 虚线边框拖拽区，支持 MP3/WAV/MIDI/MusicXML/PDF，右侧 Browse 按钮 |
| **乐谱头部** | 显示歌曲名、艺术家、调式、拍号、速度、调弦 |
| **声部选择器** | 下拉选择 Lead Guitar / Rhythm Guitar / Bass Line |
| **乐谱显示** | PDF 嵌入展示区（480px 高度可滚动），顶部工具栏含播放/暂停/重置按钮 |
| **练习进度** | 总进度条 + 分段网格（Intro/Verse/Chorus/Bridge/Outro），每段显示状态（done/current/locked）和准确率百分比 |

#### 5.1.2 当前状态

- UI 完全使用 Mock 数据（`MOCK_SCORE`、`PARTS`、`PROGRESS_SECTIONS`）
- 乐谱展示为 PDF 嵌入，非实时渲染
- 上传、转谱、播放同步均未接入真实后端

#### 5.1.3 需要实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| 音频文件上传 | P0 | 拖拽/点击上传 → `POST /api/audio/upload` → 获得 audioFileId |
| AI 转谱 | P0 | 上传后调用 `POST /api/transcribe` → 轮询状态 → 获取 Score JSON |
| 乐谱渲染 | P0 | 使用 VexFlow 或 OSMD 将 Score JSON 渲染为可交互乐谱（替代 PDF 嵌入） |
| 音频播放 | P0 | 使用 AudioEngine 播放原始音频 |
| 播放光标同步 | P1 | 播放时光标在乐谱上实时移动，高亮当前音符 |
| 声部分离 | P1 | 支持 AI 从混音中分离出不同乐器声部 |
| 分段练习 | P1 | 选择某一段循环播放，对比用户弹奏准确率 |
| 速度调节 | P2 | 慢速练习模式（50%/75%/100% 速度） |
| 麦克风输入对比 | P2 | 接入麦克风，实时分析用户演奏与乐谱的匹配度 |
| 练习进度持久化 | P2 | 每段准确率保存到项目 metadata |

---

### 5.2 Jam 空间（即兴演奏空间）

**路由**：`/jam`、`/jam/:id`

**核心功能**：选择调式/速度/风格 → AI 生成或选择伴奏 → 自由演奏 → 录音

#### 5.2.1 已实现 UI

| 区块 | 说明 |
|---|---|
| **Session Settings** | Key 选择器（12 个半音按钮）、BPM 滑块（40-240）、节拍器开关、Style 标签（Rock/Jazz/Blues/Funk/Lo-fi/Latin/R&B/Electronic） |
| **Backing Track** | AI 生成文本框（描述伴奏风格） + Generate 按钮、Library 选择器（点击打开 Library Modal）、传输控制栏（上一首/播放/暂停/停止/下一首 + 进度条 + 音量滑块） |
| **Recording** | 录音按钮（Record/Stop Recording）+ 录音指示灯 + 波形占位区 |

#### 5.2.2 当前状态

- UI 交互已搭建，Zustand store 已有 `jamStore`（session, availableTracks, selectedTrackId, isRecording）
- AI 生成按钮有 loading 态但逻辑是 `setTimeout` mock
- 伴奏素材库为空（`availableTracks` 初始为空数组）
- 传输控制只更新 store 状态，未连接 AudioEngine
- 录音未实现

#### 5.2.3 需要实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| AI 伴奏生成 | P0 | 文本描述 → Agent `start_jam` 工具 → 后端生成伴奏音频 → 返回 URL |
| LoopEngine 对接 | P0 | 播放/暂停/停止连接 `LoopEngine` → 循环播放伴奏 |
| 预置伴奏素材库 | P0 | 提供默认的鼓点、Bass、和弦 Loop 素材（按风格/调式/BPM 分类） |
| Library 数据填充 | P0 | `availableTracks` 从 API 或预置数据加载 |
| 节拍器 | P1 | `Metronome` 类连接到 AudioEngine，根据 BPM 发声 |
| 麦克风录音 | P1 | `navigator.mediaDevices.getUserMedia` → MediaRecorder → WAV/WebM |
| 录音波形可视化 | P1 | 使用 AudioEngine.getWaveformData() 实时渲染 |
| 录音保存 | P1 | 录音结束 → 上传到 `/api/audio/upload` → 关联到项目 |
| Scale 选择器 | P2 | 当前 Scale 选择虽在 `JamSessionSchema` 中定义但 UI 未展示 |
| 调式和弦提示 | P2 | 根据选择的 Key + Scale 展示和弦级数建议 |
| Jam Session 保存/恢复 | P2 | 将 session 配置 + 录音保存为项目 |

---

### 5.3 Create 空间（创作空间 / DAW）

**路由**：`/create`、`/create/:id`

**核心功能**：类 DAW 的多轨编曲界面，支持 AI 辅助作曲

#### 5.3.1 已实现 UI

| 区块 | 说明 |
|---|---|
| **DAW 工具栏** | 播放/停止按钮、BPM 显示、Add Track 按钮、Export 按钮 |
| **Track 列表** | 左侧面板（隐藏于 md 以下），空状态提示"No tracks yet" + Add Track |
| **Timeline 画布** | 时间轴区域，空状态居中卡片"Start composing" |

#### 5.3.2 当前状态

- 仅骨架 UI，`dawStore` 定义了完整的 Track 数据模型但无实际数据
- 无时间轴渲染、无音频波形、无 MIDI 编辑
- Add Track 和 Export 按钮无功能

#### 5.3.3 需要实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| 添加轨道 | P0 | Add Track → 选择类型（audio/midi/instrument/bus）→ 创建轨道 |
| 时间轴渲染 | P0 | Canvas 或 DOM 渲染时间刻度 + 播放头 + 轨道 Region 色块 |
| 播放头控制 | P0 | 播放时播放头随时间移动，点击时间轴跳转 |
| 音频导入到轨道 | P0 | 拖拽音频文件到轨道 → 创建 Audio Region |
| 轨道混音器 | P1 | 每轨 Volume/Pan/Mute/Solo/Arm 控制 |
| 音频波形渲染 | P1 | Audio Region 内显示波形 |
| AI 作曲 | P1 | 输入描述 → Agent `ai_compose` 工具 → 生成 MIDI 或音频片段 → 添加到轨道 |
| Region 拖拽编辑 | P1 | 拖拽 Region 移动位置、调整长度、复制 |
| 效果器链 | P2 | 每轨可添加效果器（EQ、压缩、混响等），参数可调 |
| Bus 路由 | P2 | 子轨道输出到 Bus 轨道，统一处理 |
| Loop 区间 | P2 | 设置循环播放区间（`loopStart`/`loopEnd`） |
| 导出音频 | P2 | 混音 → 离线渲染 → 导出 WAV/MP3 |
| MIDI 编辑器 | P3 | Piano Roll 式 MIDI 音符编辑 |

---

### 5.4 Tools 空间（工具空间）

**路由**：`/tools`、`/tools/:id`

**核心功能**：独立的 AI 音乐工具集，无需创建项目即可使用

#### 5.4.1 已实现 UI

4 个工具卡片的网格展示（2x2），每个卡片包含图标、标题、描述。

#### 5.4.2 工具清单

| 工具 | 说明 | 当前状态 |
|---|---|---|
| **Transcriber（转录器）** | 上传音频 → AI 转为乐谱/MIDI | 仅卡片 UI，无详情页 |
| **Tone Generator（音调生成器）** | 生成单音、和弦、音阶 | 仅卡片 UI，无详情页 |
| **Effects Chain（效果器链）** | 实时音频效果处理 | 仅卡片 UI，无详情页 |
| **Quick Recorder（快速录音机）** | 快速录音并导出 | 仅卡片 UI，无详情页 |

#### 5.4.3 需要实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| 工具详情页路由 | P0 | `/tools/transcribe`、`/tools/tone` 等子路由 |
| Transcriber 完整流程 | P0 | 上传 → 转谱 → 结果展示（与 Learn 空间共享转谱逻辑） |
| Tone Generator | P1 | 选择音名+八度 → 使用 OscillatorNode 生成音调；支持和弦和音阶播放 |
| Quick Recorder | P1 | 一键录音 → 波形展示 → 导出下载 |
| Effects Chain | P2 | 加载音频 → 串联效果器节点（EQ/Reverb/Delay/Distortion）→ 实时预览 → 导出 |

---

### 5.5 Library 空间（素材库）

**路由**：`/library`

**核心功能**：浏览和管理所有音频素材，包括鼓点、旋律 Loop、伴奏轨道和 AI 生成内容

#### 5.5.1 已实现 UI

| 组件 | 说明 |
|---|---|
| **LibraryContent** | 分类 Tab（Drum Grooves / Melodic Loops / Backing Tracks / AI Generation）+ 素材列表（含播放/选择按钮、名称、类型、Key、BPM 标签） |
| **LibraryModal** | 模态弹窗版本的 LibraryContent，供 Jam 空间内嵌调用 |
| **LibraryPage** | 全页版本，独立空间入口 |

#### 5.5.2 当前状态

- UI 组件完整，分类过滤逻辑已实现
- 数据源为空（`availableTracks` 初始为 `[]`）
- 播放/选择交互连接了 `jamStore.selectTrack` 但无音频播放

#### 5.5.3 需要实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| 预置素材包 | P0 | 提供一批默认的鼓点、Bass、旋律 Loop 音频文件 |
| 素材 API | P0 | 后端素材列表接口 → 前端加载 |
| 素材预览播放 | P0 | 点击 Play 按钮 → AudioEngine 播放该素材 |
| AI 生成素材归档 | P1 | Jam 空间生成的 AI 伴奏自动进入 Library "AI Generation" 分类 |
| 搜索/筛选 | P1 | 按 Key、BPM、Genre 筛选素材 |
| 素材上传 | P2 | 用户上传自己的 Loop 素材 |
| 素材拖拽到 DAW | P2 | 从 Library 拖拽素材直接到 Create 空间的轨道上 |

---

### 5.6 Projects 空间（项目管理）

**路由**：`/projects`、`/projects/:id`

**核心功能**：统一管理所有空间产生的项目

#### 5.6.1 已实现 UI

| 区块 | 说明 |
|---|---|
| **项目列表** | 响应式网格（1/2/3 列），每张卡片显示空间图标、空间名、项目名、描述、更新时间 |
| **空状态** | 居中提示"No projects yet" |
| **New Project 按钮** | 右上角 |

#### 5.6.2 当前状态

- 后端 CRUD API 完整（GET/POST/PUT/DELETE `/api/projects`）
- 前端 `projectService` 已封装
- `projectStore` 有完整的状态管理（list, active, upsert, remove, dirty）
- 但前端页面**未调用 API 拉取数据**，列表始终为空

#### 5.6.3 需要实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| 页面加载时拉取项目列表 | P0 | `useEffect` → `projectService.list()` → `setProjects()` |
| 新建项目对话框 | P0 | 点击 New Project → 弹窗选择空间 + 输入名称 → `projectService.create()` |
| 项目卡片点击跳转 | P0 | 点击卡片 → 跳转到对应空间 `/{space}/{projectId}` |
| 项目删除 | P1 | 卡片右键/长按 → 确认删除 → `projectService.delete()` |
| 项目搜索/筛选 | P1 | 按空间类型或名称筛选 |
| 项目版本历史 | P2 | `project_versions` 表已设计，需实现版本快照的创建和恢复 |
| 项目重命名/编辑 | P2 | 内联编辑项目名称和描述 |

---

## 六、AI 代理系统

### 6.1 架构

```
用户输入
  ↓
useAgent Hook → agentService.streamChat() → POST /api/agent/chat（SSE）
  ↓
AgentOrchestrator.run()
  ↓
ConversationManager.normalize()  →  整理对话历史
  ↓
Provider.stream()                →  Claude / OpenAI 调用
  ↓
LLM 返回：
  ├─ text_delta → SSE 推送 → 客户端实时显示
  ├─ tool_start → 记录待执行工具
  └─ message_stop → ToolExecutor.execute() → tool_result → SSE 推送
                                                  ↓
                                    若 navigate_to_space → 客户端路由跳转
```

### 6.2 AI Agent 13 个工具

| 分类 | 工具名 | 功能 | 参数 |
|---|---|---|---|
| **导航** | `navigate_to_space` | 跳转到指定空间 | space (learn/jam/create/tools/projects), reason? |
| **项目** | `create_project` | 创建新项目 | name, space, description? |
| | `list_projects` | 列出项目 | space? |
| | `load_project` | 加载项目 | projectId |
| **Jam** | `start_jam` | 初始化 Jam 会话 | bpm?, key?, scale? |
| | `set_tempo` | 设置 BPM | bpm |
| | `set_key` | 设置调式 | key |
| **转谱** | `start_transcription` | 开始转谱 | audioFileId |
| | `get_transcription_status` | 查询转谱进度 | transcriptionId |
| **创作** | `add_track` | 添加轨道 | name, type (audio/midi/instrument/bus) |
| | `ai_compose` | AI 作曲 | prompt, key?, bpm?, bars? |
| **音频** | `upload_audio` | 引用上传的音频 | audioFileId |
| | `process_audio` | 音频处理 | audioFileId, operation |

### 6.3 Agent 上下文感知

Agent 的系统提示词会**动态注入当前空间上下文**：

```
User is in the **jam** space.
Active project: "My Jazz Session" (id: xxx)
```

这使得 AI 能根据用户当前所在空间提供上下文相关的建议和操作。

### 6.4 AgentPanel UI

| 组件 | 说明 |
|---|---|
| **AgentPanel** | 右侧抽屉（360px），含 Header（Bot 图标 + "LAVA AI" + 关闭按钮）、消息列表、Quick Actions、输入框 |
| **ChatMessage** | 用户消息（右对齐）和 AI 消息（左对齐）渲染 |
| **ChatInput** | 文本输入框，Enter 发送 |
| **QuickActions** | 快捷操作按钮（预设常用命令） |

### 6.5 待实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| 工具执行结果反馈 | P0 | 工具执行后在聊天中显示结构化结果（不仅是导航） |
| 多轮工具调用 | P0 | 当前一次 message_stop 就执行所有 pending tool calls，需支持 LLM 根据工具结果继续推理 |
| Markdown 渲染 | P1 | AI 消息中的 Markdown 格式化展示 |
| 对话历史持久化 | P1 | 当前对话仅在内存中，刷新即丢失 |
| 工具调用进度 UI | P1 | 显示"正在转谱..."、"正在生成伴奏..."等工具执行状态 |
| 上下文增强 | P2 | 注入更多上下文（当前轨道列表、选中的 Loop、录音状态等） |

---

## 七、空间互联功能

LAVA AI 的核心差异化价值在于**各空间之间的数据流通和 AI 串联**：

### 7.1 已设计的互联路径

| 从 | 到 | 数据流 | 实现状态 |
|---|---|---|---|
| **Home** → 任意空间 | 搜索框输入 → AI 判断意图 → 导航到对应空间 | UI 已实现，AI 逻辑待接通 |
| **AI Agent** → 任意空间 | `navigate_to_space` 工具 → 客户端路由跳转 | ✅ 已实现 |
| **Learn** → Projects | 学习项目保存 | 数据模型已设计，UI 待实现 |
| **Jam** → Library | AI 生成的伴奏归入素材库 | 数据模型已设计，流程待实现 |
| **Jam** → Projects | Jam Session 保存为项目 | 数据模型已设计，UI 待实现 |
| **Library** → Jam | 从素材库选择伴奏 → 加载到 Jam | ✅ LibraryModal + selectTrack 已实现 UI 联通 |
| **Library** → Create | 从素材库拖拽到 DAW 轨道 | 未实现 |
| **Tools/Transcriber** → Learn | 转谱结果导入到 Learn 跟练 | 未实现 |
| **Create** → Projects | 作品保存为项目 | 数据模型已设计，UI 待实现 |
| **任意空间** → Projects | 统一项目管理，按 space 分类 | ✅ 后端已实现（project.space 字段） |

### 7.2 需要实现的互联功能

| 功能 | 优先级 | 说明 |
|---|---|---|
| **Learn → Create 导入** | P1 | 将学习空间的转谱结果导入到 Create 空间作为参考轨道 |
| **Jam 录音 → Create 导入** | P1 | Jam 空间的录音直接导入到 Create 空间的音频轨道 |
| **Library → Create 拖拽** | P1 | 从素材库拖拽 Loop 到 DAW 时间轴 |
| **Tools 转谱 → Learn 跟练** | P1 | 工具空间转谱完成后一键跳转到 Learn 空间练习 |
| **AI 跨空间操作** | P1 | AI 一次对话中串联多个空间操作（如"把刚才 Jam 的录音加到我的作品里"） |
| **全局播放器** | P2 | 切换空间时不中断当前播放，底部固定播放条 |
| **项目从 Projects 空间一键打开** | P0 | 点击项目卡片 → 跳转到 `/{space}/{id}` 并加载数据 |

---

## 八、音频引擎

### 8.1 架构

```
AudioEngine（单例）
  ├── context: AudioContext (44.1kHz)
  ├── masterGain: GainNode → 主音量控制
  ├── analyser: AnalyserNode → 波形/频谱数据
  └── destination: 扬声器

LoopEngine
  ├── loadLoop(id, url) → fetch → decodeAudioData → AudioBuffer
  ├── activateLoop(id) → BufferSource.loop = true
  ├── start() / stop()
  └── setLoopVolume(id, volume)

Metronome
  └── 基于 OscillatorNode 的节拍器（待实现具体逻辑）

Scheduler
  └── Web Audio 时钟精确调度（待实现具体逻辑）
```

### 8.2 设计原则

- **AudioEngine 独立于 React**：Web Audio 以 44.1kHz 运行，若接入 React 状态更新会严重卡顿
- **组件通过 ref + requestAnimationFrame 读取可视化数据**
- **AudioEngine 是单例**，确保全局共用一个 AudioContext

### 8.3 待实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| Metronome 发声逻辑 | P0 | 根据 BPM 精确打拍 |
| Scheduler 精确调度 | P0 | Web Audio 时钟对齐，避免 setTimeout 漂移 |
| 多轨同步播放 | P1 | DAW 多轨同时播放，保持同步 |
| 效果器节点 | P1 | BiquadFilter(EQ)、ConvolverNode(Reverb)、DelayNode、WaveShaperNode(Distortion) |
| 录音引擎 | P1 | MediaRecorder + AudioWorkletNode → 高质量录音 |
| 离线渲染导出 | P2 | OfflineAudioContext → WAV/MP3 导出 |
| 波形可视化组件 | P1 | 使用 analyser.getWaveformData/getFrequencyData 渲染波形/频谱 |

---

## 九、后端 API 一览

### 9.1 已实现的路由

| 方法 | 路径 | 说明 | 状态 |
|---|---|---|---|
| POST | `/api/agent/chat` | AI 对话（SSE 流式） | ✅ 完整 |
| GET | `/api/projects` | 项目列表 | ✅ 完整 |
| GET | `/api/projects/:id` | 项目详情 | ✅ 完整 |
| POST | `/api/projects` | 创建项目 | ✅ 完整 |
| PUT | `/api/projects/:id` | 更新项目 | ✅ 完整 |
| DELETE | `/api/projects/:id` | 删除项目 | ✅ 完整 |
| POST | `/api/audio/upload` | 上传音频 | ✅ 基本完整（缺少 duration 解析） |
| POST | `/api/transcribe` | 开始转谱 | ⚠️ 仅创建记录，无实际 AI 处理 |
| GET | `/api/transcribe/:id` | 转谱状态 | ✅ 查询记录 |
| POST | `/api/jam/session` | 创建 Jam 会话 | ⚠️ 仅返回配置，无持久化 |
| GET | `/api/tools` | 工具列表 | ✅ 返回静态列表 |

### 9.2 待实现的 API

| 方法 | 路径 | 说明 | 优先级 |
|---|---|---|---|
| GET | `/api/audio/:id` | 音频文件流式读取 | P0 |
| GET | `/api/audio/:id/waveform` | 音频波形数据 | P1 |
| POST | `/api/audio/:id/process` | 音频处理（效果器） | P2 |
| GET | `/api/library` | 素材库列表 | P0 |
| GET | `/api/library/:category` | 按分类查素材 | P1 |
| POST | `/api/ai/compose` | AI 作曲 | P1 |
| POST | `/api/ai/generate-backing` | AI 生成伴奏 | P0 |
| GET | `/api/jam/session/:id` | 获取 Jam 会话详情 | P1 |
| PUT | `/api/jam/session/:id` | 更新 Jam 会话 | P1 |
| POST | `/api/projects/:id/versions` | 创建版本快照 | P2 |
| GET | `/api/projects/:id/versions` | 版本历史 | P2 |

---

## 十、设计系统

### 10.1 色彩

纯黑白极简风格：

| Token | 色值 | 用途 |
|---|---|---|
| `surface-0` | `#000000` | 最深层背景 |
| `surface-1` | `#0a0a0a` | 主背景 |
| `surface-2` | `#141414` | 卡片/面板 |
| `surface-3` | `#1e1e1e` | 悬浮层/输入框 |
| `surface-4` | `#282828` | 悬停状态 |
| `border` | `#1e1e1e` | 边框 |
| `border-hover` | `#333333` | 悬停边框 |
| `text-primary` | `#ffffff` | 主文字 |
| `text-secondary` | `#888888` | 次要文字 |
| `text-muted` | `#555555` | 辅助文字 |
| `accent` | `#ffffff` | 强调色 |

### 10.2 UI 组件库

已实现的基础组件：

| 组件 | 功能 | 变体 |
|---|---|---|
| `Button` | 按钮 | default/outline/ghost/destructive，sm/icon/icon-sm |
| `Card` | 卡片容器 | hoverable |
| `Input` | 文本输入 | — |
| `Slider` | 滑块 | 支持 label |
| `Toggle` | 开关 | 支持 label |
| `Tabs` | 标签页 | — |

### 10.3 设计原则

- 除功能性指示色（错误红 `text-red-500`、成功绿 `text-success`、警告色 `text-warning`）外无其他颜色
- 字体：Inter（正文）、JetBrains Mono（等宽）
- 排版驱动层级（字号+字重），而非颜色
- 交互反馈通过透明度/边框变化，无发光/投影

---

## 十一、开发优先级路线图

### Phase 1：核心功能打通（P0）

- [ ] Learn 空间：音频上传 → 真实转谱 → 乐谱渲染
- [ ] Jam 空间：LoopEngine 对接 → 预置素材 → 伴奏播放
- [ ] Library：预置素材数据填充 + 预览播放
- [ ] Projects：页面数据加载 + 卡片跳转
- [ ] AI Agent：工具执行结果反馈 + 多轮工具调用
- [ ] Audio Engine：Metronome + Scheduler

### Phase 2：体验完善（P1）

- [ ] Learn 空间：播放光标同步 + 声部分离 + 分段练习
- [ ] Jam 空间：麦克风录音 + 波形可视化 + 节拍器
- [ ] Create 空间：完整 DAW 时间轴 + 轨道混音器 + AI 作曲
- [ ] Tools 空间：各工具详情页
- [ ] Library：搜索筛选 + AI 生成归档
- [ ] 空间互联：Learn↔Create、Jam→Create、Library→Create
- [ ] AI Agent：Markdown 渲染 + 对话持久化 + 工具执行进度

### Phase 3：高级功能（P2-P3）

- [ ] 效果器系统（Web Audio 效果器链）
- [ ] 音频导出（WAV/MP3）
- [ ] 项目版本历史
- [ ] 用户认证系统
- [ ] MIDI 编辑器（Piano Roll）
- [ ] 全局播放器
- [ ] 速度调节 + 麦克风对比练习
