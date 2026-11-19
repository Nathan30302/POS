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

/** Prefer a Wi‑Fi LAN origin so the phone QR is reachable on the same network. */
export async function resolveShopOrigin(): Promise<string> {
  const current = window.location.origin
  if (!isLoopbackOrigin(current)) return current

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
  | { type: 'barcode'; code: string; at: number }
  | { type: 'hello'; device: string }
  | { type: 'ping' }
  | ScanAck

export type ScanResult = {
  ok: boolean
  label?: string
  message: string
}
