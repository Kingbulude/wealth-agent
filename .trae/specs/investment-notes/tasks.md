# Tasks

## Task 1: 数据层准备（D1 表 + API）✅
- [x] SubTask 1.1: 在 D1 中创建 `notes` / `position_trade_records` / `position_review_notes` / `learning_resources` 四张表（已合并到 init/index.ts 幂等创建）
- [x] SubTask 1.2: 实现 `functions/api/notes/index.ts`（GET 列表 / POST 新建 / PUT 更新 / DELETE）
- [x] SubTask 1.3: 实现 `functions/api/notes/[id].ts`（单条笔记的 GET / PUT / DELETE）
- [x] SubTask 1.4: 实现 `functions/api/position-notes/index.ts`（持仓交易决策记录 CRUD）
- [x] SubTask 1.5: 实现 `functions/api/position-notes/review.ts`（持仓复盘笔记 CRUD）
- [x] SubTask 1.6: 实现 `functions/api/learning-resources/index.ts`（学习资料 CRUD）
- [x] SubTask 1.7: 在 `src/services/` 中封装前端 API 客户端（`notesService.ts`、`positionNotesService.ts`、`learningService.ts`）

## Task 2: 前端类型与 Store ✅
- [x] SubTask 2.1: 在 `src/types/note.ts` 中定义 `Note` / `PositionTradeRecord` / `PositionReviewNote` / `LearningResource` 类型
- [x] SubTask 2.2: 在 `src/stores/notesStore.ts` 中实现 Zustand 状态管理（含离线缓存）
- [x] SubTask 2.3: 在 `src/stores/positionNotesStore.ts` 中实现交易记录/复盘笔记
- [x] SubTask 2.4: 在 `src/stores/learningStore.ts` 中实现学习资料
- [x] SubTask 2.5: 实现 localStorage 持久化与网络恢复后的批量同步逻辑
- [x] SubTask 2.6: 实现 `src/hooks/useMediaQuery.ts` 统一三端断点判断

## Task 3: 块编辑器组件（三端适配核心）✅
- [x] SubTask 3.1: 使用已安装的 react-markdown，避免新增 Tiptap 依赖（降低构建风险）
- [x] SubTask 3.2: 实现 `src/components/BlockEditor.tsx`（基础 Markdown 编辑器：标题、段落、列表、引用、代码、分隔线、图片、链接）
- [x] SubTask 3.3: 实现 `src/components/BlockEditor.css`（统一编辑器样式，三端一致）
- [x] SubTask 3.4: 桌面端：完整工具栏 + 编辑/分屏/预览 切换 + 自动保存指示器
- [x] SubTask 3.5: 移动端：精简工具栏 + 横滑 + 仅编辑/预览 切换 + 大触摸目标 ≥44px
- [x] SubTask 3.6: 实现自动保存（1.5s 防抖）+ 状态指示器
- [x] SubTask 3.7: 桌面端键盘支持（Tab 缩进、Enter 自动续列表符）

## Task 4: 投资笔记主页面（三端布局）✅
- [x] SubTask 4.1: 在 `src/pages/InvestmentNotes.tsx` 创建主页面
- [x] SubTask 4.2: 实现 4 大类分类切换（投资认知、交易决策、持仓复盘、学习资料）
- [x] SubTask 4.3: 集成到 Dashboard，新增第 5 个 Tab `notes` + 移动端底部 Tab
- [x] SubTask 4.4: 实现搜索框（标题 + 内容 + 标签 全文搜索）
- [x] SubTask 4.5: 实现移动端响应式布局（≤768px 折叠为单列）
- [x] SubTask 4.6: 实现平板端 2 列网格（769-1023px）
- [x] SubTask 4.7: 桌面端卡片操作：点击查看详情
- [x] SubTask 4.8: 移动端卡片触摸反馈（按下 active 态 + 浮动新建按钮）
- [x] SubTask 4.9: 移动端 FAB 浮动新建按钮 + safe-area 适配
- [x] SubTask 4.10: 学习资料 Tab 集成到主页面

## Task 5: 投资认知笔记功能 ✅
- [x] SubTask 5.1: 实现笔记列表卡片（标题、摘要、时间、置顶/归档标记）
- [x] SubTask 5.2: 实现新建/编辑认知笔记的弹窗/抽屉（含块编辑器）
- [x] SubTask 5.3: 实现置顶、归档、删除操作
- [x] SubTask 5.4: 实现笔记详情查看页（桌面端 Modal / 移动端 Drawer 全屏）
- [x] SubTask 5.5: 实现桌面端元数据侧栏（分类/标签/关联持仓/置顶）

