# 💰 财富管理智能体 (WealthAgent)

> AI驱动的个人资产管家，让每个人都能享受专业级的财富管理服务

## 🎯 项目简介

财富管理智能体是一款基于AI的个人/家庭财富管理应用，能够：
- 📊 展示财富净值和资产分布
- 💹 管理投资持仓
- 🤖 与AI对话获取投资建议
- 📈 实时追踪股票行情

## ✨ 核心功能

### 资产总览
- 净资产统计（总资产 - 总负债）
- 资产分布可视化（饼图、柱状图）
- 流动性评分

### 资产管理
- 支持多种资产类型：现金、股票、基金、房产、负债
- 支持多币种：人民币、美元、欧元、港币、日元
- 完整的CRUD操作

### 持仓管理
- 股票和基金持仓管理
- 盈亏计算和展示
- 持仓成本跟踪

### AI投顾
- 自然语言对话
- 专业的投资建议
- 风险评估

## 🛠️ 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **状态管理**: Zustand
- **UI组件**: Ant Design 5
- **图表**: ECharts 5
- **桌面端**: Electron (待打包)

### AI
- **对话模型**: OpenAI GPT-3.5/GPT-4 (可选)
- **本地模拟**: 预置智能回复

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd wealth-agent

# 安装依赖
npm install
```

### 运行开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

### 配置AI功能（可选）

创建 `.env` 文件：

```
VITE_OPENAI_API_KEY=your-openai-api-key
```

## 📁 项目结构

```
wealth-agent/
├── src/
│   ├── main/                 # Electron主进程
│   ├── preload/             # 预加载脚本
│   ├── renderer/            # React应用
│   │   ├── components/      # UI组件
│   │   ├── pages/           # 页面
│   │   ├── stores/          # 状态管理
│   │   ├── services/        # API服务
│   │   ├── utils/           # 工具函数
│   │   └── types/           # 类型定义
│   └── shared/              # 共享代码
├── public/                  # 静态资源
├── index.html               # HTML入口
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron-builder.json
```

## 🎨 界面预览

### 资产总览
- 四个统计卡片：净资产、总资产、总负债、流动性评分
- 资产分布饼图
- 资产构成柱状图

### 持仓管理
- 持仓列表展示
- 盈亏计算和展示
- 添加/编辑/删除持仓

### AI投顾
- 自然语言对话
- Markdown格式回复
- 专业的投资建议

## 📈 开发路线图

### MVP版本 ✅
- [x] 用户注册登录
- [x] 资产数据管理
- [x] 财富净值计算
- [x] 数据可视化
- [x] 持仓管理
- [x] AI对话功能

### V1.0版本 (计划中)
- [ ] 股票行情实时API
- [ ] FastAPI后端服务
- [ ] PostgreSQL数据库
- [ ] WebSocket实时推送
- [ ] 持仓分析增强
- [ ] 风险评估模型

### V2.0版本 (计划中)
- [ ] 云端部署
- [ ] 数据同步
- [ ] 长期记忆系统
- [ ] 投资决策追踪

### 小程序版本 (计划中)
- [ ] 微信小程序迁移
- [ ] Taro框架适配
- [ ] 移动端优化

## 🔧 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建结果 |
| `npm run lint` | 代码检查 |
| `npm run lint:fix` | 自动修复代码问题 |

## ⚠️ 免责声明

本应用仅供个人财富管理参考，不构成任何投资建议。投资有风险，决策需谨慎。

## 📄 许可证

MIT License

## 👨‍💻 作者

TRAE AI 创造力大赛参赛作品