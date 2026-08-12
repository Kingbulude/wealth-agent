# 投资笔记模块 Spec（含三端 UI 布局详细设计）

## Why
当前系统只记录持仓的成本和数量，缺乏**投资决策上下文**的记录。投资者在买入/卖出时通常有强烈的逻辑判断（理由、目标价、止损位、市场环境），但事后无法回溯，导致无法系统化复盘和迭代投资能力。新增「投资笔记」模块，让每一次决策都可追溯、可复盘，帮助用户从"凭感觉交易"升级为"有据可查的体系化投资"。

## What Changes
- 新增独立 Tab 页面「**投资笔记**」，作为第 5 个主 Tab
- 笔记分为 4 大类：
  1. **投资认知积累**：投资理念、市场观察、心得体会的块编辑器笔记
  2. **个股交易决策笔记**：每次买入/卖出时的决策记录（绑定到具体持仓，按时间戳）
  3. **持仓复盘笔记**：持有期内的跟踪笔记（绑定到具体持仓）
  4. **投资学习资料收藏**：研报、书籍、文章链接收藏
- 持仓添加/编辑表单新增「**买入逻辑**」字段（买入理由、目标价位、止损位、持有周期、买入时市场环境），并支持**按时间戳追加多条**
- 三端同步：网页端 / 桌面端 / 移动端 H5 内容完全一致，**UI 布局按设备形态差异化**
- 数据后端持久化到 D1，三端共享

## Impact
- **Affected specs**: 持仓管理、资产管理、Tab 导航结构、用户偏好、推送系统
- **Affected code**:
  - `src/pages/Dashboard.tsx`（新增第 5 个 Tab + 移动端底部 Tab）
  - `src/pages/InvestmentNotes.tsx`（新建主页面）
  - `src/stores/notesStore.ts`、`positionNotesStore.ts`、`learningStore.ts`（新建）
  - `src/types/Note.ts`、`PositionNote.ts`、`LearningResource.ts`（新建类型）
  - `src/components/BlockEditor.tsx`（新建，封装 Tiptap，三端适配）
  - `src/components/AddAssetModal.tsx`（买入逻辑字段改造）
  - `src/components/HoldingList.tsx`（显示笔记入口）
  - `src/components/TradeRecordTimeline.tsx`（新建时间线组件）
  - `src/renderer/index.css`（新增三端样式：投资笔记页、块编辑器、抽屉、底部 Sheet）
  - `functions/api/notes/`、`functions/api/position-notes/`、`functions/api/learning-resources/`（CRUD API）
  - D1 表：`notes`、`position_trade_records`、`position_review_notes`、`learning_resources`

---

## ADDED Requirements

### Requirement: 投资笔记页面（Investment Notes Page）
系统 SHALL 提供一个独立 Tab「投资笔记」，按 4 大类组织内容。

#### Scenario: 进入笔记页
- **WHEN** 用户点击底部 Tab 栏的「投资笔记」
- **THEN** 显示 4 个子分类：投资认知、交易决策、持仓复盘、学习资料
- **AND** 默认进入「投资认知」分类
- **AND** 显示该分类下所有笔记的卡片列表

#### Scenario: 新建认知笔记
- **WHEN** 用户点击「新建笔记」按钮
- **THEN** 弹出类 Notion 块编辑器
- **AND** 支持块类型：标题（H1/H2/H3）、段落、待办列表、有序列表、无序列表、引用、代码块、分隔线、Markdown 粘贴
- **AND** 自动保存（编辑停顿 1.5s 后写入后端）
- **AND** 支持置顶、归档、删除

#### Scenario: 搜索/过滤笔记
- **WHEN** 用户在搜索框输入关键词
- **THEN** 实时过滤匹配的笔记（标题 + 内容）
- **AND** 显示最近 5 条搜索历史

### Requirement: 个股交易决策笔记
系统 SHALL 允许用户为每笔交易记录决策逻辑，按时间戳组织。

#### Scenario: 持仓添加时记录买入逻辑
- **WHEN** 用户在持仓添加表单填写「买入逻辑」区块
- **THEN** 可填写：
  - 买入理由（必填，多行文本）
  - 目标价位（数字，可选）
  - 止损价位（数字，可选）
  - 持有周期（短/中/长线 单选）
  - 买入时市场环境（多行文本，可选）
- **AND** 保存为该持仓的第一条交易记录，时间戳为添加时间

