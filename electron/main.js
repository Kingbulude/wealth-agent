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

function getFileProtocolUrl(filePath) {
  const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
  return 'file:///' + cleanPath
}

function setupApiProxy() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url
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
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico')
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '财富管理智能体',
    icon: iconPath,
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
