const { app, BrowserWindow, protocol, net, session } = require('electron')
const path = require('path')
const fs = require('fs')

process.on('uncaughtException', (err) => {
  console.error('[Electron] uncaughtException:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] unhandledRejection:', reason)
})

const isDev = process.env.NODE_ENV === 'development'
const CLOUDFLARE_DOMAIN = 'wealth-agent.pages.dev'

function getFileProtocolUrl(filePath) {
  const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
  return 'file:///' + cleanPath
}

function setupApiProxy() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url

    // 前端已直接请求完整 Cloudflare URL，不再需要代理重定向
    // 仅拦截相对路径的 /api/ 请求（兜底）
    if (url.startsWith('file://') && url.indexOf('/api/') >= 0) {
      const apiIndex = url.indexOf('/api/')
      const apiPath = url.substring(apiIndex)
      const targetUrl = `https://${CLOUDFLARE_DOMAIN}${apiPath}`
      console.log('[Proxy]', url, '->', targetUrl)
      callback({ redirectURL: targetUrl })
    } else {
      callback({})
    }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '财富管理智能体',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  })

  if (!isDev) {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  win.webContents.on('did-fail-load', (event, errorCode, errorDesc, validatedURL) => {
    console.log('[Electron] Page FAIL - code:', errorCode, 'desc:', errorDesc, 'url:', validatedURL)
  })

  win.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page loaded successfully')
  })

  win.webContents.on('console-message', (event, level, message) => {
    console.log('[Renderer]', message)
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    const distPath = path.join(__dirname, '..', 'dist')
    const htmlPath = path.join(distPath, 'index.html')

    console.log('[Electron] __dirname:', __dirname)
    console.log('[Electron] dist path:', distPath)
    console.log('[Electron] index.html exists:', fs.existsSync(htmlPath))

    if (fs.existsSync(htmlPath)) {
      const fileUrl = getFileProtocolUrl(htmlPath)
      console.log('[Electron] Loading from file:', fileUrl)
      win.loadURL(fileUrl).catch((err) => {
        console.error('[Electron] loadURL error:', err)
      })
    } else {
      console.warn('[Electron] dist not found, loading from cloud')
      win.loadURL(`https://${CLOUDFLARE_DOMAIN}`).catch((err) => {
        console.error('[Electron] cloud load error:', err)
      })
    }
  }
}

app.whenReady().then(() => {
  console.log('[Electron] App ready. App path:', app.getAppPath())
  console.log('[Electron] Node.js version:', process.version)
  console.log('[Electron] Electron version:', process.versions.electron)

  setupApiProxy()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
