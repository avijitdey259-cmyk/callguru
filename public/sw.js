// PiCall service worker — offline-first app shell, network-first API.
// + Web Push: ইনকামিং কলের নোটিফিকেশন (লক স্ক্রিনে ধরো/কাটো বোতাম সহ)।
// সৎ সীমা: ওয়েব PWA লক স্ক্রিন নিজে থেকে জাগাতে পারে না — নোটিফিকেশনে
// ট্যাপ করলে অ্যাপ খুলে কলে ঢোকে (notificationclick → /call/<code>)।
const CACHE = 'picall-shell-v3'
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ---------- Web Push: ইনকামিং কল ----------
// সার্ভার (server/index.js) এই আকৃতির পেলোড পাঠায়:
//   { title, body, tag, data: { code, fromId, fromName, url: '/call/<code>' },
//     actions: [{ action: 'answer', title: '📞 Answer' }, { action: 'decline', title: '❌ Decline' }] }
self.addEventListener('push', (event) => {
  let payload = null
  try { payload = event.data ? event.data.json() : null } catch { payload = null }
  if (!payload || !payload.data || typeof payload.data.url !== 'string') return
  const title = typeof payload.title === 'string' ? payload.title : '📞 Incoming PiCall'
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'Tap to answer — PiCall video call',
    tag: typeof payload.tag === 'string' ? payload.tag : 'picall-call',
    data: payload.data,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    actions: Array.isArray(payload.actions) ? payload.actions : [],
    requireInteraction: true,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const code = typeof data.code === 'string' ? data.code : ''
  // Decline: শুধু নোটিফিকেশন বন্ধ + কলারকে জানানো (বেস্ট এফর্ট — সার্ভার না পেলে শুধু বন্ধ)
  // SW ফায়ারবেস হোস্টিং থেকে চলে, API রেলওয়েতে — তাই পুরো URL (api.ts-এর ডিফল্টের মতোই)
  if (event.action === 'decline') {
    if (code) {
      event.waitUntil(
        fetch('https://callguru-production.up.railway.app/api/call-invite/decline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }).catch(() => {})
      )
    }
    return
  }
  // Answer (বা নোটিফিকেশনের গায়ে ট্যাপ): অ্যাপ খুলে সরাসরি কলে ঢোকা
  const url = typeof data.url === 'string' && data.url.startsWith('/call/') ? data.url : '/feed'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    })
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // API calls: network first, fall back to cache, never cache failures.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // App shell + static assets: cache first, update cache in the background.
  if (request.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
  }
})
