const profitService = require('../services/profitService')

function parseDate(value) {
  if (!value) return undefined
  const date = new Date(value)
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(date.getTime())) return undefined
  return date
}

async function getDashboardData(req, res) {
  try {
    const tenantId = req.tenantId
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    const days = req.query.days ? Number(req.query.days) : 30

    const [summary, trend] = await Promise.all([
      profitService.getSummary({ tenantId, from, to }),
      profitService.getTrend({ tenantId, days }),
    ])

    const summaryData = {
      revenue: summary.revenue,
      cogs: summary.cogs,
      fees: summary.fees,
      refunds: summary.refunds,
      ad_spend: summary.adSpend,
      net_profit: summary.netProfit,
      margin_percent: summary.marginPercent,
    }

    const trendData = trend.map((point) => ({
      date: point.date,
      revenue: point.revenue,
      cogs: point.cogs,
      fees: point.fees,
      refunds: point.refunds,
      ad_spend: point.adSpend,
      net_profit: point.netProfit,
    }))

    return res.json({
      summary: summaryData,
      trend: trendData,
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getDashboardData error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = {
  getDashboardData,
}

