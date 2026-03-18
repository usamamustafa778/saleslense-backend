const prisma = require('../utils/prismaClient')

function parseTenantId(raw) {
  if (raw == null || raw === '') return null
  const parsed = Number(raw)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Ensures authenticated user belongs to requested tenant.
 * - Requires authMiddleware to have already set req.user.userId
 * - Reads tenantId from query/body (configurable)
 * - Injects trusted tenantId as req.tenantId
 */
function tenantAccessMiddleware(options = {}) {
  const { source = 'query' } = options

  return async function tenantAccess(req, res, next) {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return res.status(401).json({ message: 'Unauthenticated' })
      }

      const rawTenantId =
        source === 'body'
          ? req.body?.tenantId
          : source === 'either'
            ? req.query?.tenantId ?? req.body?.tenantId
            : req.query?.tenantId

      const tenantId = parseTenantId(rawTenantId)
      if (!tenantId) {
        if (req.user?.role === 'admin') {
          const membership = await prisma.userTenantRole.findFirst({
            where: { userId: Number(userId) },
            orderBy: { tenantId: 'asc' },
            select: { tenantId: true },
          })

          if (membership?.tenantId) {
            req.tenantId = membership.tenantId
            return next()
          }
        }

        return res.status(400).json({ message: 'tenantId is required' })
      }

      const membership = await prisma.userTenantRole.findFirst({
        where: {
          userId: Number(userId),
          tenantId: Number(tenantId),
        },
        select: { id: true },
      })

      if (!membership) {
        return res.status(403).json({ message: 'Forbidden' })
      }

      req.tenantId = Number(tenantId)
      return next()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('tenantAccessMiddleware error:', error)
      return res.status(500).json({ message: 'Internal server error' })
    }
  }
}

module.exports = tenantAccessMiddleware

