/**
 * Boot-time environment validation.
 * Local/demo: SQLite + any JWT_SECRET in .env is fine.
 * Production: refuse weak secrets; SQLite demo defaults DATABASE_URL to /data.
 */
const PROD_SQLITE_DEFAULT = 'file:/data/nexora.db'

export type AppEnv = {
  nodeEnv: string
  isProd: boolean
  port: number
  webPort: number
  databaseUrl: string
  jwtSecret: string
  corsOrigins: string[] | null
  shopPublicOrigin: string | null
  dbProvider: 'sqlite' | 'postgresql' | 'unknown'
}

function detectProvider(url: string): AppEnv['dbProvider'] {
  if (!url) return 'unknown'
  if (url.startsWith('file:') || url.includes('.db')) return 'sqlite'
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql'
  }
  return 'unknown'
}

export function loadAppEnv(): AppEnv {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProd = nodeEnv === 'production'
  let databaseUrl = (process.env.DATABASE_URL || '').trim()
  const jwtSecret = process.env.JWT_SECRET || ''
  const corsRaw = (process.env.CORS_ORIGIN || '').trim()
  const corsOrigins = corsRaw
    ? corsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : null
  const shopPublicOrigin =
    (process.env.SHOP_PUBLIC_ORIGIN || '').replace(/\/$/, '') || null

  if (isProd) {
    // Railway/Fly demo: Dockerfile + entrypoint set this; still default if a
    // custom start command bypasses the entrypoint or an empty var overrides ENV.
    if (!databaseUrl) {
      databaseUrl = PROD_SQLITE_DEFAULT
      process.env.DATABASE_URL = databaseUrl
      console.warn(
        `[nexora] DATABASE_URL missing in production — defaulting to ${PROD_SQLITE_DEFAULT} (mount a volume at /data for persistence)`,
      )
    }
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error(
        'JWT_SECRET must be set and at least 32 characters in production',
      )
    }
    if (
      /change-me|dev-secret|secret123|nexora-demo/i.test(jwtSecret)
    ) {
      throw new Error('JWT_SECRET looks like a placeholder — refuse to boot')
    }
    if (!corsOrigins?.length) {
      throw new Error(
        'CORS_ORIGIN is required in production (comma-separated allowlist)',
      )
    }
    if (!(process.env.MOMO_WEBHOOK_SECRET || '').trim()) {
      throw new Error(
        'MOMO_WEBHOOK_SECRET is required in production for payment webhooks',
      )
    }
  } else if (!jwtSecret) {
    console.warn(
      '[nexora] JWT_SECRET not set — using insecure dev default (set JWT_SECRET in .env)',
    )
    process.env.JWT_SECRET =
      'nexora-dev-only-change-me-before-production-use-32+'
  }

  return {
    nodeEnv,
    isProd,
    port: Number(process.env.PORT || 4000),
    webPort: Number(process.env.WEB_PORT || 5173),
    databaseUrl,
    jwtSecret: process.env.JWT_SECRET || jwtSecret,
    corsOrigins,
    shopPublicOrigin,
    dbProvider: detectProvider(databaseUrl),
  }
}
