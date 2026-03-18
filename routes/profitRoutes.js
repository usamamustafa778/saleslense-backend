const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const tenantAccessMiddleware = require('../middlewares/tenantAccessMiddleware')
const {
  getDashboardSummary,
  getDashboardTrend,
  getProductProfitability,
} = require('../controllers/profitController')

const router = express.Router()

// Important: this router is mounted at `/api` in `server.js`.
// Therefore `router.use(...)` would run tenant auth middleware for *all* `/api/*` routes
// (including /api/tenants, /api/tenant/switch, etc.). Apply middleware per-route instead.
router.get(
  '/dashboard/summary',
  authMiddleware,
  tenantAccessMiddleware({ source: 'query' }),
  getDashboardSummary,
)
router.get(
  '/dashboard/trend',
  authMiddleware,
  tenantAccessMiddleware({ source: 'query' }),
  getDashboardTrend,
)
router.get(
  '/products/profitability',
  authMiddleware,
  tenantAccessMiddleware({ source: 'query' }),
  getProductProfitability,
)

module.exports = router