#### Scenario: 持仓追加买入逻辑
- **WHEN** 用户在持仓详情页点击「追加交易记录」
- **THEN** 弹出表单，记录新一次买入/卖出的决策
- **AND** 自动生成新时间戳的记录
- **AND** 列表按时间倒序展示所有交易记录

#### Scenario: 查看交易决策历史
- **WHEN** 用户在持仓详情页点击「交易记录」
- **THEN** 按时间倒序展示该持仓的所有买入/卖出决策
- **AND** 每条记录显示：时间、操作类型（买/卖）、价格、数量、决策理由、目标价/止损价快照

### Requirement: 持仓复盘笔记
系统 SHALL 允许用户在持仓持有期内添加跟踪笔记。

#### Scenario: 添加复盘笔记
- **WHEN** 用户在持仓详情页点击「添加复盘笔记」
- **THEN** 弹出块编辑器
- **AND** 关联到该持仓
- **AND** 自动记录当时价格、盈亏比例
- **AND** 保存为时间序列笔记

#### Scenario: 复盘时查看历史笔记
- **WHEN** 用户进入持仓复盘页
- **THEN** 显示该持仓的所有复盘笔记时间线
- **AND** 每条笔记旁显示当时的价格快照和盈亏比例
- **AND** 支持对比首条买入逻辑和当前状态

### Requirement: 学习资料收藏
系统 SHALL 允许用户收藏投资相关的外部资料。

#### Scenario: 添加学习资料
- **WHEN** 用户点击「添加资料」
- **THEN** 弹出表单，填写：标题（必填）、链接（URL）、类型（研报/书籍/文章/视频/其他）、标签（多个）、备注（可选）

#### Scenario: 浏览学习资料
- **WHEN** 用户进入学习资料分类
- **THEN** 以卡片网格展示所有收藏
- **AND** 支持按类型过滤、按标签过滤
- **AND** 点击卡片打开原始链接（新窗口）

### Requirement: 持仓添加表单增强
系统 SHALL 在持仓添加表单中新增「买入逻辑」区块。

#### Scenario: 桌面端添加持仓
- **WHEN** 用户在桌面端打开添加持仓表单
- **THEN** 在「价格」「成本」字段下方显示「买入逻辑」区块
- **AND** 包含：买入理由（TextArea）、目标价位（InputNumber）、止损价位（InputNumber）、持有周期（Radio.Group）、市场环境（TextArea）

#### Scenario: 移动端添加持仓
- **WHEN** 用户在手机端打开添加持仓表单
- **THEN** 买入逻辑字段与桌面端一致
- **AND** 触摸目标 ≥ 44px
- **AND** 表单分段折叠，简化输入

### Requirement: 三端数据同步
系统 SHALL 确保投资笔记在网页端、桌面端、移动端 H5 内容完全一致。

#### Scenario: 任意端编辑
- **WHEN** 用户在任一端新增/编辑/删除笔记
- **THEN** 切换到其他端登录同账号后能立即看到最新数据
- **AND** 通过 D1 数据库实现持久化
- **AND** 网络异常时降级到 localStorage，恢复网络后自动同步

#### Scenario: 桌面端离线
- **WHEN** 桌面端断网
- **THEN** 笔记仍可本地查看和编辑
- **AND** 恢复网络后自动同步未上传的变更

### Requirement: 三端 UI 布局差异化
系统 SHALL 根据设备形态提供差异化的 UI 布局，但保持信息架构和数据一致。详见「**三端 UI 布局详细设计**」章节。

---

## MODIFIED Requirements

### Requirement: Tab 导航结构
原有的 4 个 Tab（资产总览 / 资产管理 / 持仓管理 / 持仓智研）扩展为 **5 个 Tab**（增加「投资笔记」）。

#### Scenario: Tab 切换
- **WHEN** 用户点击任意 Tab
- **THEN** 显示对应页面
- **AND** 移动端底部 Tab 栏最多显示 5 个（投资笔记作为最后一个）

### Requirement: 持仓数据类型扩展
原 `Holding` 接口新增关联字段，但**不破坏**现有数据。

#### Scenario: 旧数据兼容
- **WHEN** 用户已存在的持仓数据（不含笔记关联）
- **THEN** 仍能正常显示
- **AND** 可在持仓详情页补充添加交易决策笔记

---

