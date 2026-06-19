const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'

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

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    const distPath = path.join(__dirname, '..', 'dist')

    console.log('[Electron] __dirname:', __dirname)
    console.log('[Electron] dist path:', distPath)

    try {
      protocol.handle('app', (request) => {
        const url = request.url
        let relPath = url.substring('app://'.length)
        if (relPath.startsWith('./')) relPath = relPath.slice(2)
        try { relPath = decodeURIComponent(relPath) } catch (e) {}
        const queryIdx = relPath.indexOf('?')
        if (queryIdx >= 0) relPath = relPath.substring(0, queryIdx)
        const hashIdx = relPath.indexOf('#')
        if (hashIdx >= 0) relPath = relPath.substring(0, hashIdx)
        const filePath = path.join(distPath, relPath || 'index.html')
        const exists = fs.existsSync(filePath)
        console.log('[Electron]', url, '->', filePath, '(exists:', exists, ')')
        return net.fetch('file:///' + filePath.replace(/\\/g, '/').replace(/^\/+/, ''))
      })
      console.log('[Electron] app:// protocol registered')
    } catch (err) {
      console.log('[Electron] Protocol registration error:', err)
    }

    win.webContents.on('did-fail-load', (event, errorCode, errorDesc, validatedURL) => {
      console.log('[Electron] Page FAIL - code:', errorCode, 'desc:', errorDesc, 'url:', validatedURL)
    })

    win.webContents.on('did-finish-load', () => {
      console.log('[Electron] Page loaded successfully')
    })

    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log('[Renderer]', message)
    })

    win.loadURL('app://./index.html')
  }
}

app.on('ready', () => {
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
