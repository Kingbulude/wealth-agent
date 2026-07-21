-- Wealth Terminal D1 Database Schema
-- Run this in Cloudflare Dashboard → D1 → your DB → Console

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 股票基础信息表（全量 A 股）
CREATE TABLE IF NOT EXISTS stock_basic (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pinyin TEXT,
  market TEXT NOT NULL,
  industry TEXT,
  industry2 TEXT,
  concepts TEXT,
  listing_date TEXT,
  total_shares REAL,
  circulating_shares REAL,
  pe REAL,
  pb REAL,
  total_market_cap REAL,
  circulating_market_cap REAL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_name ON stock_basic(name);
CREATE INDEX IF NOT EXISTS idx_stock_pinyin ON stock_basic(pinyin);
CREATE INDEX IF NOT EXISTS idx_stock_industry ON stock_basic(industry);
CREATE INDEX IF NOT EXISTS idx_stock_market ON stock_basic(market);

-- 决策信号表
CREATE TABLE IF NOT EXISTS decision_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('buy','add','hold','reduce','sell','avoid')),
  score INTEGER CHECK(score >= 0 AND score <= 100),
  horizon TEXT CHECK(horizon IN ('intraday','1d','3d','5d','swing','long')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('analysis','agent','alert','manual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','invalidated','closed')),
  strategy TEXT,
  reason TEXT,
  stop_loss REAL,
  target_price REAL,
  created_at TEXT NOT NULL,
  expired_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_signals_user ON decision_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON decision_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_status ON decision_signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_created ON decision_signals(created_at);

-- 错误日志表（前端错误监控上报）
CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  stack TEXT,
  source TEXT,
  line_no INTEGER,
  column_no INTEGER,
  url TEXT NOT NULL,
  user_agent TEXT,
  timestamp INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'js_error',
  extra TEXT
);

CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(type);

-- 用户偏好设置表（三端同步：飞书配置、主题、自定义类型等）
CREATE TABLE IF NOT EXISTS preferences (
  user_email TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_email, key)
);

CREATE INDEX IF NOT EXISTS idx_preferences_user ON preferences(user_email);

-- 投资笔记表
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cognition',
  title TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  content_text TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  related_holding_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_email);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(is_archived);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);

-- 学习资源表
CREATE TABLE IF NOT EXISTS learning_resources (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_user ON learning_resources(user_email);
CREATE INDEX IF NOT EXISTS idx_learning_type ON learning_resources(type);

-- 持仓表
CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_email);

-- 资产表
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_email);

-- 交易记录表
CREATE TABLE IF NOT EXISTS position_trade_records (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  holding_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('buy','sell')),
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  target_price REAL,
  stop_loss_price REAL,
  holding_period TEXT,
  market_context TEXT,
  record_time TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_user ON position_trade_records(user_email);
CREATE INDEX IF NOT EXISTS idx_trade_holding ON position_trade_records(holding_id);

-- 复盘笔记表
CREATE TABLE IF NOT EXISTS position_review_notes (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  holding_id TEXT NOT NULL,
  content_json TEXT NOT NULL,
  content_text TEXT NOT NULL DEFAULT '',
  price_snapshot REAL,
  profit_pct_snapshot REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_user ON position_review_notes(user_email);
CREATE INDEX IF NOT EXISTS idx_review_holding ON position_review_notes(holding_id);
