const express = require('express')
const authMiddleware = require('../middlewares/authMiddleware')
const { getReports, exportReports } = require('../controllers/reportsController')

const router = express.Router()

router.use(authMiddleware)

router.get('/', getReports)
router.get('/export', exportReports)

module.exports = router

