const { parse } = require('csv-parse/sync')
const prisma = require('../utils/prismaClient')

const CHANNEL_MAP = {
  amazon: 'AMAZON',
  ebay: 'EBAY',
  shopify: 'SHOPIFY',
}

function normalizeChannel(raw) {
  if (!raw) return 'UNKNOWN'
  const key = raw.toString().trim().toLowerCase()
  return CHANNEL_MAP[key] || raw.toUpperCase()
}

async function processCsv({ type, tenantId, csv }) {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  if (type === 'orders') {
    return processOrderCsv({ tenantId, records, raw: csv })
  }

  if (type === 'products') {
    return processProductCsv({ tenantId, records, raw: csv })
  }

  throw new Error(`Unsupported CSV type: ${type}`)
}

async function processOrderCsv({ tenantId, records, raw }) {
  await prisma.rawOrder.createMany({
    data: records.map((row) => ({
      tenantId,
      source: row.channel || 'unknown',
      rawCsvRow: JSON.stringify(row),
    })),
  })

  let createdOrders = 0

  for (const row of records) {
    // minimal example schema: adjust fields to real CSV later
    const externalId = row.order_id
    const channel = normalizeChannel(row.channel)
    const currency = (row.currency || 'USD').toUpperCase()
    const totalAmount = row.total_amount ? Number(row.total_amount) : 0
    const orderDate = row.order_date ? new Date(row.order_date) : new Date()

    const order = await prisma.order.upsert({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId,
        },
      },
      update: {
        channel,
        currency,
        totalAmount,
        orderDate,
      },
      create: {
        tenantId,
        externalId,
        channel,
        currency,
        totalAmount,
        orderDate,
      },
    })

    createdOrders += 1

    if (row.sku && row.quantity) {
      const product = await prisma.product.upsert({
        where: {
          tenantId_sku: {
            tenantId,
            sku: row.sku,
          },
        },
        update: {
          name: row.product_name || row.sku,
        },
        create: {
          tenantId,
          sku: row.sku,
          name: row.product_name || row.sku,
          baseCurrency: currency,
        },
      })

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity: Number(row.quantity),
          unitPrice: Number(row.unit_price || 0),
        },
      })
    }

    if (row.fee_amount) {
      await prisma.fee.create({
        data: {
          orderId: order.id,
          category: row.fee_category || 'GENERAL',
          amount: Number(row.fee_amount),
          currency,
        },
      })
    }

    if (row.refund_amount) {
      await prisma.refund.create({
        data: {
          orderId: order.id,
          category: row.refund_category || 'GENERAL',
          amount: Number(row.refund_amount),
          currency,
        },
      })
    }
  }

  return {
    type: 'orders',
    records: records.length,
    createdOrders,
  }
}

async function processProductCsv({ tenantId, records, raw }) {
  await prisma.rawProduct.createMany({
    data: records.map((row) => ({
      tenantId,
      source: row.source || 'products_csv',
      rawCsvRow: JSON.stringify(row),
    })),
  })

  let upserted = 0

  for (const row of records) {
    if (!row.sku) continue
    const currency = (row.currency || 'USD').toUpperCase()

    await prisma.product.upsert({
      where: {
        tenantId_sku: {
          tenantId,
          sku: row.sku,
        },
      },
      update: {
        name: row.name || row.sku,
      },
      create: {
        tenantId,
        sku: row.sku,
        name: row.name || row.sku,
        baseCurrency: currency,
      },
    })
    upserted += 1
  }

  return {
    type: 'products',
    records: records.length,
    upserted,
  }
}

async function getProducts({ tenantId }) {
  const where = tenantId ? { tenantId } : {}
  return prisma.product.findMany({
    where,
    orderBy: { id: 'asc' },
  })
}

async function getOrders({ tenantId }) {
  const where = tenantId ? { tenantId } : {}
  return prisma.order.findMany({
    where,
    include: {
      items: {
        include: {
          product: true,
        },
      },
      fees: true,
      refunds: true,
    },
    orderBy: { id: 'asc' },
  })
}

module.exports = {
  processCsv,
  getProducts,
  getOrders,
}

