# 财富管理智能体(WealthAgent) - 产品需求文档

## Overview
- **Summary**: 一个基于 AI 的个人/家庭财富管理智能体，能够展示用户的财富净值和资产分布，并根据用户的投资需求和持仓情况提供个性化的投资建议和优化方案，同时具备长期记忆和实时股价追踪能力。
- **Purpose**: 解决普通投资者缺乏专业投资知识、难以系统性管理个人资产、无法实时跟踪投资组合表现的痛点，让每个人都能享受专业级的财富管理服务。
- **Target Users**: 有投资理财需求的个人和家庭用户，包括初入股市的新手投资者和有一定投资经验的进阶用户。

## Goals
- 提供清晰直观的个人/家庭财富净值展示和资产分布明细
- 根据用户投资需求和现有持仓提供个性化投资建议和优化方案
- 具备长期记忆能力，跟踪用户之前的投资决策
- 实时获取并展示最新股价报价
- 先开发电脑端程序（Web版本先行），后续扩展为桌面端Electron和小程序

## Non-Goals (Out of Scope)
- 不提供实际的交易执行功能（不直接买卖股票）
- 不提供银行级别的账户安全保障
- 不处理用户的真实资金转账
- 不提供保险产品的销售和管理

## 技术架构

### 四层架构总览
```
┌─────────────────────────────────────────────────────────────┐
│                    前端展示层 (Presentation Layer)           │
├─────────────────────────────────────────────────────────────┤
│  Web端(React/Vue)  │  桌面端(Electron)  │  小程序端(Taro)   │
└─────────────────────────────────────────────────────────────┘
                              ↓ RESTful API / WebSocket
┌─────────────────────────────────────────────────────────────┐
│                    后端服务层 (Service Layer)                │
├─────────────────────────────────────────────────────────────┤
│  FastAPI  │  用户认证  │  财富计算引擎  │  数据同步服务      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   AI Agent 核心层 (Agent Layer)              │
├─────────────────────────────────────────────────────────────┤
│  LLM推理引擎  │  记忆系统  │  工具调用  │  投资决策链        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    数据持久层 (Data Layer)                   │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL  │  Redis  │  Chroma向量库  │  加密文件存储      │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈选型
| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **前端框架** | React 18 + TypeScript | 为小程序迁移做准备 |
| **状态管理** | Zustand | 轻量，支持跨端 |
| **UI组件库** | Ant Design / Mantine | 企业级组件库 |
| **图表库** | ECharts 5 | 财富可视化 |
| **桌面端** | Electron 29 | 跨平台桌面封装 |
| **后端框架** | FastAPI + Uvicorn | 高性能异步API |
| **AI框架** | LangChain + OpenAI Function Calling | Agent开发框架 |
| **主数据库** | PostgreSQL 16 | 结构化数据存储 |
| **缓存** | Redis 7 | 实时行情、会话状态 |
| **向量数据库** | Chroma | 长期记忆语义检索 |
| **跨端框架** | Taro | 小程序迁移准备 |

### 数据模型设计
```sql
-- 用户表（加密敏感字段）
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    encrypted_phone BYTEA,
    password_hash VARCHAR(255),
    risk_profile JSONB,
    created_at TIMESTAMP
);

-- 资产表
CREATE TABLE assets (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    asset_type VARCHAR(50), -- cash, stock, fund, real_estate, debt
    name VARCHAR(255),
    amount DECIMAL(18,2),
    currency VARCHAR(10),
    metadata JSONB,
    updated_at TIMESTAMP
);

-- 持仓表
CREATE TABLE holdings (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    symbol VARCHAR(20),
    quantity DECIMAL(18,4),
    avg_cost DECIMAL(18,4),
    current_price DECIMAL(18,4),
    last_updated TIMESTAMP
);

