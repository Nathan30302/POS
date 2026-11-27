export function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

export function hostPeerId(roomCode: string) {
  return `nexora-sell-${roomCode.toUpperCase()}`
}

export function phoneScanUrl(roomCode: string, origin = window.location.origin) {
  return `${origin.replace(/\/$/, '')}/phone-scan/${roomCode.toUpperCase()}`
}

export function isLoopbackOrigin(origin = window.location.origin) {
  return /localhost|127\.0\.0\.1/i.test(origin)
}

/** Prefer HTTPS tunnel / Wi‑Fi origin so the phone QR reaches a secure camera context. */
export async function resolveShopOrigin(): Promise<string> {
  const current = window.location.origin
  if (!isLoopbackOrigin(current)) return current

  // Static file updated when a quick tunnel starts (no API restart needed)
  try {
    const file = await fetch('/shop-origin.json', { cache: 'no-store' })
    if (file.ok) {
      const data = (await file.json()) as { preferredOrigin?: string }
      const origin = data.preferredOrigin?.replace(/\/$/, '')
      if (origin?.startsWith('http')) return origin
    }
  } catch {
    // continue
  }

  try {
    const res = await fetch('/api/lan')
    if (!res.ok) return current
    const data = (await res.json()) as {
      preferredOrigin?: string | null
      shopUrls?: string[]
    }
    return data.preferredOrigin || data.shopUrls?.[0] || current
  } catch {
    return current
  }
}

export type ScanAck = {
  type: 'ack'
  code: string
  ok: boolean
  label?: string
  message: string
}

export type ScanPacket =
  | { type: 'barcode'; code: string; at: number; intent?: 'add' | 'remove' }
  | { type: 'hello'; device: string }
  | { type: 'ping' }
  | ScanAck

export type ScanResult = {
  ok: boolean
  label?: string
  message: string
}
