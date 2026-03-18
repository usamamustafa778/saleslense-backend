const authService = require('../services/authService')
const prisma = require('../utils/prismaClient')

async function signup(req, res) {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await authService.signup({ email, password })
    return res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
    })
  } catch (error) {
    if (error.code === 'USER_EXISTS') {
      return res.status(409).json({ message: 'User already exists' })
    }
    // eslint-disable-next-line no-console
    console.error('Signup error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const { token, user } = await authService.login({ email, password })
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    if (error.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Invalid email or password' })
    }
    // eslint-disable-next-line no-console
    console.error('Login error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

async function me(req, res) {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    })

    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    return res.json({ user })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Me error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

module.exports = {
  signup,
  login,
  me,
}

