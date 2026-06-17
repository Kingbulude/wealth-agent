# 财富管理智能体(WealthAgent)完整技术实现方案

---

## 一、整体技术架构设计

### 1.1 四层架构总览

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
│  PostgreSQL  │  Redis  │  Vector DB  │  加密文件存储        │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 前端架构（支持多端复用）

**技术选型：**
- **主框架**：React 18 + TypeScript（为小程序迁移做准备）
- **状态管理**：Zustand（轻量，支持跨端）
- **UI组件库**：Ant Design / Mantine
- **图表库**：ECharts 5（财富可视化）
- **桌面端封装**：Electron 29
- **跨端准备**：组件逻辑与UI分离，使用Taro兼容层

**核心模块：**
```
src/
├── components/          # 通用UI组件（可复用）
│   ├── charts/         # 图表组件（净值曲线、资产分布）
│   ├── cards/          # 资产卡片组件
│   └── forms/          # 表单组件
├── features/           # 业务模块
│   ├── dashboard/      # 财富总览
│   ├── portfolio/      # 持仓管理
│   ├── advisor/        # AI投顾对话
│   └── tracking/       # 股价跟踪
├── hooks/              # 自定义Hooks（跨端复用）
├── services/           # API服务层
└── stores/             # 状态管理
```

### 1.3 后端架构（Python FastAPI）

**技术选型：**
- **Web框架**：FastAPI + Uvicorn
- **异步任务**：Celery + Redis
- **认证授权**：JWT + OAuth2
- **API文档**：自动生成Swagger/OpenAPI

**核心服务：**
```
app/
├── api/
│   ├── v1/
│   │   ├── wealth.py       # 财富计算接口
│   │   ├── portfolio.py    # 持仓管理接口
│   │   ├── advisor.py      # AI投顾接口
│   │   └── market.py       # 市场数据接口
├── core/
│   ├── security.py         # 加密安全
│   ├── config.py           # 配置管理
│   └── auth.py             # 认证
├── services/
│   ├── wealth_calculator.py # 财富计算引擎
│   ├── portfolio_analyzer.py # 持仓分析
│   └── market_data.py      # 行情服务
└── models/
    └── schemas.py          # Pydantic数据模型
```

### 1.4 AI Agent 层架构（TRAE Code模式核心）

**基于LangChain + OpenAI Function Calling：**
```
agent/
├── core/
│   ├── agent_executor.py   # Agent执行器
│   ├── tool_registry.py    # 工具注册中心
│   └── chain_builder.py    # 链构建器
├── memory/
│   ├── long_term.py        # 长期记忆（向量存储）
│   ├── short_term.py       # 短期记忆（会话缓存）
│   └── decision_history.py # 决策历史管理
├── tools/
│   ├── wealth_tools.py     # 财富计算工具
│   ├── portfolio_tools.py  # 持仓分析工具
│   ├── market_tools.py     # 行情查询工具
│   └── recommendation_tools.py # 建议生成工具
└── prompts/
    ├── advisor_prompt.py   # 投顾系统提示词
    └── analysis_prompt.py  # 分析提示词
```

### 1.5 数据层架构

**数据库选型：**
- **主数据库**：PostgreSQL 16（结构化数据：用户、资产、交易记录）
- **缓存/会话**：Redis 7（实时行情、会话状态、短期记忆）
- **向量数据库**：Chroma / PGVector（长期记忆语义检索）
- **文件存储**：加密本地存储 / MinIO（敏感文档）

**数据模型设计：**
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
    asset_type VARCHAR(50), -- cash, stock, fund, real_estate, etc.
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

---

## 二、分阶段实现路径

### 阶段一：MVP版本（4周，桌面端Electron）

**目标：验证核心价值，快速落地可用版本**

| 周次 | 模块 | 核心功能 | 交付标准 |
|------|------|----------|----------|
| 1 | 基础框架 | 项目脚手架搭建<br>用户注册登录<br>基础UI布局 | 可运行的桌面应用<br>用户系统完整 |
| 2 | 财富计算 | 手动录入各类资产<br>净值自动计算<br>基础饼图/柱状图展示 | 支持5大类资产录入<br>净值实时计算 |
| 3 | AI Agent基础 | 对话式交互界面<br>基础持仓分析<br>简单建议生成 | 可自然语言查询财富状况<br>生成基础分析报告 |
| 4 | MVP整合 | 股价基础跟踪<br>数据本地存储<br>打包发布 | 可安装exe/dmg<br>数据持久化 |

**MVP技术栈简化：**
- 前端：React + Electron（无需后端，本地SQLite）
- AI：直接调用OpenAI API，本地记忆
- 数据：本地SQLite + 文件加密存储

---

### 阶段二：V1.0 完整桌面版（6周）

**目标：完善功能，强化AI能力**

| 周次 | 模块 | 核心功能 |
|------|------|----------|
| 5-6 | 后端服务 | FastAPI服务搭建<br>PostgreSQL数据库<br>用户权限系统 |
| 7-8 | 强化Agent | 长期记忆系统<br>工具调用链<br>投资逻辑推理 |
| 9-10 | 高级功能 | 实时股价WebSocket推送<br>家庭账户管理<br>多维度财富分析 |

---

### 阶段三：V2.0 云服务版（4周）

**目标：云端部署，多端同步**

- 云端部署：Docker + Nginx
- 数据同步：端云双向同步
- 备份恢复：自动云端备份
- 性能优化：缓存策略 + CDN

---

