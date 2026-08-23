const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,

  send: (channel, data) => ipcRenderer.send(channel, data),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),

  // —— 桌面端自动更新（electron-updater）统一事件流：主进程 → 渲染层
  // 主进程所有 auto-updater 事件都通过同一个 channel "auto-updater" 推送，
  // payload 形如 { event: 'checking'|'available'|'not-available'|'progress'|'downloaded'|'error', ... }
  onAutoUpdaterEvent: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('auto-updater', listener)
    return () => ipcRenderer.removeListener('auto-updater', listener)
  },

  // 向后兼容：保留旧的单独 channel（供旧安装包版本的 AutoUpdater.tsx 继续工作）
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', () => callback()),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),

  checkForUpdate: () => ipcRenderer.send('check-for-update'),
  installUpdate: () => ipcRenderer.send('install-update'),

  // 获取桌面端当前版本号（app.getVersion()）
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
})
