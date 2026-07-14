export interface ElectronAPI {
  platform: string
  versions: {
    node: string
    chrome: string
    electron: string
  }
  onUpdateAvailable: (cb: (info: { version: string; releaseDate: string }) => void) => void
  onUpdateNotAvailable: (cb: () => void) => void
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => void
  checkForUpdate: () => void
  installUpdate: () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
