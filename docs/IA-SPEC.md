# LAVA AI — 信息架构规格文档

> 本文档定义产品的页面地图、导航结构、用户流转路径和每个页面的内容规格。
> 作为 AI agent 修改 prototype 的执行依据。

---

## 1. 核心设计原则

- **主线**：搜歌 → AI出谱 → 跟着练。所有设计围绕这条路径优化。
- **河流模型**：用户自然从搜索流向结果、流向练习，中间不做选择题。
- **首页使命**：帮用户在 10 秒内进入一首歌，不是展示功能列表。

---

## 2. 导航结构

### 2.1 变更说明

| 现状 | 变更为 | 原因 |
|------|--------|------|
| Home | **Home** (保留) | — |
| Play → PlayHub (Gear占位页) | **Jam** → Jam 工作台 | PlayHub 定位模糊，重新定义为「即兴工作台」 |
| My Projects | **My Songs** | 更贴合用户心智，「我的歌」而非「我的项目」 |
| New Sheet | **New Sheet** (保留) | — |
| Settings | **Settings** (保留) | — |

### 2.2 最终导航项（Sidebar + BottomNav）

```
┌─────────────────────────────┐
│  🏠  Home         /         │  ← "我想找一首歌"
│  📚  My Songs     /my-songs │  ← "看看我在练的歌"
│  🎸  Jam          /jam      │  ← "我想自由弹弹"
│  📝  New Sheet    /editor   │  ← "我要做一份谱"
│  ─── 分隔线 ───             │
│  ⚙️  Settings     /settings │
└─────────────────────────────┘
```

### 2.3 实施要点

**文件需修改：**
- `client/src/components/layout/navItems.ts` — 更新导航项
- `client/src/components/layout/Sidebar.tsx` — 更新图标和标签
- `client/src/components/layout/BottomNav.tsx` — 同步移动端导航
- `client/src/router.tsx` — 添加 `/my-songs` 路由，保留 `/projects` 重定向到 `/my-songs`

**具体改动：**
1. 移除 Play 导航项（指向 PlayHub 的入口）
2. 将 My Projects 改名为 My Songs，路由改为 `/my-songs`
3. Jam 导航项保留在 `/jam`，但指向重新设计的 Jam 工作台
4. `/projects` 做 redirect → `/my-songs`

---

## 3. 页面地图（Site Map）

### 3.1 完整路由表

| 页面 | 路由 | 定位 | 所在目录 |
|------|------|------|----------|
| 首页 | `/` | 搜索入口 + 继续练习 + 推荐发现 | `spaces/home/` |
| 搜索结果 | `/search?q=xxx` | YouTube 搜索结果展示 | `spaces/search/` |
| 歌曲页 | `/play/:id` | **核心体验页**。和弦谱 + 播放控制 + 练习工具 + DAW | `spaces/learn/` |
| Jam 工作台 | `/jam` | 即兴弹奏。AI 效果器控制台 + DAW 录音 | `spaces/jam/` |
| Jam 会话 | `/jam/:id` | 已保存的 Jam 会话 | `spaces/jam/` |
| My Songs | `/my-songs` | 用户的歌曲库（在练的歌 + 写的谱 + Jam 录音） | `spaces/my-projects/`（目录名后续可改） |
| Lead Sheet 编辑器 | `/editor` | 空白创建 | `spaces/editor/` |
| Lead Sheet 编辑器 | `/editor/:id` | 编辑已有谱 | `spaces/editor/` |
| 设置 | `/settings` | 账户、订阅、偏好 | `spaces/settings/` |
| 定价 | `/pricing` | 付费方案 | `spaces/pricing/` |
| 登录 | `/login` | — | `spaces/auth/` |
| 注册 | `/signup` | — | `spaces/auth/` |

### 3.2 重定向规则

```
/learn       → /
/create      → /
/library     → /my-songs
/projects    → /my-songs
/learn/songs/:id → /play/:id
```

### 3.3 待移除

- **PlayHubPage** (`spaces/jam/PlayHubPage.tsx`) — 不再作为独立页面。`/jam` 路由直接指向 Jam 工作台（JamPage 重构）。

---

## 4. 用户流转路径

### 4.1 主线：搜歌 → 出谱 → 跟着练

```
首页 (/)
  │
  ├─ 搜索框输入 ──→ 搜索结果页 (/search?q=xxx)
  │                    │
  │                    └─ 点击歌曲 → 选择「AI出谱」
  │                         │
  │                         └─ 等待分析 → 歌曲页 (/play/:id?generate=1)
  │                                          │
  │                                          ├─ 跟着练（主体验）
  │                                          ├─ 保存 → 进入 My Songs
  │                                          └─ 编辑谱 → /editor/:id
  │
  ├─ 点击「继续练习」卡片 ──→ 歌曲页 (/play/:id)
  │
  ├─ 点击「推荐歌曲」──→ 歌曲页 (/play/:id)
  │
  └─ 点击「30秒体验」(新用户) ──→ 歌曲页 (/play/demo) ← 预置 demo，无需等待
```

