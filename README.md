# 💰 财富管理智能体 (WealthAgent)

> AI 驱动的个人资产管家 · 一键免费部署到 Cloudflare Pages

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🎯 项目简介

财富管理智能体是一款基于 AI 的个人/家庭财富管理应用：

- 📊 **资产总览** - 净资产、流动性评分、资产分布可视化
- 💼 **资产管理** - 现金、股票、基金、房产、负债完整 CRUD
- 💹 **持仓管理** - 实时股价刷新（腾讯财经 API）、浮动盈亏计算
- 🤖 **AI 投顾** - Cloudflare Workers AI（Llama 3.1 8B）驱动的投资顾问

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
   | Deploy command | （留空） |

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
# 启动桌面应用（自动安装 Electron）
run-app.bat

# 打包 Windows 安装包
build-installer.bat
```

---

## 🤖 配置 AI 投顾（可选）

AI 投顾默认使用**模拟回复**，要接入真实 AI 需要部署 Cloudflare Workers AI：

### 1. 部署 Worker

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录
wrangler login

# 进入 Worker 目录并部署
cd workers/ai-advisor
wrangler deploy
```

部署成功后会得到 Worker URL：
```
https://wealth-ai-advisor.你的子域.workers.dev
```

### 2. 在 Cloudflare Pages 配置环境变量

1. Cloudflare Dashboard → Pages → 你的项目 → Settings → Environment variables
2. 添加变量：
   - **Variable name**: `VITE_WORKERS_AI_URL`
   - **Value**: `https://wealth-ai-advisor.你的子域.workers.dev`
3. 重新部署（Deployments → Retry deployment）

### 3. 验证

部署完成后，进入应用 → AI 投顾 → 提问，AI 即可使用 Llama 3.1 8B 模型回答。

---

## 📁 项目结构

```
wealth-agent/
├── src/
│   ├── components/         # React UI 组件
│   │   ├── AIAdvisor.tsx
│   │   ├── AssetList.tsx
│   │   ├── AssetPieChart.tsx
│   │   ├── AssetBarChart.tsx
│   │   ├── HoldingList.tsx
│   │   ├── WealthSummaryCards.tsx
│   │   └── ...
│   ├── pages/              # 页面组件
│   ├── stores/             # Zustand 状态管理
│   │   ├── assetStore.ts
│   │   ├── holdingStore.ts
│   │   └── aiStore.ts
│   ├── services/           # API 服务
│   │   ├── stockService.ts # 腾讯财经行情 API
│   │   └── aiService.ts    # AI 投顾
│   ├── utils/              # 工具函数
│   │   └── wealthCalculator.ts
│   └── types/              # TypeScript 类型定义
├── electron/               # Electron 桌面端
│   ├── main.js
│   └── preload.js
├── workers/
│   └── ai-advisor/         # Cloudflare Workers AI
│       ├── src/index.ts
│       └── wrangler.toml
├── dist/                   # 构建产物（部署到 Cloudflare Pages）
├── .github/workflows/      # GitHub Actions 自动部署
├── index.html              # HTML 入口
├── vite.config.ts          # Vite 配置
└── package.json
```

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 状态管理 | Zustand |
| UI 组件 | Ant Design 5 |
| 图表 | ECharts 5 |
| 构建工具 | Vite 5 |
| 桌面端 | Electron |
| 后端（AI） | Cloudflare Workers AI (Llama 3.1 8B) |
| 部署 | Cloudflare Pages + Workers |
| 行情数据 | 腾讯财经 API（免费、无需 key） |

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

## 🐛 故障排查

### Cloudflare Pages 部署失败？

参见 [CLOUDFLARE_PAGES_FIX.md](CLOUDFLARE_PAGES_FIX.md)

最常见原因：
- ❌ 部署命令写成 `npx wrangler deploy`（这是 Workers 的命令）
- ✅ **应该留空**，让 Cloudflare Pages 自动处理静态文件部署

### 桌面应用启动失败？

```bash
# 清理后重试
rmdir /s /q node_modules
npm install
run-app.bat
```

---

## 📈 路线图

- [x] MVP：资产管理、持仓管理、AI 投顾
- [x] Cloudflare 免费部署方案
- [x] 桌面端 Electron 打包
- [ ] 多用户登录系统
- [ ] 数据云同步
- [ ] 微信小程序版本

---

## 📄 许可证

MIT License

## ⚠️ 免责声明

本应用仅供个人财富管理参考，不构成任何投资建议。投资有风险，决策需谨慎。
