import { Card, Statistic, Row, Col, Progress } from 'antd'
import { 
  WalletOutlined, 
  BankOutlined, 
  CreditCardOutlined,
  RiseOutlined 
} from '@ant-design/icons'
import { WealthCalculator } from '../utils/wealthCalculator'
import { Asset } from '../types/asset'

interface WealthSummaryCardsProps {
  assets: Asset[]
}

export default function WealthSummaryCards({ assets }: WealthSummaryCardsProps) {
  const summary = WealthCalculator.calculateSummary(assets)

  const getLiquidityText = () => {
    if (summary.liquidityScore >= 80) return '流动性优秀'
    if (summary.liquidityScore >= 60) return '流动性良好'
    if (summary.liquidityScore >= 40) return '流动性一般'
    return '流动性较差'
  }

  return (
    <Row gutter={16}>
      <Col span={6}>
        <Card>
          <Statistic
            title="净资产"
            value={summary.totalNetWorth}
            prefix={<WalletOutlined style={{ color: '#1890ff' }} />}
            suffix="元"
            precision={2}
            valueStyle={{ 
              color: summary.totalNetWorth >= 0 ? '#1890ff' : '#f5222d',
              fontSize: 24
            }}
          />
        </Card>
      </Col>

      <Col span={6}>
        <Card>
          <Statistic
            title="总资产"
            value={summary.totalAssets}
            prefix={<BankOutlined style={{ color: '#52c41a' }} />}
            suffix="元"
            precision={2}
            valueStyle={{ color: '#52c41a', fontSize: 24 }}
          />
        </Card>
      </Col>

      <Col span={6}>
        <Card>
          <Statistic
            title="总负债"
            value={summary.totalLiabilities}
            prefix={<CreditCardOutlined style={{ color: '#f5222d' }} />}
            suffix="元"
            precision={2}
            valueStyle={{ color: '#f5222d', fontSize: 24 }}
          />
        </Card>
      </Col>

      <Col span={6}>
        <Card
          extra={
            <div style={{ textAlign: 'right' }}>
              <Progress 
                percent={summary.liquidityScore} 
                showInfo={false}
                strokeColor="#722ed1"
                size="small"
                style={{ width: 80, marginBottom: 4 }}
              />
              <div style={{ fontSize: 12, color: '#999' }}>{getLiquidityText()}</div>
            </div>
          }
        >
          <Statistic
            title="流动性评分"
            value={summary.liquidityScore}
            prefix={<RiseOutlined style={{ color: '#722ed1' }} />}
            suffix="分"
            precision={1}
            valueStyle={{ color: '#722ed1', fontSize: 24 }}
          />
        </Card>
      </Col>
    </Row>
  )
}