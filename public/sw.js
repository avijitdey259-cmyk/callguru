// PiCall service worker — অ্যাপ শেল সবসময় টাটকা (network-first),
// ব্যবহারকারীর মিডিয়া ক্যাশ থেকে (cache-first), API network-first।
// + Web Push: ইনকামিং কলের নোটিফিকেশন (লক স্ক্রিনে ধরো/কাটো বোতাম সহ)।
// সৎ সীমা: ওয়েব PWA লক স্ক্রিন নিজে থেকে জাগাতে পারে না — নোটিফিকেশনে
// ট্যাপ করলে অ্যাপ খুলে কলে ঢোকে (notificationclick → /call/<code>)।
//
// ক্যাশের ভাগাভাগি (দুটো আলাদা ক্যাশ, আলাদা নিয়ম):
//   picall-shell-v4 — অ্যাপের নিজের জিনিস (/, /index.html, JS/CSS বান্ডল,
//     ম্যানিফেস্ট, আইকন)। network-first: খুললেই নতুন ভার্সন/ডেটা আসে;
//     নেট না থাকলে ক্যাশ থেকে চলে। ভার্সন বদলালে নাম বদলায় (v4) আর
//     activate-এ পুরোনো শেল-ক্যাশ মুছে যায়।
//   picall-media-v1 — ব্যবহারকারীর মিডিয়া (Firebase Storage-এর ছবি/
//     ভিডিও — পোস্টের ভিডিও getDownloadURL থেকে আসে)। cache-first:
//     একবার লোড হলে পরে ক্যাশ থেকেই দেখায়। শেল-ক্যাশ বদলালেও এই
//     ক্যাশ কখনো মোছা হয় না। activate শুধু picall-shell-* মোছে।
// version.json কখনো ক্যাশ হয় না (network-only, no-store) — নইলে
// version-চেকটাই পুরোনো উত্তর দিত।
const CACHE = 'picall-shell-v4'
const MEDIA_CACHE = 'picall-media-v1'
const MEDIA_HOST = 'firebasestorage.googleapis.com'
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
      Promise.all(
        keys
          // শুধু পুরোনো শেল-ক্যাশ মোছে — মিডিয়া-ক্যাশ (আর অন্য ক্যাশ) অটুট থাকে
          .filter((k) => k !== CACHE && k !== MEDIA_CACHE && k.startsWith('picall-shell-'))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// অটো-আপডেট: নতুন SW অপেক্ষায় থাকলে অ্যাপ (appUpdate.ts) তাকে
// SKIP_WAITING পাঠায় — তখনই সক্রিয় হয়ে নতুন শেল চালু হয়।
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
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

  // version.json: শুধু নেটওয়ার্ক, কখনো ক্যাশ নয়, ক্যাশ থেকে দেওয়াও নয়।
  // নেট না থাকলে চাওয়াটা ফেল করে — অ্যাপ (appUpdate.ts) সেটা ধরে চুপচাপ
  // ক্যাশ করা ভার্সনেই চলতে থাকে।
  if (url.origin === self.location.origin && url.pathname === '/version.json') {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })))
    return
  }

  // API calls: network first, fall back to cache, never cache failures.
  // (অথেনটিকেটেড API/Firestore ট্রাফিক কখনো SW-ক্যাশে রাখা হয় না।)
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

  // ব্যবহারকারীর মিডিয়া (Firebase Storage): cache-first — একবার লোড হলে
  // পরে ক্যাশ থেকেই দেখায়, পেছনে নেটওয়ার্কে টাটকা করে রাখে। Range চাওয়া
  // (ভিডিও সিক) ক্যাশে রাখা হয় না — সরাসরি নেটওয়ার্কে যায়।
  if (url.hostname === MEDIA_HOST) {
    if (request.headers.has('range')) return
    event.respondWith(
      caches.open(MEDIA_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone())
              return res
            })
            .catch(() => cached)
          return cached || network
        })
      )
    )
    return
  }

  // অ্যাপ শেল + নিজের অ্যাসেট: network-first, নেট না থাকলে ক্যাশ।
  // খুললেই নতুন ভার্সন/ডেটা আসে; অফলাইনে ক্যাশ করা শেলই চলে।
  if (request.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: request.mode === 'navigate' })
        )
    )
    return
  }

  // বাকি সব ক্রস-অরিজিন (লাইভ টিভির স্ট্রিম/লোগো ইত্যাদি): SW ছোঁয় না —
  // ব্রাউজার যেমন চায় তেমনই লোড করে, কিছু ক্যাশ হয় না।
})
