const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const tenantAccessMiddleware = require('../middlewares/tenantAccessMiddleware')
const { getDashboardData } = require('../controllers/dashboardController')

const router = express.Router()

router.get('/', authMiddleware, tenantAccessMiddleware({ source: 'query' }), getDashboardData)

module.exports = router

