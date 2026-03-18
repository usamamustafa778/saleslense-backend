const bcrypt = require('bcrypt')
const prisma = require('../utils/prismaClient')

async function main() {
  const adminEmail = 'admin@test.com'
  const adminPassword = 'admin123'
  const userEmail = 'user@test.com'
  const userPassword = 'user123'
  const tenantName = 'Test Tenant'
  const otherTenantName = 'Other Tenant'

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  const admin =
    existingAdmin ||
    (await prisma.user.create({
      data: {
        email: adminEmail,
        password: await bcrypt.hash(adminPassword, 10),
        role: 'admin',
      },
    }))

  const existingUser = await prisma.user.findUnique({ where: { email: userEmail } })
  const user =
    existingUser ||
    (await prisma.user.create({
      data: {
        email: userEmail,
        password: await bcrypt.hash(userPassword, 10),
        role: 'user',
      },
    }))

  const tenant =
    (await prisma.tenant.findFirst({ where: { name: tenantName } })) ||
    (await prisma.tenant.create({
      data: {
        name: tenantName,
      },
    }))

  const otherTenant =
    (await prisma.tenant.findFirst({ where: { name: otherTenantName } })) ||
    (await prisma.tenant.create({
      data: {
        name: otherTenantName,
      },
    }))

  await prisma.userTenantRole.upsert({
    where: {
      userId_tenantId: {
        userId: admin.id,
        tenantId: tenant.id,
      },
    },
    update: {
      role: 'admin',
    },
    create: {
      userId: admin.id,
      tenantId: tenant.id,
      role: 'admin',
    },
  })

  await prisma.userTenantRole.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
    update: {
      role: 'user',
    },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: 'user',
    },
  })

  // eslint-disable-next-line no-console
  console.log('Seed complete:', {
    admin: { id: admin.id, email: admin.email, role: admin.role },
    user: { id: user.id, email: user.email, role: user.role },
    tenant: { id: tenant.id, name: tenant.name },
    otherTenant: { id: otherTenant.id, name: otherTenant.name },
  })
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

