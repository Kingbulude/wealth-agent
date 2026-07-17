import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.wealth.agent',
  appName: '财富管理智能体',
  webDir: 'dist',
  // 打包后的前端资源内置在 APK 中，App 启动时从本地加载（离线也能打开界面）
  // 所有 API 请求由前端代码直接发往 Cloudflare Pages 后端
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    // 允许 WebView 发起跨域请求到 Cloudflare API
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a0a0f',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0f',
      overlaysWebView: false
    }
  }
}

export default config
