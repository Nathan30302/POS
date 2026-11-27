#!/usr/bin/env node
/**
 * Switch Prisma datasource provider between sqlite and postgresql.
 * Usage: node scripts/switch-db-provider.mjs postgresql|sqlite
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const schemaPath = path.join(root, 'prisma', 'schema.prisma')
const target = (process.argv[2] || '').toLowerCase()

if (target !== 'sqlite' && target !== 'postgresql') {
  console.error('Usage: node scripts/switch-db-provider.mjs postgresql|sqlite')
  process.exit(1)
}

let schema = fs.readFileSync(schemaPath, 'utf8')
const next = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql)"/,
  `provider = "${target}"`,
)
if (next === schema) {
  console.error('Could not find datasource provider in schema.prisma')
  process.exit(1)
}
fs.writeFileSync(schemaPath, next)
console.log(`Prisma provider → ${target}`)
console.log(
  target === 'postgresql'
    ? 'Set DATABASE_URL=postgresql://nexora:PASSWORD@127.0.0.1:5432/nexora then: npm run db:push'
    : 'Set DATABASE_URL=file:./prisma/dev.db then: npm run db:push',
)
