// SSR test: 模拟 React 渲染 Dashboard 并捕获所有错误
// 模拟 localStorage + crypto.randomUUID

// Polyfills
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null },
  setItem(k, v) { this._data[k] = String(v) },
  removeItem(k) { delete this._data[k] },
  clear() { this._data = {} },
  key() {},
  length: 0
}

globalThis.crypto = {
  ...(globalThis.crypto || {}),
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2)
}

globalThis.window = globalThis
globalThis.document = {
  getElementById: () => ({ innerHTML: '', appendChild() {}, addEventListener() {} })
}

import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>')
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.navigator = dom.window.navigator
globalThis.HTMLElement = dom.window.HTMLElement

// 用 esbuild-loader 风格的 onResolve 加载 .tsx 麻烦，我们改用更简单的：
// 手动 require 入口文件，但 vite 路径里所有 .tsx 需要编译。改用 swc/esbuild
import { build } from 'esbuild'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appEntry = path.join(__dirname, 'src/renderer/main.tsx')

// 编译成一个 CJS bundle
const result = await build({
  entryPoints: [appEntry],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  jsx: 'automatic',
  loader: { '.ts': 'tsx', '.tsx': 'tsx', '.css': 'empty' },
  alias: {
    '@': path.join(__dirname, 'src')
  },
  external: [],
  write: false,
  define: {
    'process.env.NODE_ENV': '"development"'
  }
})

// 把 CJS bundle 写入临时文件然后 require
const tmpFile = '/tmp/test-bundle.cjs'
fs.writeFileSync(tmpFile, result.outputFiles[0].text)

// 拦截 console.error
const errors = []
const origError = console.error
console.error = (...args) => {
  errors.push(args.map(String).join(' '))
  origError.apply(console, args)
}

process.on('uncaughtException', (e) => {
  errors.push('UNCAUGHT: ' + e.message + '\n' + e.stack)
})

try {
  require(tmpFile)
  // 等一个 tick
  await new Promise(r => setTimeout(r, 500))
  console.log('=== RENDER OK ===')
} catch (e) {
  console.log('=== RENDER FAILED ===')
  console.log(e.message)
  console.log(e.stack)
}

console.log('=== Console errors (' + errors.length + ') ===')
errors.forEach((e, i) => console.log(`[${i}] ${e}\n---`))
