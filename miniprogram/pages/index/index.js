const app = getApp()

Page({
  data: {
    webViewUrl: '',
    loading: true
  },

  onLoad(options) {
    const baseUrl = app.globalData.webViewUrl
    const params = []

    params.push('utm_source=wechat_miniprogram')

    if (options && Object.keys(options).length > 0) {
      for (const key in options) {
        if (options.hasOwnProperty(key)) {
          params.push(`${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
        }
      }
    }

    const url = baseUrl + (baseUrl.indexOf('?') > -1 ? '&' : '?') + params.join('&')
    console.log('[WebView] 加载地址:', url)

    this.setData({ webViewUrl: url })
  },

  onWebViewLoad() {
    console.log('[WebView] 页面加载完成')
    this.setData({ loading: false })
  },

  onWebViewError(e) {
    console.error('[WebView] 加载失败:', e.detail)
    this.setData({ loading: false })
    wx.showModal({
      title: '加载失败',
      content: '网络异常，请检查网络后重试',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  onShareAppMessage() {
    return {
      title: '财富管理助手 - 智能记账与资产分析',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: '财富管理助手 - 智能记账与资产分析'
    }
  }
})
