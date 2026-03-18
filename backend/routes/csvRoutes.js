const express = require('express')
const {
  uploadCsv,
  getProducts,
  getOrders,
} = require('../controllers/csvController')

const router = express.Router()

router.post('/upload', uploadCsv)
router.get('/products', getProducts)
router.get('/orders', getOrders)

module.exports = router

