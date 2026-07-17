# WealthAgent

AI-powered personal wealth management application. Track assets, monitor holdings with real-time market data, and get intelligent investment insights 鈥?all in one place.

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Features

- **Asset Management** 鈥?Track 6 asset categories (cash, stocks, funds, real estate, precious metals, debt) with 25+ sub-types
- **Holdings Tracker** 鈥?Real-time stock and fund prices with 5-source failover (Eastmoney, Tencent, Sina, NetEase, Yahoo)
- **AI Investment Advisor** 鈥?Context-aware chat powered by multiple LLMs, analyzing your actual portfolio
- **Net Worth Goal** 鈥?Set targets, track progress, and project completion timeline
- **Multi-Platform** 鈥?Web, Desktop (Electron), and Mobile (Capacitor Android) from a single codebase
- **Free Hosting** 鈥?Deploy on Cloudflare Pages + D1 + Workers AI at zero cost

## Screenshots

<p align="center">
  <img src="docs/images/desktop-overview.png" width="800" alt="Desktop - Portfolio Overview" />
</p>

<p align="center">
  <img src="docs/images/mobile-overview.png" width="250" alt="Mobile - Overview" />
  &nbsp;&nbsp;
  <img src="docs/images/mobile-holdings.png" width="250" alt="Mobile - Holdings" />
  &nbsp;&nbsp;
  <img src="docs/images/mobile-holdings-detail.png" width="250" alt="Mobile - Holdings Detail" />
</p>

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| State | Zustand |
| UI | Ant Design 5 |
| Charts | Recharts, ECharts |
| Desktop | Electron 43 |
| Mobile | Capacitor 8 (Android) |
| Backend | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) |
| AI | Cloudflare Workers AI (GLM, Qwen, Llama, Gemma) |
| Market Data | 5-source failover: Eastmoney, Tencent, Sina, NetEase, Yahoo |

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install & Run

```bash
git clone https://github.com/Kingbulude/wealth-agent.git
cd wealth-agent
npm install
npm run dev
```

Open http://localhost:5173

### Build

```bash
npm run build        # Web output to dist/
npm run lint         # Lint check
```

### Desktop (Electron)

```bash
npm run electron:dev     # Development
npm run electron:build   # Package Windows installer
```

### Mobile (Android)

```bash
npm run cap:sync    # Build and sync to Android project
npm run cap:open    # Open in Android Studio
```

## Project Structure

```
wealth-agent/
鈹溾攢鈹€ src/
鈹?  鈹溾攢鈹€ components/       # UI components
鈹?  鈹溾攢鈹€ pages/            # Page shells (Dashboard)
鈹?  鈹溾攢鈹€ renderer/         # App entry, auth, routing
鈹?  鈹溾攢鈹€ stores/           # Zustand state (assets, holdings, goals, portfolio)
鈹?  鈹溾攢鈹€ services/         # Market data, AI, notifications
鈹?  鈹溾攢鈹€ utils/            # Wealth calculator, chart themes, classifiers
鈹?  鈹溾攢鈹€ types/            # TypeScript definitions
鈹?  鈹斺攢鈹€ config/           # AI strategy configurations
鈹溾攢鈹€ electron/             # Electron main/preload
鈹溾攢鈹€ functions/            # Cloudflare Pages Functions (API)
鈹?  鈹溾攢鈹€ api/              # Route handlers
鈹?  鈹斺攢鈹€ lib/              # Auth, JWT, stock data, anti-crawler
鈹溾攢鈹€ android/              # Capacitor Android project
鈹斺攢鈹€ public/               # Static assets
```

## API Routes

| Route | Description |
|-------|-------------|
| `/api/auth/*` | User registration and login |
| `/api/stock/:code` | Stock price proxy (5-source failover) |
| `/api/fund/:code` | Fund NAV proxy |
| `/api/search` | Security search |
| `/api/holdings/*` | Holdings CRUD |
| `/api/assets/*` | Assets CRUD |
| `/api/portfolio/summary` | Aggregated portfolio summary |
| `/api/ai/chat` | AI chat with streaming |
| `/api/ai/stock-analysis` | Deep stock analysis |

## Deployment

### Cloudflare Pages

1. Push to GitHub
2. Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git
3. Set build config:
   - Framework: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | JWT signing key (set in Cloudflare dashboard) |
| `FEISHU_WEBHOOK` | Optional Feishu push webhook |

## Roadmap

- [ ] Multi-user system with full cloud sync
- [ ] WeChat Mini Program
- [ ] Portfolio analytics and reporting
- [ ] Import/Export (CSV, Excel)
- [ ] Multi-currency support

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)

## Disclaimer

This application is for personal wealth management reference only and does not constitute investment advice. Investment involves risk.
