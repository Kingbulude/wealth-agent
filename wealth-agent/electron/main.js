const { app, BrowserWindow, protocol } = require('electron')
const path = require('path')
const fs = require('fs')

protocol.registerSchemesAsPrivileged([
  { scheme: 'file', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, allowServiceWorkers: true } }
])

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
      webSecurity: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    const distPath = path.join(__dirname, '..', 'dist')
    const htmlPath = path.join(distPath, 'index.html')
    console.log('[Electron] __dirname:', __dirname)
    console.log('[Electron] Loading:', htmlPath)
    console.log('[Electron] dist exists:', fs.existsSync(distPath))
    console.log('[Electron] index.html exists:', fs.existsSync(htmlPath))

    protocol.registerFileProtocol('app', (request, callback) => {
      const url = request.url.replace('app://', '')
      const decoded = decodeURIComponent(url)
      const filePath = path.join(distPath, decoded || 'index.html')
      callback({ path: filePath })
    })

    win.webContents.openDevTools()
    win.loadURL('app://./index.html')

    win.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
      console.log('[Electron] FAIL - code:', errorCode, 'desc:', errorDesc)
    })

    win.webContents.on('did-finish-load', () => {
      console.log('[Electron] Page loaded successfully')
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
