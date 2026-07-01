/**
 * 微信公众号 H5 环境工具
 * - 检测微信内置浏览器
 * - 配置 JSSDK 分享
 */

/** 检测是否在微信内置浏览器中 */
export function isWeChatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('micromessenger')
}

/**
 * 动态加载微信 JSSDK 脚本
 * 注：JSSDK 需要后端提供签名，个人订阅号未认证时不支持，
 * 此处仅加载脚本并做 graceful fallback，签名失败不影响正常使用
 */
export function loadWeChatJSSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('not in browser'))
      return
    }

    // 已加载过
    if ((window as any).wx) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('JSSDK load failed'))
    document.head.appendChild(script)
  })
}

/** 分享内容配置 */
export interface ShareContent {
  title: string
  desc: string
  link: string
  imgUrl: string
}

/**
 * 配置微信分享内容
 * 需要后端签名接口配合，未配置时静默失败
 */
export async function configWeChatShare(content: ShareContent): Promise<void> {
  if (!isWeChatBrowser()) return

  try {
    await loadWeChatJSSDK()
    const wx = (window as any).wx
    if (!wx) return

    // 尝试获取签名（需要后端接口，未部署时静默失败）
    let signature: { timestamp: string; nonceStr: string; signature: string } | null = null
    try {
      const res = await fetch('/api/wx-signature?url=' + encodeURIComponent(window.location.href))
      if (res.ok) {
        signature = await res.json()
      }
    } catch {
      // 签名接口未部署，静默跳过
    }

    if (!signature) return

    wx.config({
      debug: false,
      appId: 'wx4a767f9e2991590c',
      timestamp: signature.timestamp,
      nonceStr: signature.nonceStr,
      signature: signature.signature,
      jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData']
    })

    wx.ready(() => {
      // 分享给朋友
      wx.updateAppMessageShareData({
        title: content.title,
        desc: content.desc,
        link: content.link,
        imgUrl: content.imgUrl
      })
      // 分享到朋友圈
      wx.updateTimelineShareData({
        title: content.title,
        link: content.link,
        imgUrl: content.imgUrl
      })
    })
  } catch {
    // 所有异常静默处理，不影响 H5 正常使用
  }
}

/** 默认分享内容 */
export const DEFAULT_SHARE_CONTENT: ShareContent = {
  title: '财富管理智能体 · Wealth Terminal',
  desc: '智能资产管理、持仓追踪、AI 投资顾问，一站式财富管理工具',
  link: typeof window !== 'undefined' ? window.location.origin : '',
  imgUrl: ''
}
