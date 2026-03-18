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
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())
    .forEach((record) => {
      if (!record.productId) return
      if (!map.has(record.productId)) map.set(record.productId, record)
    })
  return map
}

function calculateOrderRevenue(order) {
  return order.items.reduce((sum, item) => sum + toNumber(item.unitPrice) * toNumber(item.quantity), 0)
}

function calculateOrderCharges(order) {
  const fees = order.fees.reduce((sum, fee) => sum + toNumber(fee.amount), 0)
  const refunds = order.refunds.reduce((sum, refund) => sum + toNumber(refund.amount), 0)
  return { fees, refunds }
}

function calculateLineCogs(item, costMap) {
  const cost = item.productId ? costMap.get(item.productId) : null
  if (!cost) return 0
  const perUnit = toNumber(cost.cogsPerUnit) + toNumber(cost.shippingPerUnit || 0)
  return perUnit * toNumber(item.quantity || 0)
}

async function loadBase({ tenantId, from, to, channel }) {
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
        ...(channel && { channel }),
      },
      orderBy: { spendDate: 'desc' },
    }),
  ])

  return { orders, costMap: getLatestCostMap(costRecords), adSpends }
}

function allocateAdSpendByDay({ orders, adSpends }) {
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

  return { adSpendByDay, dayRevenue }
}

function computeTotalsFromLines(lines) {
  const totals = lines.reduce(
    (acc, l) => {
      acc.revenue += l.revenue
      acc.cogs += l.cogs
      acc.fees += l.fees
      acc.refunds += l.refunds
      acc.adSpend += l.adSpend
      return acc
    },
    { revenue: 0, cogs: 0, fees: 0, refunds: 0, adSpend: 0 },
  )
  const grossProfit = totals.revenue - totals.cogs
  const netProfit = grossProfit - totals.fees - totals.refunds - totals.adSpend
  const marginPercent = totals.revenue === 0 ? 0 : (netProfit / totals.revenue) * 100
  return { ...totals, grossProfit, netProfit, marginPercent }
}

function toBreakdown(totals) {
  return [
    { key: 'Revenue', value: totals.revenue },
    { key: 'COGS', value: totals.cogs },
    { key: 'Fees', value: totals.fees },
    { key: 'Refunds', value: totals.refunds },
    { key: 'Ad spend', value: totals.adSpend },
    { key: 'Net profit', value: totals.netProfit },
  ]
}

async function getChannelStats({ tenantId, from, to, limit = 8 }) {
  const { orders, costMap, adSpends } = await loadBase({ tenantId, from, to })
  const { adSpendByDay, dayRevenue } = allocateAdSpendByDay({ orders, adSpends })

  const byChannel = new Map()

  orders.forEach((order) => {
    const channel = order.channel || 'UNKNOWN'
    const orderRevenue = calculateOrderRevenue(order)
    const { fees, refunds } = calculateOrderCharges(order)
    const dayKey = isoDay(order.orderDate)
    const daySpend = adSpendByDay.get(dayKey) || 0
    const dayTotalRevenue = dayRevenue.get(dayKey) || 0
    const orderAdSpend = dayTotalRevenue === 0 ? 0 : daySpend * (orderRevenue / dayTotalRevenue)

    order.items.forEach((item) => {
      const revenue = toNumber(item.unitPrice) * toNumber(item.quantity || 0)
      const ratio = orderRevenue === 0 ? 0 : revenue / orderRevenue

      const line = {
        revenue,
        cogs: calculateLineCogs(item, costMap),
        fees: fees * ratio,
        refunds: refunds * ratio,
        adSpend: orderAdSpend * ratio,
      }

      if (!byChannel.has(channel)) byChannel.set(channel, [])
      byChannel.get(channel).push(line)
    })
  })

  const channels = Array.from(byChannel.entries()).map(([channel, lines]) => {
    const totals = computeTotalsFromLines(lines)
    return {
      channel,
      revenue: totals.revenue,
      netProfit: totals.netProfit,
      marginPercent: totals.marginPercent,
      breakdown: totals,
    }
  })

  channels.sort((a, b) => b.revenue - a.revenue)
  return channels.slice(0, Math.max(1, Number(limit) || 8))
}

async function getProductStats({ tenantId, from, to, limit = 20, query }) {
  const { orders, costMap, adSpends } = await loadBase({ tenantId, from, to })
  const { adSpendByDay, dayRevenue } = allocateAdSpendByDay({ orders, adSpends })

  const q = query ? String(query).trim().toLowerCase() : ''
  const bySku = new Map()

  orders.forEach((order) => {
    const orderRevenue = calculateOrderRevenue(order)
    const { fees, refunds } = calculateOrderCharges(order)
    const dayKey = isoDay(order.orderDate)
    const daySpend = adSpendByDay.get(dayKey) || 0
    const dayTotalRevenue = dayRevenue.get(dayKey) || 0
    const orderAdSpend = dayTotalRevenue === 0 ? 0 : daySpend * (orderRevenue / dayTotalRevenue)

    order.items.forEach((item) => {
      const sku = item.product?.sku || item.productId?.toString() || 'UNMAPPED'
      const name = item.product?.name || sku

      if (q) {
        const hay = `${sku} ${name}`.toLowerCase()
        if (!hay.includes(q)) return
      }

      const revenue = toNumber(item.unitPrice) * toNumber(item.quantity || 0)
      const ratio = orderRevenue === 0 ? 0 : revenue / orderRevenue

      const line = {
        revenue,
        cogs: calculateLineCogs(item, costMap),
        fees: fees * ratio,
        refunds: refunds * ratio,
        adSpend: orderAdSpend * ratio,
      }

      if (!bySku.has(sku)) bySku.set(sku, { sku, name, lines: [] })
      bySku.get(sku).lines.push(line)
    })
  })

  const products = Array.from(bySku.values()).map((entry) => {
    const totals = computeTotalsFromLines(entry.lines)
    return {
      sku: entry.sku,
      name: entry.name,
      revenue: totals.revenue,
      netProfit: totals.netProfit,
      marginPercent: totals.marginPercent,
      breakdown: totals,
    }
  })

  products.sort((a, b) => b.revenue - a.revenue)
  return products.slice(0, Math.max(1, Number(limit) || 20))
}

