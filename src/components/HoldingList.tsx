// 持仓管理页
// 设计风格：Modern Wealth Terminal
// 特点：实时行情 + 盈亏展示 + 联动资产管理 + 30秒自动刷新

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Table, Button, message, Modal, Form, Input, InputNumber, Select, Popconfirm, Empty, Tooltip, AutoComplete, Radio, Drawer
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  StockOutlined, FundOutlined, HistoryOutlined, BulbOutlined,
  RiseOutlined, FallOutlined, ThunderboltOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ArrowLeftOutlined
} from '@ant-design/icons'
import { Holding } from '../types/holding'
import { useHoldingStore } from '../stores/holdingStore'
import { searchSecurities, fetchStockPrice, fetchFundNav, StockSearchResult } from '../services/stockService'
import { CompactNumber } from '../utils/compactNumber'
import { usePositionNotesStore } from '../stores/positionNotesStore'
import TradeRecordTimeline from './TradeRecordTimeline'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useBackHandler } from '../hooks/useBackHandler'
import ScreenshotImportModal, { ImportHoldingData } from './ScreenshotImportModal'

const fmt2 = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt4 = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

function detectHoldingType(symbol: string, name: string): 'stock' | 'fund' {
  const code = symbol.replace(/^(SH|SZ)/i, '')
  // 基金代码常见开头
  const fundPrefixes = ['50', '51', '52', '15', '16', '18', '11', '12']
  if (fundPrefixes.some(p => code.startsWith(p))) return 'fund'
  // 名称中含基金、ETF、LOF、联接、指数等关键字
  const fundKeywords = ['基金', 'ETF', 'LOF', '联接', '指数', '债券', '货币', '分级']
  if (fundKeywords.some(k => name.toUpperCase().includes(k.toUpperCase()))) return 'fund'
  return 'stock'
}

function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()
}