## 三端 UI 布局详细设计

### 设计原则（与现有项目风格一致）
- **设计语言**：沿用项目现有 "Wealth Terminal" 风格（财富金 `--brand-500`、深色顶栏、Pill Tab、玻璃态卡片）
- **三端一致性**：数据模型、API、内容展示完全一致；**仅布局密度、交互方式、空间利用按设备形态差异化**
- **断点**（沿用 `src/renderer/index.css`）：
  - **超小屏** `≤375px`：iPhone SE 等紧凑屏
  - **移动端** `≤768px`：手机 H5 / Capacitor App
  - **平板/小桌面** `769px–1023px`：iPad / 折叠屏
  - **桌面端** `≥1024px`：浏览器 / Electron 窗口（默认 1400×900 最大化）
  - **宽屏** `≥1440px`：完整三栏布局

### 端类型识别逻辑

| 端类型 | 识别方式 | 默认容器宽度 |
|--------|---------|-------------|
| 网页端 (Web) | `window.innerWidth ≥ 1024px` 且非 Electron | max-width: 1440px 居中 |
| 桌面端 (Electron) | `navigator.userAgent.includes('Electron')` | 窗口默认 1400×900，最大化 100% |
| App/H5 端 | `window.innerWidth ≤ 768px`（含 Capacitor WebView） | 100% 视口 + safe-area |

> **说明**：网页端和桌面端共用同一套 ≥1024px 布局 CSS；仅在交互细节（如快捷键、菜单栏）上做差异化。App/H5 端用 `@media (max-width: 768px)` 覆盖。

---

### 一、投资笔记主页 `InvestmentNotes.tsx` 布局

#### 1.1 网页端 / 桌面端（≥1024px）

