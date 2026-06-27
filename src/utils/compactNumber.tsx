import { useState, useCallback } from 'react'

/**
 * 将数字格式化为简写形式
 * >= 1亿: xx.xx亿
 * >= 1万: xx.xx万
 * < 1万: 原数字（带千分位）
 */
export function formatCompactNumber(n: number): string {
  if (!isFinite(n)) return '0'
  const absN = Math.abs(n)

  if (absN >= 100_000_000) {
    return (n / 100_000_000).toFixed(2) + '亿'
  }
  if (absN >= 10_000) {
    return (n / 10_000).toFixed(2) + '万'
  }
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 格式化完整数字（带千分位）
 */
export function formatFullNumber(n: number, fractionDigits = 2): string {
  if (!isFinite(n)) return '0.00'
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })
}

interface CompactNumberProps {
  value: number
  /** 前缀，如 ¥、+、- */
  prefix?: string
  /** 完整数字的小数位数 */
  fractionDigits?: number
  /** 自定义样式 */
  style?: React.CSSProperties
  /** 自定义类名 */
  className?: string
}

/**
 * 交互式数字组件
 * - 默认显示简写（如 433万）
 * - hover / click 显示完整数字
 */
export function CompactNumber({
  value,
  prefix = '',
  fractionDigits = 2,
  style,
  className
}: CompactNumberProps) {
  const [expanded, setExpanded] = useState(false)

  const compact = formatCompactNumber(value)
  const full = formatFullNumber(value, fractionDigits)

  const toggle = useCallback(() => {
    setExpanded(prev => !prev)
  }, [])

  const handleMouseEnter = useCallback(() => {
    setExpanded(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setExpanded(false)
  }, [])

  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        ...style
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={toggle}
      title={expanded ? '点击收起' : '点击或悬停查看完整数字'}
    >
      <span
        style={{
          display: 'inline-block',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          opacity: expanded ? 0 : 1,
          transform: expanded ? 'translateY(-2px)' : 'translateY(0)',
          position: expanded ? 'absolute' : 'relative',
          whiteSpace: 'nowrap'
        }}
      >
        {prefix}{compact}
      </span>
      <span
        style={{
          display: 'inline-block',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          opacity: expanded ? 1 : 0,
          transform: expanded ? 'translateY(0)' : 'translateY(2px)',
          position: expanded ? 'relative' : 'absolute',
          whiteSpace: 'nowrap'
        }}
      >
        {prefix}{full}
      </span>
    </span>
  )
}