export default function HoldingList() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'stock' | 'fund'>('all')
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [previewPrice, setPreviewPrice] = useState<{ price: number; source: string } | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tradeRecordVisible, setTradeRecordVisible] = useState(false)
  const [tradeRecordHolding, setTradeRecordHolding] = useState<Holding | null>(null)
  const [screenshotImportVisible, setScreenshotImportVisible] = useState(false)
  const [form] = Form.useForm()
  const searchTimerRef = useRef<number | null>(null)
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMobile = useIsMobile()
  const isApp = isCapacitorNative()
  const showAsMobile = isMobile || isApp

  // 交易记录抽屉：支持返回键 / 返回手势关闭
  useBackHandler(tradeRecordVisible, () => setTradeRecordVisible(false))

  const {
    loadHoldings, addHolding, updateHolding, deleteHolding,
    refreshPrices, refreshing, holdings
  } = useHoldingStore()
  const { createTrade, loadTrades } = usePositionNotesStore()

  useEffect(() => {
    loadHoldings()
    // 30秒刷新一次行情（持仓页需要更频繁）
    autoRefreshRef.current = setInterval(() => {
      refreshPrices()
    }, 30_000)
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
        autoRefreshRef.current = null
      }
    }
  }, [])

  // ============== 汇总数据 ==============
  const summary = useMemo(() => {
    let totalValue = 0
    let totalCost = 0
    let profit = 0
    let dayChange = 0
    let stockCount = 0
    let fundCount = 0

    for (const h of holdings) {
      const value = (h.currentPrice || h.avgCost) * h.quantity
      const cost = h.avgCost * h.quantity
      totalValue += value
      totalCost += cost
      profit += value - cost
      // 估算日内变动（基于 currentChangePercent）
      if (h.currentChangePercent) {
        dayChange += (h.currentPrice * h.quantity) * (h.currentChangePercent / 100)
      }
      if (h.type === 'stock') stockCount++
      else if (h.type === 'fund') fundCount++
    }
    return { totalValue, totalCost, profit, dayChange, stockCount, fundCount }
  }, [holdings])

  const isProfit = summary.profit >= 0
  const isDayUp = summary.dayChange >= 0

  const filteredHoldings = useMemo(() => {
    if (filterType === 'all') return holdings
    return holdings.filter(h => h.type === filterType)
  }, [holdings, filterType])

  // ============== 添加/编辑 ==============
  const openAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ type: 'stock', currency: 'CNY' })
    setPreviewPrice(null)
    setSearchResults([])
    setModalOpen(true)
  }

  const openEdit = (record: Holding) => {
    setEditing(record)
    form.setFieldsValue({
      type: record.type,
      symbol: record.symbol,
      name: record.name,
      quantity: record.quantity,
      avgCost: record.avgCost,
      currency: record.currency
    })
    setPreviewPrice({ price: record.currentPrice || record.avgCost, source: '当前价' })
    setSearchResults([])
    setModalOpen(true)
  }

  const submit = async () => {
    try {
      setSubmitting(true)
      const values = await form.validateFields()
      const data = {
        type: values.type,
        symbol: values.symbol,
        name: values.name,
        quantity: Number(values.quantity),
        avgCost: Number(values.avgCost),
        currency: values.currency || 'CNY'
      }
      let holdingId: string
      if (editing) {
        await updateHolding(editing.id, data)
        holdingId = editing.id
        message.success('已更新')
      } else {
        const newHolding = await addHolding(data)
        // 优先用 addHolding 返回的；否则取最后一个匹配 symbol+name 的
        holdingId = (newHolding as any)?.id
          || (() => {
              const found = holdings.find(h => h.symbol === data.symbol && h.name === data.name)
              return found?.id
            })()
          || crypto.randomUUID()
        message.success('已添加')
        // 同步创建第一条买入逻辑交易记录
        const reason = String(values.buyReason || '').trim()
        if (reason) {
          try {
            await createTrade({
              holding_id: holdingId,
              action: 'buy',
              price: Number(values.avgCost),
              quantity: Number(values.quantity),
              reason,
              target_price: values.targetPrice != null ? Number(values.targetPrice) : null,
              stop_loss_price: values.stopLossPrice != null ? Number(values.stopLossPrice) : null,
              holding_period: values.holdingPeriod || null,
              market_context: values.marketContext || null
            })
            message.success('已记录买入逻辑')
          } catch (e) {
            console.warn('记录买入逻辑失败:', e)
          }
        }
      }
      setModalOpen(false)
      // 添加/编辑后立即刷新行情
      setTimeout(() => refreshPrices(), 500)
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openTradeRecordDrawer = (record: Holding) => {
    setTradeRecordHolding(record)
    setTradeRecordVisible(true)
    loadTrades(record.id)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteHolding(id)
      message.success('已删除')
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  // ============== 搜索/自动补全 ==============
  const handleSearch = (value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!value || value.trim().length === 0) {
      setSearchResults([])
      return
    }
    searchTimerRef.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const type = (form.getFieldValue('type') || 'stock') as 'stock' | 'fund'
        const results = await searchSecurities(value, type)
        setSearchResults(results)
      } catch (e) {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  const handleSearchSelect = async (code: string, option: any) => {
    form.setFieldsValue({ symbol: code, name: option.name || option.label })
    setSearchResults([])
    setPreviewPrice(null)
    setLoadingPrice(true)
    try {
      const type = (form.getFieldValue('type') || 'stock') as 'stock' | 'fund'
      if (type === 'stock') {
        const data = await fetchStockPrice(code)
        if (data && data.price > 0) {
          setPreviewPrice({ price: data.price, source: data.name })
          form.setFieldsValue({ name: data.name })
        }
      } else if (type === 'fund') {
        const data = await fetchFundNav(code)
        if (data && data.nav > 0) {
          setPreviewPrice({ price: data.nav, source: data.name })
          form.setFieldsValue({ name: data.name })
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingPrice(false)
    }
  }

  // ============== 表格列 ==============
  const columns: ColumnsType<Holding> = [
    {
      title: '标的',
      key: 'name',
      width: 220,
      fixed: 'left' as const,
      render: (_, record) => {
        const isStock = record.type === 'stock'
        const color = isStock ? '#3a6fc7' : '#8a5cc9'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: `${color}15`, color: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0
            }}>
              {isStock ? <StockOutlined /> : <FundOutlined />}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                {record.name}
              </div>
              <div className="num" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {isStock ? '股票' : '基金'} · {record.symbol}
              </div>
            </div>
          </div>
        )
      }
    },
    {
      title: '持仓数量',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      width: 120,
      render: (v: number) => (
        <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>
          {v.toLocaleString('zh-CN', { maximumFractionDigits: 4 })}
        </div>
      )
    },
    {
      title: '成本价',
      dataIndex: 'avgCost',
      key: 'avgCost',
      align: 'right' as const,
      width: 120,
      render: (v: number) => (
        <div className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
          ¥{fmt4(v)}
        </div>
      )
    },
    {
      title: '现价',
      key: 'currentPrice',
      align: 'right' as const,
      width: 130,
      render: (_, r) => {
        const price = r.currentPrice || r.avgCost
        const change = r.currentChangePercent || 0
        const isUp = change > 0
        const isDown = change < 0
        return (
          <div>
            <div className="num" style={{
              fontSize: 14, fontWeight: 600,
              color: isUp ? 'var(--up)' : isDown ? 'var(--down)' : 'var(--text-primary)'
            }}>
              ¥{fmt2(price)}
            </div>
            {change !== 0 && (
              <div className="num" style={{
                fontSize: 11, marginTop: 2, fontWeight: 600,
                color: isUp ? 'var(--up)' : 'var(--down)'
              }}>
                {isUp ? '+' : ''}{change.toFixed(2)}%
              </div>
            )}
          </div>
        )
      }
    },
    {
      title: '市值',
      key: 'marketValue',
      align: 'right' as const,
      width: 140,
      sorter: (a, b) => ((a.currentPrice || a.avgCost) * a.quantity) - ((b.currentPrice || b.avgCost) * b.quantity),
      render: (_, r) => {
        const value = (r.currentPrice || r.avgCost) * r.quantity
        return (
          <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            ¥{fmt2(value)}
          </div>
        )
      }
    },
    {
      title: '盈亏金额',
      key: 'profit',
      align: 'right' as const,
      width: 140,
      sorter: (a, b) => {
        const pa = ((a.currentPrice || a.avgCost) - a.avgCost) * a.quantity
        const pb = ((b.currentPrice || b.avgCost) - b.avgCost) * b.quantity
        return pa - pb
      },
      render: (_, r) => {
        const cost = r.avgCost * r.quantity
        const value = (r.currentPrice || r.avgCost) * r.quantity
        const profit = value - cost
        const isUp = profit > 0
        const isDown = profit < 0
        return (
          <div className="num" style={{
            fontSize: 14, fontWeight: 700,
            color: isUp ? 'var(--up)' : isDown ? 'var(--down)' : 'var(--text-tertiary)'
          }}>
            {isUp ? '+' : isDown ? '−' : ''}¥{fmt2(Math.abs(profit))}
          </div>
        )
      }
    },
    {
      title: '盈亏比例',
      key: 'profitPct',
      align: 'right' as const,
      width: 120,
      sorter: (a, b) => {
        const pa = a.avgCost > 0 ? (((a.currentPrice || a.avgCost) - a.avgCost) / a.avgCost) : 0
        const pb = b.avgCost > 0 ? (((b.currentPrice || b.avgCost) - b.avgCost) / b.avgCost) : 0
        return pa - pb
      },
      render: (_, r) => {
        const cost = r.avgCost * r.quantity
        const value = (r.currentPrice || r.avgCost) * r.quantity
        const profit = value - cost
        const profitPct = cost > 0 ? (profit / cost) * 100 : 0
        const isUp = profit > 0
        const isDown = profit < 0
        return (
          <div className="num" style={{
            fontSize: 14, fontWeight: 700,
            color: isUp ? 'var(--up)' : isDown ? 'var(--down)' : 'var(--text-tertiary)'
          }}>
            {isUp ? '+' : ''}{profitPct.toFixed(2)}%
          </div>
        )
      }
    },
    {
      title: '更新时间',
      key: 'lastUpdated',
      width: 120,
      align: 'center' as const,
      render: (_, r) => {
        if (!r.lastUpdated) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
        const d = new Date(r.lastUpdated)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        const ss = String(d.getSeconds()).padStart(2, '0')
        return (
          <Tooltip title={d.toLocaleString('zh-CN')}>
            <span className="num" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {hh}:{mm}:{ss}
            </span>
          </Tooltip>
        )
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <Tooltip title="交易记录">
            <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => openTradeRecordDrawer(record)} />
          </Tooltip>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title="确定删除该持仓？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      )
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ============ Section Title ============ */}
      <div className="section-header fade-in">
        <div>
          <div className="section-eyebrow">Holdings</div>
          <h1 className="section-title">持仓管理</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            30秒自动刷新
          </span>
          <Button
            type="primary"
            ghost
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={() => refreshPrices()}
          >
            刷新行情
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAdd}
            style={{
              background: 'var(--ink-950)',
              borderColor: 'var(--ink-950)',
              fontWeight: 600
            }}
          >
            添加持仓
          </Button>
          <Button
            icon={<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E" alt="截图" style={{ width: 16, height: 16 }} />}
            onClick={() => setScreenshotImportVisible(true)}
          >
            截图导入
          </Button>
        </div>
      </div>

      {/* ============ 实时汇总卡 ============ */}
      <div className="kpi-grid fade-in-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <div className="kpi-card" style={{ '--accent': '#3a6fc7' } as React.CSSProperties}>
          <div className="kpi-head">
            <div className="kpi-label">
              <span className="kpi-icon" style={{ background: 'rgba(58,111,199,0.12)', color: '#3a6fc7' }}>
                <StockOutlined />
              </span>
              持仓总市值
            </div>
            {refreshing && (
              <span className="chip muted">
                <span className="live-dot busy" />
                同步
              </span>
            )}
          </div>
          <div className="kpi-value" style={{ color: '#3a6fc7' }}>
            <CompactNumber value={summary.totalValue} prefix="¥" />
          </div>
          <div className="kpi-foot">股 {summary.stockCount} · 基 {summary.fundCount}</div>
        </div>

        <div className="kpi-card" style={{ '--accent': isProfit ? 'var(--up)' : 'var(--down)' } as React.CSSProperties}>
          <div className="kpi-head">
            <div className="kpi-label">
              <span
                className="kpi-icon"
                style={{
                  background: isProfit ? 'var(--up-soft)' : 'var(--down-soft)',
                  color: isProfit ? 'var(--up)' : 'var(--down)'
                }}
              >
                {isProfit ? <RiseOutlined /> : <FallOutlined />}
              </span>
              累计盈亏
            </div>
            <span className={`chip ${isProfit ? 'up' : 'down'}`}>
              {isProfit ? '盈利' : '亏损'}
            </span>
          </div>
          <div className="kpi-value" style={{ color: isProfit ? 'var(--up)' : 'var(--down)' }}>
            <CompactNumber
              value={Math.abs(summary.profit)}
              prefix={isProfit ? '+' : '-'}
            />
          </div>
          <div className="kpi-foot">
            收益率 <span style={{ fontWeight: 600, color: isProfit ? 'var(--up)' : 'var(--down)' }}>
              {(summary.totalCost > 0 ? (summary.profit / summary.totalCost) * 100 : 0).toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="kpi-card" style={{ '--accent': isDayUp ? 'var(--up)' : 'var(--down)' } as React.CSSProperties}>
          <div className="kpi-head">
            <div className="kpi-label">
              <span
                className="kpi-icon"
                style={{
                  background: isDayUp ? 'var(--up-soft)' : 'var(--down-soft)',
                  color: isDayUp ? 'var(--up)' : 'var(--down)'
                }}
              >
                {isDayUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              </span>
              今日盈亏
            </div>
            <span className={`chip ${isDayUp ? 'up' : 'down'}`}>
              {isDayUp ? '上涨' : '下跌'}
            </span>
          </div>
          <div className="kpi-value" style={{ color: isDayUp ? 'var(--up)' : 'var(--down)' }}>
            <CompactNumber
              value={Math.abs(summary.dayChange)}
              prefix={isDayUp ? '+' : '-'}
            />
          </div>
          <div className="kpi-foot">
            持仓成本 <span className="num">¥{fmt2(summary.totalCost)}</span>
          </div>
        </div>
      </div>

      {/* ============ Filter + Search ============ */}
      <div className="panel fade-in-2" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', padding: 4, background: 'var(--app-bg)', borderRadius: 10, gap: 2 }}>
            {[
              { key: 'all',   label: '全部' },
              { key: 'stock', label: '股票' },
              { key: 'fund',  label: '基金' }
            ].map(t => {
              const active = filterType === t.key
              return (
                <div
                  key={t.key}
                  onClick={() => setFilterType(t.key as any)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: 7,
                    background: active ? '#fff' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s var(--ease-out)'
                  }}
                >
                  {t.label}
                </div>
              )
            })}
          </div>
          <span className="chip muted">
            <span className="dot" />
            共 {filteredHoldings.length} 个标的
          </span>
          <span className="chip" style={{ background: 'rgba(201,167,106,0.08)', border: '1px solid rgba(201,167,106,0.15)' }}>
            <ThunderboltOutlined style={{ fontSize: 12, color: '#b08d4f', marginRight: 4 }} />
            数据源：东财 · 腾讯 · 新浪 · 网易 · 雅虎
          </span>
        </div>
      </div>

      {showAsMobile ? (
        <div className="mobile-card-list fade-in-3">
        {filteredHoldings.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                暂无持仓，点击上方「添加持仓」开始
              </span>
            }
          />
        ) : (
          filteredHoldings.map(record => {
            const isStock = record.type === 'stock'
            const price = record.currentPrice || record.avgCost
            const change = record.currentChangePercent || 0
            const isUp = change > 0
            const isDown = change < 0
            const value = price * record.quantity
            const cost = record.avgCost * record.quantity
            const profit = value - cost
            const profitPct = cost > 0 ? (profit / cost) * 100 : 0
            const profitUp = profit > 0
            const profitDown = profit < 0
            return (
              <div key={record.id} className="mobile-card">
                {/* 第一行：名称 + 现价/涨跌幅 */}
                <div className="mobile-card-row" style={{ marginBottom: 6 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="mobile-card-title">{record.name}</div>
                    <div className="mobile-card-sub" style={{ marginTop: 2 }}>
                      {isStock ? '股票' : '基金'} · {record.symbol}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                    <div className="num" style={{ fontSize: 16, fontWeight: 700, color: isUp ? 'var(--up)' : isDown ? 'var(--down)' : 'var(--text-primary)' }}>
                      ¥{fmt2(price)}
                    </div>
                    <div className="num" style={{ fontSize: 12, fontWeight: 600, color: isUp ? 'var(--up)' : isDown ? 'var(--down)' : 'var(--text-tertiary)' }}>
                      {isUp ? '+' : ''}{change.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* 第二行：盈亏金额 + 盈亏比例（醒目） */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <span className="num" style={{ fontSize: 15, fontWeight: 700, color: profitUp ? 'var(--up)' : profitDown ? 'var(--down)' : 'var(--text-tertiary)' }}>
                    {profitUp ? '+' : profitDown ? '−' : ''}¥{fmt2(Math.abs(profit))}
                  </span>
                  <span className="num" style={{ fontSize: 12, fontWeight: 600, color: profitUp ? 'var(--up)' : profitDown ? 'var(--down)' : 'var(--text-tertiary)' }}>
                    {profitUp ? '+' : profitDown ? '−' : ''}{profitPct.toFixed(2)}%
                  </span>
                </div>

                {/* 第三行：成本价 / 数量 / 市值（紧凑三列） */}
                <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderTop: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>成本</div>
                    <div className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>¥{fmt4(record.avgCost)}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>数量</div>
                    <div className="num" style={{ fontSize: 13, fontWeight: 600 }}>{record.quantity.toLocaleString('zh-CN')}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>市值</div>
                    <div className="num" style={{ fontSize: 13, fontWeight: 700 }}>¥{fmt2(value)}</div>
                  </div>
                </div>

                {/* 底部操作 */}
                <div className="mobile-card-actions" style={{ marginTop: 10, paddingTop: 0, borderTop: 'none' }}>
                  <button className="mobile-card-btn" onClick={() => openTradeRecordDrawer(record)}>
                    <HistoryOutlined /> 交易记录
                  </button>
                  <button className="mobile-card-btn" onClick={() => openEdit(record)}>
                    <EditOutlined /> 编辑
                  </button>
                  <button className="mobile-card-btn danger" onClick={() => handleDelete(record.id)}>
                    <DeleteOutlined /> 删除
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
      ) : (
      <div className="panel luxe-table fade-in-3 desktop-only">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredHoldings}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                    暂无持仓，点击右上「添加持仓」开始
                  </span>
                }
              />
            )
          }}
        />
      </div>
      )}

      {/* ============ Add/Edit Modal ============ */}
      <Modal
        title={
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>
            {editing ? '编辑持仓' : '添加持仓'}
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        confirmLoading={submitting}
        okText={editing ? '保存' : '添加'}
        cancelText="取消"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={{ type: 'stock', currency: 'CNY' }}>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'stock', label: <span><StockOutlined /> 股票</span> },
                { value: 'fund', label: <span><FundOutlined /> 基金</span> }
              ]}
              size="large"
              onChange={() => {
                form.setFieldsValue({ symbol: undefined, name: undefined })
                setSearchResults([])
                setPreviewPrice(null)
              }}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.type !== curr.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type') || 'stock'
              return (
                <>
                  <Form.Item
                    name="symbol"
                    label="代码 / 名称"
                    rules={[{ required: true, message: '请输入代码或名称搜索' }]}
                  >
                    <AutoComplete
                      onSearch={handleSearch}
                      onSelect={(val, option: any) => handleSearchSelect(val, option)}
                      placeholder={type === 'stock' ? '输入代码或名称，如 600519 茅台' : '输入基金代码或名称'}
                      notFoundContent={searching ? '搜索中…' : searchResults.length === 0 ? null : '无结果'}
                    >
                      {searchResults.map(r => (
                        <AutoComplete.Option key={r.code} value={r.code} name={r.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600 }}>{r.name}</span>
                            <span className="num" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                              {r.code}
                            </span>
                          </div>
                        </AutoComplete.Option>
                      ))}
                    </AutoComplete>
                  </Form.Item>

                  <Form.Item
                    name="name"
                    label="名称"
                    rules={[{ required: true, message: '请输入名称' }]}
                  >
                    <Input
                      placeholder="选中上方搜索结果自动填入"
                      size="large"
                      suffix={
                        previewPrice ? (
                          <span className="num" style={{ fontSize: 12, color: 'var(--brand-600)' }}>
                            当前 ¥{fmt2(previewPrice.price)} {loadingPrice ? '…' : ''}
                          </span>
                        ) : null
                      }
                    />
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="quantity"
              label="持仓数量"
              rules={[{ required: true, message: '请输入数量' }, { type: 'number', min: 0 }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} step={100} placeholder="0" size="large" />
            </Form.Item>
            <Form.Item
              name="avgCost"
              label="平均成本"
              rules={[{ required: true, message: '请输入成本' }, { type: 'number', min: 0 }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                precision={4}
                placeholder="0.0000"
                size="large"
              />
            </Form.Item>
          </div>

          <Form.Item name="currency" label="货币" rules={[{ required: true }]}>
            <Select
              size="large"
              options={[
                { value: 'CNY', label: '人民币 CNY' },
                { value: 'USD', label: '美元 USD' },
                { value: 'HKD', label: '港币 HKD' }
              ]}
            />
          </Form.Item>

          <div style={{
            background: 'rgba(201, 167, 106, 0.06)',
            border: '1px solid rgba(201, 167, 106, 0.2)',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{ color: 'var(--brand-500)' }}>💡</span>
            添加后系统将自动从 5 个数据源（东财/腾讯/新浪/网易/雅虎）拉取实时行情，每 30 秒自动刷新。
          </div>

          {!editing && (
            <div className="buy-logic-block" style={{ marginTop: 16 }}>
              <div className="buy-logic-block-title">
                <BulbOutlined /> 买入逻辑
                <span className="badge">新增</span>
              </div>
              <Form.Item
                name="buyReason"
                label="买入理由"
                extra="建议说明：核心逻辑、关键数据、估值理由等"
                style={{ marginBottom: 0 }}
                rules={[{ type: 'string', max: 500 }]}
              >
                <Input.TextArea
                  rows={isMobile ? 2 : 3}
                  maxLength={500}
                  showCount
                  placeholder="为什么买？基于什么判断？例如：业绩超预期+估值修复+龙头溢价"
                />
              </Form.Item>

              <div className="buy-logic-field-row">
                <Form.Item name="targetPrice" label="目标价位（选填）" style={{ marginBottom: 0 }}>
                  <InputNumber
                    prefix="¥"
                    min={0}
                    step={0.01}
                    style={{ width: '100%' }}
                    placeholder="目标价"
                    size={isMobile ? 'large' : 'middle'}
                  />
                </Form.Item>
                <Form.Item name="stopLossPrice" label="止损价位（选填）" style={{ marginBottom: 0 }}>
                  <InputNumber
                    prefix="¥"
                    min={0}
                    step={0.01}
                    style={{ width: '100%' }}
                    placeholder="止损价"
                    size={isMobile ? 'large' : 'middle'}
                  />
                </Form.Item>
              </div>

              <Form.Item name="holdingPeriod" label="持有周期" style={{ marginBottom: 0 }}>
                <Radio.Group size={isMobile ? 'large' : 'middle'}>
                  <Radio.Button value="short">短线</Radio.Button>
                  <Radio.Button value="mid">中线</Radio.Button>
                  <Radio.Button value="long">长线</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="marketContext"
                label="买入时市场环境（选填）"
                style={{ marginBottom: 0 }}
                rules={[{ type: 'string', max: 300 }]}
              >
                <Input.TextArea
                  rows={isMobile ? 2 : 2}
                  maxLength={300}
                  placeholder="当时的宏观/行业/资金面背景"
                />
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>

      {/* ============ 交易记录抽屉 ============ */}
      <Drawer
        open={tradeRecordVisible}
        onClose={() => setTradeRecordVisible(false)}
        title={
          tradeRecordHolding ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {showAsMobile && (
                <Button
                  type="text"
                  size="large"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setTradeRecordVisible(false)}
                  style={{ marginLeft: -8 }}
                />
              )}
              <span style={{ fontWeight: 600 }}>
                {tradeRecordHolding.name} · 交易记录
              </span>
            </div>
          ) : (
            <span style={{ fontWeight: 600 }}>交易记录</span>
          )
        }
        width={showAsMobile ? '100%' : 640}
        destroyOnClose
        className={showAsMobile ? 'mobile-trade-drawer' : ''}
        closeIcon={showAsMobile ? null : undefined}
      >
        {tradeRecordHolding && (
          <TradeRecordTimeline holdingId={tradeRecordHolding.id} />
        )}
        {showAsMobile && (
          <div style={{
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
            background: '#fff',
            borderTop: '1px solid var(--card-border)',
            zIndex: 10
          }}>
            <Button
              block
              size="large"
              onClick={() => setTradeRecordVisible(false)}
              style={{ height: 46, fontWeight: 600 }}
            >
              关闭
            </Button>
          </div>
        )}
      </Drawer>

      {/* ============ 截图导入弹窗 ============ */}
      <ScreenshotImportModal
        visible={screenshotImportVisible}
        onClose={() => setScreenshotImportVisible(false)}
        onImport={async (importData: ImportHoldingData[]) => {
          for (const item of importData) {
            if (item.matched_holding_id) {
              await updateHolding(item.matched_holding_id, {
                quantity: item.quantity,
                avgCost: item.cost_price
              })
            } else {
              await addHolding({
                type: detectHoldingType(item.symbol, item.name),
                symbol: item.symbol,
                name: item.name,
                quantity: item.quantity,
                avgCost: item.cost_price,
                currency: 'CNY'
              })
            }
          }
          message.success(`已成功导入 ${importData.length} 条持仓数据`)
          setTimeout(() => refreshPrices(), 500)
        }}
        existingHoldings={holdings}
      />
    </div>
  )
}
