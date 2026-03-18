const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const tenantAccessMiddleware = require('../middlewares/tenantAccessMiddleware')
const {
  getTopChannels,
  getTopProducts,
  getChannelDetail,
  getProductDetail,
} = require('../controllers/analyticsController')

const router = express.Router()

router.use(authMiddleware)
router.use(tenantAccessMiddleware({ source: 'query' }))

router.get('/channels', getTopChannels)
router.get('/products', getTopProducts)
router.get('/channels/:channel', getChannelDetail)
router.get('/products/:sku', getProductDetail)

module.exports = router

