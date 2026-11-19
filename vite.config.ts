import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

const certFile = path.resolve(import.meta.dirname, 'certs/dev-cert.pem')
const keyFile = path.resolve(import.meta.dirname, 'certs/dev-key.pem')
const hasMkcert = fs.existsSync(certFile) && fs.existsSync(keyFile)

const plugins: PluginOption[] = [react(), tailwindcss()]
// Prefer trusted mkcert certs (PHONE-SETUP.md); else Vite basic SSL for quick HTTPS
if (!hasMkcert) plugins.push(basicSsl())

const https = hasMkcert
  ? {
      cert: fs.readFileSync(certFile),
      key: fs.readFileSync(keyFile),
    }
  : undefined

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
    // HTTPS so phone cameras can stay live (secure context)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: true,
    https,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
})
