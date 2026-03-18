const analyticsService = require('../services/analyticsService')

function parseDate(value) {
  if (!value) return undefined
  const date = new Date(value)
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(date.getTime())) return undefined
  return date
}

async function getTopChannels(req, res) {
  try {
    const tenantId = req.tenantId
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    const limit = req.query.limit ? Number(req.query.limit) : 8

    const channels = await analyticsService.getChannelStats({ tenantId, from, to, limit })
    return res.json({ channels })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getTopChannels error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getTopProducts(req, res) {
  try {
    const tenantId = req.tenantId
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    const limit = req.query.limit ? Number(req.query.limit) : 25
    const query = req.query.query ? String(req.query.query) : undefined

    const products = await analyticsService.getProductStats({ tenantId, from, to, limit, query })
    return res.json({ products })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getTopProducts error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getChannelDetail(req, res) {
  try {
    const tenantId = req.tenantId
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    const channel = req.params.channel ? String(req.params.channel) : ''

    if (!channel) return res.status(400).json({ message: 'channel is required' })

    const detail = await analyticsService.getChannelDetail({ tenantId, from, to, channel })
    return res.json({ channel, ...detail })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getChannelDetail error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getProductDetail(req, res) {
  try {
    const tenantId = req.tenantId
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    const sku = req.params.sku ? String(req.params.sku) : ''

    if (!sku) return res.status(400).json({ message: 'sku is required' })

    const detail = await analyticsService.getProductDetail({ tenantId, from, to, sku })
    return res.json({ sku, ...detail })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getProductDetail error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = {
  getTopChannels,
  getTopProducts,
  getChannelDetail,
  getProductDetail,
}

