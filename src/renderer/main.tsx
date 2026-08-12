import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { errorMonitor } from '../utils/errorMonitor'
import './index.css'

// 初始化全局错误监控
errorMonitor.init()

// Capacitor 原生 App 初始化（仅在 Android/iOS App 内执行，Web/Electron 无影响）
// 使用动态 import：即使 @capacitor 包加载异常，也不会阻断 Web 端启动
if (typeof window.Capacitor?.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
  // 标记 body 为原生 App 环境，CSS 据此补充状态栏安全间距
  // Android WebView 的 env(safe-area-inset-top) 始终返回 0，必须手动补偿
  document.body.classList.add('capacitor-native')
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#0a0a0f' }).catch(() => {})
  }).catch(() => {})
  import('@capacitor/splash-screen').then(({ SplashScreen }) => {
    SplashScreen.hide().catch(() => {})
  }).catch(() => {})

  // OTA 热更新：监听下载事件，提示用户
  // autoUpdate: 'onLaunch' 已在 capacitor.config.ts 中配置，插件会自动检查并下载
  import('@capgo/capacitor-updater').then(({ CapacitorUpdater }) => {
    // 关键：notifyAppReady 告诉插件"新版本跑起来没问题"，不调用会在下次启动自动回滚
    CapacitorUpdater.notifyAppReady().catch(() => {})
    CapacitorUpdater.addListener('downloadComplete', () => {
      console.log('[OTA] 新版本已下载，即将自动应用')
    }).catch(() => {})
    CapacitorUpdater.addListener('downloadFailed', (info: any) => {
      console.warn('[OTA] 下载失败:', info)
    }).catch(() => {})
    CapacitorUpdater.addListener('updateFailed', (info: any) => {
      console.warn('[OTA] 更新失败，回退到内置版本:', info)
    }).catch(() => {})
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
