import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { errorMonitor } from '../utils/errorMonitor'
import './index.css'

// 初始化全局错误监控
errorMonitor.init()

// Capacitor 原生 App 初始化（仅在 Android/iOS App 内执行，Web/Electron 无影响）
// 使用动态 import：即使 @capacitor 包加载异常，也不会阻断 Web 端启动
if (typeof (window as any).Capacitor?.isNativePlatform === 'function' && (window as any).Capacitor.isNativePlatform()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#0a0a0f' }).catch(() => {})
  }).catch(() => {})
  import('@capacitor/splash-screen').then(({ SplashScreen }) => {
    SplashScreen.hide().catch(() => {})
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
