/* eslint-disable no-console */
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const adminEmail = 'admin@profitdesk.test'
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existing) {
    console.log('Admin user already exists, skipping seed.')
    return
  }

  const hashedPassword = await bcrypt.hash('admin123', 10)

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Default Tenant',
      baseCurrency: 'USD',
    },
  })

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
    },
  })

  await prisma.userTenantRole.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      role: 'admin',
    },
  })

  const sampleCsv = [
    'order_id,channel,currency,total_amount,order_date,sku,product_name,quantity,unit_price,fee_amount,fee_category,refund_amount,refund_category',
    'ORDER123,amazon,USD,120.50,2024-01-15,SKU-123,Sample Product,2,50.00,10.50,COMMISSION,0,',
  ].join('\n')

  await prisma.rawOrder.create({
    data: {
      tenantId: tenant.id,
      source: 'seed',
      rawCsvRow: sampleCsv,
    },
  })

  console.log('Seeded admin user, tenant, and sample CSV.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

