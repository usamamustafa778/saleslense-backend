const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const tenantAccessMiddleware = require('../middlewares/tenantAccessMiddleware')
const {
  uploadCsv,
  getProducts,
  getOrders,
} = require('../controllers/csvController')

const router = express.Router()

router.use(authMiddleware)

router.post('/upload', tenantAccessMiddleware({ source: 'body' }), uploadCsv)
router.get('/products', tenantAccessMiddleware({ source: 'query' }), getProducts)
router.get('/orders', tenantAccessMiddleware({ source: 'query' }), getOrders)

module.exports = router

