import { prisma } from '../src/lib/db.js'
import { generateDemoTransactions } from '../server/lib/demo.js'

const DEMO_USER = { username: 'demo', password: 'demo123' }

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

  let account = await prisma.account.findFirst({ where: { userId: user.id, isDemo: true } })
  if (!account) {
    account = await prisma.account.create({
      data: {
        userId: user.id,
        name: 'Demo account',
        type: 'checking',
        institution: 'MoneyTrack Demo',
        openingBalance: 2500,
        isDemo: true,
      },
    })
  }

  const rows = generateDemoTransactions()
  await prisma.transaction.deleteMany({ where: { userId: user.id } })
  await prisma.transaction.createMany({
    data: rows.map(t => ({
      ...t,
      userId: user.id,
      accountId: account.id,
      source: 'demo',
    })),
  })

  console.log(`Seeded user "${user.username}" (admin: ${user.isAdmin}) with ${rows.length} transactions.`)
  console.log(`Demo account: ${account.name} (${account.id})`)
  console.log(`Login with ${DEMO_USER.username} / ${DEMO_USER.password}`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
