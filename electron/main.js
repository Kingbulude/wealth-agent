const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')

process.on('uncaughtException', (err) => {
  console.error('[Electron] uncaughtException:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] unhandledRejection:', reason)
})

const isDev = process.env.NODE_ENV === 'development'

function registerAppProtocol(distPath) {
  try {
    protocol.handle('app', (request) => {
      const url = request.url
      let relPath = url.substring('app://'.length)
      if (relPath.startsWith('./')) relPath = relPath.slice(2)
      if (relPath.startsWith('/')) relPath = relPath.slice(1)
      try { relPath = decodeURIComponent(relPath) } catch (e) {}
      const qi = relPath.indexOf('?')
      if (qi >= 0) relPath = relPath.substring(0, qi)
      const hi = relPath.indexOf('#')
      if (hi >= 0) relPath = relPath.substring(0, hi)
      const filePath = path.join(distPath, relPath || 'index.html')
      const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
      return net.fetch('file:///' + cleanPath)
    })
    console.log('[Electron] app:// protocol registered')
    return true
  } catch (err) {
    console.error('[Electron] Protocol registration error:', err)
    return false
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Wealth Agent',
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

  win.webContents.openDevTools({ mode: 'detach' })

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

    registerAppProtocol(distPath)

    win.loadURL('app://./index.html').catch((err) => {
      console.error('[Electron] loadURL error:', err)
    })
  }
}

app.whenReady().then(() => {
  console.log('[Electron] App ready. App path:', app.getAppPath())
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
