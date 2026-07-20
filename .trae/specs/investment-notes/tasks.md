# Tasks

## Task 1: 数据层准备（D1 表 + API）
- [ ] SubTask 1.1: 在 D1 中创建 `notes` / `position_trade_records` / `learning_resources` 三张表（提供 SQL 脚本给用户执行）
- [ ] SubTask 1.2: 实现 `functions/api/notes/index.ts`（GET 列表 / POST 新建 / PUT 更新 / DELETE）
- [ ] SubTask 1.3: 实现 `functions/api/notes/[id].ts`（单条笔记的 GET / PUT / DELETE）
- [ ] SubTask 1.4: 实现 `functions/api/position-notes/index.ts`（持仓交易决策记录 CRUD）
- [ ] SubTask 1.5: 实现 `functions/api/learning-resources/index.ts`（学习资料 CRUD）
- [ ] SubTask 1.6: 在 `src/services/` 中封装前端 API 客户端（`notesService.ts`、`positionNotesService.ts`、`learningService.ts`）

## Task 2: 前端类型与 Store
- [ ] SubTask 2.1: 在 `src/types/` 中定义 `Note` / `PositionTradeRecord` / `LearningResource` 类型
- [ ] SubTask 2.2: 在 `src/stores/` 中实现 `notesStore.ts`（Zustand 状态管理，含离线缓存）
- [ ] SubTask 2.3: 在 `src/stores/` 中实现 `positionNotesStore.ts`
- [ ] SubTask 2.4: 在 `src/stores/` 中实现 `learningStore.ts`
- [ ] SubTask 2.5: 实现 localStorage 持久化与网络恢复后的批量同步逻辑

## Task 3: 块编辑器组件
- [ ] SubTask 3.1: 安装 Tiptap 依赖（`@tiptap/react`、`@tiptap/starter-kit`、必要扩展）
- [ ] SubTask 3.2: 实现 `src/components/BlockEditor.tsx`（基础块编辑器：标题、段落、列表、引用、代码、分隔线）
- [ ] SubTask 3.3: 实现 `src/components/BlockEditor.css`（统一编辑器样式，三端一致）
- [ ] SubTask 3.4: 实现自动保存（1.5s 防抖）

## Task 4: 投资笔记主页面
- [ ] SubTask 4.1: 在 `src/pages/` 中创建 `InvestmentNotes.tsx`（主页面）
- [ ] SubTask 4.2: 实现 4 大类分类切换（投资认知、交易决策、持仓复盘、学习资料）
- [ ] SubTask 4.3: 集成到 Dashboard，新增第 5 个 Tab
- [ ] SubTask 4.4: 实现搜索框（标题 + 全文搜索）
- [ ] SubTask 4.5: 实现移动端响应式布局（≤768px 折叠为单列）

## Task 5: 投资认知笔记功能
- [ ] SubTask 5.1: 实现笔记列表卡片（标题、摘要、时间、置顶/归档标记）
- [ ] SubTask 5.2: 实现新建/编辑认知笔记的弹窗（含块编辑器）
- [ ] SubTask 5.3: 实现置顶、归档、删除操作
- [ ] SubTask 5.4: 实现笔记详情查看页（只读模式）

## Task 6: 个股交易决策笔记功能
- [ ] SubTask 6.1: 在 `src/components/AddAssetModal.tsx` 中新增「买入逻辑」区块（5 个字段）
- [ ] SubTask 6.2: 改造 `HoldingList.tsx`，增加「交易记录」入口
- [ ] SubTask 6.3: 实现「追加交易记录」表单（支持买/卖两种 action）
- [ ] SubTask 6.4: 实现交易记录时间线展示（按时间倒序）
- [ ] SubTask 6.5: 在移动端同步显示

## Task 7: 持仓复盘笔记功能
- [ ] SubTask 7.1: 在持仓详情页增加「复盘笔记」Tab
- [ ] SubTask 7.2: 实现复盘笔记编辑器（关联块编辑器）
- [ ] SubTask 7.3: 记录当时价格、盈亏比例快照
- [ ] SubTask 7.4: 时间线展示所有复盘笔记
- [ ] SubTask 7.5: 对比首条买入逻辑与当前状态

## Task 8: 学习资料收藏功能
- [ ] SubTask 8.1: 实现学习资料添加表单（标题/链接/类型/标签/备注）
- [ ] SubTask 8.2: 实现资料卡片网格展示
- [ ] SubTask 8.3: 实现按类型/标签过滤
- [ ] SubTask 8.4: 点击卡片打开原链接（新窗口）

## Task 9: 三端同步验证
- [ ] SubTask 9.1: 网页端新增/编辑/删除笔记，桌面端登录同账号验证
- [ ] SubTask 9.2: 桌面端离线编辑，恢复网络后验证自动同步
- [ ] SubTask 9.3: 移动端 H5 验证布局和功能完整性
- [ ] SubTask 9.4: 验证持仓交易记录的三端一致性

## Task 10: 部署与验证
- [ ] SubTask 10.1: 运行 `npx tsc --noEmit` 类型检查
- [ ] SubTask 10.2: 运行 `npm run build` 构建
- [ ] SubTask 10.3: 推送到 main 分支，触发 GitHub Actions
- [ ] SubTask 10.4: 验证 Cloudflare Pages 部署成功
- [ ] SubTask 10.5: 验证桌面端 Release 自动生成并包含新功能

# Task Dependencies
- Task 1（数据层）必须先完成
- Task 2（前端 Store）依赖 Task 1
- Task 3（块编辑器）可与 Task 2 并行
- Task 4（主页面）依赖 Task 2 和 Task 3
- Task 5-8（具体功能）依赖 Task 4
- Task 9（验证）依赖 Task 5-8
- Task 10（部署）必须最后执行
