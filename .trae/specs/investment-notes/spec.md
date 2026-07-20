# 投资笔记模块 Spec

## Why
当前系统只记录持仓的成本和数量，缺乏**投资决策上下文**的记录。投资者在买入/卖出时通常有强烈的逻辑判断（理由、目标价、止损位、市场环境），但事后无法回溯，导致无法系统化复盘和迭代投资能力。新增「投资笔记」模块，让每一次决策都可追溯、可复盘，帮助用户从"凭感觉交易"升级为"有据可查的体系化投资"。

## What Changes
- 新增独立 Tab 页面「**投资笔记**」，作为第五个主 Tab
- 笔记分为 4 大类：
  1. **投资认知积累**：投资理念、市场观察、心得体会的块编辑器笔记
  2. **个股交易决策笔记**：每次买入/卖出时的决策记录（绑定到具体持仓）
  3. **持仓复盘笔记**：持有期内的跟踪笔记（绑定到具体持仓）
  4. **投资学习资料收藏**：研报、书籍、文章链接收藏
- 持仓添加/编辑表单新增「**买入逻辑**」字段（买入理由、目标价位、止损位、持有周期、买入时市场环境），并支持**按时间戳追加多条**（后续加仓时记录新的逻辑）
- 三端同步：网页端 / 桌面端 / 移动端 H5 内容完全一致
- 数据后端持久化到 D1，三端共享

## Impact
- **Affected specs**: 持仓管理、资产管理、Tab 导航结构、用户偏好
- **Affected code**:
  - `src/pages/Dashboard.tsx`（新增 Tab）
  - `src/stores/`（新增 notesStore, positionNoteStore）
  - `src/types/`（新增 Note, PositionNote, LearningResource 类型）
  - `src/components/AddAssetModal.tsx`（买入逻辑字段）
  - `src/components/HoldingList.tsx`（显示笔记入口）
  - `functions/api/notes/`（新增笔记 CRUD API）
  - `functions/api/position-notes/`（新增持仓决策笔记 API）
  - `functions/api/learning-resources/`（新增学习资料收藏 API）
  - D1 表：`notes`、`position_notes`、`position_trade_records`、`learning_resources`

## ADDED Requirements

### Requirement: 投资笔记页面（Investment Notes Page）
系统 SHALL 提供一个独立 Tab「投资笔记」，按 4 大类组织内容。

#### Scenario: 进入笔记页
- **WHEN** 用户点击底部 Tab 栏的「投资笔记」
- **THEN** 显示 4 个子 Tab 或分组切换：投资认知、交易决策、持仓复盘、学习资料
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
- **AND** 每条记录显示：时间、操作类型（买/卖）、价格、数量、决策理由

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
- **THEN** 弹出表单，填写：
  - 标题（必填）
  - 链接（URL）
  - 类型（研报/书籍/文章/视频/其他）
  - 标签（多个）
  - 备注（可选）
- **AND** 保存到 learning_resources 表

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
- **AND** 表单提交时，这些字段一起入库

#### Scenario: 移动端添加持仓
- **WHEN** 用户在手机端打开添加持仓表单
- **THEN** 买入逻辑字段与桌面端一致
- **AND** 触摸目标 ≥ 44px
- **AND** 表单分段折叠，简化输入

### Requirement: 三端同步
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

## REMOVED Requirements
无

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

### 同步策略
- 笔记数据走 D1 + localStorage 双写
- 网络失败时只写 localStorage，恢复后批量同步
- 用 Zustand store 管理本地状态，提供离线优先体验
