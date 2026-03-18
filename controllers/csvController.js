const csvService = require('../services/csvService')

async function uploadCsv(req, res) {
  try {
    const { type, csv } = req.body
    const tenantId = req.tenantId

    if (!type || !['orders', 'products'].includes(type)) {
      return res.status(400).json({ message: 'type must be "orders" or "products"' })
    }

    if (!csv) {
      return res.status(400).json({ message: 'csv content is required' })
    }

    const result = await csvService.processCsv({
      type,
      tenantId,
      csv,
    })

    return res.status(201).json({
      message: 'CSV processed successfully',
      summary: result,
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('CSV upload error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getProducts(req, res) {
  try {
    const tenantId = req.tenantId
    const data = await csvService.getProducts({ tenantId })
    return res.json(data)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Get products error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getOrders(req, res) {
  try {
    const tenantId = req.tenantId
    const data = await csvService.getOrders({ tenantId })
    return res.json(data)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Get orders error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = {
  uploadCsv,
  getProducts,
  getOrders,
}