```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar  [Wealth Terminal 财富管理智能体]      上证:3287.45  设置  退出  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Pill Tab:  ① 资产总览  ② 资产管理  ③ 持仓管理  ④ 持仓智研  ⑤ 投资笔记 │  ← 激活
│                                                                      │
│  ┌─ 投资笔记 (Investment Notes) ──────────────────────────────┐    │
│  │  ▣ 投资认知   ▢ 交易决策   ▢ 持仓复盘   ▢ 学习资料          │    │  ← 二级子 Tab（圆角胶囊）
│  │  🔍 [搜索笔记……]                       [＋ 新建笔记]  [⋯]  │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │    │
│  │  │ 📌 置顶笔记  │ │ 笔记卡片    │ │ 笔记卡片    │           │    │  ← 卡片网格 3 列
│  │  │ 标题…       │ │ 标题…       │ │ 标题…       │           │    │
│  │  │ 摘要前 120字│ │ 摘要…       │ │ 摘要…       │           │    │
│  │  │ 标签·时间   │ │ 标签·时间   │ │ 标签·时间   │           │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘           │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │    │
│  │  │ 笔记卡片    │ │ 笔记卡片    │ │ 笔记卡片    │           │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘           │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**布局规格**：
- **顶部 Tab 栏**：沿用现有 `.tab-bar` pill 样式，5 个 Tab 单行铺开（≥1440px）；1024-1439px 缩小间距 `padding: 8px 16px`
- **二级子 Tab**：横向 capsule 列表（圆角胶囊），4 个分类 + 搜索框 + 「+ 新建笔记」按钮，固定在子页面顶部
- **卡片网格**：`grid-template-columns: repeat(3, 1fr); gap: 20px;`
  - 卡片宽屏宽度 1024-1439px：3 列
  - 1440px+：仍 3 列（限制 max-width 1440 居中）
  - 每张卡片高度自适应，最小 160px
- **卡片内容**：标题（16px/700）、摘要（前 120 字 / 13px/400 `--text-secondary`）、标签 chip、更新时间、置顶/归档 icon
- **悬浮效果**：`transform: translateY(-2px)` + `box-shadow: var(--shadow-md)`，点击展开详情

**桌面端 Electron 差异**（仅交互层）：
- 支持 `Ctrl/Cmd+N` 新建笔记快捷键
- 卡片右键菜单：编辑、置顶、归档、删除、复制 Markdown
- 顶部菜单栏可扩展「笔记」菜单（File > New Note / Export All）

#### 1.2 移动端 H5 / App 端（≤768px）

```
┌──────────────────────┐
│ TopBar [¥ WT] ☰ 头像  │  ← 52px 高度
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ 投资笔记           │ │  ← 页面大标题 20px
│ │ Notes & Insights  │ │  ← 副标题 10px eyebrow
│ └──────────────────┘ │
│                      │
│ ┌─ 横向胶囊导航 ───┐ │  ← 4 个分类水平滑动
│ │ 认知·决策·复盘·资料│ │     overflow-x: auto
│ └──────────────────┘ │
│                      │
│ ┌─ 搜索 + 新建 ────┐ │
│ │ 🔍 [搜索…] [＋]  │ │  ← 搜索框 + 浮动新建按钮
│ └──────────────────┘ │
│                      │
│ ┌─ 笔记卡片 ──────┐ │
│ │ 📌 标题          │ │
│ │ 摘要内容…        │ │  ← 圆角 16px 卡片
│ │ 标签 · 2小时前    │ │
│ │ [操作图标]        │ │
│ └──────────────────┘ │
│                      │
│ ┌─ 笔记卡片 ──────┐ │
│ │ 标题             │ │
│ │ 摘要内容…        │ │
│ │ 标签 · 昨天       │ │
│ └──────────────────┘ │
│                      │
├──────────────────────┤
│ 🏠  📋  💼  🤖  📝   │  ← 底部 Tab Bar 68px
│ 总览  资产  持仓  智研 笔记│     safe-area
└──────────────────────┘
```

**布局规格**：
- **页面标题**：`.section-eyebrow`（10px 字间距 0.24em） + `.section-title`（20px/700）
- **二级 Tab**：横向滚动胶囊，单个胶囊 `padding: 8px 16px; min-height: 36px;` 触摸目标 ≥44px 包含整个胶囊 padding 区域
- **搜索框**：`.ant-input` 高度 48px，圆角 12px，固定在页面顶部
- **新建按钮**：浮动按钮（FAB）右下角 `position: fixed; bottom: 88px; right: 16px;` 圆形 56×56，金色 `--brand-500`
- **卡片列表**：单列垂直堆叠，gap 12px
  - 卡片 padding 16px，圆角 16px
  - 标题 14px/600，摘要 12px/400（最多 3 行）
  - 长按卡片弹出操作菜单（置顶/归档/删除）
- **底部 Tab Bar**：扩展为 5 个（投资笔记作为第 5 个），单 Tab `flex: 1; min-height: 44px;`
- **下拉刷新**：顶部下拉触发重新拉取笔记列表
- **滑动操作**：卡片左滑显示「归档」「删除」按钮（参考 iOS Mail 设计）

#### 1.3 平板端（769px – 1023px）
- 卡片网格 2 列（介于手机 1 列和桌面 3 列之间）
- 二级子 Tab 与桌面端一致
- 编辑器弹窗居中显示（不像手机全屏）

---

### 二、笔记编辑器（块编辑器 Tiptap）布局

#### 2.1 网页端 / 桌面端（≥1024px）

```
┌───────────────────── 笔记编辑器弹窗（Modal）─────────────────────┐
│  [← 返回]  新建/编辑笔记                       [⋯更多]  [✓ 保存]  │  ← Header 60px
├──────────────────────────────────────────────────────────────────┤
│ ┌─── 工具栏 ─────────────────────────────────────────────────┐   │
│ │  H1 H2 H3 │ B I U │ • ─ 1. │ [ ] │ ❝ │ </> │ — │ 📷 链接 │  │  ← Toolbar 44px
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── 编辑区 ─────────────────────────────────────────────┐    │
│  │ 笔记标题（placeholder: 笔记标题…）                       │    │  ← 标题输入
│  │ ───────────────────────────────────────────────────     │    │
│  │ 块 1: 段落（块级 hover 出现「⋮」「+」）                  │    │
│  │ 块 2: H2 标题                                            │    │
│  │ 块 3: 列表项                                             │    │
│  │ 块 4: 引用块                                             │    │
│  │ 块 N: [+] 添加块（命令面板或菜单）                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─── 元数据侧栏（可选，桌面端 ≥1440px 显示） ───────────┐      │
│  │ 分类: 投资认知 ▼                                        │      │
│  │ 标签: #价值投资  #长期持有                              │      │
│  │ 关联持仓: 茅台 600519 [×]                                │      │
│  │ 置顶 ☐  归档 ☐                                          │      │
│  │ 字数: 1234  最后保存: 14:23:45                          │      │
│  └─────────────────────────────────────────────────────────┘      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**布局规格**：
- **弹窗尺寸**：宽度 720px（≥1024px），高度自适应，最大 85vh
- **标题输入**：32px/700 大号 placeholder
- **工具栏**：固定在编辑区顶部，圆角胶囊按钮，每个 `padding: 6px 10px;` 触摸目标 32px
- **块级控件**：鼠标悬浮块左侧出现「⋮」拖拽手柄 +「+」添加按钮
- **元数据侧栏**：≥1440px 时左右双栏（编辑区 60% + 元数据 40%）；1024-1439px 单栏，元数据折叠到顶部下拉
- **自动保存指示器**：标题栏右侧显示「保存于 14:23:45」+ 状态点
- **快捷键**（桌面端 Electron）：
  - `Cmd/Ctrl+B` 加粗、`Cmd/Ctrl+I` 斜体、`Cmd/Ctrl+K` 插入链接
  - `Cmd/Ctrl+S` 立即保存（不依赖 1.5s 防抖）
  - `Cmd/Ctrl+Enter` 提交