### 阶段四：小程序迁移（4周）

**目标：微信小程序版本上线**

---

## 三、核心模块代码框架

### 3.1 财富计算引擎 (`services/wealth_calculator.py`)

```python
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Optional
from pydantic import BaseModel

class Asset(BaseModel):
    id: str
    asset_type: str  # cash, stock, fund, real_estate, debt, etc.
    name: str
    amount: Decimal
    currency: str = "CNY"
    growth_rate: Optional[float] = None
    liquidity_level: int = 1  # 1-5, 1最高流动性
    updated_at: datetime

class WealthSummary(BaseModel):
    total_net_worth: Decimal
    total_assets: Decimal
    total_liabilities: Decimal
    asset_distribution: Dict[str, Decimal]
    liquidity_score: float
    last_updated: datetime

class WealthCalculator:
    """财富计算核心引擎"""
    
    def __init__(self):
        self.exchange_rates = self._load_exchange_rates()
        
    def calculate_net_worth(self, assets: List[Asset]) -> WealthSummary:
        """计算净资产总值"""
        # 1. 统一货币转换
        normalized_assets = [
            self._convert_to_cny(asset) for asset in assets
        ]
        
        # 2. 区分资产和负债
        total_assets = sum(
            a.amount for a in normalized_assets 
            if a.asset_type != "debt"
        )
        total_liabilities = sum(
            a.amount for a in normalized_assets 
            if a.asset_type == "debt"
        )
        
        # 3. 资产分类统计
        distribution = {}
        for asset in normalized_assets:
            if asset.asset_type != "debt":
                distribution[asset.asset_type] = (
                    distribution.get(asset.asset_type, Decimal(0)) 
                    + asset.amount
                )
        
        # 4. 流动性评分
        liquidity_score = self._calculate_liquidity_score(normalized_assets)
        
        return WealthSummary(
            total_net_worth=total_assets - total_liabilities,
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            asset_distribution=distribution,
            liquidity_score=liquidity_score,
            last_updated=datetime.now()
        )
    
    def calculate_growth_projection(
        self, 
        assets: List[Asset], 
        years: int = 5
    ) -> Dict[int, Decimal]:
        """计算财富增长预测"""
        projections = {}
        current_value = self.calculate_net_worth(assets).total_net_worth
        
        for year in range(1, years + 1):
            weighted_growth = self._calculate_weighted_growth(assets)
            current_value = current_value * Decimal(1 + weighted_growth / 100)
            projections[year] = current_value
            
        return projections
    
    def _convert_to_cny(self, asset: Asset) -> Asset:
        """货币转换为人民币"""
        if asset.currency == "CNY":
            return asset
            
        rate = self.exchange_rates.get(asset.currency, 1.0)
        return Asset(
            **asset.dict(exclude={"amount"}),
            amount=asset.amount * Decimal(rate)
        )
    
    def _calculate_liquidity_score(self, assets: List[Asset]) -> float:
        """计算资产流动性评分（0-100）"""
        total_value = sum(a.amount for a in assets if a.asset_type != "debt")
        if total_value == 0:
            return 0
            
        weighted_sum = sum(
            (float(a.amount) / float(total_value)) * (6 - a.liquidity_level) * 20
            for a in assets if a.asset_type != "debt"
        )
        return round(weighted_sum, 2)
    
    def _calculate_weighted_growth(self, assets: List[Asset]) -> float:
        """计算加权平均增长率"""
        total_value = sum(
            a.amount for a in assets 
            if a.asset_type != "debt" and a.growth_rate
        )
        if total_value == 0:
            return 5.0  # 默认增长率
            
        weighted_sum = sum(
            (float(a.amount) / float(total_value)) * (a.growth_rate or 0)
            for a in assets 
            if a.asset_type != "debt"
        )
        return weighted_sum
    
    def _load_exchange_rates(self) -> Dict[str, float]:
        """加载汇率"""
        return {
            "USD": 7.2,
            "EUR": 7.8,
            "HKD": 0.92,
            "JPY": 0.048
        }
```

---

### 3.2 持仓分析模块 (`services/portfolio_analyzer.py`)

