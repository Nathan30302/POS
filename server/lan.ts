import os from 'node:os'

/** Prefer private LAN IPv4 addresses phones can reach on the same Wi‑Fi. */
export function lanIpv4Addresses(): string[] {
  const preferred: string[] = []
  const other: string[] = []

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const net of entries ?? []) {
      const family = String(net.family)
      if (family !== 'IPv4' && family !== '4') continue
      if (net.internal) continue
      const address = net.address
      if (
        address.startsWith('192.168.') ||
        address.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
      ) {
        preferred.push(address)
      } else {
        other.push(address)
      }
    }
  }

  return [...preferred, ...other]
}

export function shopUrlsForLan(
  webPort = Number(process.env.WEB_PORT || 5173),
  protocol = process.env.WEB_PROTOCOL || 'https',
) {
  // HTTPS by default so phone browsers allow live camera scanning
  const scheme = protocol === 'http' ? 'http' : 'https'
  return lanIpv4Addresses().map((ip) => `${scheme}://${ip}:${webPort}`)
}
