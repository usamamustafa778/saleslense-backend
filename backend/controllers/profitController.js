const profitService = require('../services/profitService')

function parseDate(value) {
  if (!value) return undefined
  const date = new Date(value)
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(date.getTime())) return undefined
  return date
}

async function getDashboardSummary(req, res) {
  try {
    const tenantId = Number(req.query.tenantId || 1)
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)

    const summary = await profitService.getSummary({ tenantId, from, to })

    return res.json({
      revenue: summary.revenue,
      cogs: summary.cogs,
      fees: summary.fees,
      refunds: summary.refunds,
      ad_spend: summary.adSpend,
      net_profit: summary.netProfit,
      margin_percent: summary.marginPercent,
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getDashboardSummary error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getDashboardTrend(req, res) {
  try {
    const tenantId = Number(req.query.tenantId || 1)
    const days = req.query.days ? Number(req.query.days) : 30

    const trend = await profitService.getTrend({ tenantId, days })

    const normalizedTrend = trend.map((point) => ({
      date: point.date,
      revenue: point.revenue,
      cogs: point.cogs,
      fees: point.fees,
      refunds: point.refunds,
      ad_spend: point.adSpend,
      net_profit: point.netProfit,
    }))

    return res.json({
      trend: normalizedTrend,
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getDashboardTrend error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getProductProfitability(req, res) {
  try {
    const tenantId = Number(req.query.tenantId || 1)
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)

    const products = await profitService.getProductProfitability({
      tenantId,
      from,
      to,
    })

    return res.json({
      products,
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getProductProfitability error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = {
  getDashboardSummary,
  getDashboardTrend,
  getProductProfitability,
}

