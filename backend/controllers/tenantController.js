const prisma = require('../utils/prismaClient')

async function listTenants(req, res) {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ message: 'Unauthenticated' })
    }

    const memberships = await prisma.userTenantRole.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { tenantId: 'asc' },
    })

    const tenants = memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      role: m.role,
    }))

    return res.json({ tenants })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('listTenants error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function switchTenant(req, res) {
  try {
    const userId = req.user?.userId
    const { tenantId } = req.body || {}

    if (!userId) {
      return res.status(401).json({ message: 'Unauthenticated' })
    }

    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId is required' })
    }

    const membership = await prisma.userTenantRole.findFirst({
      where: {
        userId,
        tenantId: Number(tenantId),
      },
      include: { tenant: true },
    })

    if (!membership) {
      return res.status(403).json({ message: 'User not assigned to this tenant' })
    }

    return res.json({
      tenant: {
        id: membership.tenant.id,
        name: membership.tenant.name,
        role: membership.role,
      },
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('switchTenant error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = {
  listTenants,
  switchTenant,
}

