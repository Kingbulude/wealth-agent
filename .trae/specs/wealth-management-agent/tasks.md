# 财富管理智能体(WealthAgent) - 实现计划

## 实现阶段总览

### MVP阶段（4周）- 当前重点

## [x] Task 1: 创建报名帖内容
- **Priority**: P0
- **Depends On**: None
- **Description**: 根据大赛要求，撰写完整的报名帖内容，包含创意名称、创意介绍、目标用户及痛点、价值与意义四个部分
- **Acceptance Criteria Addressed**: 报名合规性
- **Test Requirements**:
  - `human-judgement` TR-1.1: 报名帖内容完整，字数不少于100字
  - `human-judgement` TR-1.2: 内容逻辑清晰，符合大赛审核标准

## [x] Task 2: 生成创意产物HTML文件
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 创建展示创意方案的HTML文件，包含产品介绍、功能展示、用户界面预览
- **Acceptance Criteria Addressed**: 报名合规性
- **Test Requirements**:
  - `programmatic` TR-2.1: HTML文件能够正常打开和显示
  - `human-judgement` TR-2.2: 文件内容完整，界面美观

---

## [x] Task 3: 项目脚手架搭建（Week 1）
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 初始化React + TypeScript项目
  - 配置Electron桌面端
  - 配置Ant Design UI组件库
  - 配置Zustand状态管理
  - 配置ECharts图表库
  - 配置ESLint + Prettier
- **Acceptance Criteria Addressed**: 基础架构
- **Test Requirements**:
  - `programmatic` TR-3.1: 项目能够成功运行 `npm run dev`
  - `programmatic` TR-3.2: Electron能够正常启动
  - `programmatic` TR-3.3: UI组件库正常导入和使用

## [x] Task 4: 用户认证系统（Week 1）
- **Priority**: P0
- **Depends On**: Task 3
- **Description**: 
  - 用户注册页面（邮箱/密码）
  - 用户登录页面
  - JWT Token管理
  - 登录状态持久化
  - 路由权限控制
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-4.1: 用户能够注册新账号
  - `programmatic` TR-4.2: 用户能够登录并保持登录状态
  - `programmatic` TR-4.3: 未登录用户无法访问主页

## [x] Task 5: 资产数据管理模块（Week 1-2）
- **Priority**: P0
- **Depends On**: Task 4
- **Description**: 
  - 设计资产数据模型（Asset类型：cash, stock, fund, real_estate, debt）
  - SQLite本地数据库集成
  - 资产录入表单（支持5大类资产）
  - 资产编辑和删除功能
  - 资产分类筛选
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-5.1: 能够添加不同类型的资产
  - `programmatic` TR-5.2: 能够编辑资产信息
  - `programmatic` TR-5.3: 能够删除资产
  - `programmatic` TR-5.4: 资产数据能够持久化保存

## [ ] Task 6: 财富净值计算引擎（Week 2）
- **Priority**: P0
- **Depends On**: Task 5
- **Description**: 
  - 实现WealthCalculator类
  - 货币转换功能（CNY, USD, EUR, HKD, JPY）
  - 净资产计算（资产 - 负债）
  - 资产分布统计
  - 流动性评分计算
  - 财富增长预测
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-6.1: 净资产计算正确（资产 - 负债）
  - `programmatic` TR-6.2: 资产分类统计准确
  - `programmatic` TR-6.3: 货币转换正确
  - `programmatic` TR-6.4: 流动性评分计算正确

## [x] Task 7: 财富总览页面（Week 2）
- **Priority**: P0
- **Depends On**: Task 6
- **Description**: 
  - 财富总览Dashboard布局
  - 净资产总额展示卡片
  - 资产分布饼图（ECharts）
  - 资产明细列表
  - 快速添加资产入口
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `human-judgement` TR-7.1: 页面布局美观整洁
  - `human-judgement` TR-7.2: 饼图清晰展示资产分布
  - `human-judgement` TR-7.3: 数据实时更新

## [x] Task 8: 持仓管理页面（Week 2-3）
- **Priority**: P1
- **Depends On**: Task 5
- **Description**: 
  - 持仓列表展示
  - 股票/基金搜索添加
  - 持仓成本录入
  - 持仓盈亏计算
  - 持仓分析卡片
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-8.1: 能够添加股票持仓
  - `programmatic` TR-8.2: 盈亏计算准确
  - `human-judgement` TR-8.3: 持仓列表展示清晰

## [ ] Task 9: 股票行情API集成（Week 3）
- **Priority**: P1
- **Depends On**: Task 8
- **Description**: 
  - 集成AkShare股票行情API
  - 实时股价获取
  - 涨跌幅展示
  - 股价数据缓存
  - 非交易时间处理
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-9.1: 能够获取A股实时行情
  - `programmatic` TR-9.2: 股价数据能够正确展示
  - `programmatic` TR-9.3: 数据缓存正常工作

## [ ] Task 10: 持仓分析模块（Week 3）
- **Priority**: P1
- **Depends On**: Task 8, Task 9
- **Description**: 
  - 实现PortfolioAnalyzer类
  - 行业分布分析
  - 风险指标计算（波动率、贝塔）
  - 分散化评分（HHI指数）
  - 优化建议生成
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-10.1: 收益计算准确
  - `programmatic` TR-10.2: 风险指标计算正确
  - `human-judgement` TR-10.3: 建议合理专业

