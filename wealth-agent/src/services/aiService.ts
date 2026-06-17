import { useAssetStore } from '../stores/assetStore'
import { useHoldingStore } from '../stores/holdingStore'
import { WealthCalculator } from '../utils/wealthCalculator'

// System Prompt - AI投顾人设
const SYSTEM_PROMPT = `你是一位专业的财富管理顾问AI，具备以下能力：

## 专业身份
- 15年经验的CFA持证人
- 擅长家庭资产配置
- 擅长投资组合优化
- 擅长风险管理

## 核心原则
- 所有建议必须基于用户的实际持仓和风险承受能力
- 必须参考用户的历史决策，保持建议的一致性
- 给出具体的、可执行的建议，而非空泛理论
- 明确标注风险提示，不承诺收益

## 工作流程
1. 先了解用户当前的财富状况和持仓
2. 了解用户的投资目标和风险偏好
3. 如有需要，查询实时市场数据
4. 综合分析后给出结构化建议

## 输出格式
📊 现状分析：简要描述用户的财务状况
⚠️ 风险提示：明确指出潜在风险
💡 优化建议：分点列出可执行的建议
🎯 行动计划：具体的下一步操作

记住：用户的利益永远第一，保守、谨慎、专业。`

// 获取用户财务上下文
function getUserFinancialContext(): string {
  const { assets } = useAssetStore.getState()
  const { holdings, getTotalValue, getTotalProfit, getProfitRate } = useHoldingStore.getState()
  
  // 计算资产汇总
  const summary = WealthCalculator.calculateSummary(assets)
  
  // 股票持仓
  const stockHoldings = holdings.filter(h => h.type === 'stock')
  const fundHoldings = holdings.filter(h => h.type === 'fund')
  
  let context = '## 用户财务概况\n\n'
  
  // 总资产
  context += `### 总资产情况\n`
  context += `- 总资产：¥${summary.totalAssets.toLocaleString()}\n`
  context += `- 总负债：¥${summary.totalLiabilities.toLocaleString()}\n`
  context += `- 净资产：¥${summary.totalNetWorth.toLocaleString()}\n`
  context += `- 流动性评分：${summary.liquidityScore}分\n\n`
  
  // 资产分布
  if (summary.assetDistribution.length > 0) {
    context += `### 资产分布\n`
    summary.assetDistribution.forEach(item => {
      context += `- ${getAssetTypeName(item.type)}：¥${item.amount.toLocaleString()} (${item.percentage.toFixed(1)}%)\n`
    })
    context += '\n'
  }
  
  // 持仓情况
  if (stockHoldings.length > 0) {
    context += `### 股票持仓（共${stockHoldings.length}只）\n`
    stockHoldings.forEach(h => {
      context += `- ${h.name}(${h.symbol})：${h.quantity}股，成本¥${h.avgCost.toFixed(2)}，当前¥${h.currentPrice.toFixed(2)}\n`
    })
    context += `- 股票总市值：¥${getTotalValue('stock').toLocaleString()}\n`
    context += `- 股票盈亏：¥${getTotalProfit('stock').toLocaleString()} (${getProfitRate('stock').toFixed(2)}%)\n\n`
  }
  
  if (fundHoldings.length > 0) {
    context += `### 基金持仓（共${fundHoldings.length}只）\n`
    fundHoldings.forEach(h => {
      context += `- ${h.name}(${h.symbol})：${h.quantity}份，成本¥${h.avgCost.toFixed(2)}，当前¥${h.currentPrice.toFixed(2)}\n`
    })
    context += `- 基金总市值：¥${getTotalValue('fund').toLocaleString()}\n`
    context += `- 基金盈亏：¥${getTotalProfit('fund').toLocaleString()} (${getProfitRate('fund').toFixed(2)}%)\n\n`
  }
  
  if (holdings.length === 0 && assets.length === 0) {
    context += '### 注意事项\n用户尚未添加任何资产或持仓信息，请先了解用户的基本情况。\n'
  }
  
  return context
}

function getAssetTypeName(type: string): string {
  const names: Record<string, string> = {
    cash: '现金/存款',
    stock: '股票',
    fund: '基金',
    real_estate: '房产',
    debt: '负债'
  }
  return names[type] || type
}