### 4.2 支线：自由弹奏

```
导航点击 Jam ──→ Jam 工作台 (/jam)
                    │
                    ├─ 选择音色预设
                    ├─ AI 推荐/生成效果器组合
                    ├─ 调参数（拖拽旋钮）
                    ├─ 开节拍器，自由弹奏
                    └─ 录音 → 保存 → 进入 My Songs
```

### 4.3 支线：写谱

```
导航点击 New Sheet ──→ 编辑器 (/editor)
                          │
                          ├─ 空白创建
                          └─ 保存 → 进入 My Songs

歌曲页里点「编辑谱」──→ 编辑器 (/editor/:id)
                          │
                          └─ 修改 AI 生成的谱 → 保存
```

### 4.4 My Songs 入口

```
导航点击 My Songs ──→ My Songs 页 (/my-songs)
                         │
                         ├─ 点击「在练的歌」→ 歌曲页 (/play/:id)
                         ├─ 点击「我写的谱」→ 编辑器 (/editor/:id)
                         └─ 点击「Jam 录音」→ Jam (/jam/:id)
```

---

## 5. 各页面内容规格

### 5.1 首页 (/)

**新用户和回访用户展示不同内容，通过是否有练习历史判断。**

#### 新用户首页

| 区域 | 内容 | 优先级 |
|------|------|--------|
| **搜索框** | "What do you want to play?" + 热门标签（小星星 · 晴天 · Hotel California · Let It Be） | 第一视觉 |
| **30秒体验** | "看看 AI 怎么秒出和弦谱" + 一个预置 demo 按钮（点击直接进入歌曲页 /play/demo，无需等待 AI 分析） | 第二视觉 |
| **按难度发现** | 入门(4和弦) · 流行热歌 · 指弹经典 · 进阶挑战（横向滑动歌曲卡片） | 第三视觉 |

#### 回访用户首页

| 区域 | 内容 | 优先级 |
|------|------|--------|
| **继续练习** | 最近练过的歌（卡片展示：封面 + 歌名 + 进度），点击直接进入歌曲页 | 第一视觉 |
| **搜索框** | "What do you want to play?" + 热门标签 | 第二视觉 |
| **推荐给你** | 根据练习历史推荐相似歌曲（初期用标签关联，后期用推荐算法） | 第三视觉 |

#### 从首页移除的内容

- ~~快捷卡片（Learn a Song / Jam Session / Create Lead Sheet）~~ → 去掉，分散主线注意力
- ~~PricingCards~~ → 移到专门的 /pricing 页，首页不展示定价
- ~~升级 Banner~~ → 只在用户触达付费功能限制时展示，不常驻首页

**实施文件：** `spaces/home/HomePage.tsx`

---

### 5.2 歌曲页 /play/:id（核心体验页）

**页面三层结构：元信息栏 + 和弦谱区 + 底部控制区**

#### 元信息栏（顶部固定）

```
← 返回    {歌名} - {艺人}    ⭐ 收藏
Key: {调}  │  BPM: {速度}  │  难度: ●●●○○
```

#### 和弦谱区（中间可滚动，占据主体空间）

- 按段落展示和弦格子（Intro / Verse / Chorus / Bridge / Outro）
- **和弦跟随高亮**：播放时当前和弦格子高亮（背景色变化），自动滚动到视口
- **段落循环按钮**：每个段落标题旁有 🔁 按钮，点击后该段落循环播放
- **和弦指法弹窗**：点击和弦名（如 Dm7）→ 弹出小气泡显示吉他指法图

#### 底部控制区（固定在底部）

**播放控制栏（始终可见）：**
```
◄◄  ▶ 播放  ►►  │  🐢 0.8x ── 1.0x ── 1.2x 🐇
━━━━━━━━●━━━━━━━━━━━━━━  2:15 / 4:30
```

**工具 Tab 切换（互斥，同一时刻只显示一个）：**

| Tab | 内容 | 面向用户 |
|-----|------|----------|
| 🎸 指法图 | 当前段落所有和弦的指法图网格 | 新手不确定怎么按 |
| 📖 歌词 | 歌词展示（如果有） | 想边弹边唱 |
| 🎹 DAW | 多轨录音面板（波形、轨道控制） | 想录下自己弹的 |

**关键设计变更：**
- 播放控制栏从 DAW 面板中独立出来，不需要打开 DAW 就能控制播放
- DAW 变成 tab 里的一个选项，不再默认展开
- 新增变速滑块（播放控制栏内）
- 新增段落循环（和弦谱区内，每个段落标题旁）
- 新增和弦指法弹窗（点击和弦名触发）
- 新增和弦跟随高亮（播放时自动标记当前和弦）

