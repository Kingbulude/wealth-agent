/**
 * 替代 date-fns 的轻量工具函数
 * 避免新增依赖
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function formatDateTime(input: string | number | Date): string {
  const d = new Date(input)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function formatDate(input: string | number | Date): string {
  const d = new Date(input)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function formatTime(input: string | number | Date): string {
  const d = new Date(input)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function formatMonthDay(input: string | number | Date): string {
  const d = new Date(input)
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function formatDateTimeFull(input: string | number | Date): string {
  const d = new Date(input)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}
