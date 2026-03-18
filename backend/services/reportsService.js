const prisma = require('../utils/prismaClient')

function toNumber(value) {
  if (value == null) return 0
  return Number(value)
}

function isoDay(value) {
  return new Date(value).toISOString().slice(0, 10)
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

function calculateOrderRevenue(order) {
  return order.items.reduce(
    (sum, item) => sum + toNumber(item.unitPrice) * toNumber(item.quantity),
    0,
  )
}

function calculateOrderFees(order) {
  const fees = order.fees.reduce((sum, fee) => sum + toNumber(fee.amount), 0)
  const refunds = order.refunds.reduce(
    (sum, refund) => sum + toNumber(refund.amount),
    0,
  )
  return { fees, refunds }
}

function calculateLineCogs(item, costMap) {
  const cost = item.productId ? costMap.get(item.productId) : null
  if (!cost) return 0
  const perUnit = toNumber(cost.cogsPerUnit) + toNumber(cost.shippingPerUnit || 0)
  return perUnit * toNumber(item.quantity || 0)
}

async function getReportRows({ tenantId, from, to, channel, query }) {
  const dateFilter = from || to ? { gte: from, lte: to } : undefined

  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      ...(dateFilter && { orderDate: dateFilter }),
      ...(channel && { channel }),
    },
    include: {
      items: { include: { product: true } },
      fees: true,
      refunds: true,
    },
    orderBy: { orderDate: 'desc' },
  })

  const [costRecords, adSpends] = await Promise.all([
    prisma.costRecord.findMany({ where: { tenantId } }),
    prisma.adSpendRecord.findMany({
      where: {
        tenantId,
        ...(dateFilter && { spendDate: dateFilter }),
      },
    }),
  ])

  const costMap = getLatestCostMap(costRecords)

  const adSpendByDay = new Map()
  adSpends.forEach((record) => {
    const key = isoDay(record.spendDate)
    adSpendByDay.set(key, (adSpendByDay.get(key) || 0) + toNumber(record.amount))
  })

  const dayRevenue = new Map()
  orders.forEach((order) => {
    const key = isoDay(order.orderDate)
    const revenue = calculateOrderRevenue(order)
    dayRevenue.set(key, (dayRevenue.get(key) || 0) + revenue)
  })

  const q = query ? query.trim().toLowerCase() : ''

  const rows = []

  orders.forEach((order) => {
    const orderRevenue = calculateOrderRevenue(order)
    const { fees, refunds } = calculateOrderFees(order)
    const totalCharges = fees + refunds
    const dayKey = isoDay(order.orderDate)
    const daySpend = adSpendByDay.get(dayKey) || 0
    const dayTotalRevenue = dayRevenue.get(dayKey) || 0
    const orderAdSpend = dayTotalRevenue === 0 ? 0 : daySpend * (orderRevenue / dayTotalRevenue)

    order.items.forEach((item) => {
      const sku = item.product?.sku || null
      const productName = item.product?.name || sku || 'Unmapped SKU'

      if (q) {
        const hay = `${sku || ''} ${productName || ''}`.toLowerCase()
        if (!hay.includes(q)) return
      }

      const revenue = toNumber(item.unitPrice) * toNumber(item.quantity || 0)
      const cogs = calculateLineCogs(item, costMap)
      const ratio = orderRevenue === 0 ? 0 : revenue / orderRevenue
      const feeShare = totalCharges * ratio
      const adSpend = orderAdSpend * ratio
      const netProfit = revenue - cogs - feeShare - adSpend
      const marginPercent = revenue === 0 ? 0 : (netProfit / revenue) * 100

      rows.push({
        id: `${order.id}-${item.id}`,
        date: order.orderDate.toISOString(),
        channel: order.channel,
        sku,
        productName,
        revenue,
        cogs,
        fees: feeShare,
        adSpend,
        netProfit,
        marginPercent,
      })
    })
  })

  return rows
}

module.exports = {
  getReportRows,
}

