const costService = require('../services/costService')

async function upsertCosts(req, res) {
  try {
    const { tenantId, productId, sku, cogsPerUnit, shippingPerUnit, currency, adSpend } =
      req.body

    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' })
    }

    const result = await costService.upsertCosts({
      tenantId: Number(tenantId),
      productId,
      sku,
      cogsPerUnit,
      shippingPerUnit,
      currency,
      adSpend,
    })

    return res.status(201).json(result)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Upsert costs error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function getCosts(req, res) {
  try {
    const { tenantId } = req.query
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' })
    }

    const data = await costService.getCosts({ tenantId: Number(tenantId) })
    return res.json(data)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Get costs error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = {
  upsertCosts,
  getCosts,
}

