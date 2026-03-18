require('dotenv').config()

const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/authRoutes')
const healthRoutes = require('./routes/healthRoutes')
const csvRoutes = require('./routes/csvRoutes')
const costRoutes = require('./routes/costRoutes')
const profitRoutes = require('./routes/profitRoutes')
const tenantRoutes = require('./routes/tenantRoutes')

const app = express()

app.use(
  cors({
    origin: '*',
    credentials: true,
  }),
)
app.use(express.json())

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/csv', csvRoutes)
app.use('/api/costs', costRoutes)
app.use('/api', profitRoutes)
app.use('/api', tenantRoutes)

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ProfitDesk backend listening on port ${PORT}`)
})

