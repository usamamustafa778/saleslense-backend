const express = require('express')
const { upsertCosts, getCosts } = require('../controllers/costController')

const router = express.Router()

router.post('/', upsertCosts)
router.get('/', getCosts)

module.exports = router