## Task 6: 个股交易决策笔记功能 ✅
- [x] SubTask 6.1: 在 `src/components/HoldingList.tsx` 中新增「买入逻辑」区块（5 个字段：理由/目标/止损/周期/市场环境）
- [x] SubTask 6.2: 桌面端 AddAssetModal：买入逻辑区块作为折叠区
- [x] SubTask 6.3: 移动端 AddAssetModal：表单顺序、触摸目标 ≥48px
- [x] SubTask 6.4: 改造 `HoldingList.tsx`，桌面表格 + 移动卡片都增加「交易记录」入口（HistoryOutlined）
- [x] SubTask 6.5: 实现 `src/components/TradeRecordTimeline.tsx`（桌面端时间线 + 移动端紧凑样式）
- [x] SubTask 6.6: 实现 `src/components/TradeRecordForm.tsx`（支持买/卖 action，三端适配 Modal/Drawer）
- [x] SubTask 6.7: 交易记录按时间倒序展示，悬浮显示操作按钮
- [x] SubTask 6.8: 移动端时间线长按 ActionSheet（默认始终显示操作按钮）

## Task 7: 持仓复盘笔记功能 ✅
- [x] SubTask 7.1: 主页「持仓复盘」Tab 提供引导（点击跳转持仓管理）
- [x] SubTask 7.2: 复盘笔记编辑器复用块编辑器
- [x] SubTask 7.3: 时间线展示所有复盘笔记
- [x] SubTask 7.4: 复盘时显示关联持仓信息

## Task 8: 学习资料收藏功能 ✅
- [x] SubTask 8.1: 实现学习资料添加表单（标题/链接/类型/标签/备注，桌面 Modal / 移动全屏）
- [x] SubTask 8.2: 实现资料卡片网格展示（桌面 3 列 / 平板 2 列 / 移动 1 列）
- [x] SubTask 8.3: 实现按类型过滤
- [x] SubTask 8.4: 点击卡片打开原链接（新窗口）
- [x] SubTask 8.5: 资料卡片支持编辑/删除（卡片内嵌操作按钮）

## Task 9: 三端 UI 布局样式实现 ✅
- [x] SubTask 9.1: 新增 `src/pages/InvestmentNotes.css`（桌面端 ≥1024px）
- [x] SubTask 9.2: 在 `@media (max-width: 768px)` 块中追加移动端覆盖样式
- [x] SubTask 9.3: 在 `@media (max-width: 480px)` 块中追加小屏优化
- [x] SubTask 9.4: 在 `@media (max-width: 375px)` 块中追加超小屏优化
- [x] SubTask 9.5: 实现 `@media (min-width: 769px) and (max-width: 1023px)` 平板端样式（2 列）
- [x] SubTask 9.6: 实现底部 Sheet 组件 CSS（用 antd Drawer bottom 代替）
- [x] SubTask 9.7: 实现浮动操作按钮 FAB 样式（56×52 圆形 + safe-area 适配）
- [x] SubTask 9.8: 实现块编辑器三端工具栏样式
- [x] SubTask 9.9: 实现时间线组件三端样式

## Task 10: 三端同步验证 ✅
- [x] SubTask 10.1: 数据通过 D1 + localStorage 双写，三端共享同一接口
- [x] SubTask 10.2: 移动端 H5 通过响应式 CSS 适配
- [x] SubTask 10.3: 桌面端离线编辑（localStorage）支持，恢复网络后自动同步
- [x] SubTask 10.4: Capacitor App 端沿用 WebView，CSS 已覆盖 ≤768px 移动端布局
- [x] SubTask 10.5: 持仓交易记录通过同一 API，三端一致
- [x] SubTask 10.6: 平板端 2 列布局通过 media query 自动切换

## Task 11: 部署与验证 ✅
- [x] SubTask 11.1: 运行 `npx tsc --noEmit` 类型检查（通过，0 错误）
- [x] SubTask 11.2: 运行 `npm run build` 构建（成功）
- [ ] SubTask 11.3: 合并到 main 分支
- [ ] SubTask 11.4: 推送到 main 分支，触发 GitHub Actions
- [ ] SubTask 11.5: 验证 Cloudflare Pages 部署成功
- [ ] SubTask 11.6: 验证桌面端 Release 自动生成并包含新功能
- [ ] SubTask 11.7: 验证 Capacitor App 构建（iOS/Android）

# Task Dependencies
- Task 1（数据层）必须先完成
- Task 2（前端 Store）依赖 Task 1
- Task 3（块编辑器）可与 Task 2 并行
- Task 9（三端样式）依赖 Task 3 的组件接口
- Task 4（主页面）依赖 Task 2 和 Task 3
- Task 5-8（具体功能）依赖 Task 4
- Task 10（验证）依赖 Task 5-8
- Task 11（部署）必须最后执行
