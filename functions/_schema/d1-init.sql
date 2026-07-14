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