```python
from typing import List, Dict, Tuple
from decimal import Decimal
from dataclasses import dataclass
import numpy as np

@dataclass
class Holding:
    symbol: str
    name: str
    quantity: Decimal
    avg_cost: Decimal
    current_price: Decimal
    sector: str
    volatility: float  # 年化波动率
    correlation: float  # 与大盘相关性

@dataclass
class PortfolioAnalysis:
    total_value: Decimal
    total_cost: Decimal
    total_profit: Decimal
    profit_rate: float
    sector_distribution: Dict[str, float]
    risk_metrics: Dict[str, float]
    diversification_score: float
    recommendations: List[str]

class PortfolioAnalyzer:
    """投资组合分析器"""
    
    def analyze_portfolio(self, holdings: List[Holding]) -> PortfolioAnalysis:
        """全面分析投资组合"""
        # 1. 基础收益计算
        total_value = sum(h.quantity * h.current_price for h in holdings)
        total_cost = sum(h.quantity * h.avg_cost for h in holdings)
        total_profit = total_value - total_cost
        profit_rate = (float(total_profit) / float(total_cost)) * 100 if total_cost else 0
        
        # 2. 行业分布分析
        sector_dist = self._analyze_sector_distribution(holdings)
        
        # 3. 风险指标计算
        risk_metrics = self._calculate_risk_metrics(holdings)
        
        # 4. 分散化评分
        div_score = self._calculate_diversification_score(holdings)
        
        # 5. 生成建议
        recommendations = self._generate_recommendations(
            holdings, sector_dist, risk_metrics, div_score
        )
        
        return PortfolioAnalysis(
            total_value=total_value,
            total_cost=total_cost,
            total_profit=total_profit,
            profit_rate=round(profit_rate, 2),
            sector_distribution=sector_dist,
            risk_metrics=risk_metrics,
            diversification_score=div_score,
            recommendations=recommendations
        )
    
    def _analyze_sector_distribution(self, holdings: List[Holding]) -> Dict[str, float]:
        """分析行业集中度"""
        total_value = sum(float(h.quantity * h.current_price) for h in holdings)
        distribution = {}
        
        for h in holdings:
            value = float(h.quantity * h.current_price)
            distribution[h.sector] = distribution.get(h.sector, 0) + value
            
        return {
            sector: round((value / total_value) * 100, 2)
            for sector, value in distribution.items()
        }
    
    def _calculate_risk_metrics(self, holdings: List[Holding]) -> Dict[str, float]:
        """计算风险指标"""
        weights = np.array([
            float(h.quantity * h.current_price) for h in holdings
        ])
        weights = weights / weights.sum()
        
        volatilities = np.array([h.volatility for h in holdings])
        correlations = np.array([[h.correlation for h in holdings]]).T
        
        # 组合波动率
        portfolio_vol = np.sqrt(np.sum(weights**2 * volatilities**2))
        
        # 贝塔系数
        portfolio_beta = np.sum(weights * correlations.flatten())
        
        return {
            "portfolio_volatility": round(portfolio_vol * 100, 2),
            "portfolio_beta": round(portfolio_beta, 2),
            "sharpe_ratio_hint": self._estimate_sharpe(portfolio_vol)
        }
    
    def _calculate_diversification_score(self, holdings: List[Holding]) -> float:
        """计算分散化评分（0-100）"""
        if len(holdings) <= 1:
            return 20.0
            
        # 基于HHI指数
        total_value = sum(float(h.quantity * h.current_price) for h in holdings)
        weights = np.array([
            float(h.quantity * h.current_price) / total_value 
            for h in holdings
        ])
        
        hhi = np.sum(weights**2)
        # 归一化：1/N是完美分散，1是完全集中
        normalized_hhi = (hhi - 1/len(weights)) / (1 - 1/len(weights))
        score = (1 - normalized_hhi) * 100
        
        return round(score, 2)
    
    def _generate_recommendations(
        self,
        holdings: List[Holding],
        sector_dist: Dict[str, float],
        risk_metrics: Dict[str, float],
        div_score: float
    ) -> List[str]:
        """生成优化建议"""
        recommendations = []
        
        # 1. 集中度检查
        for sector, pct in sector_dist.items():
            if pct > 40:
                recommendations.append(
                    f"⚠️ {sector}行业占比{pct}%，建议降低行业集中度至30%以下"
                )
        
        # 2. 分散化检查
        if div_score < 50:
            recommendations.append(
                f"📊 分散化评分{div_score}分偏低，建议增加5-8只低相关性标的"
            )
        
        # 3. 风险检查
        if risk_metrics["portfolio_volatility"] > 25:
            recommendations.append(
                f"⚡ 组合波动率{risk_metrics['portfolio_volatility']}%偏高，"
                "建议增配债券或现金类资产"
            )
        
        # 4. 单只持仓检查
        for h in holdings:
            weight = float(h.quantity * h.current_price) / \
                     sum(float(hh.quantity * hh.current_price) for hh in holdings) * 100
            if weight > 15:
                recommendations.append(
                    f"🎯 {h.name}持仓占比{weight:.1f}%过高，建议降至15%以下"
                )
        
        return recommendations
```

---

### 3.3 AI Agent 核心 (`agent/core/agent_executor.py`)

