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

  // === OTA 更新 ===
  const [otaChecking, setOtaChecking] = useState(false)
  const [otaStatus, setOtaStatus] = useState<'idle' | 'checking' | 'downloading' | 'ready' | 'error' | 'latest'>('idle')
  const [otaMessage, setOtaMessage] = useState('')
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [currentVersion, setCurrentVersion] = useState('')
  const [latestVersion, setLatestVersion] = useState('')
  const [nativeVersion, setNativeVersion] = useState('')

  async function loadCurrentVersion() {
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) {
        setCurrentVersion('web (自动更新)')
        return
      }
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
      const info = await CapacitorUpdater.current()
      const bundleVersion = info.bundle?.version
      const native = info.native || 'builtin'
      setNativeVersion(native)
      // bundle version 优先（OTA 更新后的版本号），否则回退到内置 native 版本
      setCurrentVersion(bundleVersion || native)
    } catch {
      setCurrentVersion('unknown')
    }
  }

  useEffect(() => {
    if (visible) loadCurrentVersion()
  }, [visible])

  async function handleCheckUpdate() {
    setOtaChecking(true)
    setOtaStatus('checking')
    setOtaMessage('')
    setDownloadPercent(0)

    let progressListener: any = null
    let timeoutTimer: any = null

    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) {
        setOtaStatus('latest')
        setOtaMessage('Web 端通过 Cloudflare Pages 自动更新，无需手动操作')
        return
      }

      const updaterMod = await import('@capgo/capacitor-updater')
      const { CapacitorUpdater } = updaterMod

      // ====== 1. 直接调用自建 manifest 接口（不使用 CapacitorUpdater.getLatest()，后者走 Capgo 付费云）======
      // 字段说明按 Capgo 自托管协议：https://capgo.app/docs/plugin/self-hosted/auto-update/
      // version_name 是当前安装的 OTA 版本号（或 'builtin'），version_build 是 APK 原生版本号
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

      // 自建 manifest 返回 { message: 'Already up to date' } 或 { message: ... } 表示无需更新
      // 返回 { version, url, checksum } 才表示有更新
      if (!manifestData.version || manifestData.message) {
        setOtaStatus('latest')
        setOtaMessage(manifestData.message || '已是最新版本')
        return
      }

      const remoteVersion: string = manifestData.version
      const downloadUrl: string = manifestData.url
      const checksum: string = manifestData.checksum || ''

      setLatestVersion(remoteVersion)
      setOtaStatus('downloading')
      setOtaMessage(`发现新版本 ${remoteVersion}，正在下载 0%`)

      // ====== 2. 先注册下载进度监听器（必须在 download() 调用之前）======
      progressListener = await (CapacitorUpdater as any).addListener(
        'downloadProgress',
        (p: any) => {
          const pct = Math.max(0, Math.min(100, Math.round(((p?.percent ?? 0) * 100))))
          setDownloadPercent(pct)
          setOtaMessage(`发现新版本 ${remoteVersion}，正在下载 ${pct}%`)
        }
      ).catch(() => null)

      // ====== 3. 超时保护：120 秒没下载完视为失败 ======
      timeoutTimer = setTimeout(() => {
        throw new Error('下载超时（超过 120 秒），请检查网络或稍后重试')
      }, 120 * 1000)

      // ====== 4. 下载并校验 bundle ======
      const downloaded = await CapacitorUpdater.download({
        url: downloadUrl,
        version: remoteVersion,
        checksum: checksum || undefined,
      })
      console.log('[OTA] downloaded:', downloaded)

      clearTimeout(timeoutTimer)
      timeoutTimer = null

      // 下载完成标记为 100%
      setDownloadPercent(100)
      setOtaMessage(`新版本 ${remoteVersion} 正在安装...`)

      // ====== 5. 设置为下次启动的活跃版本 ======
      await CapacitorUpdater.set(downloaded)
      setOtaStatus('ready')
      setOtaMessage(`新版本 ${remoteVersion} 已下载，重启 App 后生效`)
      message.success('更新已下载，请重启 App 生效')
    } catch (e: any) {
      console.error('[OTA] check failed:', e)
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
      setOtaChecking(false)
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SyncOutlined style={{ color: '#1890ff' }} />
              <span>应用更新</span>
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
            <div style={{ padding: '8px 10px', background: '#dafbe1', borderRadius: 4, fontSize: 12, color: '#116329', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleOutlined />
              {otaMessage}
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
