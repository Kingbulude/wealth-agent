const { app, BrowserWindow } = require('electron')
const path = require('path')

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
      sandbox: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    const htmlPath = path.join(__dirname, '..', 'dist', 'index.html')
    console.log('Loading HTML from:', htmlPath)
    win.loadFile(htmlPath)
    win.webContents.openDevTools()
  }

  win.webContents.on('did-fail-load', (event, errorCode, errorDesc, validatedURL) => {
    console.log('Page load failed:', { errorCode, errorDesc, validatedURL })
  })

  win.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully')
  })
}

app.whenReady().then(() => {
  console.log('App path:', app.getAppPath())
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
