/**
 * Boot-time environment validation / Railway-friendly defaults.
 * Local/demo: SQLite + any JWT_SECRET in .env is fine.
 * Production: prefer explicit secrets; if unset, auto-provision so the
 * process can listen (demo / Railway) instead of 502 before bind.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const PROD_SQLITE_DEFAULT = 'file:/data/nexora.db'
const DATA_DIR = '/data'
const JWT_SECRET_FILE = path.join(DATA_DIR, '.jwt_secret')
const MOMO_SECRET_FILE = path.join(DATA_DIR, '.momo_webhook_secret')

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

function isWeakSecret(value: string): boolean {
  return (
    !value ||
    value.length < 32 ||
    /change-me|dev-secret|secret123|nexora-demo/i.test(value)
  )
}

/** Ensure /data exists when a volume (or ephemeral container FS) is writable. */
function ensureDataDir(): boolean {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    return true
  } catch {
    return false
  }
}

function readPersistedSecret(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const value = fs.readFileSync(filePath, 'utf8').trim()
    return value.length >= 32 ? value : null
  } catch {
    return null
  }
}

function writePersistedSecret(filePath: string, value: string): boolean {
  if (!ensureDataDir()) return false
  try {
    fs.writeFileSync(filePath, value, { encoding: 'utf8', mode: 0o600 })
    return true
  } catch {
    return false
  }
}

/**
 * Resolve JWT / webhook secrets: env → /data file → generate (persist if possible).
 */
function resolveOrProvisionSecret(
  envKey: string,
  filePath: string,
  label: string,
): string {
  const fromEnv = (process.env[envKey] || '').trim()
  if (!isWeakSecret(fromEnv)) {
    return fromEnv
  }
  if (fromEnv) {
    console.warn(
      `[nexora] ${envKey} is missing, short, or a placeholder — auto-provisioning for boot`,
    )
  }

  const fromFile = readPersistedSecret(filePath)
  if (fromFile) {
    process.env[envKey] = fromFile
    console.warn(
      `[nexora] ${label} loaded from ${filePath} (set ${envKey} in the host for real production)`,
    )
    return fromFile
  }

  const generated = crypto.randomBytes(48).toString('base64url')
  process.env[envKey] = generated
  const persisted = writePersistedSecret(filePath, generated)
  if (persisted) {
    console.warn(
      `[nexora] ${label} auto-generated and saved to ${filePath} — sessions/webhooks stay stable across restarts while the volume persists. Set ${envKey} explicitly for real production.`,
    )
  } else {
    console.warn(
      `[nexora] ${label} auto-generated in-memory only (could not write ${filePath}) — value resets on restart; mount a volume at /data or set ${envKey}.`,
    )
  }
  return generated
}

/** Prefer Railway public URL / domain when CORS / shop origin unset. */
function railwayPublicOrigin(): string | null {
  const domain = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim()
  if (domain) {
    return domain.startsWith('http') ? domain.replace(/\/$/, '') : `https://${domain}`
  }
  for (const key of [
    'RAILWAY_STATIC_URL',
    'RAILWAY_SERVICE_NEXORA_URL',
    'RAILWAY_SERVICE_URL',
  ]) {
    const raw = (process.env[key] || '').trim().replace(/\/$/, '')
    if (raw) return raw.startsWith('http') ? raw : `https://${raw}`
  }
  // Any RAILWAY_SERVICE_*_URL (service name varies)
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^RAILWAY_SERVICE_.+_URL$/i.test(key)) continue
    const raw = (value || '').trim().replace(/\/$/, '')
    if (raw) return raw.startsWith('http') ? raw : `https://${raw}`
  }
  return null
}

export function loadAppEnv(): AppEnv {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProd = nodeEnv === 'production'
  let databaseUrl = (process.env.DATABASE_URL || '').trim()
  let corsRaw = (process.env.CORS_ORIGIN || '').trim()
  let shopPublicOrigin =
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

    resolveOrProvisionSecret('JWT_SECRET', JWT_SECRET_FILE, 'JWT_SECRET')
    resolveOrProvisionSecret(
      'MOMO_WEBHOOK_SECRET',
      MOMO_SECRET_FILE,
      'MOMO_WEBHOOK_SECRET',
    )

    const publicOrigin = railwayPublicOrigin()
    if (!corsRaw) {
      if (publicOrigin) {
        corsRaw = publicOrigin
        process.env.CORS_ORIGIN = corsRaw
        console.warn(
          `[nexora] CORS_ORIGIN unset — deriving from Railway public origin: ${corsRaw}`,
        )
      } else {
        console.warn(
          '[nexora] CORS_ORIGIN unset and no Railway public domain detected — reflecting request Origin (set CORS_ORIGIN for locked production)',
        )
      }
    }
    if (!shopPublicOrigin && publicOrigin) {
      shopPublicOrigin = publicOrigin
      process.env.SHOP_PUBLIC_ORIGIN = publicOrigin
      console.warn(
        `[nexora] SHOP_PUBLIC_ORIGIN unset — deriving from Railway: ${publicOrigin}`,
      )
    }

    // SERVE_SPA: Docker/entrypoint already default to 1; ensure for non-Docker prod.
    if (process.env.SERVE_SPA === undefined || process.env.SERVE_SPA === '') {
      process.env.SERVE_SPA = '1'
    }
  } else if (isWeakSecret((process.env.JWT_SECRET || '').trim())) {
    console.warn(
      '[nexora] JWT_SECRET not set — using insecure dev default (set JWT_SECRET in .env)',
    )
    process.env.JWT_SECRET =
      'nexora-dev-only-change-me-before-production-use-32+'
  }

  const corsOrigins = corsRaw
    ? corsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : null

  return {
    nodeEnv,
    isProd,
    port: Number(process.env.PORT) || 4000,
    webPort: Number(process.env.WEB_PORT) || 5173,
    databaseUrl,
    jwtSecret: process.env.JWT_SECRET || '',
    corsOrigins,
    shopPublicOrigin,
    dbProvider: detectProvider(databaseUrl),
  }
}
