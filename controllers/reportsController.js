const reportsService = require('../services/reportsService')

function parseDate(value) {
  if (!value) return undefined
  const date = new Date(value)
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(date.getTime())) return undefined
  return date
}

async function getReports(req, res) {
  try {
    const tenantId = req.tenantId
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    const channel = req.query.channel ? String(req.query.channel) : undefined
    const query = req.query.query ? String(req.query.query) : undefined

    const rows = await reportsService.getReportRows({
      tenantId,
      from,
      to,
      channel,
      query,
    })

    return res.json({ rows })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getReports error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

function escapeCsv(value) {
  if (value == null) return ''
  const raw = String(value)
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

async function exportReports(req, res) {
  try {
    const tenantId = req.tenantId
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    const channel = req.query.channel ? String(req.query.channel) : undefined
    const query = req.query.query ? String(req.query.query) : undefined

    const rows = await reportsService.getReportRows({
      tenantId,
      from,
      to,
      channel,
      query,
    })

    const header = [
      'date',
      'channel',
      'sku',
      'product',
      'revenue',
      'cogs',
      'fees',
      'ad_spend',
      'net_profit',
      'margin_percent',
    ]

    const lines = [header.join(',')]
    rows.forEach((row) => {
      lines.push(
        [
          row.date?.slice(0, 10),
          row.channel,
          row.sku,
          row.productName,
          row.revenue,
          row.cogs,
          row.fees,
          row.adSpend,
          row.netProfit,
          row.marginPercent,
        ]
          .map(escapeCsv)
          .join(','),
      )
    })

    const csv = `${lines.join('\n')}\n`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="profitdesk-report.csv"')
    return res.status(200).send(csv)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('exportReports error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = {
  getReports,
  exportReports,
}

