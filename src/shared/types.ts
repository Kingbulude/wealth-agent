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

/**
 * Capacitor 全局对象的最小类型声明（仅覆盖项目中实际使用的 API）
 * 完整类型见 @capacitor/core 的 Capacitor 接口
 */
export interface CapacitorGlobal {
  isNativePlatform: () => boolean
  getPlatform: () => 'web' | 'android' | 'ios'
  convertFileSrc?: (filePath: string) => string
  [key: string]: unknown
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    Capacitor?: CapacitorGlobal
  }
}