-- Agent决策历史
CREATE TABLE decision_history (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(100),
    query TEXT,
    response TEXT,
    tools_used JSONB,
    embedding VECTOR(1536),
    created_at TIMESTAMP
);
```

## 分阶段实现路径

### 阶段一：MVP版本（4周）
**目标：验证核心价值，快速落地可用版本**

| 周次 | 模块 | 核心功能 | 交付标准 |
|------|------|----------|----------|
| 1 | 基础框架 | 项目脚手架搭建<br>用户注册登录<br>基础UI布局 | 可运行的Web应用<br>用户系统完整 |
| 2 | 财富计算 | 手动录入各类资产<br>净值自动计算<br>基础饼图/柱状图展示 | 支持5大类资产录入<br>净值实时计算 |
| 3 | AI Agent基础 | 对话式交互界面<br>基础持仓分析<br>简单建议生成 | 可自然语言查询财富状况<br>生成基础分析报告 |
| 4 | MVP整合 | 股价基础跟踪<br>数据本地存储<br>打包发布 | 可安装exe/dmg<br>数据持久化 |

**MVP技术栈简化：**
- 前端：React + Electron（本地SQLite存储）
- AI：直接调用OpenAI API，本地记忆
- 数据：本地SQLite + 文件加密存储

### 阶段二：V1.0 完整桌面版（6周）
**目标：完善功能，强化AI能力**

| 周次 | 模块 | 核心功能 |
|------|------|----------|
| 5-6 | 后端服务 | FastAPI服务搭建<br>PostgreSQL数据库<br>用户权限系统 |
| 7-8 | 强化Agent | 长期记忆系统<br>工具调用链<br>投资逻辑推理 |
| 9-10 | 高级功能 | 实时股价WebSocket推送<br>家庭账户管理<br>多维度财富分析 |

### 阶段三：V2.0 云服务版（4周）
**目标：云端部署，多端同步**
- 云端部署：Docker + Nginx
- 数据同步：端云双向同步
- 备份恢复：自动云端备份

### 阶段四：小程序迁移（4周）
**目标：微信小程序版本上线**

## Functional Requirements
- **FR-1**: 用户注册登录系统，支持邮箱/手机号认证
- **FR-2**: 显示个人或家庭的财富净值总览
- **FR-3**: 展示各类资产的分布明细（股票、基金、存款、房产等）
- **FR-4**: 支持用户输入投资需求和目标
- **FR-5**: 基于用户持仓和投资逻辑提供优化建议
- **FR-6**: 长期记忆用户之前的决策记录（基于向量数据库）
- **FR-7**: 实时获取和展示股价报价
- **FR-8**: 提供投资组合分析和风险评估
- **FR-9**: AI对话式交互，自然语言查询和控制

## Non-Functional Requirements
- **NFR-1**: 界面简洁友好，操作便捷（5分钟内上手）
- **NFR-2**: 数据更新及时，股价信息实时同步
- **NFR-3**: 投资建议专业可靠，基于合理的投资逻辑
- **NFR-4**: 用户数据安全保密（字段级加密）
- **NFR-5**: 建议一致性校验，防止AI幻觉
- **NFR-6**: 响应速度快，页面加载<2秒

## Constraints
- **Technical**: 
  - MVP阶段：Web应用 + 本地存储
  - V1.0：Electron桌面端 + PostgreSQL
  - 后续：小程序迁移（Taro框架）
- **Business**: 不涉及真实资金交易，仅提供咨询建议服务
- **Dependencies**: 
  - 需要接入股票行情API（AkShare/Tushare）
  - 需要OpenAI API或TRAE AI API

## Assumptions
- 用户具备基本的投资理财知识
- 用户愿意提供真实的资产和持仓信息
- 网络环境稳定，能够实时获取股价数据
- 用户接受数据本地存储或云端同步

## Acceptance Criteria

### AC-1: 用户认证
- **Given**: 用户首次使用应用
- **When**: 用户注册并登录
- **Then**: 系统创建用户账号并保持登录状态
- **Verification**: `programmatic`

### AC-2: 财富净值展示
- **Given**: 用户已录入个人资产信息
- **When**: 用户打开应用查看首页
- **Then**: 页面显示用户的财富净值总额和各类资产分布饼图
- **Verification**: `human-judgment`

### AC-3: 资产分布明细
- **Given**: 用户已录入股票、基金、存款等各类资产
- **When**: 用户点击查看资产明细
- **Then**: 页面清晰展示各类资产的具体金额和占比
- **Verification**: `human-judgment`

### AC-4: 投资需求输入
- **Given**: 用户进入投资建议模块
- **When**: 用户输入投资目标、风险偏好和预期收益
- **Then**: 系统保存用户的投资需求并生成个性化建议
- **Verification**: `programmatic`

### AC-5: 投资建议生成
- **Given**: 用户已录入持仓信息和投资需求
- **When**: 用户请求投资建议
- **Then**: 系统基于持仓分析和投资逻辑提供优化建议
- **Verification**: `human-judgment`

### AC-6: 决策记忆
- **Given**: 用户之前有过投资决策记录
- **When**: 用户再次使用应用
- **Then**: 系统能够回忆并展示之前的决策历史
- **Verification**: `programmatic`

### AC-7: 实时股价追踪
- **Given**: 用户持有股票资产
- **When**: 用户查看股票详情
- **Then**: 页面显示最新股价和涨跌幅信息
- **Verification**: `programmatic`

### AC-8: AI对话交互
- **Given**: 用户输入自然语言查询
- **When**: 用户询问"我的投资组合风险如何？"
- **Then**: AI基于用户持仓和历史决策给出专业分析
- **Verification**: `human-judgment`

## 核心模块设计

### 1. 财富计算引擎
```python
class WealthCalculator:
    """财富计算核心引擎"""
    
    def calculate_net_worth(self, assets: List[Asset]) -> WealthSummary:
        """计算净资产总值"""
        # 1. 统一货币转换
        # 2. 区分资产和负债
        # 3. 资产分类统计
        # 4. 流动性评分
        pass
    
    def calculate_growth_projection(
        self, 
        assets: List[Asset], 
        years: int = 5
    ) -> Dict[int, Decimal]:
        """计算财富增长预测"""
        pass
