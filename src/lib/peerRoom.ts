export function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

export function hostPeerId(roomCode: string) {
  return `stationery-pos-${roomCode.toUpperCase()}`
}

export function phoneScanUrl(roomCode: string, origin = window.location.origin) {
  return `${origin.replace(/\/$/, '')}/phone-scan/${roomCode.toUpperCase()}`
}

export function isLocalhostOrigin(origin = window.location.origin) {
  return /localhost|127\.0\.0\.1/i.test(origin)
}

export type ScanPacket =
  | { type: 'barcode'; code: string; at: number }
  | { type: 'hello'; device: string }
  | { type: 'ping' }
