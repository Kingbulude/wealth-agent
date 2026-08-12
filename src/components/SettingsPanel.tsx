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
  const [currentVersion, setCurrentVersion] = useState('')
  const [latestVersion, setLatestVersion] = useState('')

  async function loadCurrentVersion() {
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) {
        setCurrentVersion('web (自动更新)')
        return
      }
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
      const info = await CapacitorUpdater.current()
      setCurrentVersion(info.bundle?.version || info.native || 'builtin')
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
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) {
        setOtaStatus('latest')
        setOtaMessage('Web 端通过 Cloudflare Pages 自动更新，无需手动操作')
        return
      }

      const { CapacitorUpdater } = await import('@capgo/capacitor-updater')

      // 手动触发更新检查
      const result = await CapacitorUpdater.getLatest()
      console.log('[OTA] getLatest result:', result)

      if (result.version && result.version !== currentVersion) {
        setLatestVersion(result.version)
        setOtaStatus('downloading')
        setOtaMessage(`发现新版本 ${result.version}，正在下载...`)

        // 下载 bundle
        const downloaded = await CapacitorUpdater.download({
          url: result.url || '',
          version: result.version
        })
        console.log('[OTA] downloaded:', downloaded)

        // 设置为下次启动的活跃版本
        await CapacitorUpdater.set(downloaded)
        setOtaStatus('ready')
        setOtaMessage(`新版本 ${result.version} 已下载，重启 App 后生效`)
        message.success('更新已下载，请重启 App 生效')
      } else {
        setOtaStatus('latest')
        setOtaMessage('已是最新版本')
      }
    } catch (e: any) {
      console.error('[OTA] check failed:', e)
      setOtaStatus('error')
      setOtaMessage(e?.message || '检查更新失败')
    } finally {
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
            <div style={{ padding: '8px 10px', background: '#fff8c5', borderRadius: 4, fontSize: 12, color: '#9a6700', display: 'flex', alignItems: 'center', gap: 6 }}>
              <SyncOutlined spin />
              {otaMessage}
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
