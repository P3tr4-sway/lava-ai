# LAVA AI — 当前信息架构说明

> 本文档只描述当前代码库里真实存在、可访问的页面和路由。
> 路由真相以 `client/src/router.tsx` 为准，不以旧规划文档为准。

## 1. 产品形态

当前版本已经从早期的多空间音乐平台，收敛为一个更聚焦的 practice pack 工作流。

主路径如下：

1. 用户登录或注册
2. 从 Home 开始输入需求或上传素材
3. 创建或导入一个 pack
4. 在 `/pack/:id` 中编辑、试听、与 AI 协作
5. 在 `My Songs` 中重新打开和管理已有内容

## 2. 全局导航

当前侧边栏和移动端底部导航是统一的。

| 标签 | 路由 | 作用 |
| --- | --- | --- |
| Home | `/` | 创建新 pack 的入口页 |
| My Songs | `/songs` | 浏览并重新打开已保存 pack |
| Profile | `/profile` | 账户、主题、登出 |

相关源码：

- `client/src/components/layout/navItems.ts`
- `client/src/components/layout/Sidebar.tsx`
- `client/src/components/layout/BottomNav.tsx`

## 3. 路由地图

### 在线路由

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | `HomePage` | 位于 `AppShell` 内 |
| `/songs` | `MySongsPage` | 位于 `AppShell` 内 |
| `/profile` | `ProfilePage` | 位于 `AppShell` 内 |
| `/pack/:id` | `EditorPage` | 核心 pack 工作区 |
| `/login` | `LoginPage` | 独立认证页 |
| `/signup` | `SignupPage` | 独立认证页 |

### 兼容性重定向

| 路由 | 重定向到 | 说明 |
| --- | --- | --- |
| `/settings` | `/profile` | 保留旧入口 |
| `/projects` | `/songs` | 保留旧入口 |
| `/files` | `/songs` | 保留旧入口 |
| `/play/:id` | `/pack/:id` | 旧播放页已并入 pack editor |
| `*` | `/` | 通配兜底 |

### 当前不应视为在线页面

以下路径不应再被写成当前产品能力：

- `/learn`
- `/jam`
- `/create`
- `/search`
- `/tools`
- `/pricing`
- `/backing-tracks`

## 4. 页面规格

### 4.1 Home `/`

文件：`client/src/spaces/home/HomePage.tsx`

定位：

- 新建内容的主入口

当前能力：

- 自然语言输入
- quick action 预设提示
- 文件上传
- 音频、YouTube、MusicXML、PDF、图片导入识别
- processing / review / setup / waiting 状态
- 最近 pack 快捷入口
- 新建 pack 配置弹窗

主要结果：

- 创建一个新 pack 并跳转到 `/pack/:id`
- 完成导入并打开生成后的 pack

### 4.2 My Songs `/songs`

文件：`client/src/spaces/songs/MySongsPage.tsx`

定位：

- 已保存 pack 列表页

当前能力：

- 加载项目列表
- 按名称搜索
- 打开 pack
- 删除 pack 并确认

空状态：

- 引导用户回到 Home 创建第一个 pack

### 4.3 Pack Editor `/pack/:id`

文件：`client/src/spaces/pack/EditorPage.tsx`

定位：

- 当前最核心的编辑与练习工作区

当前能力：

- 加载项目数据与历史版本
- 自动保存
- 修改 pack 名称
- notation / tab 编辑
- 播放控制与 playback style 设置
- 带当前谱面上下文的 AI 聊天面板
- 版本预览、对比、放弃、应用

主要子模块：

- `EditorTitleBar`
- `EditorToolbar`
- `EditorCanvas`
- `EditorChatPanel`
- `PreviewBar`

### 4.4 Profile `/profile`

文件：`client/src/spaces/profile/ProfilePage.tsx`

定位：

- 轻量账户与偏好设置页

当前能力：

- 展示 mock 用户信息
- 切换主题
- 登出

### 4.5 Auth `/login` 与 `/signup`

文件：

- `client/src/spaces/auth/LoginPage.tsx`
- `client/src/spaces/auth/SignupPage.tsx`

定位：

- demo 认证入口

当前行为：

- 邮箱密码登录/注册 UI
- provider 风格登录按钮
- 前端本地持久化认证状态

## 5. 用户流

### 5.1 主流程

```text
登录 / 注册
  -> Home
  -> 输入提示或上传素材
  -> 创建 pack
  -> /pack/:id
  -> 保存和继续编辑
  -> 在 /songs 中再次打开
```

### 5.2 资源库流程

```text
/songs
  -> 搜索已有 pack
  -> 打开 /pack/:id
  -> 继续编辑或练习
```

### 5.3 旧入口兼容流程

```text
/play/:id -> /pack/:id
/projects -> /songs
/files -> /songs
/settings -> /profile
```

## 6. 维护说明

- App shell 位于 `client/src/components/layout/AppShell.tsx`
- 路由定义位于 `client/src/router.tsx`
- 当前 IA 明显比历史规划更小、更聚焦
- 旧文档里出现的 Jam、Search、Lead Sheet、Pricing、多空间导航等内容，除非 router 再次恢复，否则都应视为历史信息