#### 2.2 移动端 H5 / App 端（≤768px）

```
┌──────────────────────────┐
│ ←  笔记编辑        [✓]   │  ← TopBar 52px（粘性）
├──────────────────────────┤
│ ┌─ 标题 ───────────────┐ │
│ │ 笔记标题（点击输入）   │ │  ← 28px/700
│ └───────────────────────┘ │
│ ┌─ 工具栏（横滑） ─────┐ │
│ │ ⫶  𝓗  B  I  U  • ─  │ │  ← 横向滚动触摸工具栏
│ │ [ ]  ❝  </>  🔗  ⋯  │ │     单按钮 44×44
│ └───────────────────────┘ │
│                          │
│ ┌─ 块编辑区（全屏） ───┐ │
│ │ 段落…                │ │
│ │                      │ │
│ │ [+] 添加块（FAB）    │ │  ← 浮动按钮 56×56
│ │                      │ │
│ │ 块 2: 列表           │ │
│ │ 块 3: 引用           │ │
│ └───────────────────────┘ │
│                          │
│ ┌─ 元数据（底部 Sheet）┐ │  ← 抽屉式上拉
│ │ 分类 / 标签 / 关联…  │ │     从底部弹出
│ └───────────────────────┘ │
│                          │
├──────────────────────────┤
│ 🏠  📋  💼  🤖  📝       │  ← 底部 Tab
└──────────────────────────┘
```

**布局规格**：
- **全屏编辑**：移动端用 `Drawer` 抽屉代替 Modal，从底部弹出，全屏
- **标题区**：28px/700 输入框，无 placeholder，使用 `contenteditable` 模拟
- **工具栏**：
  - 横向 `overflow-x: auto`，可滑动
  - 单按钮 `min-width: 44px; min-height: 44px;`（Apple HIG 标准）
  - 仅展示高频工具：H、粗体、斜体、列表、引用、链接、`⋯ 更多`
  - 高级工具（代码块、分隔线）藏在 `⋯` 弹出的二级菜单
- **块编辑**：
  - 字体 16px（避免 iOS 缩放）
  - 段落行高 1.6
  - 双指捏合缩放编辑区
  - 块级点击展开键盘工具栏
- **元数据抽屉**：
  - 浮层 Sheet 从底部弹出（类似 iOS Form Sheet）
  - 高度 60vh，背景模糊 `backdrop-filter: blur(20px)`
  - 分类用 `Picker` 选择器，标签用 Chip 输入
- **键盘适配**：
  - 监听 `keyboardWillShow` / `keyboardWillHide`，自动上推编辑区
  - 工具栏悬浮在键盘上方
  - 「完成」按钮代替「保存」按钮（避免歧义）

#### 2.3 通用编辑器样式
- **块类型**：`paragraph` / `heading 1-3` / `bulletList` / `orderedList` / `todoList` / `blockquote` / `codeBlock` / `divider` / `image`
- **主题色**：编辑聚焦边框 `var(--brand-500)`，块拖拽手柄 `var(--text-tertiary)`
- **字号**：标题 H1 28px / H2 22px / H3 18px，正文 16px
- **行高**：1.6，段落间距 12px
- **代码块**：`font-family: var(--font-mono);` 浅灰背景 `var(--app-bg)`

---

