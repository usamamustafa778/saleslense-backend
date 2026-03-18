const prisma = require('../utils/prismaClient')

function toNumber(value) {
  if (value == null) return 0
  return Number(value)
}

function calculateOrderRevenue(order) {
  return order.items.reduce(
    (sum, item) => sum + toNumber(item.unitPrice) * toNumber(item.quantity),
    0,
  )
}

function getLatestCostMap(costRecords) {
  const map = new Map()
  costRecords
    .sort(
      (a, b) =>
        new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime(),
    )
    .forEach((record) => {
      if (!record.productId) return
      if (!map.has(record.productId)) {
        map.set(record.productId, record)
      }
    })

  return map
}

function calculateOrderCogs(order, costMap) {
  return order.items.reduce((sum, item) => {
    const cost = item.productId ? costMap.get(item.productId) : null
    if (!cost) return sum

    const perUnit =
      toNumber(cost.cogsPerUnit) + toNumber(cost.shippingPerUnit || 0)

    return sum + perUnit * toNumber(item.quantity)
  }, 0)
}

function calculateOrderFees(order) {
  const fees = order.fees.reduce((sum, fee) => sum + toNumber(fee.amount), 0)
  const refunds = order.refunds.reduce(
    (sum, refund) => sum + toNumber(refund.amount),
    0,
  )
  return { fees, refunds }
}

async function loadBaseData({ tenantId, from, to }) {
  const dateFilter = from || to ? { gte: from, lte: to } : undefined

  const [orders, costRecords, adSpends] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId,
        ...(dateFilter && { orderDate: dateFilter }),
      },
      include: {
        items: true,
        fees: true,
        refunds: true,
      },
      orderBy: { orderDate: 'asc' },
    }),
    prisma.costRecord.findMany({
      where: { tenantId },
    }),
    prisma.adSpendRecord.findMany({
      where: {
        tenantId,
        ...(dateFilter && { spendDate: dateFilter }),
      },
    }),
  ])

  const costMap = getLatestCostMap(costRecords)

  return { orders, costMap, adSpends }
}

async function getSummary({ tenantId, from, to }) {
  const { orders, costMap, adSpends } = await loadBaseData({ tenantId, from, to })

  let revenue = 0
  let cogs = 0
  let totalFees = 0
  let totalRefunds = 0

  orders.forEach((order) => {
    const orderRevenue = calculateOrderRevenue(order)
    const orderCogs = calculateOrderCogs(order, costMap)
    const { fees, refunds } = calculateOrderFees(order)

    revenue += orderRevenue
    cogs += orderCogs
    totalFees += fees
    totalRefunds += refunds
  })

  const adSpend = adSpends.reduce((sum, record) => sum + toNumber(record.amount), 0)
  const netProfit = revenue - cogs - totalFees - totalRefunds - adSpend
  const marginPercent = revenue === 0 ? 0 : (netProfit / revenue) * 100

  return {
    revenue,
    cogs,
    fees: totalFees,
    refunds: totalRefunds,
    adSpend,
    netProfit,
    marginPercent,
  }
}

async function getTrend({ tenantId, days = 30 }) {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - (days - 1))

  const { orders, costMap, adSpends } = await loadBaseData({ tenantId, from, to })

  const trendMap = new Map()

  // initialize days
  for (let i = 0; i < days; i += 1) {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    trendMap.set(key, {
      date: key,
      revenue: 0,
      cogs: 0,
      fees: 0,
      refunds: 0,
      adSpend: 0,
      netProfit: 0,
    })
  }

  orders.forEach((order) => {
    const key = new Date(order.orderDate).toISOString().slice(0, 10)
    const bucket = trendMap.get(key)
    if (!bucket) return

    const orderRevenue = calculateOrderRevenue(order)
    const orderCogs = calculateOrderCogs(order, costMap)
    const { fees, refunds } = calculateOrderFees(order)

    bucket.revenue += orderRevenue
    bucket.cogs += orderCogs
    bucket.fees += fees
    bucket.refunds += refunds
  })

  adSpends.forEach((record) => {
    const key = new Date(record.spendDate).toISOString().slice(0, 10)
    const bucket = trendMap.get(key)
    if (!bucket) return
    bucket.adSpend += toNumber(record.amount)
  })

  const trend = Array.from(trendMap.values()).map((bucket) => {
    const netProfit =
      bucket.revenue -
      bucket.cogs -
      bucket.fees -
      bucket.refunds -
      bucket.adSpend
    return {
      ...bucket,
      netProfit,
    }
  })

  return trend
}

async function getProductProfitability({ tenantId, from, to }) {
  const { orders, costMap } = await loadBaseData({ tenantId, from, to })

  const productMap = new Map()

  orders.forEach((order) => {
    const { fees, refunds } = calculateOrderFees(order)
    const orderRevenue = calculateOrderRevenue(order)

    order.items.forEach((item) => {
      const key = item.productId || `unmapped-${item.id}`
      if (!productMap.has(key)) {
        productMap.set(key, {
          productId: item.productId ?? null,
          sku: item.product?.sku ?? null,
          name: item.product?.name ?? 'Unmapped SKU',
          revenue: 0,
          cogs: 0,
          fees: 0,
          refunds: 0,
          netProfit: 0,
        })
      }

      const entry = productMap.get(key)

      const lineRevenue =
        toNumber(item.unitPrice) * toNumber(item.quantity || 0)

      const cost = item.productId ? costMap.get(item.productId) : null
      const perUnit =
        cost && (cost.cogsPerUnit || cost.shippingPerUnit)
          ? toNumber(cost.cogsPerUnit) + toNumber(cost.shippingPerUnit || 0)
          : 0
      const lineCogs = perUnit * toNumber(item.quantity || 0)

      const ratio = orderRevenue === 0 ? 0 : lineRevenue / orderRevenue

      entry.revenue += lineRevenue
      entry.cogs += lineCogs
      entry.fees += fees * ratio
      entry.refunds += refunds * ratio
    })
  })

  const results = Array.from(productMap.values()).map((entry) => {
    const netProfit =
      entry.revenue - entry.cogs - entry.fees - entry.refunds
    const marginPercent =
      entry.revenue === 0 ? 0 : (netProfit / entry.revenue) * 100
    return {
      ...entry,
      netProfit,
      marginPercent,
    }
  })

  results.sort((a, b) => b.revenue - a.revenue)

  return results
}

module.exports = {
  getSummary,
  getTrend,
  getProductProfitability,
}

