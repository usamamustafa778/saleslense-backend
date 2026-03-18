const { PrismaClient } = require('@prisma/client')

// Dev-friendly default so the API boots without extra setup.
// For production, always set DATABASE_URL explicitly.
function normalizeMongoUrl(url, fallbackDbName) {
  if (!url) return url

  // If a URL looks like: mongodb+srv://...mongodb.net/?appName=Cluster0
  // then the database name part is empty. Prisma/Mongo requires a DB name.
  // We'll inject a default DB before the `?`.
  const match = url.match(/^(mongodb(?:\+srv)?):\/\/(.*?mongodb\.net)\/\?(.*)$/)
  if (match) {
    const protocol = match[1]
    const host = match[2]
    const query = match[3]
    return `${protocol}://${host}/${fallbackDbName}?${query}`
  }

  // If URL ends with ...mongodb.net/ (no db, no query)
  const match2 = url.match(/^(mongodb(?:\+srv)?):\/\/(.*?mongodb\.net)\/$/)
  if (match2) {
    const protocol = match2[1]
    const host = match2[2]
    return `${protocol}://${host}/${fallbackDbName}`
  }

  return url
}

const DEFAULT_DB_NAME = 'saleslense'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `mongodb://127.0.0.1:27017/${DEFAULT_DB_NAME}`
} else {
  process.env.DATABASE_URL = normalizeMongoUrl(process.env.DATABASE_URL, DEFAULT_DB_NAME)
}

const prisma = new PrismaClient()

// The backend codebase expects these Prisma models to have numeric `id` fields.
// When switching to MongoDB, Prisma can't auto-increment Ints, so we generate
// them using `Sequence` documents instead.
const SEQUENCE_KEY_BY_MODEL = {
  user: 'User',
  tenant: 'Tenant',
  userTenantRole: 'UserTenantRole',
  product: 'Product',
  order: 'Order',
  orderItem: 'OrderItem',
  fee: 'Fee',
  refund: 'Refund',
  costRecord: 'CostRecord',
  adSpendRecord: 'AdSpendRecord',
  rawOrder: 'RawOrder',
  rawProduct: 'RawProduct',
}

async function getNextIntId(sequenceKey) {
  const seq = await prisma.sequence.upsert({
    where: { key: sequenceKey },
    create: { key: sequenceKey, value: 1 },
    update: { value: { increment: 1 } },
  })

  return seq.value
}

const wrappedModelsCache = new Map()

function wrapModel(modelClient, sequenceKey) {
  return new Proxy(modelClient, {
    get(target, prop, receiver) {
      if (prop === 'create') {
        const original = target.create.bind(target)
        return async (args) => {
          if (args?.data && args.data.id == null) {
            // Keep `id` numeric to avoid breaking existing auth/tenant logic.
            args.data.id = await getNextIntId(sequenceKey)
          }
          return original(args)
        }
      }

      if (prop === 'upsert') {
        const original = target.upsert.bind(target)
        return async (args) => {
          if (args?.create && args.create.id == null) {
            args.create.id = await getNextIntId(sequenceKey)
          }
          return original(args)
        }
      }

      if (prop === 'createMany') {
        const original = target.createMany.bind(target)
        return async (args) => {
          if (Array.isArray(args?.data)) {
            for (const row of args.data) {
              if (row && row.id == null) {
                row.id = await getNextIntId(sequenceKey)
              }
            }
          }
          return original(args)
        }
      }

      return Reflect.get(target, prop, receiver)
    },
  })
}

const prismaProxy = new Proxy(prisma, {
  get(target, prop, receiver) {
    if (prop in SEQUENCE_KEY_BY_MODEL) {
      if (wrappedModelsCache.has(prop)) return wrappedModelsCache.get(prop)
      const sequenceKey = SEQUENCE_KEY_BY_MODEL[prop]
      const wrapped = wrapModel(target[prop], sequenceKey)
      wrappedModelsCache.set(prop, wrapped)
      return wrapped
    }
    return Reflect.get(target, prop, receiver)
  },
})

module.exports = prismaProxy