### 三、持仓交易记录时间线 `TradeRecordTimeline` 布局

#### 3.1 网页端 / 桌面端（≥1024px）

```
┌─── 贵州茅台 600519 · 交易记录 ───────────────────────────────┐
│                                              [＋ 追加交易记录] │
├────────────────────────────────────────────────────────────┤
│  ●━━━ 2026-07-20 14:30  买入 100股 @ ¥1680.50             │  ← 最新
│  │     理由: 业绩超预期 + 龙头估值修复                      │
│  │     目标: ¥1900   止损: ¥1600   持有: 中线                │
│  │     市场环境: 7月CPI回落, 流动性宽松                       │
│  │                                              [编辑] [删除] │
│  │                                                          │
│  ●━━━ 2026-05-10 10:15  买入 50股 @ ¥1620.00               │
│  │     理由: 首次建仓                                       │
│  │     ...                                                  │
│  │                                                          │
│  ●━━━ 2026-03-01 09:30  卖出 30股 @ ¥1750.00              │  ← 历史
│  │     理由: 短线止盈，剩余持仓继续持有                       │
│  │     ...                                                  │
└────────────────────────────────────────────────────────────┘
```

**布局规格**：
- **时间线样式**：左侧 2px 渐变竖线（`--brand-500` → `transparent`），每个节点 8px 圆点
- **操作类型 chip**：
  - 买入：`background: rgba(214, 59, 59, 0.1); color: var(--up);`（红涨）
  - 卖出：`background: rgba(30, 155, 126, 0.1); color: var(--down);`（绿跌）
- **记录卡片**：每条 `padding: 16px 20px;` 圆角 12px，背景 `rgba(255,255,255,0.6)`
- **字段布局**：
  - 第一行：时间 + 操作 + 价格（等宽数字）
  - 第二行：理由（多行文本，最多 3 行折叠）
  - 第三行：目标/止损/持有周期（小字 chip 排列）
  - 第四行：市场环境（折叠展开）
- **悬浮**：鼠标悬浮显示「编辑」「删除」按钮（绝对定位右上角）
- **排序**：时间倒序（最新在最上）

#### 3.2 移动端 H5 / App 端（≤768px）

```
┌──────────────────────────────┐
│  贵州茅台 600519 · 交易记录    │
│               [＋ 追加]      │  ← 48px 按钮
├──────────────────────────────┤
│  ●━━ 07-20 14:30  买入       │
│  │   100股 @ ¥1680.50         │  ← 紧凑型
│  │   业绩超预期 + 龙头估值     │
│  │   [目标] [止损] [中线]      │  ← chip
│  │   [展开 ▼]                  │  ← 折叠市场环境
│                              │
│  ●━━ 05-10 10:15  买入       │
│  │   50股 @ ¥1620.00         │
│  │   ...                     │
│                              │
│  ●━━ 03-01 09:30  卖出       │
│  │   30股 @ ¥1750.00         │
└──────────────────────────────┘
```

**布局规格**：
- **单列垂直卡片**，每条 8px 圆点 + 12px 缩进
- **元数据折叠**：默认显示 3 个 chip（目标/止损/持有），市场环境点击「展开 ▼」显示
- **操作**：长按弹出 ActionSheet（编辑/删除/复制理由）
- **空状态**：插画 + 提示「还没有交易记录，点击右上角添加」
- **加载**：下拉刷新 + 骨架屏

---

### 四、持仓添加表单 `AddAssetModal` 改造

#### 4.1 桌面端（≥1024px）

```
┌─ 添加持仓 ──────────────────────────────────────────┐
│                                                      │
│  ┌─ 基础信息 ──────────┐ ┌─ 买入逻辑（新增） ──────┐ │
│  │ 标的: [600519 茅台]  │ │ 买入理由:              │ │
│  │ 持仓数量: [100]      │ │ ┌─────────────────┐    │ │
│  │ 成本价: [1680.50]    │ │ │ TextArea 多行    │    │ │
│  │ 当前价: [1720.00]    │ │ │ 必填             │    │ │
│  │ 货币: [CNY ▼]        │ │ └─────────────────┘    │ │
│  │ 分组: [白酒 ▼]        │ │ 目标价位: [1900.00]   │ │
│  └──────────────────────┘ │ 止损价位: [1600.00]   │ │
│                           │ 持有周期: ◉短线 中线 长线│ │
│                           │ 市场环境:              │ │
│                           │ ┌─────────────────┐    │ │
│                           │ │ TextArea 选填    │    │ │
│                           │ └─────────────────┘    │ │
│                           └────────────────────────┘ │
│                                                      │
│                              [取消]      [✓ 添加]    │
└──────────────────────────────────────────────────────┘
```

