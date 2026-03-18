const bcrypt = require('bcrypt')
const prisma = require('../utils/prismaClient')
const { generateToken } = require('../utils/jwt')

const SALT_ROUNDS = 10

async function signup({ email, password }) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    const error = new Error('User already exists')
    error.code = 'USER_EXISTS'
    throw error
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'user',
    },
  })

  return user
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const error = new Error('Invalid credentials')
    error.code = 'INVALID_CREDENTIALS'
    throw error
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    const error = new Error('Invalid credentials')
    error.code = 'INVALID_CREDENTIALS'
    throw error
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  })

  return { token, user }
}

module.exports = {
  signup,
  login,
}

