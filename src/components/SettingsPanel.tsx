import { useState, useEffect } from 'react'
import { Button, Input, Modal, Form, message, Space, Card, Tag, Spin } from 'antd'
import { SettingOutlined, BellOutlined, SaveOutlined, RestOutlined, CopyOutlined, SyncOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { getPushConfig, savePushConfig, testFeishuPush, loadPushConfig } from '../services/notificationService'

interface SettingsPanelProps {
  visible: boolean
  onClose: () => void
}

export default function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)

  // 打开面板时从 API 拉取最新配置（三端同步）
  useEffect(() => {
    if (visible && !configLoaded) {
      loadPushConfig().then(config => {
        form.setFieldsValue({ feishuWebhook: config.feishuWebhook || '' })
        setConfigLoaded(true)
      }).catch(() => {
        // API 失败用本地缓存
        const local = getPushConfig()
        form.setFieldsValue({ feishuWebhook: local.feishuWebhook || '' })
        setConfigLoaded(true)
      })
    }
    if (!visible) {
      setConfigLoaded(false)
    }
  }, [visible, configLoaded, form])

  async function handleSave() {
    setLoading(true)
    try {
      const values = await form.validateFields()
      await savePushConfig({ feishuWebhook: values.feishuWebhook || '' })
      message.success('设置已保存并同步到云端')
      onClose()
    } catch (e) {
      console.error('保存失败:', e)
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleTest() {
    setTestLoading(true)
    try {
      const result = await testFeishuPush()
      if (result.ok) {
        message.success('推送测试成功！请查看飞书消息')
      } else {
        message.error(result.error || '测试失败')
      }
    } catch (e) {
      message.error('测试失败')
    } finally {
      setTestLoading(false)
    }
  }

  function handleCopyWebhook() {
    const webhook = form.getFieldValue('feishuWebhook')
    if (webhook) {
      navigator.clipboard.writeText(webhook)
      message.success('已复制')
    }
  }

  // === 更新版本检测 —— 三端自适应：桌面端(Electron) / App端(Capacitor OTA) / Web端(Cloudflare Pages) ===
  const [platformKind, setPlatformKind] = useState<'electron' | 'capacitor' | 'web'>('web')
  const [otaChecking, setOtaChecking] = useState(false)
  const [otaStatus, setOtaStatus] = useState<'idle' | 'checking' | 'downloading' | 'ready' | 'error' | 'latest'>('idle')
  const [otaMessage, setOtaMessage] = useState('')
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [currentVersion, setCurrentVersion] = useState('')
  const [latestVersion, setLatestVersion] = useState('')
  const [nativeVersion, setNativeVersion] = useState('')

  async function loadCurrentVersion() {
    // Electron 桌面端：直接通过 IPC 调 app.getVersion()
    const ea = (window as any).electronAPI
    if (ea && typeof ea.getAppVersion === 'function') {
      setPlatformKind('electron')
      try {
        const v = await ea.getAppVersion()
        setCurrentVersion(v)
        // 最新版本在首次检查时异步拿到；这里同时也拉一下 GitHub Release 标签显示出来
        try {
          const resp = await fetch(
            'https://api.github.com/repos/Kingbulude/wealth-agent/releases/latest',
            { cache: 'no-store' }
          )
          if (resp.ok) {
            const json = await resp.json()
            const tag: string = json.tag_name || ''
            if (tag) setLatestVersion(tag.replace(/^v/, ''))
          }
        } catch { /* 离线/网络失败先留空，点检查更新会再拉 */ }
        return
      } catch {
        setCurrentVersion('unknown')
        return
      }
    }

    // Capacitor 移动端 / Web 端
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) {
        setPlatformKind('web')
        setCurrentVersion('web (自动更新)')
        return
      }
      setPlatformKind('capacitor')
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
      const info = await CapacitorUpdater.current()
      const bundleVersion = info.bundle?.version
      const native = info.native || 'builtin'
      setNativeVersion(native)
      setCurrentVersion(bundleVersion || native)
    } catch {
      setCurrentVersion('unknown')
    }
  }

  // ——— 桌面端 auto-updater 事件订阅，挂载时只挂一次 ———
  useEffect(() => {
    if (!visible) return
    const ea = (window as any).electronAPI
    if (!ea || typeof ea.onAutoUpdaterEvent !== 'function') return
    const off = ea.onAutoUpdaterEvent((payload: any) => {
      switch (payload?.event) {
        case 'checking':
          setOtaStatus('checking')
          setOtaMessage('正在检查更新...')
          setOtaChecking(true)
          break
        case 'available':
          setLatestVersion(String(payload.version || ''))
          setOtaStatus('downloading')
          setDownloadPercent(0)
          setOtaMessage(`发现新版本 ${payload.version}，正在准备下载`)
          break
        case 'progress': {
          const pct = Math.max(0, Math.min(100, Number(payload.percent) || 0))
          setOtaStatus('downloading')
          setDownloadPercent(pct)
          const totalKB = payload.total ? Math.round(payload.total / 1024) : 0
          setOtaMessage(
            `正在下载新版本 ${latestVersion || ''} ${pct}%` +
            (totalKB ? ` · ${Math.round((payload.transferred || 0) / 1024)}KB / ${totalKB}KB` : '')
          )
          break
        }
        case 'downloaded':
          setLatestVersion(String(payload.version || latestVersion))
          setDownloadPercent(100)
          setOtaStatus('ready')
          setOtaMessage(`新版本 ${payload.version || ''} 已下载完成，点击"立即重启并安装"生效`)
          setOtaChecking(false)
          break
        case 'not-available':
          if (payload?.version) setLatestVersion(String(payload.version))
          setOtaStatus('latest')
          setOtaMessage('当前已是最新版本')
          setOtaChecking(false)
          break
        case 'error':
          setOtaStatus('error')
          setOtaMessage(`更新失败：${payload?.message || '未知错误'}`)
          setOtaChecking(false)
          break
      }
    })
    return () => { if (typeof off === 'function') off() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, latestVersion])

  useEffect(() => {
    if (visible) loadCurrentVersion()
  }, [visible])

  async function handleCheckUpdate() {
    setOtaChecking(true)
    setOtaMessage('')
    setDownloadPercent(0)

    let progressListener: any = null
    let timeoutTimer: any = null

    try {
      // ============ 桌面端：通过 IPC 调用 electron-updater ============
      const ea = (window as any).electronAPI
      if (ea && typeof ea.checkForUpdate === 'function') {
        setOtaStatus('checking')
        setOtaMessage('正在检查更新（GitHub Release）...')
        ea.checkForUpdate()
        // 状态更新通过 onAutoUpdaterEvent 订阅处理（见上面的 useEffect）
        // 10 秒内如果没有 not-available/available 回包，则当失败
        const guard = setTimeout(() => {
          if (otaStatus === 'checking') {
            setOtaStatus('error')
            setOtaMessage('检查更新超时，请检查网络连接或稍后重试')
            setOtaChecking(false)
          }
        }, 15 * 1000)
        // 注意：由于检查结果是事件回调，不能在这里 clearTimeout，交给订阅回调/guard 兜底
        ;(guard) // 避免 unused 警告
        return
      }

      // ============ 移动端：Capacitor OTA（自建 manifest + 代理下载）============
      setOtaStatus('checking')
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) {
        setOtaStatus('latest')
        setOtaMessage('Web 端通过 Cloudflare Pages 自动更新，刷新页面即可获取最新版本')
        setOtaChecking(false)
        return
      }

      const updaterMod = await import('@capgo/capacitor-updater')
      const { CapacitorUpdater } = updaterMod

      const manifestBody = {
        platform: 'android',
        device_id: 'local',
        app_id: 'com.wealth.agent',
        custom_id: '',
        plugin_version: '8.51.3',
        version_build: nativeVersion || currentVersion || '1.0.0',
        version_code: '1',
        version_name: (currentVersion && currentVersion !== 'unknown') ? currentVersion : 'builtin',
        version_os: '35',
        is_emulator: false,
        is_prod: true,
      }

      console.log('[OTA] posting manifest with body:', manifestBody)
      const manifestResp = await fetch('/api/ota/manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifestBody),
      })
      const manifestData = await manifestResp.json().catch(() => ({}))
      console.log('[OTA] manifest response:', manifestData)

      if (!manifestData.version || manifestData.message) {
        setOtaStatus('latest')
        setOtaMessage(manifestData.message || '已是最新版本')
        setOtaChecking(false)
        return
      }

      const remoteVersion: string = manifestData.version
      const downloadUrl: string = manifestData.url
      const checksum: string = manifestData.checksum || ''

      setLatestVersion(remoteVersion)
      setOtaStatus('downloading')
      setOtaMessage(`发现新版本 ${remoteVersion}，正在下载 0%`)

      progressListener = await (CapacitorUpdater as any).addListener(
        'downloadProgress',
        (p: any) => {
          const pct = Math.max(0, Math.min(100, Math.round(((p?.percent ?? 0) * 100))))
          setDownloadPercent(pct)
          setOtaMessage(`发现新版本 ${remoteVersion}，正在下载 ${pct}%`)
        }
      ).catch(() => null)

      timeoutTimer = setTimeout(() => {
        throw new Error('下载超时（超过 120 秒），请检查网络或稍后重试')
      }, 120 * 1000)

      const downloaded = await CapacitorUpdater.download({
        url: downloadUrl,
        version: remoteVersion,
        checksum: checksum || undefined,
      })
      console.log('[OTA] downloaded:', downloaded)

      clearTimeout(timeoutTimer)
      timeoutTimer = null

      setDownloadPercent(100)
      setOtaMessage(`新版本 ${remoteVersion} 正在安装...`)

      await CapacitorUpdater.set(downloaded)
      setOtaStatus('ready')
      setOtaMessage(`新版本 ${remoteVersion} 已下载，重启 App 后生效`)
      message.success('更新已下载，请重启 App 生效')
    } catch (e: any) {
      console.error('[Update] check failed:', e)
      setOtaStatus('error')
      const msg = e?.message || '检查更新失败'
      setOtaMessage(msg.includes('getLatest') || msg.includes('capgo')
        ? '更新服务连接异常，请重启 App 或稍后重试'
        : msg)
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (progressListener && typeof progressListener.remove === 'function') {
        progressListener.remove().catch(() => {})
      }
      // 注意：桌面端事件订阅回调里已经把 otaChecking 关掉了；移动端在这里统一关
      if (platformKind !== 'electron') setOtaChecking(false)
    }
  }

  // 桌面端：已下载的更新点一下立即安装重启
  function handleInstallNow() {
    const ea = (window as any).electronAPI
    if (ea && typeof ea.installUpdate === 'function') {
      ea.installUpdate()
    }
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined />
          <span>设置</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      <div style={{ padding: 8 }}>
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BellOutlined style={{ color: '#1890ff' }} />
              <span>飞书推送</span>
            </div>
          }
          style={{ marginBottom: 16 }}
        >
          <Form form={form} layout="vertical">
            <Form.Item
              label="飞书机器人Webhook"
              name="feishuWebhook"
              rules={[{ required: false, message: '请输入Webhook地址' }]}
            >
              <Input
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                prefix={<BellOutlined style={{ color: '#1890ff' }} />}
                allowClear
              />
            </Form.Item>
          </Form>

          <div style={{ fontSize: 12, color: '#999', marginBottom: 16, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}>
            <strong style={{ color: '#666' }}>配置步骤：</strong>
            <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
              <li>打开飞书群聊 → 设置 → 添加机器人</li>
              <li>点击"创建自定义机器人"</li>
              <li>复制Webhook地址并粘贴到上方输入框</li>
              <li>点击"测试推送"验证配置是否生效</li>
            </ol>
          </div>

          <Space>
            <Button
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
              type="primary"
            >
              保存设置
            </Button>
            <Button
              icon={<RestOutlined />}
              onClick={handleTest}
              loading={testLoading}
            >
              测试推送
            </Button>
            <Button
              icon={<CopyOutlined />}
              onClick={handleCopyWebhook}
              disabled={!form.getFieldValue('feishuWebhook')}
            >
              复制
            </Button>
          </Space>
        </Card>

        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <SyncOutlined style={{ color: '#1890ff' }} />
              <span>应用更新</span>
              <Tag color="default" style={{ fontSize: 11, marginLeft: 'auto', fontWeight: 400 }}>
                {platformKind === 'electron' && '桌面端'}
                {platformKind === 'capacitor' && 'App 端'}
                {platformKind === 'web' && 'Web 端'}
              </Tag>
            </div>
          }
          style={{ marginBottom: 16 }}
          size="small"
        >
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#666', fontSize: 13 }}>当前版本：</span>
              <Tag color="blue">{currentVersion || '加载中...'}</Tag>
            </div>
            {latestVersion && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666', fontSize: 13 }}>最新版本：</span>
                <Tag color="green">{latestVersion}</Tag>
              </div>
            )}
          </div>

          <Button
            icon={otaChecking ? <Spin size="small" /> : <SyncOutlined />}
            onClick={handleCheckUpdate}
            loading={otaChecking}
            type="primary"
            size="small"
            style={{ marginBottom: 8 }}
          >
            {otaChecking ? '检查中...' : '检查更新'}
          </Button>

          {otaStatus === 'ready' && (
            <div style={{ padding: '8px 10px', background: '#dafbe1', borderRadius: 4, fontSize: 12, color: '#116329', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleOutlined />
                {otaMessage}
              </div>
              {platformKind === 'electron' && (
                <Button
                  type="primary"
                  danger
                  size="small"
                  style={{ marginTop: 10 }}
                  icon={<RestOutlined />}
                  onClick={handleInstallNow}
                >
                  立即重启并安装新版本
                </Button>
              )}
            </div>
          )}
          {otaStatus === 'latest' && (
            <div style={{ padding: '8px 10px', background: '#f6f8fa', borderRadius: 4, fontSize: 12, color: '#57606a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleOutlined />
              {otaMessage}
            </div>
          )}
          {otaStatus === 'error' && (
            <div style={{ padding: '8px 10px', background: '#ffebe9', borderRadius: 4, fontSize: 12, color: '#82071e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ExclamationCircleOutlined />
              {otaMessage}
            </div>
          )}
          {otaStatus === 'downloading' && (
            <div style={{ padding: '10px', background: '#fff8c5', borderRadius: 4, color: '#9a6700' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 8 }}>
                <SyncOutlined spin />
                {otaMessage}
              </div>
              <div style={{
                width: '100%',
                height: 6,
                background: '#ffe58f',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${downloadPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #faad14, #d48806)',
                  transition: 'width 0.2s ease-out',
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#ad6800', textAlign: 'right', marginTop: 4 }}>
                {downloadPercent}%
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: '#999', marginTop: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}>
            更新下载后需<strong>重启 App</strong>生效。如果自动更新未生效，可在此手动检查并下载。
          </div>
        </Card>

        <Card
          title="推送说明"
          size="small"
        >
          <ul style={{ fontSize: 12, color: '#666', margin: 0, paddingLeft: 16 }}>
            <li>飞书推送完全免费，只需创建一个自定义机器人即可</li>
            <li>支持推送：持仓报告、决策信号、AI分析结果</li>
            <li>所有数据仅在本地和飞书之间传输，不会泄露给第三方</li>
          </ul>
        </Card>
      </div>
    </Modal>
  )
}