```python
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import BaseMessage
from langchain.tools import Tool

from agent.memory.long_term import LongTermMemory
from agent.memory.short_term import ShortTermMemory
from tools.wealth_tools import get_all_wealth_tools
from tools.market_tools import get_all_market_tools

class WealthAgentExecutor:
    """财富管理智能体执行器"""
    
    def __init__(
        self,
        user_id: str,
        openai_api_key: str,
        model_name: str = "gpt-4o"
    ):
        self.user_id = user_id
        self.llm = ChatOpenAI(
            model=model_name,
            api_key=openai_api_key,
            temperature=0.1
        )
        
        # 记忆系统
        self.long_term_memory = LongTermMemory(user_id)
        self.short_term_memory = ShortTermMemory(user_id)
        
        # 注册工具
        self.tools = self._register_tools()
        
        # 构建Agent
        self.agent = self._build_agent()
        self.executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            verbose=True,
            max_iterations=10
        )
    
    def _register_tools(self) -> List[Tool]:
        """注册所有可用工具"""
        return [
            *get_all_wealth_tools(self.user_id),
            *get_all_market_tools(),
            self._create_memory_tool(),
        ]
    
    def _create_memory_tool(self) -> Tool:
        """创建记忆检索工具"""
        return Tool(
            name="search_past_decisions",
            description="检索用户历史投资决策和对话记录，用于保持建议一致性",
            func=self.long_term_memory.search_relevant_decisions
        )
    
    def _build_agent(self):
        """构建Agent"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一位专业的财富管理顾问AI，具备以下能力：

1. **专业身份**：15年经验的CFA持证人，擅长家庭资产配置、投资组合优化
2. **核心原则**：
   - 所有建议必须基于用户的实际持仓和风险承受能力
   - 必须参考用户的历史决策，保持建议的一致性
   - 给出具体的、可执行的建议，而非空泛理论
   - 明确标注风险提示，不承诺收益

3. **工作流程**：
   - 先查询用户当前的财富状况和持仓
   - 检索相关的历史决策和对话
   - 如有需要，查询实时市场数据
   - 综合分析后给出结构化建议

4. **输出格式**：
   - 📊 现状分析
   - ⚠️ 风险提示
   - 💡 优化建议（分点列出，可执行）
   - 🎯 行动计划

记住：用户的利益永远第一，保守、谨慎、专业。"""),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        return create_openai_tools_agent(self.llm, self.tools, prompt)
    
    async def chat(
        self, 
        message: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """处理用户对话"""
        # 1. 获取会话历史
        chat_history = self.short_term_memory.get_session_history(session_id)
        
        # 2. 执行Agent
        result = await self.executor.ainvoke({
            "input": message,
            "chat_history": chat_history
        })
        
        # 3. 保存到记忆
        self.short_term_memory.add_message(
            session_id, "user", message
        )
        self.short_term_memory.add_message(
            session_id, "assistant", result["output"]
        )
        
        # 4. 重要决策存入长期记忆
        if self._is_important_decision(message, result["output"]):
            self.long_term_memory.add_decision(
                query=message,
                response=result["output"],
                metadata={"session_id": session_id}
            )
        
        return {
            "response": result["output"],
            "tools_used": result.get("intermediate_steps", []),
            "session_id": session_id
        }
    
    def _is_important_decision(self, query: str, response: str) -> bool:
        """判断是否为重要决策，需要存入长期记忆"""
        keywords = ["买入", "卖出", "加仓", "减仓", "配置", "建议", "计划", "目标"]
        return any(k in query or k in response for k in keywords)
```

---

### 3.4 长期记忆系统 (`agent/memory/long_term.py`)

```python
from typing import List, Dict, Any
import chromadb
from chromadb.utils import embedding_functions
from datetime import datetime
import json

class LongTermMemory:
    """长期记忆系统 - 基于向量数据库"""
    
    def __init__(self, user_id: str, persist_dir: str = "./data/memory"):
        self.user_id = user_id
        
        # 初始化Chroma客户端
        self.client = chromadb.PersistentClient(path=persist_dir)
        
        # OpenAI嵌入函数
        self.embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
            model_name="text-embedding-3-small"
        )
        
        # 用户专属集合
        self.collection = self.client.get_or_create_collection(
            name=f"user_{user_id}_decisions",
            embedding_function=self.embedding_fn
        )
    
    def add_decision(
        self,
        query: str,
        response: str,
        metadata: Dict[str, Any] = None
    ):
        """添加决策到长期记忆"""
        doc_id = f"decision_{datetime.now().timestamp()}"
        
        document = f"""
        用户提问: {query}
        AI回复: {response}
        时间: {datetime.now().isoformat()}
        """
        
        self.collection.add(
            ids=[doc_id],
            documents=[document],
            metadatas=[{
                "user_id": self.user_id,
                "timestamp": datetime.now().isoformat(),
                **(metadata or {})
            }]
        )
    
    def search_relevant_decisions(
        self,
        query: str,
        top_k: int = 5
    ) -> str:
        """检索相关历史决策"""
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k
        )
        
        if not results["documents"][0]:
            return "暂无历史决策记录"
            
        formatted = "【历史决策参考】\n"
        for i, doc in enumerate(results["documents"][0], 1):
            formatted += f"\n--- 决策 {i} ---\n{doc.strip()}\n"
            
        return formatted
    
    def get_all_decisions(self, limit: int = 20) -> List[Dict]:
        """获取所有历史决策"""
        results = self.collection.get(limit=limit)
        return [
            {"document": doc, "metadata": meta}
            for doc, meta in zip(results["documents"], results["metadatas"])
        ]
```

---

### 3.5 实时股价跟踪模块 (`services/market_data.py`)

```python
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import asyncio
import aiohttp
import redis
from dataclasses import dataclass

@dataclass
class StockQuote:
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    volume: int
    high: float
    low: float
    open: float
    previous_close: float
    timestamp: datetime

class MarketDataService:
    """市场数据服务 - 实时股价跟踪"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)
        self.cache_ttl = 60  # 1分钟缓存
        self.base_url = "https://api.example.com/market"  # 实际接入东方财富/雪球
        
    async def get_realtime_quote(self, symbol: str) -> Optional[StockQuote]:
        """获取实时行情"""
        # 1. 查缓存
        cache_key = f"quote:{symbol}"
        cached = self.redis.get(cache_key)
        
        if cached:
            return StockQuote(**eval(cached))
            
        # 2. 调用API
        quote = await self._fetch_quote_from_api(symbol)
        
        if quote:
            # 3. 写入缓存
            self.redis.setex(
                cache_key,
                self.cache_ttl,
                str(quote.__dict__)
            )
            
        return quote
    
    async def get_batch_quotes(self, symbols: List[str]) -> Dict[str, StockQuote]:
        """批量获取行情"""
        tasks = [self.get_realtime_quote(symbol) for symbol in symbols]
        results = await asyncio.gather(*tasks)
        
        return {
            symbol: quote
            for symbol, quote in zip(symbols, results)
            if quote
        }
    
    async def subscribe_quotes(
        self,
        symbols: List[str],
        callback,
        interval: int = 30
    ):
        """订阅实时行情推送（WebSocket用）"""
        while True:
            quotes = await self.get_batch_quotes(symbols)
            await callback(quotes)
            await asyncio.sleep(interval)
    
    async def _fetch_quote_from_api(self, symbol: str) -> Optional[StockQuote]:
        """从API获取行情（示例，实际对接数据源）"""
        # 这里对接实际的行情API
        # 可选数据源：Tushare、AkShare、东方财富OpenAPI、雪球
        
        # 模拟数据（实际替换为真实API调用）
        mock_data = {
            "600519": {"name": "贵州茅台", "price": 1680.00},
            "000001": {"name": "平安银行", "price": 12.50},
            "601318": {"name": "中国平安", "price": 45.80},
        }
        
        if symbol in mock_data:
            data = mock_data[symbol]
            return StockQuote(
                symbol=symbol,
                name=data["name"],
                price=data["price"],
                change=data["price"] * 0.01,
                change_percent=1.0,
                volume=1000000,
                high=data["price"] * 1.02,
                low=data["price"] * 0.98,
                open=data["price"] * 0.995,
                previous_close=data["price"] * 0.99,
                timestamp=datetime.now()
            )
            
        return None
```

