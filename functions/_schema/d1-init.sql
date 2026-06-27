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