**布局规格**：
- **双栏布局**：左栏 50% 基础信息（已有字段），右栏 50% 买入逻辑（新增字段）
- **右栏字段顺序**：
  1. 买入理由（必填，红星标记）
  2. 目标价位（InputNumber，前缀 ¥）
  3. 止损价位（InputNumber，前缀 ¥）
  4. 持有周期（Radio.Group 水平）
  5. 市场环境（TextArea 3 行，选填）
- **保存**：与基础信息一起提交
- **数据关联**：自动创建第一条 `position_trade_records`（action='buy'，时间戳 = 添加时间）

#### 4.2 移动端 H5 / App 端（≤768px）

```
┌──────────────────────────┐
│ ← 添加持仓        [保存]   │  ← TopBar
├──────────────────────────┤
│ ▼ 基础信息               │  ← 折叠分组
│   标的: [搜索股票…]       │
│   数量: [100]            │
│   成本: [1680.50]        │
│   ...                    │
│                          │
│ ▼ 买入逻辑（新）          │  ← 默认展开
│   买入理由 *              │
│   ┌──────────────────┐  │
│   │                  │  │
│   │                  │  │
│   └──────────────────┘  │
│   目标: [1900]  止损: [1600]│  ← 并排
│   周期: ◉短线 ○中 ○长    │
│   市场环境:               │
│   ┌──────────────────┐  │
│   │                  │  │
│   └──────────────────┘  │
│                          │
├──────────────────────────┤
│ [取消]         [✓ 添加]   │  ← 底部固定按钮 56px
└──────────────────────────┘
```

**布局规格**：
- **垂直分组**：「基础信息」默认折叠，「买入逻辑」默认展开
- **触摸目标**：所有输入框 `min-height: 48px;` 按钮 `min-height: 56px;`
- **目标/止损并排**：使用 `Row` + `Col`（xs=24 sm=12）节省空间
- **键盘弹起**：页面自动滚动到当前聚焦输入框
- **保存**：右滑手势提交，或点底部「保存」按钮

---

### 五、关键交互组件的三端差异

| 组件 | 网页端/桌面端 | 移动端 H5/App |
|------|--------------|--------------|
| **新增笔记** | 居中 Modal 720px | 底部 Drawer 全屏 |
| **笔记详情查看** | Modal 800px | 全屏页面（路由跳转） |
| **追加交易记录** | 居中 Modal 560px | 底部 Drawer 90vh |
| **持仓详情** | 右侧抽屉 Drawer 600px | 全屏页面 |
| **添加学习资料** | 居中 Modal 480px | 底部 Sheet 70vh |
| **搜索过滤** | 顶部固定搜索框 + Dropdown | 顶部搜索框 + 弹出筛选 Sheet |
| **删除确认** | Popconfirm 气泡 | ActionSheet + AlertDialog |
| **日期选择** | DatePicker 内嵌 | 底部 Sheet 弹出 |
| **拖拽排序** | HTML5 drag-and-drop | 长按拖拽 + 振动反馈 |
| **键盘快捷键** | Cmd/Cmd+N/S/K 等 | 无（用底部工具栏代替） |
| **右键菜单** | 桌面端支持 | 无（用长按代替） |
| **Toast 提示** | message.success() 顶部 | 自定义底部 Snackbar |

---

### 六、CSS 类命名规范（新增）

在 `src/renderer/index.css` 中新增以下类，保持与现有命名风格一致：

```css
/* 投资笔记主页面 */
.notes-page { ... }            /* 根容器 */
.notes-sub-tabs { ... }        /* 二级子 Tab 容器 */
.notes-search-bar { ... }      /* 搜索条 */
.notes-card-grid { ... }       /* 卡片网格 */
.notes-card { ... }            /* 单张笔记卡片 */
.notes-card-pinned { ... }     /* 置顶样式变体 */

/* 块编辑器 */
.block-editor { ... }
.block-editor-toolbar { ... }
.block-editor-content { ... }
.block-editor-fab { ... }      /* 移动端浮动添加按钮 */

/* 持仓交易记录 */
.trade-timeline { ... }
.trade-timeline-item { ... }
.trade-timeline-dot { ... }
.trade-timeline-action-buy { ... }
.trade-timeline-action-sell { ... }

/* 移动端 Sheet */
.bottom-sheet { ... }
.bottom-sheet-handle { ... }
.bottom-sheet-content { ... }

/* 浮动操作按钮 */
.fab { ... }
.fab-primary { ... }
```

