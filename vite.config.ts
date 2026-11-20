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
const proxy = {
  '/api': {
    target: `http://127.0.0.1:${apiPort}`,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    https,
    proxy,
  },
  preview: {
    port: 5173,
    host: true,
    https,
    proxy,
  },
})
