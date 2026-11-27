/**
 * Lightweight structured logging — no secrets, request-scoped via AsyncLocalStorage optional.
 * Keep dependencies zero; ship to stderr as JSON lines in production.
 */

export type LogFields = Record<string, unknown>

function serialize(level: string, msg: string, fields?: LogFields) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  }
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(line)
  }
  const extra = fields && Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : ''
  return `[${level}] ${msg}${extra}`
}

export const log = {
  info(msg: string, fields?: LogFields) {
    console.info(serialize('info', msg, fields))
  },
  warn(msg: string, fields?: LogFields) {
    console.warn(serialize('warn', msg, fields))
  },
  error(msg: string, fields?: LogFields) {
    console.error(serialize('error', msg, fields))
  },
}

/** Strip common secret-shaped keys before logging objects. */
export function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (/password|secret|token|authorization|api[_-]?key/i.test(k)) {
      out[k] = '[redacted]'
    } else {
      out[k] = v
    }
  }
  return out
}
