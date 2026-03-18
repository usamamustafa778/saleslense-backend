const { PrismaClient } = require('@prisma/client')

// Dev-friendly default so the API boots without extra setup.
// For production, always set DATABASE_URL explicitly.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db'
}

const prisma = new PrismaClient()

module.exports = prisma

