# WebView 微信小程序实施方案

## 一、方案概述

在现有 React H5 项目基础上，新增一个独立的微信小程序项目（纯 WebView 容器），通过 `<web-view>` 组件加载现有 H5 页面，实现微信小程序快速上线。

**核心原则：零侵入现有代码**
- 不修改 `src/`、`functions/`、`public/` 等任何现有目录
- 小程序代码放在独立目录 `miniprogram/` 下
- 使用独立 git 分支开发，不污染 main 分支

---

## 二、当前项目结构分析

```
/workspace/
├── src/              # React H5 前端代码（不动）
├── functions/        # Cloudflare Pages API（不动）
├── public/           # 静态资源（不动）
├── electron/         # 桌面端代码（不动）
├── index.html        # H5 入口（不动）
├── vite.config.ts    # Vite 配置（不动）
├── package.json      # 项目依赖（不动）
└── miniprogram/      # ← 新增：微信小程序代码（独立目录）
```

**现有 H5 部署地址**：`https://wealth-agent.pages.dev`（Cloudflare Pages）
**小程序作用**：仅作为 WebView 容器壳，加载上述 H5 地址

---

## 三、小程序项目结构（新增）

```
miniprogram/
├── app.js                  # 小程序入口
├── app.json                # 全局配置（页面路由、窗口样式等）
├── app.wxss                # 全局样式
├── project.config.json     # 开发者工具项目配置
├── sitemap.json            # 小程序搜索配置
├── pages/
│   └── index/              # 唯一页面：WebView 容器
│       ├── index.js        # 页面逻辑
│       ├── index.wxml      # 页面结构（只有 <web-view>）
│       ├── index.wxss      # 页面样式
│       └── index.json      # 页面配置
└── README.md               # 小程序部署说明
```

---

## 四、实施步骤

### 阶段 1：项目脚手架搭建

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1.1 | 创建 git 分支 `feat/wechat-webview` | 从 main 分支切出，隔离开发 |
| 1.2 | 创建 `miniprogram/` 目录 | 独立目录，不影响现有代码 |
| 1.3 | 编写 `app.js` / `app.json` / `app.wxss` | 小程序全局配置 |
| 1.4 | 编写 `project.config.json` | 开发者工具项目配置 |
| 1.5 | 编写 `sitemap.json` | 搜索配置 |
| 1.6 | 创建 `pages/index/` 页面 | 唯一页面，只放 web-view |

### 阶段 2：WebView 页面实现

| 步骤 | 操作 | 说明 |
|------|------|------|
| 2.1 | 编写 `index.wxml` | 只有一行 `<web-view src="{{url}}"></web-view>` |
| 2.2 | 编写 `index.js` | 配置 H5 地址，处理加载状态 |
| 2.3 | 编写 `index.wxss` | 全屏布局，无多余元素 |
| 2.4 | 编写 `index.json` | 页面标题、导航栏配置 |
| 2.5 | 添加加载状态提示 | web-view 加载时显示 loading |

### 阶段 3：域名校验文件

| 步骤 | 操作 | 说明 |
|------|------|------|
| 3.1 | 说明域名校验流程 | 用户需在小程序后台配置业务域名 |
| 3.2 | 准备校验文件放置说明 | 告诉用户把校验文件放到 `public/` 目录 |
| 3.3 | 修改 `public/_headers` | 确保校验文件可被访问 |

### 阶段 4：部署说明文档

| 步骤 | 操作 | 说明 |
|------|------|------|
| 4.1 | 编写 `miniprogram/README.md` | 详细的上线步骤说明 |
| 4.2 | 小程序注册流程 | 账号注册、AppID 获取 |
| 4.3 | 开发者工具使用 | 下载、导入项目、上传代码 |
| 4.4 | 业务域名配置 | 后台配置步骤截图说明 |
| 4.5 | 提交审核流程 | 类目选择、审核注意事项 |
| 4.6 | 发布上线 | 审核通过后发布 |

### 阶段 5：验证与交付

| 步骤 | 操作 | 说明 |
|------|------|------|
| 5.1 | 代码检查 | 确认未修改任何现有文件 |
| 5.2 | 类型检查 | `npx tsc --noEmit` 确认 H5 代码不受影响 |
| 5.3 | 构建验证 | `npm run build` 确认 H5 构建正常 |
| 5.4 | 推送到分支 | 推送到 `feat/wechat-webview` 分支 |

---

## 五、关键文件说明

### 5.1 `miniprogram/pages/index/index.wxml`（核心）

```xml
<!-- 只有一个 web-view 组件，全屏加载 H5 -->
<web-view src="{{webViewUrl}}" bindload="onLoad" binderror="onError"></web-view>
```

### 5.2 `miniprogram/pages/index/index.js`

```javascript
Page({
  data: {
    webViewUrl: 'https://wealth-agent.pages.dev',
    loading: true
  },
  onLoad() {
    // 可通过参数动态改变 URL，如 ?from=wechat
    const url = this.data.webViewUrl + '?utm_source=wechat_miniprogram'
    this.setData({ webViewUrl: url })
  },
  onLoad() {
    this.setData({ loading: false })
  },
  onError(e) {
    console.error('WebView加载失败:', e.detail)
    wx.showToast({ title: '加载失败，请重试', icon: 'none' })
  }
})
```

### 5.3 `miniprogram/app.json`

```json
{
  "pages": ["pages/index/index"],
  "window": {
    "navigationBarTitleText": "财富管理助手",
    "navigationBarBackgroundColor": "#0a0a0f",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#0a0a0f"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

---

## 六、风险与注意事项

### 6.1 代码安全

- ✅ **零侵入**：小程序代码完全在 `miniprogram/` 独立目录
- ✅ **分支隔离**：在 `feat/wechat-webview` 分支开发，不影响 main
- ✅ **回滚简单**：不需要直接删除分支即可

### 6.2 审核风险

| 风险 | 概率 | 应对策略 |
|------|------|---------|
| 类目选择不对被打回 | 中 | 选「工具-记账」，简介往个人记账靠 |
| 网页内容涉金融被查 | 中 | 小程序名称和简介弱化金融属性 |
| 需要企业资质 | 低 | 先用个人主体试试，不行再升级 |

### 6.3 技术限制

- WebView 组件仅企业和个人主体都能用
- 业务域名必须 HTTPS（现有 Cloudflare Pages 已满足）
- 每个小程序最多配置 200 个业务域名（我们只用 1 个）

---

## 七、用户需要配合的事项

1. **注册小程序账号**：个人/企业，获取 AppID
2. **下载微信开发者工具**：官方 IDE
3. **配置业务域名**：小程序后台添加 H5 域名，下载校验文件
4. **上传校验文件**：把校验文件发给我，我放到 `public/` 目录
5. **提交审核**：用开发者工具上传代码，在后台提交审核

---

## 八、现有文件改动清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `miniprogram/`（整个目录） | 新增 | 小程序项目代码，完全独立 |
| `public/`（可能新增校验文件） | 可能新增 | 域名校验文件（用户提供后添加） |
| 其他所有文件 | 无改动 | 完全不动 |

**确认：现有 src/、functions/、package.json、vite.config.ts 等核心文件全部不修改。**
