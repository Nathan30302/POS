/**
 * Stress-create N lean businesses for platform directory scale checks.
 * Usage: node scripts/stress-businesses.mjs [count=100]
 * Cleanup: CLEANUP=1 node scripts/stress-businesses.mjs
 *
 * Does not create owner users (fast). Pair with:
 *   GET /api/platform/businesses?page=1&pageSize=50
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const count = Math.min(
  5000,
  Math.max(1, Number(process.argv[2] || process.env.COUNT || 100)),
)
const prefix = process.env.PREFIX || `StressBiz-${Date.now()}`

async function cleanup() {
  const deleted = await prisma.business.deleteMany({
    where: { name: { startsWith: 'StressBiz-' } },
  })
  console.log(`Deleted ${deleted.count} stress businesses`)
}

async function main() {
  if (process.env.CLEANUP === '1') {
    await cleanup()
    return
  }

  console.log(`Creating ${count} businesses (prefix ${prefix})…`)
  const started = Date.now()
  const batch = 50
  let made = 0
  while (made < count) {
    const n = Math.min(batch, count - made)
    await prisma.$transaction(
      Array.from({ length: n }, (_, i) => {
        const idx = made + i
        const idSlug = `${prefix}-${idx}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        return prisma.business.create({
          data: {
            name: `${prefix}-${String(idx).padStart(4, '0')}`,
            slug: idSlug.slice(0, 60),
            industry: 'retail',
            status: idx % 5 === 0 ? 'PENDING_APPROVAL' : 'TRIAL',
            plan: idx % 2 === 0 ? 'starter' : 'growth',
            modulesJson: '{}',
            settingsJson: '{}',
            branches: {
              create: { name: 'Main Branch', isMain: true },
            },
          },
        })
      }),
    )
    made += n
    process.stdout.write(`  ${made}/${count}\r`)
  }
  console.log(
    `\nDone ${count} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  )
  console.log('Cleanup later: CLEANUP=1 node scripts/stress-businesses.mjs')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
