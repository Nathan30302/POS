const CACHE = 'nexora-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

function isAppShell(request, url) {
  if (request.mode === 'navigate') return true
  const path = url.pathname
  if (path.startsWith('/api/')) return false
  if (path.startsWith('/src/') || path.startsWith('/@') || path.startsWith('/node_modules/')) {
    return true
  }
  if (path.startsWith('/assets/')) return true
  return /\.(?:js|mjs|css|html|map)(?:$|\?)/.test(path)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Network-first for HTML/JS/CSS so theme + Settings updates always land.
  if (isAppShell(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && request.mode === 'navigate') {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    )
    return
  }

  // Cache-first only for static media (theme videos, images, fonts).
  event.respondWith(
    caches.match(request).then((cached) => {
      const networked = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || networked
    }),
  )
})
