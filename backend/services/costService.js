const prisma = require('../utils/prismaClient')

async function upsertCosts({
  tenantId,
  productId,
  sku,
  cogsPerUnit,
  shippingPerUnit,
  currency,
  adSpend,
}) {
  let product = null

  if (productId) {
    product = await prisma.product.findFirst({
      where: { id: Number(productId), tenantId },
    })
  } else if (sku) {
    product = await prisma.product.findFirst({
      where: {
        tenantId,
        sku,
      },
    })
  }

  if (!currency) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    // eslint-disable-next-line no-param-reassign
    currency = tenant?.baseCurrency || 'USD'
  }

  let costRecord = null
  if (cogsPerUnit || shippingPerUnit) {
    costRecord = await prisma.costRecord.create({
      data: {
        tenantId,
        productId: product ? product.id : null,
        cogsPerUnit: cogsPerUnit != null ? Number(cogsPerUnit) : null,
        shippingPerUnit: shippingPerUnit != null ? Number(shippingPerUnit) : null,
        currency,
      },
    })
  }

  let adSpendRecord = null
  if (adSpend) {
    adSpendRecord = await prisma.adSpendRecord.create({
      data: {
        tenantId,
        channel: adSpend.channel || 'GENERIC',
        amount: Number(adSpend.amount || 0),
        currency: adSpend.currency || currency,
        spendDate: adSpend.date ? new Date(adSpend.date) : new Date(),
      },
    })
  }

  return {
    costRecord,
    adSpendRecord,
  }
}

async function getCosts({ tenantId }) {
  const [costs, adSpends] = await Promise.all([
    prisma.costRecord.findMany({
      where: { tenantId },
      include: { product: true },
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.adSpendRecord.findMany({
      where: { tenantId },
      orderBy: { spendDate: 'desc' },
    }),
  ])

  return { costs, adSpends }
}

module.exports = {
  upsertCosts,
  getCosts,
}

