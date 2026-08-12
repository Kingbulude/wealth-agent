# Checklist - 投资笔记模块

## 数据层
- [ ] D1 已创建 `notes` / `position_trade_records` / `position_review_notes` / `learning_resources` 表
- [ ] 笔记 CRUD API 正常工作（GET/POST/PUT/DELETE）
- [ ] 持仓交易决策 API 正常工作
- [ ] 持仓复盘笔记 API 正常工作
- [ ] 学习资料 API 正常工作
- [ ] 所有 API 都有 JWT 鉴权

## 前端架构
- [ ] TypeScript 类型定义完整（Note / PositionTradeRecord / PositionReviewNote / LearningResource）
- [ ] Zustand Store 实现状态管理
- [ ] localStorage 持久化工作正常
- [ ] 网络恢复后批量同步未上传数据
- [ ] `useMediaQuery` hook 统一断点判断

## 块编辑器
- [ ] 支持标题（H1/H2/H3）
- [ ] 支持段落
- [ ] 支持有序/无序/待办列表
- [ ] 支持引用块
- [ ] 支持代码块
- [ ] 支持分隔线
- [ ] 支持图片
- [ ] 支持 Markdown 粘贴
- [ ] 自动保存（1.5s 防抖）+ 状态指示器
- [ ] 编辑器样式三端一致

## 投资笔记主页面
- [ ] Dashboard 增加第 5 个 Tab「投资笔记」
- [ ] 移动端底部 Tab 栏 5 个 Tab 显示正确
- [ ] 4 大类分类切换正常
- [ ] 搜索功能工作
- [ ] 桌面端 ≥1024px：3 列卡片网格
- [ ] 平板端 769-1023px：2 列卡片网格
- [ ] 移动端 ≤768px：单列卡片堆叠
- [ ] 桌面端卡片悬浮 transform + shadow 效果
- [ ] 移动端卡片触摸反馈（按下 scale 0.985）
- [ ] 桌面端 Cmd/Ctrl+N 快捷键新建笔记
- [ ] 桌面端卡片右键菜单
- [ ] 移动端长按操作菜单
- [ ] 移动端左滑删除手势
- [ ] 移动端 FAB 浮动新建按钮（56×56，金色，避让 Tab Bar + safe-area）
- [ ] 移动端下拉刷新
- [ ] 移动端空状态插画

## 投资认知笔记
- [ ] 笔记列表卡片展示
- [ ] 桌面端卡片 3 列网格
- [ ] 移动端卡片 1 列堆叠
- [ ] 桌面端新建：居中 Modal 720px
- [ ] 移动端新建：底部 Drawer 全屏
- [ ] 桌面端编辑：Modal + 元数据侧栏（≥1440px 显示）
- [ ] 移动端编辑：Drawer + 底部 Sheet 元数据
- [ ] 置顶功能
- [ ] 归档功能
- [ ] 删除功能
- [ ] 笔记详情查看（桌面 Modal / 移动全屏页面）
- [ ] 桌面端自动保存指示器「保存于 14:23:45」
- [ ] 桌面端快捷键（Cmd/Ctrl+B/I/K/S）工作

## 个股交易决策笔记
- [ ] 持仓添加表单新增「买入逻辑」5 字段
- [ ] 表单字段：买入理由、目标价位、止损价位、持有周期、市场环境
- [ ] 桌面端 AddAssetModal：双栏布局（基础信息 + 买入逻辑）
- [ ] 移动端 AddAssetModal：分组折叠（基础信息折叠 + 买入逻辑展开）
- [ ] 桌面端目标/止损：单列垂直排布
- [ ] 移动端目标/止损：Row/Col 并排节省空间
- [ ] 桌面端持有周期：Radio.Group 水平
- [ ] 移动端持有周期：Radio.Group 大按钮（44px 触摸目标）
- [ ] 持仓详情页「交易记录」入口
- [ ] 追加交易记录表单（桌面 Modal / 移动 Drawer 90vh）
- [ ] 桌面端时间线：2px 渐变竖线 + 8px 圆点 + 操作 chip（买入红/卖出绿）
- [ ] 移动端时间线：单列紧凑卡片，长按 ActionSheet
- [ ] 字段布局：时间/操作/价格 → 理由 → 目标止损持有 chip → 市场环境折叠
- [ ] 交易记录按时间倒序
- [ ] 鼠标悬浮显示「编辑」「删除」按钮
- [ ] 移动端空状态：插画 + 提示

