const express = require('express')
const {
  getDashboardSummary,
  getDashboardTrend,
  getProductProfitability,
} = require('../controllers/profitController')

const router = express.Router()

router.get('/dashboard/summary', getDashboardSummary)
router.get('/dashboard/trend', getDashboardTrend)
router.get('/products/profitability', getProductProfitability)

module.exports = router

