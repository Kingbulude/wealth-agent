# Cloudflare Pages 部署配置指南

## 错误说明

错误信息：
```
[错误] 无法检测到项目静态文件（例如 html、css 和 js）所在的目录
```

**原因**：你的项目被 Cloudflare 当作 **Workers** 项目部署（使用 wrangler），而我们的是一个 **Pages** 静态站点项目。

---

## 在 Cloudflare Pages 控制台的正确配置

### 项目设置 → 构建配置：

| 配置项 | 值 |
|---|---|
| 框架预设 | **Vite** |
| 构建命令 | `npm run build` |
| 部署命令 | **（留空）** |
| 构建输出目录 | `dist` |
| 根目录 | `wealth-agent` |

### 重要修改点：

1. **部署命令留空**（之前是 `npx wrangler 部署`）
2. **根目录** = `wealth-agent`（因为你的 GitHub 仓库 `Kingbulude/wealth-agent` 里的代码在 `wealth-agent` 子目录里）
3. **构建命令** = `npm run build`（不要用 wrangler）
4. **输出目录** = `dist`（Vite 的默认输出目录）

---

## 验证仓库结构

你的 GitHub 仓库结构应该是这样的：
```
Kingbulude/wealth-agent/
└── wealth-agent/        ← 根目录设成这个
    ├── package.json
    ├── vite.config.ts
    ├── dist/            ← 输出目录
    └── src/
```

---

## 修改步骤

1. 打开 https://dash.cloudflare.com/
2. Workers & Pages → 找到 `wealth-agent` 项目
3. **设置** → **构建** → 修改以下：
   - 框架预设：**Vite**
   - 构建命令：`npm run build`
   - 部署命令：清空
   - 构建输出目录：`dist`
   - 根目录：`wealth-agent`
4. 保存 → 自动重新部署
5. 等 1-2 分钟，构建成功后会自动给你一个 `xxx.pages.dev` 域名

---

## 部署 Workers AI（可选）

如果要让 AI 投顾能联网调用真实 AI 模型，再单独部署 Workers：

1. 在 Cloudflare 控制台 → Workers & Pages → Create → Create Worker
2. 选择 **"从 Hello World 开始"** → 给它起名 `wealth-ai-advisor`
3. 打开编辑器，把 `workers/ai-advisor/src/index.ts` 的内容粘贴进去
4. 部署
5. 回到 Pages 项目 → 设置 → 环境变量 → 添加：
   - 变量名：`VITE_WORKERS_AI_URL`
   - 值：`https://wealth-ai-advisor.你的子域.workers.dev`
6. 重新部署

---

## 我已经推送到 GitHub

我加了 `dist/_redirects` 文件（SPA fallback 路由），让 React Router 刷新时不会 404。仓库更新后 Cloudflare Pages 会自动拉取最新代码重新部署。