## 持仓复盘笔记
- [ ] 持仓详情页「复盘笔记」Tab
- [ ] 复盘编辑器可用（关联块编辑器）
- [ ] 自动记录当时价格/盈亏快照
- [ ] 桌面端时间线展示（与交易记录样式一致）
- [ ] 移动端时间线紧凑展示
- [ ] 对比首条买入逻辑与当前状态（差异卡片）
- [ ] 复盘笔记自动保存

## 学习资料收藏
- [ ] 桌面端添加表单：居中 Modal 480px
- [ ] 移动端添加表单：底部 Sheet 70vh
- [ ] 桌面端卡片 3 列网格
- [ ] 平板端 2 列网格
- [ ] 移动端卡片 1 列
- [ ] 类型过滤（桌面 Dropdown / 移动 Sheet）
- [ ] 标签过滤
- [ ] 点击卡片打开原链接（新窗口）
- [ ] 移动端左滑删除

## 关键交互组件
- [ ] 新增笔记：桌面 Modal 720px / 移动 Drawer 全屏
- [ ] 笔记详情：桌面 Modal 800px / 移动全屏页面
- [ ] 追加交易：桌面 Modal 560px / 移动 Drawer 90vh
- [ ] 持仓详情：桌面右侧抽屉 600px / 移动全屏页面
- [ ] 添加学习资料：桌面 Modal 480px / 移动 Sheet 70vh
- [ ] 删除确认：桌面 Popconfirm / 移动 ActionSheet + AlertDialog
- [ ] 日期选择：桌面内嵌 / 移动 Sheet
- [ ] Toast：桌面顶部 / 移动底部 Snackbar

## CSS 样式规范
- [ ] `src/renderer/index.css` 新增 `.notes-page`、`.notes-sub-tabs`、`.notes-search-bar`、`.notes-card-grid`、`.notes-card`
- [ ] 新增 `.block-editor`、`.block-editor-toolbar`、`.block-editor-content`、`.block-editor-fab`
- [ ] 新增 `.trade-timeline`、`.trade-timeline-item`、`.trade-timeline-dot`、`.trade-timeline-action-buy/sell`
- [ ] 新增 `.bottom-sheet`、`.bottom-sheet-handle`、`.bottom-sheet-content`
- [ ] 新增 `.fab`、`.fab-primary`
- [ ] `@media (max-width: 768px)` 中追加移动端覆盖
- [ ] `@media (max-width: 480px)` 中追加小屏优化
- [ ] `@media (max-width: 375px)` 中追加超小屏优化
- [ ] `@media (min-width: 769px) and (max-width: 1023px)` 平板端样式
- [ ] 沿用项目现有 design tokens：`--brand-500`、`--text-primary`、`--up`/`--down` 等

## 三端同步
- [ ] 网页端 ↔ 桌面端同步
- [ ] 网页端 ↔ 移动端 H5 同步
- [ ] 网页端 ↔ Capacitor App 同步
- [ ] 桌面端离线编辑
- [ ] 恢复网络后自动同步
- [ ] 三端数据完全一致
- [ ] 三端 UI 布局差异化但信息架构一致

## 部署
- [x] `npx tsc --noEmit` 通过（0 类型错误）
- [x] `npm run build` 成功
- [x] 已推送到 main 分支（bf31c6c / 6c655b3）
- [ ] Cloudflare Pages 部署成功（等待 2-3 分钟）
- [ ] GitHub Actions 自动发布桌面端 Release
- [ ] Capacitor App 构建成功（iOS/Android）
