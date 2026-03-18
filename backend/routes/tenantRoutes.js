const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const { listTenants, switchTenant } = require('../controllers/tenantController')

const router = express.Router()

router.use(authMiddleware)

router.get('/tenants', listTenants)
router.post('/tenant/switch', switchTenant)

module.exports = router