## [ ] Task 11: AI Agent基础实现（Week 3）
- **Priority**: P0
- **Depends On**: Task 10
- **Description**: 
  - LangChain环境配置
  - OpenAI API集成
  - System Prompt设计（专业投顾人设）
  - 基础对话界面
  - 工具注册（财富查询、持仓分析）
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `programmatic` TR-11.1: 能够正常调用OpenAI API
  - `programmatic` TR-11.2: 工具函数正常执行
  - `human-judgement` TR-11.3: AI回复专业友好

## [ ] Task 12: 长期记忆系统（Week 3-4）
- **Priority**: P1
- **Depends On**: Task 11
- **Description**: 
  - Chroma向量数据库集成
  - 决策历史存储
  - 语义检索功能
  - 时间衰减加权
  - 历史决策展示
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-12.1: 决策能够正确存储
  - `programmatic` TR-12.2: 语义检索返回相关结果
  - `human-judgement` TR-12.3: 历史展示清晰

## [x] Task 13: AI投顾对话界面（Week 4）
- **Priority**: P0
- **Depends On**: Task 11, Task 12
- **Description**: 
  - 聊天界面布局
  - 消息列表展示
  - Markdown渲染
  - 加载状态显示
  - 会话管理
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `human-judgement` TR-13.1: 界面美观易用
  - `human-judgement` TR-13.2: Markdown格式正确渲染
  - `programmatic` TR-13.3: 消息能够正确发送和接收

## [x] Task 14: MVP整合与打包（Week 4）
- **Priority**: P0
- **Depends On**: Task 7, Task 9, Task 13
- **Description**: 
  - 页面路由整合
  - 状态管理整合
  - Electron打包配置
  - Windows/macOS安装包生成
  - 应用图标和名称配置
- **Acceptance Criteria Addressed**: 整体交付
- **Test Requirements**:
  - `programmatic` TR-14.1: 能够生成可执行安装包
  - `programmatic` TR-14.2: 打包后应用能够正常运行
  - `human-judgement` TR-14.3: 整体用户体验流畅

---

## V1.0 完整桌面版（后续阶段）

## [ ] Task 15: FastAPI后端服务搭建
- **Priority**: P1
- **Depends On**: Task 14
- **Description**: 
  - FastAPI项目初始化
  - PostgreSQL数据库配置
  - 用户认证API
  - 财富计算API
  - WebSocket实时推送
- **Notes**: 桌面端MVP后启动

## [ ] Task 16: 强化AI Agent能力
- **Priority**: P1
- **Depends On**: Task 15
- **Description**: 
  - 一致性校验器实现
  - 事实核查机制
  - 工具调用链优化
  - 投资逻辑推理增强
- **Notes**: 依赖后端API

## [ ] Task 17: 云端数据同步
- **Priority**: P1
- **Depends On**: Task 15
- **Description**: 
  - 端云双向同步
  - 冲突处理
  - 离线支持
  - 自动备份
- **Notes**: 依赖后端部署

---

## 小程序迁移（未来阶段）

## [ ] Task 18: 小程序项目初始化
- **Priority**: P2
- **Depends On**: Task 14
- **Description**: 
  - Taro项目创建
  - 共享代码迁移
  - 微信登录适配
- **Notes**: 桌面端稳定后启动

## [ ] Task 19: 小程序核心功能迁移
- **Priority**: P2
- **Depends On**: Task 18
- **Description**: 
  - 财富总览页面迁移
  - 持仓管理页面迁移
  - AI投顾对话迁移
  - 股价跟踪迁移
- **Notes**: 4周完成

## 任务依赖关系图

```
Task 3 (脚手架)
    ↓
Task 4 (用户认证) ─────────┐
    ↓                      │
Task 5 (资产数据) ──────→ Task 6 (财富计算) → Task 7 (财富总览)
    ↓                          ↓
Task 8 (持仓管理) ──────→ Task 9 (行情API) → Task 10 (持仓分析)
    ↓                          ↓
Task 11 (AI Agent基础) ←────────────────────
    ↓                      ↑
Task 12 (长期记忆) ─────→ Task 13 (对话界面)
    ↓
Task 14 (MVP打包)
    ↓
Task 15-17 (V1.0)
    ↓
Task 18-19 (小程序)
```

## 当前执行计划（本周）

**Week 1 目标：基础框架 + 用户认证**

1. Task 3: 项目脚手架搭建 [2天]
2. Task 4: 用户认证系统 [3天]

**Week 2 目标：财富计算 + 资产录入**

3. Task 5: 资产数据管理模块 [3天]
4. Task 6: 财富净值计算引擎 [2天]
5. Task 7: 财富总览页面 [2天]

**Week 3 目标：持仓管理 + AI Agent**

6. Task 8: 持仓管理页面 [2天]
7. Task 9: 股票行情API集成 [1天]
8. Task 10: 持仓分析模块 [1天]
9. Task 11: AI Agent基础实现 [2天]
10. Task 12: 长期记忆系统 [1天]

**Week 4 目标：整合 + 打包**

11. Task 13: AI投顾对话界面 [2天]
12. Task 14: MVP整合与打包 [3天]