### 七、CSS 媒体查询补充

在 `@media (max-width: 768px)` 块中追加：

```css
@media (max-width: 768px) {
  .notes-page { padding: 12px 14px calc(68px + env(safe-area-inset-bottom)); }
  .notes-sub-tabs { 
    overflow-x: auto; 
    flex-wrap: nowrap;
    padding: 0 14px;
    margin: 0 -14px 12px;
  }
  .notes-card-grid { grid-template-columns: 1fr; gap: 12px; }
  .notes-card { padding: 16px; border-radius: 16px; }
  .block-editor { padding: 0; }
  .block-editor-toolbar {
    position: sticky;
    top: 52px;
    z-index: 10;
    overflow-x: auto;
  }
  .trade-timeline { padding: 14px; }
  .fab {
    position: fixed;
    bottom: calc(80px + env(safe-area-inset-bottom));
    right: 16px;
    width: 56px; height: 56px;
    border-radius: 50%;
  }
}
```

---

## Technical Design (高层架构)

### 数据模型（D1 表）

**notes** - 认知笔记
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cognition',  -- cognition/trade/review/learning
  title TEXT,
  content_json TEXT NOT NULL,  -- 块编辑器 JSON
  content_text TEXT,            -- 纯文本（搜索用）
  tags TEXT,                    -- 逗号分隔
  is_pinned INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  related_holding_id TEXT,      -- 可选关联
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_notes_user ON notes(user_email, category, updated_at);
```

**position_trade_records** - 持仓交易决策记录
```sql
CREATE TABLE position_trade_records (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  holding_id TEXT NOT NULL,
  action TEXT NOT NULL,         -- buy/sell
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  reason TEXT NOT NULL,         -- 决策理由
  target_price REAL,            -- 目标价
  stop_loss_price REAL,         -- 止损价
  holding_period TEXT,          -- short/mid/long
  market_context TEXT,          -- 市场环境
  record_time TEXT NOT NULL,    -- 用户填写的时间
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ptr_user_holding ON position_trade_records(user_email, holding_id, record_time DESC);
```

**position_review_notes** - 持仓复盘笔记
```sql
CREATE TABLE position_review_notes (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  holding_id TEXT NOT NULL,
  content_json TEXT NOT NULL,
  content_text TEXT,
  price_snapshot REAL,          -- 当时价格
  profit_pct_snapshot REAL,     -- 当时盈亏
  created_at TEXT NOT NULL
);
CREATE INDEX idx_prn_user_holding ON position_review_notes(user_email, holding_id, created_at DESC);
```

**learning_resources** - 学习资料收藏
```sql
CREATE TABLE learning_resources (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,           -- report/book/article/video/other
  tags TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_lr_user ON learning_resources(user_email, type);
```

### 块编辑器选型
- 使用 **Tiptap**（基于 ProseMirror），体积小（约 200KB gzip），支持扩展
- 块类型通过 Tiptap StarterKit + 自定义扩展实现
- 内容以 JSON 存储，前端用 `content_json` 字段渲染
- **三端适配**：
  - 桌面端：完整工具栏 + 元数据侧栏
  - 移动端：精简工具栏 + 底部 Sheet
  - 通过响应式 CSS + `useMediaQuery` hook 切换

### 同步策略
- 笔记数据走 D1 + localStorage 双写
- 网络失败时只写 localStorage，恢复后批量同步
- 用 Zustand store 管理本地状态，提供离线优先体验
- 移动端特殊处理：App 切后台时立即 flush 待同步数据

### Capacitor App 兼容性
- 编辑器在 WebView 中正常渲染（已验证 Tiptap 兼容）
- 块编辑器触摸事件用 `touchstart` + `touchend`（避免 300ms 延迟）
- 软键盘弹出时，编辑区自动上推
- 浮动按钮避让底部 Tab Bar（68px + safe-area）

---

## REMOVED Requirements
无
