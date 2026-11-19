import { prisma } from '../src/lib/db.js'

const DEMO_USER = { username: 'demo', password: 'demo123' }

const VENDORS = [
  ['DOORDASH*SUSHI PALACE', 'Dining Out', true, 22, 65],
  ['UBER EATS LATE NIGHT', 'Dining Out', true, 18, 48],
  ['STARBUCKS #4821', 'Dining Out', true, 5, 14],
  ['NETFLIX.COM MONTHLY', 'Subscriptions', true, 15.99, 15.99],
  ['SPOTIFY PREMIUM', 'Subscriptions', true, 10.99, 10.99],
  ['DISNEY+ BUNDLE', 'Subscriptions', true, 13.99, 13.99],
  ['WHOLE FOODS MARKET', 'Groceries', false, 60, 180],
  ['KROGER SUPERMARKET', 'Groceries', false, 40, 120],
  ['SHELL GAS STATION', 'Transport', false, 35, 70],
  ['UBER*TRIP', 'Transport', false, 9, 32],
  ['ELECTRIC UTILITY BILL', 'Utilities', false, 70, 140],
  ['COMCAST INTERNET', 'Utilities', false, 79.99, 79.99],
  ['ATM FEE', 'Fees', true, 3, 5],
  ['LATE PAYMENT CHARGE', 'Fees', true, 25, 35],
]

function randomTransactions(days = 90) {
  const out = []
  const today = new Date()
  for (let d = days - 1; d >= 0; d--) {
    if (Math.random() > 0.45) continue
    const [description, category, isWaste, min, max] = VENDORS[Math.floor(Math.random() * VENDORS.length)]
    const date = new Date(today)
    date.setDate(today.getDate() - d)
    out.push({
      date,
      description,
      amount: Number((min + Math.random() * (max - min)).toFixed(2)),
      category,
      isWaste,
    })
  }
  return out
}

async function main() {
  const count = await prisma.user.count()
  const existing = await prisma.user.findUnique({ where: { username: DEMO_USER.username } })

  const user = existing ?? await prisma.user.create({
    data: {
      username: DEMO_USER.username,
      password: DEMO_USER.password,
      isAdmin: count === 0,
    },
  })

  const rows = randomTransactions()
  await prisma.transaction.deleteMany({ where: { userId: user.id } })
  await prisma.transaction.createMany({ data: rows.map(r => ({ ...r, userId: user.id })) })

  console.log(`Seeded user "${user.username}" (admin: ${user.isAdmin}) with ${rows.length} transactions.`)
  console.log(`Login with ${DEMO_USER.username} / ${DEMO_USER.password}`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
