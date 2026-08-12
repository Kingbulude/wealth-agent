# 财富管理智能体 - 比赛作品优化实施计划

## [x] Task 1: AI 投顾 6 大专业分析场景
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 新增 6 个专业分析场景模板：资产配置体检、风险评估、组合优化建议、持仓集中度分析、收益归因分析、行业分布洞察
  - 每个场景有独立的 System Prompt，AI 自动读取资产 / 持仓数据作为上下文
  - 桌面端左侧场景入口列表，移动端场景按钮横向滑动
  - 分析结果结构化展示（标题 + 要点 + 数据引用）
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 6 个场景模板均配置了独立的 prompt 和图标
  - `programmatic` TR-1.2: 点击场景后，AI 请求 body 中包含用户资产和持仓数据
  - `human-judgement` TR-1.3: 分析结果结构化、有数据引用、建议具体可操作
- **Notes**: 重点打磨「组合优化建议」和「资产配置体检」，这是最有价值的两个场景

## [x] Task 2: 收益数据全链路打通
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 资产总览页新增「投资收益」汇总卡：总收益金额、总收益率
  - 持仓管理页新增收益排行榜（涨幅榜 / 跌幅榜切换）
  - 单标的显示：成本价、现价、盈亏金额、盈亏比例
  - 收益计算统一公式：收益 = (currentPrice - avgCost) × quantity
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 资产总览页显示总收益金额和收益率，计算正确
  - `programmatic` TR-2.2: 持仓列表每条显示盈亏金额和百分比
  - `programmatic` TR-2.3: 收益排行榜按收益率排序
  - `human-judgement` TR-2.4: 收益数据配色符合涨跌习惯（红涨绿跌）
- **Notes**: 确保港股和基金的收益计算也已打通

## [x] Task 3: 数据可视化增强
- **Priority**: medium
- **Depends On**: Task 2
- **Description**:
  - 行业分布环形图（基于持仓标的行业分类）
  - 资产类别柱状图（当前配置 vs 目标配置对比）
  - 持仓市值占比饼图（已有，需优化样式）
  - 移动端图表单列全宽 + 自适应
- **Acceptance Criteria Addressed**: AC-3, AC-4
- **Test Requirements**:
  - `programmatic` TR-3.1: 行业分布图表有数据时正常渲染
  - `programmatic` TR-3.2: 移动端 @media 查询下图表宽度 100%
  - `human-judgement` TR-3.3: 图表配色统一、标签清晰、交互流畅
- **Notes**: 行业分类可用简单映射（白酒/科技/金融/医药等）

## [x] Task 4: 移动端体验全面打磨
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 底部 Tab Bar 图标统一科技财富风格
  - 所有页面卡片间距、圆角、阴影统一
  - 输入框和按钮最小高度 44px
  - 页面切换有过渡动画
  - 顶栏在移动端紧凑显示
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: viewport ≤768px 时底部 Tab Bar 显示，桌面 Tab 隐藏
  - `programmatic` TR-4.2: 所有按钮/可点击元素触摸区域 ≥44px
  - `human-judgement` TR-4.3: 4 个 Tab 页面在移动端均无横向滚动条、布局合理
  - `human-judgement` TR-4.4: 整体视觉风格统一，APP 感强
- **Notes**: 参考主流财富管理 APP（如蚂蚁财富、天天基金）的移动端布局

## [x] Task 5: 部署验证与稳定性保障
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4
- **Description**:
  - 构建验证：`npm run build` 无报错
  - Cloudflare Pages 部署验证：线上链接可访问
  - 离线 fallback 验证：断网时数据不丢失
  - 行情接口容错验证：模拟单源失败仍能获取数据
- **Acceptance Criteria Addressed**: AC-5, AC-7
- **Test Requirements**:
  - `programmatic` TR-5.1: `npm run build` 成功，无 TypeScript 错误
  - `programmatic` TR-5.2: 线上体验链接可正常访问和操作
  - `programmatic` TR-5.3: localStorage 数据持久化正常
  - `human-judgement` TR-5.4: 页面加载速度快，交互无明显卡顿
- **Notes**: 体验链接必须稳定，这是评审的基本门槛

## [x] Task 6: 比赛作品材料准备
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - README 最终优化：增加比赛作品定位、核心亮点、技术架构图
  - 截图准备：桌面端 4 页 + 移动端 4 页（共 8 张高质量截图）
  - 比赛作品帖正文撰写（按官方模板 4 大部分）
  - TRAE 实践过程整理：关键 Session ID + 开发步骤截图描述
  - docs/ 目录下保存所有比赛相关材料
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `human-judgement` TR-6.1: README 结构清晰、亮点突出、图文并茂
  - `human-judgement` TR-6.2: 作品帖内容完整覆盖官方模板 4 大部分
  - `human-judgement` TR-6.3: TRAE 实践过程有说服力，能证明由 TRAE 完成
  - `human-judgement` TR-6.4: 截图质量高，能展示产品核心价值
- **Notes**: 这是「展示表现力」维度的核心，直接影响 15% 权重

## 优先级总览

| 优先级 | 任务 | 对应评审维度 |
|---|---|---|
| 🔴 高 | Task 1 AI 投顾升级 | 创新价值 30% + 产品完成度 30% |
| 🔴 高 | Task 2 收益数据 | 产品完成度 30% |
| 🔴 高 | Task 4 移动端打磨 | 产品完成度 30% + 展示表现力 15% |
| 🔴 高 | Task 5 部署验证 | 产品完成度 30%（基础门槛） |
| 🔴 高 | Task 6 作品材料 | 展示表现力 15% + TRAE 实践 25% |
| 🟡 中 | Task 3 可视化增强 | 产品完成度 30% + 展示表现力 15% |