**实施文件：** `spaces/learn/SongsPage.tsx`, `components/score/ChordGrid.tsx`, `components/daw/DawPanel.tsx`

---

### 5.3 Jam 工作台 /jam

**页面两层结构：AI 效果器控制台 + DAW 录音**

与歌曲页共享底层结构（上面内容区 + 下面 DAW），但服务不同心智：
- 歌曲页 = "我在学一首歌"
- Jam 工作台 = "我在随便弹"

#### 上半部分：AI 效果器控制台

```
音色预设:  [Clean] [Overdrive] [Distortion] [Acoustic]

效果器链:
┌──────────┐   ┌──────────┐   ┌──────────┐
│Compressor│──▶│Tube Scr. │──▶│ Reverb   │
│ Drive: 6 │   │ Gain: 7  │   │ Room: 4  │  ← 可拖拽调参
└──────────┘   └──────────┘   └──────────┘

AI 推荐:  [✨ 90s Grunge]  [✨ Blues Club]  [✨ Lo-fi Chill]
          点击即应用一套效果器组合，实时试听
```

#### 中间：节拍器 + 参数

```
BPM: [  120  ]  Key: [  Am  ]  [🥁 节拍器 ON/OFF]
```

#### 下半部分：DAW 录音

```
[● REC]  Track 1: ▁▂▃▅▇▅▃▂▁▂▃▅▇▅▃
         Track 2: ────────────────────
```

**实施要点：**
- PlayHubPage 内容全部替换，改为 Jam 工作台
- 复用 JamPage 的 DAW 部分，但上半部分重新设计为效果器控制台
- `/jam` 不再展示 "Today's Featured Tones" / "My Gear" / "Gear Shop"

**实施文件：** `spaces/jam/PlayHubPage.tsx`（重写），`spaces/jam/JamPage.tsx`（复用 DAW 部分）

---

### 5.4 My Songs /my-songs

**从 My Projects 改造而来。**

#### 变更点

1. **页面标题**：My Projects → My Songs
2. **默认排序**：按最近练习/编辑时间倒序（最近的在最前）
3. **筛选 Tab**：全部 / 在练的歌 / 我写的谱 / Jam 录音（替代原来的 All / Scores / Jam / Create）
4. **卡片信息**：歌名、艺人、上次练习时间、类型图标
5. **点击行为**：
   - 在练的歌 → `/play/:id`
   - 我写的谱 → `/editor/:id`
   - Jam 录音 → `/jam/:id`

**实施文件：** `spaces/my-projects/MyProjectsPage.tsx`, `client/src/router.tsx`

---

### 5.5 Lead Sheet 编辑器 /editor

保持现有设计，不做大改。

**新增入口：** 歌曲页内可以跳转到编辑器，让用户修改 AI 生成的谱。在歌曲页元信息栏或更多菜单中添加「编辑此谱」按钮，点击后带着当前谱数据跳转到 `/editor/:id`。

---

## 6. 新增路由：/play/demo

为新用户提供「30秒体验」入口。

- 这是一个预置的歌曲页，数据硬编码（不需要 AI 分析）
- 推荐使用一首经典且和弦简单的歌（如 Hotel California 前奏）
- 用户点击首页「30秒体验」按钮 → 直接进入 `/play/demo`
- 可以体验完整的和弦谱 + 播放 + 跟随高亮
- 底部显示注册引导："想分析更多歌曲？注册免费开始"

**实施：** 在 `router.tsx` 中添加 `/play/demo` 路由，复用 SongsPage 组件，通过 id=demo 加载预置数据。

---

## 7. 变更清单（按文件）

| 文件 | 改动 |
|------|------|
| `router.tsx` | 添加 `/my-songs` 路由；`/projects` 重定向到 `/my-songs`；`/play/demo` 路由 |
| `navItems.ts` | Play → 移除；My Projects → My Songs `/my-songs`；保持 Jam `/jam` |
| `Sidebar.tsx` | 同步导航项变更 |
| `BottomNav.tsx` | 同步导航项变更 |
| `HomePage.tsx` | 移除快捷卡片和 PricingCards；新增「继续练习」区域和「30秒体验」区域；新老用户分流逻辑 |
| `SongsPage.tsx` | 播放控制栏独立；新增变速滑块；新增底部 Tab 切换（指法图/歌词/DAW）；和弦跟随高亮 |
| `ChordGrid.tsx` | 和弦格子高亮状态；段落循环按钮；和弦点击弹出指法图 |
| `PlayHubPage.tsx` | 全部重写为 Jam 工作台（AI 效果器控制台 + 节拍器 + DAW） |
| `MyProjectsPage.tsx` | 改名 My Songs；筛选 Tab 改为（全部/在练的歌/我写的谱/Jam录音）；默认按时间排序 |
