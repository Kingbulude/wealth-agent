# 💰 财富管理智能体 (WealthAgent)

> AI 驱动的个人 / 家庭资产管家 · 桌面 / 移动 / Web 三端统一 · 一键免费部署到 Cloudflare Pages

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Android](https://img.shields.io/badge/Android-APK-3DDC84?logo=android&logoColor=white)](https://developer.android.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

一个开源的个人财富管理应用，帮你把散落在各处的现金、股票、基金、房产、贵金属甚至负债集中到一处，配合 AI 投顾和多源实时行情，随时掌握自己的净资产与持仓盈亏。

---

## ✨ 核心亮点

| 亮点 | 说明 |
|---|---|
| **🤖 AI 智能投顾** | 基于 DeepSeek / Llama 3.1 8B，实时读取你的资产和持仓数据，提供个性化投资建议，多轮对话随时在线 |
| **📊 五源行情容错** | 同时接入东方财富、腾讯财经、新浪财经、网易财经、雅虎财经 5 大数据源，自动择优，杜绝数据中断 |
| **📱 三端体验统一** | 一份代码同时覆盖 Web 端、桌面端（Electron）、移动端（Android APK），随时随地查看资产 |
| **🔐 账号与云同步** | 支持注册登录（JWT），持仓 / 资产数据通过 Cloudflare D1 云端存储，多设备同步 |
| **💸 零部署成本** | 全部跑在 Cloudflare Pages + D1 + Workers AI 上，个人用户可永久免费使用，无需自有服务器 |

---

## 🖥 产品展示

### 桌面端

> 资产总览：净资产 Hero 卡 + KPI 汇总 + 资产分布环形图 + 资产构成柱状图

![桌面端 - 资产总览]<img width="1920" height="850" alt="image" src="https://github.com/user-attachments/assets/474acb01-a304-4c07-a48b-e945f13558cd" />


### 移动端

> 底部 4 Tab APP 风格 · 单手操作 · 卡片化列表 · 实时数据

<p align="center">
  <img src="docs/images/mobile-overview.png" width="280" alt="手机端 - 资产总览" />
  &nbsp;&nbsp;
  <img src="docs/images/mobile-holdings.png" width="280" alt="手机端 - 持仓管理" />
  &nbsp;&nbsp;
  <img src="docs/images/mobile-holdings-detail.png" width="280" alt="手机端 - 持仓详情" />
</p>

---

## 🎯 功能介绍

### 📊 资产总览
- 净资产 / 总资产 / 总负债 / 净资产目标 四大核心指标
- 净资产目标：可设定、可进度跟踪、可推算达成天数
- 持仓联动：自动汇总「持仓管理」中的实时市值与盈亏
- 资产分布环形图 + 资产构成柱状图，一目了然

### 💼 资产管理
- 6 大资产类别：现金、股票、基金、房产、贵金属、负债
- 完整 CRUD 操作 + 联动标记（与持仓自动同步，避免重复录入）
- 桌面端表格展示，移动端自动切换为卡片列表

### 💹 持仓管理
- 覆盖 A 股 / 港股 / 开放式基金
- **5 源行情容错**：东财 / 腾讯 / 新浪 / 网易 / 雅虎自动择优
- 实时展示涨跌幅 / 涨跌额 / 盈亏 / 累计收益率
- 30 秒自动同步，交易时段频率可调
- 价格合理性校验：单日波动超 30% 自动丢弃，防数据异常

### 🤖 AI 投顾
- 基于 DeepSeek / Llama 3.1 8B，可自由切换
- 实时读取资产 / 持仓作为对话上下文
- 多轮对话 + 历史会话 + 快捷场景模板
- 移动端历史栏可折叠，场景模板横向滑动

### 🔔 消息推送
- 支持配置飞书（Lark）Webhook，定时推送每日资产报告
- 一键把当日的持仓盈亏、净资产变动送到群聊

### 🔐 账号系统
- 邮箱注册 / 登录，密码使用 bcrypt 加盐哈希
- JWT 鉴权，数据按用户隔离存储在 Cloudflare D1

---

## 🏗 技术架构

```
┌─────────────────────────────────────────────────────┐
│  前端层 (React 18 + TypeScript + Vite)              │
│  ┌───────────────────────────────────────────────┐  │
│  │  UI 组件层: Ant Design 5 / Zustand / Recharts │  │
│  │  桌面端 / 移动端 / Electron 统一体验          │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────┐
│  Cloudflare Pages (CDN + Functions)                 │
│  ┌───────────────────────────────────────────────┐  │
│  │  /api/stock/:code   股票行情代理（A / 港）    │  │
│  │  /api/fund/:code    基金净值代理              │  │
│  │  /api/search        标的搜索                  │  │
│  │  /api/holdings/*    持仓 CRUD                 │  │
│  │  /api/assets/*      资产 CRUD                 │  │
│  │  /api/auth/*        注册 / 登录 / 鉴权        │  │
│  │  /api/ai/*          AI 投顾对话               │  │
│  │  /api/notify/*      飞书推送 / 每日报告       │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
   ┌──────────────────┐   ┌──────────────────┐
   │  Cloudflare D1   │   │   Workers AI     │
   │  (SQLite 兼容)   │   │  (Llama 3.1 8B)  │
   └──────────────────┘   └──────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────┐
   │  五源行情数据层（并发请求 + 自动择优）       │
   │  东方财富 / 腾讯 / 新浪 / 网易 / 雅虎        │
   └──────────────────────────────────────────────┘
```

**关键技术设计**：

- **五源行情容错机制**：每只标的并发请求 5 个数据源，自动选取离中位数最近的结果，规避单源异常
- **本地优先 · 云端同步**：localStorage 兜底，D1 云端同步，写入失败不影响使用
- **响应式 APP 化布局**：CSS `@media` + 底部 Tab Bar 组件，桌面 / 移动同一份代码
- **桌面端封装**：Electron 壳 + 同源前端代码，提供原生桌面体验
- **移动端封装**：Capacitor 把同一份前端构建产物打包成 Android APK，离线也能打开界面

---

## 🚀 一键部署到 Cloudflare Pages（免费）

### 前置准备
- Cloudflare 账号（免费注册）
- GitHub / GitLab 账号（用于仓库连接）

### 部署步骤

1. **注册 Cloudflare 账号**：https://dash.cloudflare.com/sign-up
2. **进入 Pages**：Workers & Pages → Create → Pages → Connect to Git
3. **选择仓库**：选择本项目仓库（建议先 Fork 到自己的账号下）
4. **构建配置**：

   | 配置项 | 值 |
   |---|---|
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | （留空） |
   | Deploy command | （**留空**，不要写 wrangler deploy） |

5. **点击 "Save and Deploy"**，等待 2-3 分钟
6. **完成！** 你会得到 `https://your-project.pages.dev` 免费域名

> 💡 详细故障排查：[CLOUDFLARE_PAGES_FIX.md](CLOUDFLARE_PAGES_FIX.md) 或 [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md)

---

## 💻 本地开发

### 环境要求
- Node.js >= 18（推荐 20 LTS）
- npm >= 9

### Web 端

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
# 启动桌面应用（开发模式，前台 Vite + 后台 Electron）
npm run electron:dev
# 或直接启动已构建的桌面应用：
run-app.bat        # Windows
# 或手动：npx electron .

# 打包 Windows 安装包
build-installer.bat
# 或：npm run electron:build
```

### 移动端（Android APK）

项目已通过 [Capacitor](https://capacitorjs.com/) 接入 Android，前端构建产物会同步进 `android/` 工程。

```bash
# 1. 先构建前端
npm run build

# 2. 把 dist/ 同步到 Android 工程
npm run cap:sync

# 3. 用 Android Studio 打开工程进行编译 / 真机调试
npm run cap:open
```

> 仓库内置了 GitHub Action（`.github/workflows/build-android.yml`），push 到 `main` 后会自动构建 Debug APK 供下载。

---

## ⚙️ 环境变量

参考 [.env.example](.env.example)：

| 变量 | 说明 |
|---|---|
| `VITE_OPENAI_API_KEY` | 可选。配置后 AI 投顾会走自己的 Key；不配置则使用内置的 Cloudflare Workers AI / 模拟回复 |

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript 5 |
| 状态管理 | Zustand |
| UI 组件 | Ant Design 5 |
| 图表 | Recharts / ECharts |
| 构建工具 | Vite 5 |
| 桌面端 | Electron 43 |
| 移动端 | Capacitor 8（Android） |
| 后端 | Cloudflare Pages Functions |
| 数据库 | Cloudflare D1 (SQLite) |
| 鉴权 | JWT + bcrypt |
| AI 模型 | Cloudflare Workers AI (Llama 3.1 8B) / DeepSeek |
| 行情数据 | 5 源容错（东财 / 腾讯 / 新浪 / 网易 / 雅虎） |
| 基金数据 | 天天基金实时估值 + 东财历史净值 |
| CI/CD | GitHub Actions（Android / Electron / Cloudflare 三条流水线） |

---

## 📁 项目结构

```
wealth-agent/
├── src/
│   ├── pages/                # 页面层
│   │   └── Dashboard.tsx     # 主页面（顶栏 + Tab + 底部导航）
│   ├── renderer/             # 登录 / 鉴权相关入口
│   │   ├── pages/LoginPage.tsx
│   │   └── stores/authStore.ts
│   ├── components/           # 业务组件
│   │   ├── PortfolioOverview.tsx   # 资产总览
│   │   ├── AssetList.tsx           # 资产管理
│   │   ├── HoldingList.tsx         # 持仓管理
│   │   ├── AIAdvisor.tsx           # AI 投顾
│   │   ├── SettingsPanel.tsx       # 设置（行情频率 / 推送等）
│   │   ├── AssetPieChart.tsx       # 资产分布饼图
│   │   ├── AssetBarChart.tsx       # 资产构成柱状图
│   │   └── WealthSummaryCards.tsx  # 财富汇总卡片
│   ├── stores/               # Zustand 状态管理
│   │   ├── assetStore.ts
│   │   ├── holdingStore.ts
│   │   ├── goalStore.ts
│   │   └── portfolioStore.ts
│   ├── services/             # 数据服务层
│   │   ├── stockService.ts   # 行情服务（5 源容错 + 港股 + 基金）
│   │   ├── aiService.ts      # AI 投顾服务
│   │   ├── notificationService.ts  # 飞书推送
│   │   └── securityDict.ts   # 标的本地字典
│   ├── utils/                # 工具函数
│   │   ├── wealthCalculator.ts
│   │   ├── financeColor.ts
│   │   └── industryClassifier.ts
│   └── types/                # TypeScript 类型定义
├── electron/                 # Electron 桌面端
│   ├── main.js
│   └── preload.js
├── android/                  # Capacitor Android 工程
├── capacitor.config.ts       # Capacitor 配置
├── functions/                # Cloudflare Pages Functions（后端）
│   ├── api/
│   │   ├── stock/[code].ts   # 股票行情代理（A股 + 港股）
│   │   ├── fund/[code].ts    # 基金净值代理
│   │   ├── search.ts         # 标的搜索
│   │   ├── auth/             # 注册 / 登录 / 鉴权
│   │   ├── holdings/         # 持仓 CRUD
│   │   ├── assets/           # 资产 CRUD
│   │   ├── ai/               # AI 投顾对话
│   │   └── notify/           # 飞书推送 / 每日报告
│   ├── lib/                  # 后端公共库（鉴权 / 行情抓取等）
│   └── _schema/d1-init.sql   # D1 数据库初始化脚本
├── docs/                     # 文档与展示素材
│   └── images/               # 产品截图
├── release/                  # 发布版本
└── package.json
```

---

## 📋 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Web 开发服务器（热更新） |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 本地预览生产版本 |
| `npm run lint` | ESLint 代码检查 |
| `npm run electron:dev` | 启动 Electron 桌面应用（开发模式） |
| `npm run electron:build` | 打包 Windows 安装包 |
| `npm run cap:sync` | 把前端构建产物同步到 Android 工程 |
| `npm run cap:open` | 用 Android Studio 打开 Android 工程 |

---

## 📈 项目路线图

- [x] MVP 版本：资产管理、持仓管理、AI 投顾
- [x] Cloudflare Pages 免费部署方案
- [x] Electron 桌面端打包
- [x] 港股实时行情接入
- [x] 移动端 APP 化布局（底部 Tab Bar）
- [x] 五源行情容错机制
- [x] 天天基金实时估值接入
- [x] 资产分布图表可视化
- [x] 多用户登录系统（注册 / 登录 / JWT 鉴权）
- [x] 飞书每日资产报告推送
- [x] Android APK 打包（Capacitor + GitHub Action）
- [ ] 数据全量云同步（D1 多设备实时同步）
- [ ] iOS 版本
- [ ] 微信小程序版本

---

## 🤝 贡献

欢迎提交 Issue 和 PR！本项目的目标是：**让每个人都能拥有一个零成本、跨终端、懂自己的 AI 资产管家**。

---

## 📄 许可证

[MIT License](LICENSE)

## ⚠️ 免责声明

本应用仅供个人财富管理参考，不构成任何投资建议。行情数据来自第三方公开接口，可能存在延迟或异常；投资有风险，决策需谨慎。
