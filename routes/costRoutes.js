const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const tenantAccessMiddleware = require('../middlewares/tenantAccessMiddleware')
const { upsertCosts, getCosts } = require('../controllers/costController')

const router = express.Router()

router.use(authMiddleware)

router.post('/', tenantAccessMiddleware({ source: 'body' }), upsertCosts)
router.get('/', tenantAccessMiddleware({ source: 'query' }), getCosts)

module.exports = router