async function getChannelDetail({ tenantId, from, to, channel }) {
  const { orders, costMap, adSpends } = await loadBase({ tenantId, from, to, channel })
  const { adSpendByDay, dayRevenue } = allocateAdSpendByDay({ orders, adSpends })

  const daily = new Map()
  const lines = []

  orders.forEach((order) => {
    const orderRevenue = calculateOrderRevenue(order)
    const { fees, refunds } = calculateOrderCharges(order)
    const dayKey = isoDay(order.orderDate)
    const daySpend = adSpendByDay.get(dayKey) || 0
    const dayTotalRevenue = dayRevenue.get(dayKey) || 0
    const orderAdSpend = dayTotalRevenue === 0 ? 0 : daySpend * (orderRevenue / dayTotalRevenue)

    order.items.forEach((item) => {
      const revenue = toNumber(item.unitPrice) * toNumber(item.quantity || 0)
      const ratio = orderRevenue === 0 ? 0 : revenue / orderRevenue

      const line = {
        date: dayKey,
        sku: item.product?.sku || null,
        name: item.product?.name || item.product?.sku || 'Unmapped SKU',
        revenue,
        cogs: calculateLineCogs(item, costMap),
        fees: fees * ratio,
        refunds: refunds * ratio,
        adSpend: orderAdSpend * ratio,
      }

      line.netProfit = line.revenue - line.cogs - line.fees - line.refunds - line.adSpend
      line.marginPercent = line.revenue === 0 ? 0 : (line.netProfit / line.revenue) * 100

      lines.push(line)

      if (!daily.has(dayKey)) {
        daily.set(dayKey, { date: dayKey, revenue: 0, cogs: 0, fees: 0, refunds: 0, adSpend: 0, netProfit: 0 })
      }
      const bucket = daily.get(dayKey)
      bucket.revenue += line.revenue
      bucket.cogs += line.cogs
      bucket.fees += line.fees
      bucket.refunds += line.refunds
      bucket.adSpend += line.adSpend
      bucket.netProfit += line.netProfit
    })
  })

  const totals = computeTotalsFromLines(lines)
  const trend = Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date))

  return { totals, breakdown: toBreakdown(totals), trend, topProducts: summarizeTop(lines, 'sku') }
}

async function getProductDetail({ tenantId, from, to, sku }) {
  const { orders, costMap, adSpends } = await loadBase({ tenantId, from, to })
  const { adSpendByDay, dayRevenue } = allocateAdSpendByDay({ orders, adSpends })

  const daily = new Map()
  const lines = []

  orders.forEach((order) => {
    const orderRevenue = calculateOrderRevenue(order)
    const { fees, refunds } = calculateOrderCharges(order)
    const dayKey = isoDay(order.orderDate)
    const daySpend = adSpendByDay.get(dayKey) || 0
    const dayTotalRevenue = dayRevenue.get(dayKey) || 0
    const orderAdSpend = dayTotalRevenue === 0 ? 0 : daySpend * (orderRevenue / dayTotalRevenue)

    order.items.forEach((item) => {
      const itemSku = item.product?.sku || item.productId?.toString() || 'UNMAPPED'
      if (itemSku !== sku) return

      const revenue = toNumber(item.unitPrice) * toNumber(item.quantity || 0)
      const ratio = orderRevenue === 0 ? 0 : revenue / orderRevenue

      const line = {
        date: dayKey,
        channel: order.channel || 'UNKNOWN',
        sku: itemSku,
        name: item.product?.name || itemSku,
        revenue,
        cogs: calculateLineCogs(item, costMap),
        fees: fees * ratio,
        refunds: refunds * ratio,
        adSpend: orderAdSpend * ratio,
      }

      line.netProfit = line.revenue - line.cogs - line.fees - line.refunds - line.adSpend
      line.marginPercent = line.revenue === 0 ? 0 : (line.netProfit / line.revenue) * 100

      lines.push(line)

      if (!daily.has(dayKey)) {
        daily.set(dayKey, { date: dayKey, revenue: 0, cogs: 0, fees: 0, refunds: 0, adSpend: 0, netProfit: 0 })
      }
      const bucket = daily.get(dayKey)
      bucket.revenue += line.revenue
      bucket.cogs += line.cogs
      bucket.fees += line.fees
      bucket.refunds += line.refunds
      bucket.adSpend += line.adSpend
      bucket.netProfit += line.netProfit
    })
  })

  const totals = computeTotalsFromLines(lines)
  const trend = Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date))

  return { totals, breakdown: toBreakdown(totals), trend, topChannels: summarizeTop(lines, 'channel') }
}

function summarizeTop(lines, field) {
  const map = new Map()
  lines.forEach((l) => {
    const key = l[field] || 'UNKNOWN'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(l)
  })

  const items = Array.from(map.entries()).map(([key, ls]) => {
    const totals = computeTotalsFromLines(ls)
    return { key, revenue: totals.revenue, netProfit: totals.netProfit, marginPercent: totals.marginPercent }
  })
  items.sort((a, b) => b.revenue - a.revenue)
  return items.slice(0, 10)
}

module.exports = {
  getChannelStats,
  getProductStats,
  getChannelDetail,
  getProductDetail,
}

