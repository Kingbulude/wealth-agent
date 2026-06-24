# 💰 财富管理智能体 (WealthAgent)

> AI 驱动的个人 / 家庭资产管家 · 一键免费部署到 Cloudflare Pages
>
> ✨ A股 / 港股 / 开放式基金全覆盖 · 5 源行情容错 · AI 投顾 7×24 在线 · 桌面 / 移动 / Web 三端体验统一

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Deploy](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-FF6B35?logo=cloudflare&logoColor=white)](#-一键部署)

---

## ✨ 为什么是 WealthAgent？

| | 痛点 | WealthAgent 的解法 |
|---|---|---|
| 🎯 **多市场** | A 股、港股、基金各玩各的 | 6 位 A股 + 5 位港股 + 6 位基金代码统一接入 |
| 🛰 **数据源** | 一个接口挂了就没了 | **5 源行情容错**（东财 / 腾讯 / 新浪 / 网易 / 雅虎）自动择优 |
| 📡 **实时性** | 估值要手填、刷新要手点 | 30 秒自动同步 · 5 源并发 · 涨跌 / 盈亏自动算 |
| 🤖 **AI 投顾** | 通用大模型不懂你的持仓 | Workers AI 实时读取你的资产 / 持仓给个性化建议 |
| 📱 **移动端** | 响应式 = 缩小版桌面 | 真正的 APP 化布局：底部 Tab Bar、卡片化列表、单手操作 |
| 💸 **部署成本** | 后端要服务器 | 全部跑在 Cloudflare Pages + D1 + Workers，**免费** |

---

## 🖥 桌面端展示

> 资产总览：净资产 Hero 卡 + 4 个 KPI 汇总 + 资产分布环形图 + 资产构成柱状图

![桌面端 - 资产总览](docs/images/desktop-overview.png)

**核心模块**

- **资产总览** — 净资产 / 总资产 / 总负债 / 净资产目标四象限，资产分布、流动性评分一目了然
- **资产管理** — 现金、股票、基金、房产、贵金属、负债 6 大类完整 CRUD，联动资产自动汇总
- **持仓管理** — 实时行情、持仓盈亏、当日涨跌、累计收益率，支持 4 张汇总卡 + 详细列表
- **AI 投顾** — DeepSeek 驱动的智能投顾，多轮对话，深度上下文

---

## 📱 手机端展示

> 底部 4 Tab APP 风格 · 单手操作 · 卡片化列表 · 实时数据

<p align="center">
  <img src="docs/images/mobile-overview.png" width="280" alt="手机端 - 资产总览" />
  &nbsp;&nbsp;
  <img src="docs/images/mobile-holdings.png" width="280" alt="手机端 - 持仓管理" />
  &nbsp;&nbsp;
  <img src="docs/images/mobile-holdings-detail.png" width="280" alt="手机端 - 持仓详情" />
</p>

**移动端亮点**

- ✅ 固定底部 Tab Bar（资产总览 / 资产管理 / 持仓管理 / AI 投顾）
- ✅ 净资产目标卡占满整行，Hero 卡横向贯通
- ✅ 持仓列表卡片化，每张卡显示：标的 / 现价 / 当日涨跌幅 / 市值 / 盈亏
- ✅ AI 投顾历史栏可折叠，场景模板横向滑动
- ✅ 全部触摸目标 ≥ 44px，单手操作不误触

---

## 🎯 项目简介

财富管理智能体（WealthAgent）是一款基于 AI 的个人 / 家庭财富管理应用，主打**实时、多市场、移动友好、零部署成本**：

### 📊 资产总览
- 净资产 / 总资产 / 总负债 Hero 卡（深色顶 + 烫金强调）
- 净资产目标：可设定、可进度跟踪、可推算达成天数
- 持仓联动：自动汇总「持仓管理」标签内的实时市值与盈亏
- 资产分布环形图 + 资产构成柱状图（按一级分类）

### 💼 资产管理
- 6 大类别：现金、股票、基金、房产、贵金属、负债
- 完整 CRUD + 联动标记（与持仓自动同步，避免重复录入）
- 移动端表格 → 卡片列表自动切换

### 💹 持仓管理
- 覆盖 A股 / 港股 / 开放式基金
- **5 源行情容错**：东财 / 腾讯 / 新浪 / 网易 / 雅虎自动择优
- 实时涨跌幅 / 涨跌额 / 盈亏 / 累计收益率
- 30 秒自动同步，交易时段 9:30-15:00 频率可调

### 🤖 AI 投顾
- 基于 DeepSeek / Llama 3.1 8B，可切换
- 实时读取资产 / 持仓作为上下文
- 多轮对话 + 历史会话 + 快捷场景模板
- 移动端历史栏可折叠，场景横向滑动

---

## 🏗 技术架构

```
┌─────────────────────────────────────────────────┐
│  Frontend (React 18 + TypeScript + Vite)        │
│  - Ant Design 5 / Zustand / Recharts            │
│  - 桌面 / 移动 / 桌面壳（Electron）统一体验     │
└─────────────────────────────────────────────────┘
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────────────┐
│  Cloudflare Pages (CDN + Functions)             │
│  ├─ /api/stock/:code    股票代理（A / 港）      │
│  ├─ /api/fund/:code     基金净值代理            │
│  ├─ /api/search         标的搜索                │
│  ├─ /api/holdings/*     持仓 CRUD               │
│  └─ /api/assets/*       资产 CRUD               │
└─────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   Cloudflare D1           Workers AI
   (SQLite 兼容)        (Llama 3.1 8B)
```

**关键设计**

- **5 源行情容错**：每只标的并发请求 5 个源，自动选取离中位数最近的结果，规避单源异常
- **价格合理性校验**：单日波动超过 30% 自动丢弃，防数据源异常
- **本地优先 · 云端同步**：localStorage 兜底，D1 同步，写入失败不影响使用
- **桌面 / 移动同源**：CSS `@media` + 底部 Tab Bar 组件，桌面 / 移动用同一份代码

---

## 🚀 一键部署到 Cloudflare Pages（免费）

### 部署步骤

1. **注册 Cloudflare 账号**：https://dash.cloudflare.com/sign-up
2. **进入 Pages**：Workers & Pages → Create → Pages → Connect to Git
3. **选择仓库**：[`Kingbulude/wealth-agent`](https://github.com/Kingbulude/wealth-agent)
4. **构建配置**：

   | 配置项 | 值 |
   |---|---|
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | （留空） |
   | Deploy command | （**留空**，不要写 wrangler deploy） |

5. **点击 "Save and Deploy"**，等待 2-3 分钟
6. **完成！** 你会得到 `https://wealth-agent-xxx.pages.dev` 免费域名

> 💡 详细故障排查：[CLOUDFLARE_PAGES_FIX.md](CLOUDFLARE_PAGES_FIX.md)

---

## 💻 本地开发

### 环境要求
- Node.js >= 18（推荐 20 LTS）
- npm >= 9

### 快速开始

```bash
# 克隆项目
git clone https://github.com/Kingbulude/wealth-agent.git
cd wealth-agent

# 安装依赖
npm install

# 启动开发服务器
npm run dev
# → 访问 http://localhost:5173

# 构建生产版本
npm run build
# → 产物在 dist/ 目录
```

### 桌面端（Electron）

```bash
# 启动桌面应用
run-app.bat        # Windows
# 或手动：npx electron .

# 打包 Windows 安装包
build-installer.bat
```

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript 5 |
| 状态管理 | Zustand |
| UI 组件 | Ant Design 5 |
| 图表 | Recharts / ECharts |
| 构建工具 | Vite 5 |
| 桌面端 | Electron |
| 后端 | Cloudflare Pages Functions |
| 数据库 | Cloudflare D1 (SQLite) |
| AI | Cloudflare Workers AI (Llama 3.1 8B) / DeepSeek |
| 行情数据 | 5 源容错（东财 / 腾讯 / 新浪 / 网易 / 雅虎） |
| 基金数据 | 天天基金实时估值 + 东财历史净值 |

---

## 📁 项目结构

```
wealth-agent/
├── src/
│   ├── pages/                # 页面
│   │   └── Dashboard.tsx     # 主页面（顶栏 + Tab + 底部导航）
│   ├── components/           # 业务组件
│   │   ├── PortfolioOverview.tsx   # 资产总览
│   │   ├── AssetList.tsx           # 资产管理
│   │   ├── HoldingList.tsx         # 持仓管理
│   │   └── AIAdvisor.tsx           # AI 投顾
│   ├── stores/               # Zustand 状态
│   │   ├── assetStore.ts
│   │   ├── holdingStore.ts
│   │   ├── goalStore.ts
│   │   └── portfolioStore.ts
│   ├── services/             # 数据服务
│   │   ├── stockService.ts   # 行情（5 源容错 + 港股 + 基金）
│   │   ├── aiService.ts      # AI 投顾
│   │   └── securityDict.ts   # 标的本地字典
│   ├── utils/                # 工具
│   │   └── wealthCalculator.ts
│   └── types/                # TypeScript 类型
├── electron/                 # Electron 桌面端
│   ├── main.js
│   └── preload.js
├── functions/api/            # Cloudflare Pages Functions
│   ├── stock/[code].ts       # 股票代理（支持 A股 + 港股）
│   ├── fund/[code].ts        # 基金代理（天天基金 + 东财）
│   ├── search.ts             # 标的搜索
│   ├── holdings/             # 持仓 CRUD
│   └── assets/               # 资产 CRUD
├── docs/                     # 文档与展示图
│   └── images/               # README 截图
└── package.json
```

---

## ⚙️ 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 本地预览生产版本 |
| `npm run lint` | ESLint 代码检查 |
| `run-app.bat` | 启动 Electron 桌面应用 |
| `build-installer.bat` | 打包 Windows 安装包 |

---

## 📈 路线图

- [x] MVP：资产管理、持仓管理、AI 投顾
- [x] Cloudflare 免费部署方案
- [x] 桌面端 Electron 打包
- [x] 港股实时行情接入
- [x] 移动端 APP 化布局
- [x] 5 源行情容错
- [x] 天天基金实时估值
- [ ] 多用户登录系统
- [ ] 数据云同步（D1 全量上线）
- [ ] 微信小程序版本

---

## 🤝 贡献

欢迎 PR / Issue！这个项目的目标始终是：**让每个人都能拥有一个零成本、跨终端、懂自己的资产管家**。

---

## 📄 许可证

[MIT License](LICENSE)

## ⚠️ 免责声明

本应用仅供个人财富管理参考，不构成任何投资建议。投资有风险，决策需谨慎。
