require('dotenv').config()

const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/authRoutes')
const healthRoutes = require('./routes/healthRoutes')
const csvRoutes = require('./routes/csvRoutes')
const costRoutes = require('./routes/costRoutes')
const dashboardRoutes = require('./routes/dashboardRoutes')
const analyticsRoutes = require('./routes/analyticsRoutes')
const profitRoutes = require('./routes/profitRoutes')
const tenantRoutes = require('./routes/tenantRoutes')
const reportsRoutes = require('./routes/reportsRoutes')

const app = express()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: false,
  }),
)
app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/csv', csvRoutes)
app.use('/api/costs', costRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api', profitRoutes)
app.use('/api', tenantRoutes)
app.use('/api/reports', reportsRoutes)

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ProfitDesk backend listening on port ${PORT}`)
})