---

## 四、数据存储和安全方案

### 4.1 敏感数据加密体系

**加密层级设计：**

```
┌─────────────────────────────────────────────────────────┐
│                    应用层加密                            │
│  前端AES加密传输  →  后端RSA解密  →  字段级加密存储       │
└─────────────────────────────────────────────────────────┘
```

**核心加密实现 (`core/security.py`)：**

```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import os
from typing import Optional

class DataEncryptor:
    """金融数据加密器"""
    
    def __init__(self, master_key: Optional[str] = None):
        # 主密钥从环境变量获取，不存入代码
        self.master_key = master_key or os.getenv("ENCRYPTION_MASTER_KEY")
        self.salt = os.getenv("ENCRYPTION_SALT", "wealth_agent_salt").encode()
        
    def _derive_key(self, user_id: str) -> bytes:
        """基于用户ID派生独立密钥"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt + user_id.encode(),
            iterations=100000,
            backend=default_backend()
        )
        key_material = self.master_key.encode() + user_id.encode()
        return base64.urlsafe_b64encode(kdf.derive(key_material))
    
    def encrypt_field(self, user_id: str, plaintext: str) -> bytes:
        """字段级加密"""
        key = self._derive_key(user_id)
        f = Fernet(key)
        return f.encrypt(plaintext.encode())
    
    def decrypt_field(self, user_id: str, ciphertext: bytes) -> str:
        """字段级解密"""
        key = self._derive_key(user_id)
        f = Fernet(key)
        return f.decrypt(ciphertext).decode()
    
    def encrypt_sensitive_data(self, user_id: str, data: dict) -> dict:
        """加密敏感字段（手机号、银行卡、身份证等）"""
        sensitive_fields = ["phone", "id_card", "bank_card", "email"]
        
        result = data.copy()
        for field in sensitive_fields:
            if field in result and result[field]:
                result[field] = self.encrypt_field(user_id, result[field])
                
        return result
```

### 4.2 数据库安全策略

**1. PostgreSQL 行级安全 (RLS)**
```sql
-- 启用行级安全策略
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY user_isolation_policy ON assets
    FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_isolation_policy ON holdings
    FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);
```

**2. 数据库审计日志**
```sql
-- 创建审计日志表
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50),
    operation VARCHAR(10),
    user_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 触发器自动记录数据变更
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (table_name, operation, user_id, old_value, new_value)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        current_setting('app.current_user_id')::uuid,
        row_to_json(OLD),
        row_to_json(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 权限控制体系

**基于RBAC的权限模型：**

```python
from enum import Enum
from functools import wraps
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer

class Role(str, Enum):
    ADMIN = "admin"
    PREMIUM = "premium"
    STANDARD = "standard"
    READ_ONLY = "read_only"

class Permission(str, Enum):
    ASSET_READ = "asset:read"
    ASSET_WRITE = "asset:write"
    PORTFOLIO_READ = "portfolio:read"
    PORTFOLIO_WRITE = "portfolio:write"
    ADVISOR_USE = "advisor:use"
    MARKET_DATA = "market:data"

# 角色权限矩阵
ROLE_PERMISSIONS = {
    Role.ADMIN: list(Permission),
    Role.PREMIUM: [
        Permission.ASSET_READ, Permission.ASSET_WRITE,
        Permission.PORTFOLIO_READ, Permission.PORTFOLIO_WRITE,
        Permission.ADVISOR_USE, Permission.MARKET_DATA
    ],
    Role.STANDARD: [
        Permission.ASSET_READ, Permission.ASSET_WRITE,
        Permission.PORTFOLIO_READ, Permission.MARKET_DATA
    ],
    Role.READ_ONLY: [
        Permission.ASSET_READ, Permission.PORTFOLIO_READ
    ]
}