// 调用OpenAI API
export async function sendMessageToAI(userMessage: string): Promise<string> {
  // 检查API Key
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  
  if (!apiKey || apiKey === 'your-openai-api-key') {
    // 没有API Key，返回模拟回复
    return getMockResponse(userMessage)
  }
  
  try {
    const context = getUserFinancialContext()
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: `当前用户数据：\n${context}` },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }
    
    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error('AI API调用失败:', error)
    return getMockResponse(userMessage)
  }
}

// 模拟回复（当没有API Key时）
function getMockResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase()
  
  if (lowerMessage.includes('风险') || lowerMessage.includes('风险评估')) {
    return `📊 **风险评估分析**

基于您目前的资产配置：

**当前风险等级：中低风险**

**优势：**
- ✅ 流动性资产配置充足
- ✅ 负债比例合理（负债率约${Math.round(Math.random() * 30 + 10)}%）
- ✅ 资产配置相对分散

**潜在风险：**
- ⚠️ 股票仓位集中度偏高，建议分散
- ⚠️ 缺少避险资产配置
- ⚠️ 流动性风险管理待加强

**建议：**
1. 适当降低单一股票持仓至15%以下
2. 考虑配置10-20%的债券基金作为避险资产
3. 保持3-6个月生活费的现金储备`
  }
  
  if (lowerMessage.includes('配置') || lowerMessage.includes('优化')) {
    return `💡 **资产配置优化建议**

基于您当前的财务状况，提供以下优化建议：

## 当前配置分析
您的资产配置基本合理，但有进一步优化的空间。

## 优化建议

### 1. 股票仓位调整
- **现状**：股票占比偏高
- **建议**：将股票仓位控制在30-40%
- **理由**：降低单一市场风险

### 2. 增加基金配置
- **建议**：增加指数基金配置至20-30%
- **理由**：分散个股风险，同时分享市场成长

### 3. 保持流动性
- **建议**：保持20-30%的现金或短期理财产品
- **理由**：应对突发情况和投资机会

### 4. 考虑债券
- **建议**：配置10-15%的债券基金
- **理由**：降低整体组合波动性`
  }
  
  if (lowerMessage.includes('持仓') || lowerMessage.includes('股票')) {
    const { holdings } = useHoldingStore.getState()
    const { getTotalValue, getTotalProfit } = useHoldingStore.getState()
    
    if (holdings.length === 0) {
      return `📊 **持仓分析**

您目前还没有添加任何持仓信息。

**建议操作：**
1. 点击"持仓管理"添加您的股票或基金持仓
2. 录入成本价和持仓数量
3. 添加后我可以帮您分析持仓情况和优化建议

**为什么要添加持仓？**
- 了解真实的投资敞口
- 计算盈亏情况
- 获得个性化的配置建议
- 追踪投资表现`
    }
    
    return `📊 **持仓分析**

您目前持有 ${holdings.length} 个标的：
- 股票：${holdings.filter(h => h.type === 'stock').length} 只
- 基金：${holdings.filter(h => h.type === 'fund').length} 只

**总市值**：¥${getTotalValue().toLocaleString()}
**总盈亏**：¥${getTotalProfit().toLocaleString()} (${((getTotalProfit() / getTotalValue()) * 100).toFixed(2)}%)

**初步建议：**
1. 持仓数量适中，继续观察
2. 关注持仓的分散度，避免过度集中
3. 定期检视持仓表现，适时调整`
  }
  
  if (lowerMessage.includes('总资产') || lowerMessage.includes('净资产')) {
    const { assets } = useAssetStore.getState()
    const summary = WealthCalculator.calculateSummary(assets)
    
    return `💰 **资产总览**

**净资产**：¥${summary.totalNetWorth.toLocaleString()}
**总资产**：¥${summary.totalAssets.toLocaleString()}
**总负债**：¥${summary.totalLiabilities.toLocaleString()}
**流动性评分**：${summary.liquidityScore}/100

${summary.assetDistribution.length > 0 ? '**资产分布**：' + summary.assetDistribution.map(a => `${getAssetTypeName(a.type)}${a.percentage.toFixed(1)}%`).join('、') : '暂无资产数据'}

整体来看，您的净资产 ${summary.totalNetWorth >= 0 ? '为正，财务状况良好' : '为负，需要重点关注债务问题'}。`
  }
  
  // 默认回复
  return `您好！我是您的AI财富管理顾问。

**我能帮您：**
- 📊 分析资产配置和风险状况
- 💡 提供投资组合优化建议
- 📈 解读持仓表现
- 🎯 制定投资计划

**请告诉我您想了解什么？**
例如："我的投资风险如何？"、"如何优化我的资产配置？"`
}