import { useState, useEffect } from 'react'
import { Button, Input, Modal, Form, message, Space, Card } from 'antd'
import { SettingOutlined, BellOutlined, SaveOutlined, RestOutlined, CopyOutlined } from '@ant-design/icons'
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
