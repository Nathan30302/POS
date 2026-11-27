import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type PluginOption, type ServerOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

/**
 * Default: plain HTTP on localhost (no “Not private” wall).
 * Camera still works on http://localhost (browsers treat it as a secure context).
 *
 * Optional phone LAN HTTPS: NEXORA_HTTPS=1 npm run dev
 * Prefer mkcert certs from ./scripts/setup-lan-https.sh — see PHONE-SETUP.md.
 */
const wantHttps = process.env.NEXORA_HTTPS === '1'
const certFile = path.resolve(import.meta.dirname, 'certs/dev-cert.pem')
const keyFile = path.resolve(import.meta.dirname, 'certs/dev-key.pem')
const hasMkcert = fs.existsSync(certFile) && fs.existsSync(keyFile)

const plugins: PluginOption[] = [react(), tailwindcss()]
let https: ServerOptions['https']

if (wantHttps) {
  if (hasMkcert) {
    https = {
      cert: fs.readFileSync(certFile),
      key: fs.readFileSync(keyFile),
    }
  } else {
    plugins.push(basicSsl())
  }
}

const apiPort = process.env.API_PORT || process.env.PORT || '4000'

/** Keep browser Host/Origin usable for cookie CSRF behind Cloudflare tunnels. */
const apiProxy = {
  target: `http://127.0.0.1:${apiPort}`,
  // Keep the public Host (e.g. *.trycloudflare.com) so CSRF can match Origin
  changeOrigin: false,
  configure(proxy: { on: (event: 'proxyReq', listener: (...args: any[]) => void) => void }) {
    proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void }, req: { headers: Record<string, unknown> }) => {
      const host = String(req.headers.host || '')
      if (host) proxyReq.setHeader('X-Forwarded-Host', host)
      const proto = String(req.headers['x-forwarded-proto'] || 'https')
      proxyReq.setHeader('X-Forwarded-Proto', proto)
    })
  },
}

const proxy = {
  '/api': apiProxy,
  '/uploads': apiProxy,
}

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/jspdf')) return 'vendor-jspdf'
          if (id.includes('node_modules/@zxing')) return 'vendor-zxing'
          if (id.includes('node_modules/peerjs')) return 'vendor-peer'
          if (id.includes('node_modules/qrcode')) return 'vendor-qrcode'
          if (id.includes('node_modules/jsbarcode')) return 'vendor-jsbarcode'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    // Phones hit LAN IPs / Cloudflare hostnames — don't 403 them
    allowedHosts: true,
    https,
    proxy,
  },
  preview: {
    port: 5173,
    host: true,
    allowedHosts: true,
    https,
    proxy,
  },
})
