import { useEffect, useState } from 'react'
import { message } from 'antd'

export default function AutoUpdater() {
  const [updateInfo, setUpdateInfo] = useState<{ version: string } | null>(null)

  useEffect(() => {
    const ea = window.electronAPI
    if (!ea) return

    ea.onUpdateAvailable((info) => {
      message.info(`发现新版本 v${info.version}，正在下载更新...`)
    })

    ea.onUpdateDownloaded((info) => {
      setUpdateInfo(info)
      message.success({
        content: `新版本 v${info.version} 已下载，3秒后自动安装更新...`,
        duration: 3
      })
    })

    ea.onUpdateNotAvailable(() => {
      // 静默处理，无需提示
    })
  }, [])

  if (!updateInfo) return null

  return null
}
