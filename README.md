<div align="center">

# 💰 财富管理智能体 · WealthAgent

**AI 驱动的个人 / 家庭资产管家 · Web · 桌面 · 移动三端统一 · 一键免费部署到 Cloudflare**

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Android](https://img.shields.io/badge/Android-APK-3DDC84?logo=android&logoColor=white)](https://developer.android.com/)
[![License](https://img.shields.io/badge/License-CC--BY--NC--ND--4.0-ef9420.svg)](#-许可协议)

</div>

> 把散落在各处的现金、股票、基金、房产、贵金属甚至负债集中到一处，配合 **AI 投顾** 和 **五源实时行情**，随时掌握自己的净资产与持仓盈亏。
>
> ⚠️ **本项目仅授权个人学习与自用，严禁任何形式的商业使用。详见文末「许可协议」。**

---

## ✨ 核心亮点

| 亮点 | 说明 |
|---|---|
| 🤖 **AI 智能投顾** | 基于 DeepSeek / Llama 3.1 8B，实时读取你的资产和持仓数据，提供个性化投资建议，多轮对话随时在线 |
| 📊 **五源行情容错** | 同时接入东方财富、腾讯财经、新浪财经、网易财经、雅虎财经 5 大数据源，并发请求 + 自动择优，杜绝单点中断 |
| 📱 **三端体验统一** | 一份代码同时覆盖 **Web 端 · 桌面端（Electron）· 移动端（Android APK）**，随时随地查看资产 |
| 🔐 **账号与云同步** | 邮箱注册 / 登录（JWT + bcrypt），持仓 / 资产数据通过 Cloudflare D1 云端存储，多设备无缝同步 |
| 💸 **零部署成本** | 全部跑在 Cloudflare Pages + D1 + Workers AI 上，个人用户可永久免费使用，无需自有服务器 |
| 🎨 **Modern Wealth Terminal 设计** | 深色金色顶栏、Pill Tab、环形 / 柱状资产分布图、移动端 APP 化底部导航 |

---

## 🖥 产品展示

### 桌面端（Web / Electron）

> 资产总览：净资产 Hero 卡 + KPI 汇总 + 资产分布环形图 + 资产构成柱状图 + 上证指数实时行情

<p align="center">
  <img width="1920" src="https://github.com/user-attachments/assets/474acb01-a304-4c07-a48b-e945f13558cd" alt="桌面端 - 资产总览" />
</p>

### 移动端（Android APK）

> 底部 5 Tab APP 风格 · 单手操作 · 卡片化列表 · 适配状态栏 · 跨设备数据同步
>
> 移动端专门做了顶栏精简：隐藏上证指数 ticker 和飞书批量推送按钮，让核心操作（刷新 / 设置 / 头像 / 退出）的触摸目标更宽松。

<p align="center">
  <img src="docs/images/mobile-overview.png" width="260" alt="手机端 - 资产总览" />
  &nbsp;&nbsp;
  <img src="docs/images/mobile-holdings.png" width="260" alt="手机端 - 持仓管理" />
</p>

> 📷 截图位于 `docs/images/`，可自行替换为最新截图。

---

## 🎯 功能介绍

### 📊 资产总览（Portfolio Overview）
- 净资产 / 总资产 / 总负债 / 净资产目标 四大核心指标
- 净资产目标：可设定、可进度跟踪、可推算达成天数
- 持仓联动：自动汇总「持仓管理」中的实时市值与盈亏
- 资产分布环形图 + 资产构成柱状图，一目了然

### 💼 资产管理（Asset Management）
- 6 大资产类别：现金、股票、基金、房产、贵金属、负债
- 完整 CRUD 操作 + 联动标记（与持仓自动同步，避免重复录入）
- 桌面端表格展示，移动端自动切换为卡片列表

### 💹 持仓管理（Holdings）
- 覆盖 **A 股 / 港股 / 开放式基金**
- **5 源行情容错**：东财 / 腾讯 / 新浪 / 网易 / 雅虎并发择优
- 实时展示涨跌幅 / 涨跌额 / 盈亏 / 累计收益率
- 30 秒自动同步，交易时段频率可调
- 价格合理性校验：单日波动超 30% 自动丢弃，防数据异常

### 🤖 持仓智研（AI Advisor）
- 基于 DeepSeek / Llama 3.1 8B，可自由切换
- 实时读取资产 / 持仓作为对话上下文
- 多轮对话 + 历史会话 + 快捷场景模板
- 移动端历史栏可折叠，场景模板横向滑动

### 📝 投资笔记（Investment Notes）
- 随手记录投资心得、复盘、策略
- 按账户隔离，云同步

### 🔔 消息推送
- 支持配置飞书（Lark）Webhook，定时推送每日资产报告
- 一键把当日的持仓盈亏、净资产变动送到群聊
- *注：该功能为桌面端批量推送场景，移动端 App 已隐藏入口*

### 🔐 账号系统
- 邮箱注册 / 登录，密码使用 bcrypt 加盐哈希
- JWT 鉴权，数据按用户隔离存储在 Cloudflare D1

---

## 🏗 技术架构

```
┌─────────────────────────────────────────────────────┐
│  前端层 (React 18 + TypeScript 5 + Vite)            │
│  ┌───────────────────────────────────────────────┐  │
│  │  UI 组件: Ant Design 5 / Zustand / Recharts   │  │
│  │  封装层:  Web  ·  Electron 桌面  ·  Capacitor │  │
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
│  │  /api/portfolio/*   组合快照                  │  │
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
- **跨端封装策略**：通过 `window.Capacitor` / `window.electronAPI` 运行时检测，三端共用同一份前端代码
  - Web → 直接访问 Cloudflare Pages
  - Electron → 内置前端 + 跨域访问 Cloudflare API
  - Capacitor → WebView 中加载前端，API 走 Cloudflare 后端
- **平台差异化样式**：通过 `body.capacitor-native` CSS class 区分原生 App 与 Web/Electron，互不影响
- **移动端状态栏适配**：`StatusBar.setOverlaysWebView({overlay:false})` + Android 原生主题 `statusBarColor`

---

## 🚀 一键部署到 Cloudflare Pages（免费）

### 前置准备
- Cloudflare 账号（免费注册）：https://dash.cloudflare.com/sign-up
- GitHub 账号

### 部署步骤

1. **Fork 本仓库**到自己的 GitHub 账号
2. 进入 Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**
3. 选择你 Fork 的仓库
4. 构建配置：

   | 配置项 | 值 |
   |---|---|
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Deploy command | （**留空**，不要写 `wrangler deploy`） |

5. **Save and Deploy**，等待 2-3 分钟
6. 完成！得到 `https://your-project.pages.dev` 免费域名
7. 初始化数据库：参考 `functions/_schema/d1-init.sql`

> 💡 详细故障排查：[CLOUDFLARE_PAGES_FIX.md](CLOUDFLARE_PAGES_FIX.md) 或 [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md)

---

## 💻 本地开发

### 环境要求
- Node.js >= 18（推荐 20 LTS）
- npm >= 9
- Android Studio（如需构建 APK）

### Web 端

```bash
git clone https://github.com/Kingbulude/wealth-agent.git
cd wealth-agent
npm install
npm run dev          # → http://localhost:5173
npm run build        # → 产物在 dist/
```

### 桌面端（Electron）

```bash
npm run electron:dev      # 开发模式（前台 Vite + 后台 Electron）
# 或直接启动：
run-app.bat               # Windows
npx electron .            # 手动启动
build-installer.bat       # 打包 Windows 安装包
# 或：npm run electron:build
```

### 移动端（Android APK）

项目已通过 [Capacitor](https://capacitorjs.com/) 接入 Android，前端构建产物会同步进 `android/` 工程。

```bash
npm run build        # 1. 构建前端
npm run cap:sync     # 2. 同步到 Android 工程
npm run cap:open     # 3. 用 Android Studio 打开编译 / 真机调试
```

> 🤖 **云端自动构建**：仓库内置 GitHub Action（`.github/workflows/build-android.yml`），每次 push 到 `main` 都会自动编译 Debug APK，可在仓库的 **Actions → 最新运行 → Artifacts** 下载。

---

## ⚙️ 环境变量

参考 [.env.example](.env.example)：

| 变量 | 说明 |
|---|---|
| `VITE_OPENAI_API_KEY` | 可选。配置后 AI 投顾走自己的 Key；不配置则使用内置的 Cloudflare Workers AI / 模拟回复 |

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
| 移动端 | Capacitor 6（Android） |
| 后端 | Cloudflare Pages Functions |
| 数据库 | Cloudflare D1（SQLite） |
| 鉴权 | JWT + bcrypt |
| AI 模型 | Cloudflare Workers AI（Llama 3.1 8B）/ DeepSeek |
| 行情数据 | 五源容错（东财 / 腾讯 / 新浪 / 网易 / 雅虎） |
| 基金数据 | 天天基金实时估值 + 东财历史净值 |
| CI/CD | GitHub Actions（Android / Electron / Cloudflare 三条流水线） |

---

## 📁 项目结构

```
wealth-agent/
├── src/
│   ├── pages/                # 页面层
│   │   ├── Dashboard.tsx     # 主页面（顶栏 + Tab + 底部导航）
│   │   └── InvestmentNotes.tsx
│   ├── renderer/             # 入口 + 登录鉴权
│   │   ├── main.tsx          # 应用入口（Capacitor 初始化）
│   │   ├── index.css         # 全局样式（含移动端 APP 化布局）
│   │   └── stores/authStore.ts
│   ├── components/           # 业务组件
│   │   ├── PortfolioOverview.tsx   # 资产总览
│   │   ├── AssetList.tsx           # 资产管理
│   │   ├── HoldingList.tsx         # 持仓管理
│   │   ├── AIAdvisor.tsx           # 持仓智研
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
│   │   ├── stockService.ts   # 行情服务（五源容错 + 港股 + 基金）
│   │   ├── aiService.ts      # AI 投顾服务
│   │   ├── notificationService.ts  # 飞书推送
│   │   └── securityDict.ts   # 标的本地字典
│   ├── utils/
│   │   ├── apiUrl.ts         # 平台路由（Web / Electron / Capacitor）
│   │   ├── wealthCalculator.ts
│   │   ├── financeColor.ts
│   │   └── industryClassifier.ts
│   ├── config/               # 运行时配置
│   ├── shared/               # 跨端共享代码
│   └── types/                # TypeScript 类型定义
├── electron/                 # Electron 桌面端
│   ├── main.ts
│   └── preload.js
├── android/                  # Capacitor Android 工程
├── capacitor.config.ts       # Capacitor 配置
├── functions/                # Cloudflare Pages Functions（后端）
│   ├── api/
│   │   ├── stock/[code].ts   # 股票行情代理（A 股 + 港股）
│   │   ├── fund/[code].ts    # 基金净值代理
│   │   ├── search.ts         # 标的搜索
│   │   ├── auth/             # 注册 / 登录 / 鉴权
│   │   ├── holdings/         # 持仓 CRUD
│   │   ├── assets/           # 资产 CRUD
│   │   ├── portfolio/        # 组合快照
│   │   ├── ai/               # AI 投顾对话
│   │   └── notify/           # 飞书推送 / 每日报告
│   ├── lib/                  # 后端公共库（鉴权 / 行情抓取等）
│   └── _schema/d1-init.sql   # D1 数据库初始化脚本
├── docs/
│   └── images/               # 产品截图
├── resources/                # 桌面端图标 / 安装包素材
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
- [x] 移动端状态栏适配 + 顶栏精简
- [x] D1 多设备数据同步
- [ ] iOS 版本
- [ ] 微信小程序版本

---

## 🤝 贡献

欢迎提交 Issue 和 PR 共同完善本项目。**但请注意：本项目不接受任何旨在商业化运营的改动合入主线。**

---

## 📄 许可协议

**本项目采用 [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/)（署名 - 非商业性使用 - 禁止演绎）国际许可协议。**

### ✅ 你可以
- **个人学习与自用**：克隆、部署到自己服务器、供个人 / 家庭使用
- **阅读、研究、引用本项目的代码与设计**：请注明作者和出处

### ❌ 你不可以
- **商业使用**：包括但不限于将本项目或其衍生作品用于售卖、付费 SaaS、引流变现、企业内部商用工具、二次包装上架应用商店等任何以营利为目的的用途
- **未经授权的二次分发或衍生**：禁止在未获得作者书面授权前，修改代码后重新发布或作为另一款产品分发
- **去除 / 篡改作者署名与许可声明**

> 如需商用授权，请通过 GitHub Issues 联系作者 [Kingbulude](https://github.com/Kingbulude) 获取书面授权。

### 🔑 一句话总结
**自用随意，商用必究。**

---

## ⚠️ 免责声明

本应用仅供个人财富管理参考，**不构成任何投资建议**。AI 投顾的输出仅基于你输入的数据，可能存在偏差；行情数据来自第三方公开接口，可能存在延迟或异常。**投资有风险，决策需谨慎，据此操作风险自负。**

作者不对因使用本软件而产生的任何直接或间接损失承担责任。

---

<div align="center">

**如果这个项目对你有帮助，欢迎 ⭐ Star 支持！**

Made with ❤️ by [Kingbulude](https://github.com/Kingbulude)

</div>