def require_permission(permission: Permission):
    """权限检查装饰器"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user = Depends(get_current_user), **kwargs):
            user_permissions = ROLE_PERMISSIONS.get(current_user.role, [])
            if permission not in user_permissions:
                raise HTTPException(status_code=403, detail="权限不足")
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator
```

### 4.4 数据备份与灾备

**备份策略：**
- **实时备份**：WAL归档（PostgreSQL Write-Ahead Log）
- **每日全量**：凌晨2点自动全量备份，保留30天
- **异地容灾**：主从同步 + 跨区域备份
- **加密备份**：备份文件AES-256加密存储

**备份脚本示例：**
```bash
#!/bin/bash
# daily_backup.sh

BACKUP_DIR="/backup/wealth_agent"
DATE=$(date +%Y%m%d_%H%M%S)

# 1. 加密导出数据库
pg_dump wealth_agent | gpg --symmetric --cipher-algo AES256 \
    --passphrase "$BACKUP_KEY" -o "$BACKUP_DIR/db_$DATE.sql.gpg"

# 2. 加密导出向量数据库
tar czf - /data/chroma | gpg --symmetric --cipher-algo AES256 \
    --passphrase "$BACKUP_KEY" -o "$BACKUP_DIR/chroma_$DATE.tar.gz.gpg"

# 3. 同步到异地存储
aws s3 sync $BACKUP_DIR s3://wealth-agent-backup/ --sse AES256

# 4. 清理30天前备份
find $BACKUP_DIR -type f -mtime +30 -delete
```

---

## 五、电脑端到小程序迁移路线图

### 5.1 迁移准备阶段（架构兼容设计）

**从第一天开始就为迁移做准备：**

| 准备项 | 具体措施 | 目的 |
|--------|----------|------|
| **技术栈选型** | React + TypeScript + Zustand | 与Taro生态兼容 |
| **组件分层** | UI组件与业务逻辑彻底分离 | 只替换UI渲染层 |
| **API层抽象** | 统一Service层，封装所有HTTP请求 | 端侧无需修改 |
| **样式兼容** | 使用CSS变量 + 响应式单位(rpx) | 小程序样式无缝兼容 |

**目录结构兼容设计：**
```
src/
├── shared/              # 【100%可复用】跨端共享
│   ├── hooks/          # 业务Hooks
│   ├── services/       # API服务
│   ├── stores/         # 状态管理
│   ├── utils/          # 工具函数
│   └── types/          # TypeScript类型
├── web/                # 桌面端专属
│   ├── components/     # Web端UI组件
│   ├── pages/          # Web端页面
│   └── layouts/        # Web端布局
└── miniprogram/        # 小程序专属（后续创建）
    ├── components/     # 小程序UI组件
    ├── pages/          # 小程序页面
    └── app.config.ts   # 小程序配置
```

### 5.2 迁移实施路线图（4周）

#### 第1周：基础设施迁移

**目标：小程序项目框架搭建完成，基础能力跑通**

```
周一-周二：项目初始化
├── Taro 3.x + React + TypeScript 项目创建
├── 配置文件对齐（ESLint、Prettier、TSConfig）
├── shared目录软链接/复制到小程序项目
└── 环境变量配置（开发/生产）

周三-周四：基础能力适配
├── Zustand状态管理迁移（无需修改）
├── API Service层迁移（替换fetch为wx.request）
├── 路由系统适配（Taro路由）
└── 登录授权适配（微信授权替代账号密码）

周五：冒烟测试
├── 编译通过，能在开发者工具正常打开
├── 接口请求正常，数据获取成功
└── 状态管理正常工作
```

#### 第2周：核心页面迁移（财富总览+持仓）

**目标：80%核心功能可用**

```
周一-周二：Dashboard页面
├── 净值卡片组件迁移
├── ECharts图表迁移（taro-echarts）
├── 资产分布饼图迁移
└── 净值趋势折线图迁移

周三-周四：持仓管理页面
├── 持仓列表组件
├── 新增/编辑资产表单
├── 分类筛选功能
└── 批量操作功能

周五：功能验证
├── 数据录入完整流程验证
├── 计算准确性验证
└── 页面性能检测
```

#### 第3周：AI Agent对话+股价跟踪

**目标：AI功能完整迁移**

```
周一-周二：AI投顾对话
├── 聊天界面组件迁移
├── WebSocket适配（Taro Socket API）
├── Markdown渲染适配（taro-markdown）
└── 代码块/表格渲染兼容

周三-周四：股价跟踪
├── 实时行情列表
├── 自选股管理
├── K线图组件适配
└── 价格提醒功能

周五：端云联调
├── 桌面端与小程序数据同步
├── 会话跨端同步
└── 记忆系统跨端共享
```

#### 第4周：优化+测试+发布

**目标：小程序上线准备**

```
周一：性能优化
├── 包体积优化（控制在2M以内）
├── 首屏加载优化（分包加载）
├── 图片资源压缩
└── 接口请求缓存

周二-周三：兼容性测试
├── 多机型适配测试
├── 微信版本兼容性
├── 暗黑模式适配
└── 横竖屏适配

周四：审核准备
├── 隐私协议配置
├── 权限声明整理
├── 小程序类目选择
└── 审核材料准备

周五：提交审核
├── 体验版测试
├── 提交微信审核
└── 审核问题快速迭代
```

### 5.3 关键技术兼容方案

| 功能 | 桌面端(Web) | 小程序端 | 兼容方案 |
|------|-------------|----------|----------|
| **HTTP请求** | axios | wx.request | 封装统一Request层 |
| **本地存储** | localStorage | wx.setStorage | 统一Storage API |
| **图表** | ECharts | taro-echarts | 配置完全复用 |
| **Markdown** | react-markdown | taro-markdown | 组件Props对齐 |
| **WebSocket** | 原生WebSocket | Taro.connectSocket | 统一Socket封装 |
| **路由** | React Router | Taro.navigateTo | 统一Router Hooks |
| **分享** | Web分享API | wx.showShareMenu | 条件编译处理 |

**条件编译示例：**
```typescript
// 统一跳转封装
export const navigateTo = (url: string) => {
  #ifdef H5
  window.location.href = url
  #endif
  
  #ifdef WEAPP
  Taro.navigateTo({ url })
  #endif
}
```

---

## 六、重点难点分析与解决方案

### 难点一：AI Agent 建议的一致性与准确性

**问题描述：**
- 多次对话给出矛盾的投资建议
- 建议脱离用户实际风险承受能力
- 市场变化后建议未能及时调整
-  hallucination（幻觉）编造不存在的数据

**解决方案：**

```python
# agent/core/consistency_checker.py
class ConsistencyChecker:
    """一致性校验器 - 防止AI给出矛盾建议"""
    
    def __init__(self, long_term_memory):
        self.memory = long_term_memory
        
    def check_consistency(
        self,
        new_suggestion: str,
        user_risk_profile: dict
    ) -> dict:
        """检查新建议与历史决策的一致性"""
        
        issues = []
        
        # 1. 检索历史决策
        history = self.memory.search_relevant_decisions(
            new_suggestion, top_k=10
        )
        
        # 2. 风险承受能力匹配检查
        suggested_risk = self._extract_risk_level(new_suggestion)
        if suggested_risk > user_risk_profile["max_risk_tolerance"]:
            issues.append({
                "type": "risk_mismatch",
                "severity": "high",
                "message": f"建议风险等级({suggested_risk})超出用户承受能力({user_risk_profile['max_risk_tolerance']})"
            })
        
        # 3. 历史决策一致性检查
        contradictions = self._find_contradictions(new_suggestion, history)
        issues.extend(contradictions)
        
        # 4. 事实核查（防止幻觉）
        fact_issues = self._fact_checking(new_suggestion)
        issues.extend(fact_issues)
        
        return {
            "pass": len([i for i in issues if i["severity"] == "high"]) == 0,
            "issues": issues,
            "revised_suggestion": self._revise_suggestion(new_suggestion, issues)
        }
    
    def _fact_checking(self, suggestion: str) -> list:
        """事实核查 - 验证股票代码、价格等数据真实性"""
        # 提取股票代码，调用真实行情API验证
        symbols = extract_stock_symbols(suggestion)
        issues = []
        
        for symbol in symbols:
            real_data = market_service.get_realtime_quote(symbol)
            if not real_data:
                issues.append({
                    "type": "hallucination",
                    "severity": "high",
                    "message": f"股票代码{symbol}不存在或无法获取数据"
                })
                
        return issues
```

**附加措施：**
- 所有数值型建议必须通过工具调用获取真实数据
- 建立投资建议黑名单（禁止推荐具体个股买卖时机）
- 强制添加免责声明模板

---

### 难点二：金融数据的实时性与准确性

**问题描述：**
- 股价延迟导致持仓估值错误
- 汇率波动影响跨国资产计算
- 非交易时间数据真空
- 不同数据源价格不一致

**解决方案：**

```python
# services/market_data_manager.py
class MarketDataManager:
    """行情数据管理器 - 多源融合+容错处理"""
    
    def __init__(self):
        self.providers = [
            TushareProvider(),
            AkShareProvider(),
            EastMoneyProvider()
        ]
        self.fallback_strategy = "majority_vote"
        
    async def get_reliable_price(self, symbol: str) -> dict:
        """获取可靠价格 - 多源投票机制"""
        
        # 1. 并行请求所有数据源
        results = await asyncio.gather(
            *[provider.get_price(symbol) for provider in self.providers],
            return_exceptions=True
        )
        
        # 2. 过滤失败结果
        valid_results = [
            r for r in results 
            if not isinstance(r, Exception) and r.get("price")
        ]
        
        if not valid_results:
            return self._get_last_cached_price(symbol)
            
        # 3. 多数投票 + 异常值剔除
        prices = [r["price"] for r in valid_results]
        median_price = np.median(prices)
        
        # 剔除偏离中位数超过2%的异常值
        reliable_prices = [
            p for p in prices 
            if abs(p - median_price) / median_price < 0.02
        ]
        
        if not reliable_prices:
            return {"price": median_price, "source": "fallback", "reliability": 0.7}
            
        return {
            "price": np.mean(reliable_prices),
            "source": f"{len(reliable_prices)} providers consensus",
            "reliability": min(0.95, 0.7 + len(reliable_prices) * 0.05)
        }
    
    def handle_non_trading_hours(self, symbol: str) -> dict:
        """非交易时间处理策略"""
        last_price = self._get_last_close_price(symbol)
        return {
            "price": last_price,
            "is_real_time": False,
            "note": "非交易时间，显示最新收盘价",
            "next_trading_time": self._get_next_trading_time()
        }
```

---

### 难点三：用户隐私与数据安全

**问题描述：**
- 金融数据极度敏感，泄露后果严重
- 本地存储容易被逆向工程
- 云端传输存在中间人攻击风险
- 合规要求（个人信息保护法）

**解决方案：**

**三层防护架构：**
1. **传输层**：HTTPS + 证书固定 + 请求签名
2. **存储层**：字段级加密 + 密钥分离
3. **应用层**：数据脱敏 + 权限最小化

```python
# core/privacy.py
class PrivacyProtector:
    """隐私保护器"""
    
    @staticmethod
    def desensitize_data(data: dict) -> dict:
        """数据脱敏 - 用于日志展示"""
        result = data.copy()
        
        # 手机号脱敏
        if "phone" in result:
            result["phone"] = result["phone"][:3] + "****" + result["phone"][-4:]
            
        # 银行卡脱敏
        if "bank_card" in result:
            result["bank_card"] = result["bank_card"][:4] + "****" + result["bank_card"][-4:]
            
        # 身份证脱敏
        if "id_card" in result:
            result["id_card"] = result["id_card"][:6] + "********" + result["id_card"][-4:]
            
        # 金额模糊化（日志用）
        if "amount" in result:
            result["amount"] = f"约{round(result['amount'] / 10000, 1)}万"
            
        return result
    
    @staticmethod
    def secure_log(user_id: str, action: str, data: dict = None):
        """安全日志 - 不记录敏感信息"""
        log_entry = {
            "user_id_hash": hashlib.sha256(user_id.encode()).hexdigest()[:16],
            "action": action,
            "timestamp": datetime.now().isoformat(),
            "ip_masked": mask_ip_address(get_current_ip())
        }
        if data:
            log_entry["data"] = PrivacyProtector.desensitize_data(data)
            
        logger.info(json.dumps(log_entry))
```

---

### 难点四：记忆系统的检索准确性

**问题描述：**
- 语义检索不相关，召回错误历史
- 重要决策被淹没，长期记忆失效
- 上下文窗口溢出，丢失重要信息

**解决方案：**

```python
# agent/memory/advanced_retrieval.py
class AdvancedRetriever:
    """高级检索器 - 混合检索策略"""
    
    def __init__(self, vector_store):
        self.vector_store = vector_store
        self.keyword_index = self._build_keyword_index()
        
    def hybrid_search(
        self,
        query: str,
        top_k: int = 5
    ) -> list:
        """混合检索 - 向量+关键词+时间衰减"""
        
        # 1. 向量语义检索
        vector_results = self.vector_store.similarity_search_with_score(query, k=top_k*2)
        
        # 2. 关键词BM25检索
        keyword_results = self._bm25_search(query, k=top_k*2)
        
        # 3. 结果融合与重排序
        merged = self._reciprocal_rank_fusion(vector_results, keyword_results)
        
        # 4. 时间衰减加权（近期决策权重更高）
        for result in merged:
            days_ago = (datetime.now() - result["timestamp"]).days
            time_decay = np.exp(-days_ago / 30)  # 30天半衰期
            result["final_score"] *= (0.5 + 0.5 * time_decay)
            
        # 5. 多样性保证（MMR算法）
        return self._maximal_marginal_relevance(merged, top_k)
    
    def _reciprocal_rank_fusion(self, *result_lists, k=60):
        """RRF融合算法 - 解决单一检索偏差"""
        scores = {}
        for results in result_lists:
            for rank, result in enumerate(results):
                doc_id = result["id"]
                scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank)
                
        # 按融合分数排序
        sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [self._get_document(doc_id) for doc_id, _ in sorted_docs]
```

---

### 难点五：小程序包体积限制

**问题描述：**
- 微信小程序主包限制2M，分包20M
- ECharts等大库容易超体积
- 大量页面导致编译慢、启动慢

**解决方案：**

**体积优化三板斧：**
1. **分包加载** - 按功能模块拆分，首页最小化
2. **按需引入** - Tree Shaking + 动态导入
3. **资源CDN** - 图片、字体等静态资源上云

```javascript
// Taro 分包配置 - app.config.js
export default {
  pages: [
    'pages/dashboard/index',      // 首页（主包）
    'pages/login/index',          // 登录页（主包）
  ],
  subpackages: [
    {
      root: 'portfolio',          // 持仓管理分包
      pages: [
        'pages/list/index',
        'pages/edit/index',
        'pages/detail/index'
      ]
    },
    {
      root: 'advisor',            // AI投顾分包
      pages: [
        'pages/chat/index',
        'pages/history/index'
      ],
      independent: true           // 独立分包
    },
    {
      root: 'market',             // 行情分包
      pages: [
        'pages/quotes/index',
        'pages/kline/index'
      ]
    }
  ],
  preloadRule: {
    'pages/dashboard/index': {
      network: 'wifi',
      packages: ['portfolio']     // 首页加载完预加载持仓包
    }
  }
}
```

---

## 方案总结

### 核心优势

1. **TRAE Code模式原生支持** - 模块化设计，每个功能模块都是独立可运行、可测试的代码单元
2. **平滑迁移架构** - 从第一天就为小程序迁移做准备，业务逻辑100%复用
3. **企业级安全** - 字段级加密、行级安全、审计日志、权限控制
4. **生产级AI Agent** - 一致性校验、事实核查、防幻觉机制
5. **完整的落地路线图** - 4周MVP → 6周全功能 → 4周全迁移

### 立即启动建议

**第一周就可以开始写代码：**
```bash
# MVP最简启动方式
# 1. 前端：React + Electron
npx create-react-app wealth-agent --template typescript
npm install electron antd echarts zustand

# 2. 后端：FastAPI本地服务
pip install fastapi uvicorn langchain openai chromadb

# 3. AI Agent直接调用OpenAI API
# 无需复杂架构，先跑通核心流程
```

**技术选型验证：**
- ✅ React → Taro 迁移可行性已验证
- ✅ Python后端跨端无依赖
- ✅ Zustand跨端状态管理兼容
- ✅ ECharts在小程序有成熟替代方案
