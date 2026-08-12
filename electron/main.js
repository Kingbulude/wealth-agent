const { app, BrowserWindow, protocol, net, session, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

process.on('uncaughtException', (err) => {
  console.error('[Electron] uncaughtException:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] unhandledRejection:', reason)
})

const isDev = process.env.NODE_ENV === 'development'
const CLOUDFLARE_DOMAIN = 'wealth-agent.pages.dev'

// 注册自定义协议为特权协议（必须在 app.whenReady 之前调用）
// 使用 app:// 替代 file://，可以保持 webSecurity: true 同时加载本地资源
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true
  }
}])

function setupApiProxy() {
  // 保留代理作为安全网：前端已使用完整 https URL，但万一有相对路径请求也兜底
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url
    if ((url.startsWith('app://') || url.startsWith('file://')) && url.indexOf('/api/') >= 0) {
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
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico')
  const primaryDisplay = require('electron').screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: '财富管理智能体',
    icon: iconPath,
    autoHideMenuBar: true,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // 默认最大化显示
  win.maximize()

  if (isDev) {
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
      console.log('[Electron] Loading from app:// protocol')
      win.loadURL('app://bundle/index.html').catch((err) => {
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

  // 注册 app:// 协议处理器：将 app://bundle/path 映射到 dist/path
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    let pathname = url.pathname
    if (pathname === '/' || pathname === '' || pathname === '/index.html') {
      pathname = '/index.html'
    }
    const filePath = path.join(__dirname, '..', 'dist', pathname)
    return net.fetch('file://' + filePath)
  })

  setupApiProxy()
  createWindow()
  setupAutoUpdater()
})

// ============ Auto Update ============
let updateAvailable = false

function setupAutoUpdater() {
  if (isDev) {
    console.log('[AutoUpdate] Development mode, skipping auto-update')
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // Configure GitHub as update source
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Kingbulude',
    repo: 'wealth-agent'
  })

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdate] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdate] Update available:', info.version)
    updateAvailable = true
    // Notify renderer
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate
      })
    }
    // Auto download the update
    autoUpdater.downloadUpdate()
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdate] App is up to date')
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('update-not-available')
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log('[AutoUpdate] Download progress:', Math.round(progress.percent) + '%')
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdate] Update downloaded:', info.version)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('update-downloaded', {
        version: info.version
      })
    }
    // Auto quit and install after a short delay
    setTimeout(() => {
      autoUpdater.quitAndInstall()
    }, 3000)
  })

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdate] Error:', err.message)
  })

  // Handle IPC from renderer
  ipcMain.on('check-for-update', () => {
    console.log('[AutoUpdate] Manual check triggered')
    autoUpdater.checkForUpdates()
  })

  ipcMain.on('install-update', () => {
    console.log('[AutoUpdate] Installing update...')
    autoUpdater.quitAndInstall()
  })

  // Check for update on startup (delay 5s to let app load first)
  setTimeout(() => {
    console.log('[AutoUpdate] Checking for updates...')
    autoUpdater.checkForUpdates()
  }, 5000)
}

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