```

### 2. 持仓分析模块
```python
class PortfolioAnalyzer:
    """投资组合分析器"""
    
    def analyze_portfolio(self, holdings: List[Holding]) -> PortfolioAnalysis:
        """全面分析投资组合"""
        # 1. 基础收益计算
        # 2. 行业分布分析
        # 3. 风险指标计算
        # 4. 分散化评分
        # 5. 生成建议
        pass
```

### 3. AI Agent 核心
```python
class WealthAgentExecutor:
    """财富管理智能体执行器"""
    
    def __init__(self, user_id: str, openai_api_key: str):
        self.llm = ChatOpenAI(model="gpt-4o", api_key=openai_api_key)
        self.long_term_memory = LongTermMemory(user_id)
        self.short_term_memory = ShortTermMemory(user_id)
        self.tools = self._register_tools()
    
    async def chat(self, message: str, session_id: Optional[str] = None):
        """处理用户对话"""
        pass
```

### 4. 长期记忆系统
```python
class LongTermMemory:
    """长期记忆系统 - 基于向量数据库"""
    
    def add_decision(self, query: str, response: str, metadata: Dict):
        """添加决策到长期记忆"""
        pass
    
    def search_relevant_decisions(self, query: str, top_k: int = 5):
        """检索相关历史决策"""
        pass
```

## Open Questions
- [x] 股票行情API选择：AkShare（免费）或 Tushare（付费）
- [ ] 是否需要支持多语言？
- [ ] 是否需要支持家庭成员共享？
- [ ] 桌面端打包格式选择？
