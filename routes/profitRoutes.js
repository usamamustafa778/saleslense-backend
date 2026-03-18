const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const tenantAccessMiddleware = require('../middlewares/tenantAccessMiddleware')
const {
  getDashboardSummary,
  getDashboardTrend,
  getProductProfitability,
} = require('../controllers/profitController')

const router = express.Router()

router.use(authMiddleware)
router.use(tenantAccessMiddleware({ source: 'query' }))

router.get('/dashboard/summary', getDashboardSummary)
router.get('/dashboard/trend', getDashboardTrend)
router.get('/products/profitability', getProductProfitability)

module.exports = router

