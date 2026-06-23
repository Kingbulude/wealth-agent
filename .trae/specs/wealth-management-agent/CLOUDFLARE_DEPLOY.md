# Cloudflare 免费部署指南

## 部署概览

```
前端（Cloudflare Pages）
└── 纯静态 SPA（React + Zustand）
    └── 免费托管、全球 CDN、自动 HTTPS

AI 后端（Cloudflare Workers + Workers AI）
└── 免费 Llama 3.1 8B 模型
    └── 每日 10 万次请求额度
```

---

## 第一部分：部署前端到 Cloudflare Pages

### Step 1：注册账号
1. 访问 https://dash.cloudflare.com/ 注册（用邮箱即可，完全免费）
2. 注册后进入 Dashboard

### Step 2：上传代码到 GitHub
1. 打开 https://github.com/ 并注册账号
2. 点击 "New repository" 创建新仓库，命名为 `wealth-agent`
3. 把项目代码上传到这个仓库：
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/你的用户名/wealth-agent.git
   git push -u origin main
   ```

### Step 3：连接 Cloudflare Pages
1. Cloudflare Dashboard → 左侧菜单 → **Workers & Pages**
2. 点击 **创建应用程序** → 选择 **Pages** → **连接到 GitHub**
3. 授权 GitHub 访问
4. 选择仓库 `wealth-agent`，设置以下选项：
   - **生产分支**：`main`
   - **构建命令**：`npm run build`
   - **构建输出目录**：`dist`
   - **环境变量**（点击展开）：
     - `NODE_VERSION` = `18`

5. 点击 **保存并部署**

### Step 4：获取访问地址
部署完成后，Cloudflare 会给你一个免费域名：
```
https://xxxxx.pages.dev
```
这就是你的应用地址，全球可访问！

---

## 第二部分：部署 AI 后端（Cloudflare Workers AI）

### Step 1：安装 Wrangler CLI
```bash
npm install -g wrangler
```

### Step 2：登录 Cloudflare
```bash
wrangler login
```
（会在浏览器打开授权页面，点击允许即可）

### Step 3：部署 Workers AI
```bash
cd workers/ai-advisor
wrangler deploy
```

部署成功后会显示 Worker URL，格式如：
```
https://wealth-ai-advisor.你的账号.workers.dev
```

### Step 4：验证 AI 是否工作
```bash
curl -X POST https://wealth-ai-advisor.你的账号.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'
```

返回 AI 回复即为成功。

---

## 第三部分：让前端调用 AI

### 把 Workers URL 配置到前端

1. 打开 Cloudflare Pages 的设置 → **环境变量**
2. 添加：
   - **变量名**：`VITE_WORKERS_AI_URL`
   - **值**：`https://wealth-ai-advisor.你的账号.workers.dev`
3. 重新部署（点击 **重新部署** 按钮）

---

## 第四部分：自定义域名（可选）

如果你有自己的域名：
1. Cloudflare Dashboard → Pages → 你的项目 → **自定义域**
2. 输入你的域名，按提示添加 DNS 记录
3. 等待验证通过，即可使用你的域名访问

---

## 费用说明

| 服务 | 免费额度 | 本项目使用量 | 是否免费 |
|------|---------|------------|---------|
| Cloudflare Pages | 无限带宽 | < 1GB 静态资源 | ✅ 完全免费 |
| Cloudflare Workers | 每日 10 万次请求 | 每天 < 100 次 | ✅ 完全免费 |
| Workers AI | 每日推理额度 | 每天 < 100 次 | ✅ 完全免费 |
| Cloudflare D1 | 1GB 存储 | 本项目暂不需要 | ✅ 暂不需要 |
| 域名 | pages.dev 免费二级域名 | - | ✅ 免费 |

**结论：整套部署 0 元，无需信用卡，无需备案。**

---

## 目录结构说明

```
wealth-agent/
├── dist/                      ← 部署到 Cloudflare Pages 的静态文件
│   ├── index.html
│   └── assets/
├── workers/
│   └── ai-advisor/            ← Cloudflare Workers AI
│       ├── src/index.ts       ← Worker 代码
│       └── wrangler.toml      ← Worker 配置
├── src/
│   └── services/
│       └── aiService.ts       ← 前端 AI 调用（会请求 Workers）
└── .dev.vars.example          ← 环境变量模板
```

---

## 常见问题

**Q: 部署后 AI 投顾没有回复？**
A: 检查 `VITE_WORKERS_AI_URL` 是否正确配置，然后重新部署。

**Q: 国内访问慢吗？**
A: Cloudflare 在全球有 CDN 节点，国内访问速度比 Vercel 快很多。

**Q: Workers AI 免费额度用完了怎么办？**
A: 前端会自动降级到模拟回复模式，不会崩溃。
