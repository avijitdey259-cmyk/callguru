// অটো-আপডেট — ব্যানার/বোতাম নেই, ব্যবহারকারীকে কিছু ট্যাপ করতে হয় না।
// অ্যাপ খুললেই (আর ফোরগ্রাউন্ডে ফিরলেই) নতুন ভার্সন আছে কি না দেখা হয়;
// নতুন ভার্সন থাকলে আপনা-আপনি সেটা চালু হয়। কল/লাইভ/রেকর্ডিং চললে
// সুইচ পিছিয়ে যায় — কল/লাইভ শেষ হলে বা পরের বার খুললে তখন হয়।
// অফলাইনে বা কোনো ধাপ ফেল করলে ক্যাশ করা পুরোনো ভার্সনই চলে, চুপচাপ।
// __APP_VERSION__ বিল্ডের সময় vite.config.ts থেকে বসে (define)।
export const RUNNING_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : 'dev'

// নতুন ভার্সন কি না — খালি/অনুপস্থিত ভার্সন কখনোই "নতুন" নয়।
export function isNewerVersion(running: string, fetched: unknown): boolean {
  if (typeof fetched !== 'string' || !fetched.trim()) return false
  if (typeof running !== 'string' || !running.trim()) return false
  return fetched.trim() !== running.trim()
}

// ব্যস্ত সেশন — এই অবস্থায় রিলোড/সুইচ একদম নয়, পিছিয়ে দিতে হয়।
// কল/লাইভ পেজগুলো Layout-এর বাইরে, তাই রুটই আসল চিহ্ন; স্টোরে কোনো
// গ্লোবাল ইন-কল/লাইভ অবস্থা নেই (CallPage/DatingLivePage-র state স্থানীয়)।
// recording: KYC সেলফি-ভিডিও রেকর্ডিংয়ের ফ্ল্যাগ (pages.tsx KycPage বসায়)।
export function isBusySession(pathname: string, recording = false): boolean {
  if (recording) return true
  return (
    pathname.startsWith('/call/') ||
    pathname.startsWith('/dating-live/') ||
    pathname.startsWith('/dating-go-live')
  )
}

// ব্যবহারকারীর মিডিয়া — অ্যাপে নেটওয়ার্ক থেকে আসা ব্যবহারকারী-মিডিয়ার
// একমাত্র আসল উৎস Firebase Storage (পোস্টের ভিডিও: pages.tsx-এ
// getDownloadURL)। প্রোফাইল/গ্যালারি/পোস্টের ছবি আর KYC সেলফি data URL —
// নেটওয়ার্কে যায় না, localStorage-এই থাকে। লাইভ টিভির স্ট্রিম/লোগো বা
// অন্য থার্ড-পার্টি URL এখানে পড়ে না — সেগুলো কখনো ক্যাশ হয় না।
export function isUserMediaUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'firebasestorage.googleapis.com'
  } catch {
    return false
  }
}

type FetchLike = (
  input: string,
  init?: { cache?: string },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

// সার্ভারের version.json পড়া — cache: 'no-store', ফেল করলে false (অফলাইনে
// অ্যাপ আগের মতোই ক্যাশ থেকে চলবে; কোনো ছোড়াছুড়ি নেই)।
export async function checkVersion(
  fetchImpl: FetchLike,
  running: string,
): Promise<{ newer: boolean; remote: string | null }> {
  try {
    const res = await fetchImpl('/version.json', { cache: 'no-store' })
    if (!res.ok) return { newer: false, remote: null }
    const data = (await res.json()) as { version?: unknown }
    const remote = typeof data?.version === 'string' ? data.version : null
    return { newer: isNewerVersion(running, remote), remote }
  } catch {
    return { newer: false, remote: null }
  }
}

const APPLIED_KEY = 'picall-update-applied'

// একই ভার্সনে এক সেশনে একবারের বেশি রিলোড নয় — ডেপ্লয় মাঝপথে থাকলে
// (version.json নতুন, বান্ডল এখনো পুরোনো) রিলোড-লুপ আটকায়।
function alreadyApplied(version: string): boolean {
  try {
    return sessionStorage.getItem(APPLIED_KEY) === version
  } catch {
    return false
  }
}
function markApplied(version: string): void {
  try {
    sessionStorage.setItem(APPLIED_KEY, version)
  } catch {
    /* ignore */
  }
}

let registration: ServiceWorkerRegistration | null = null
let updatePending = false
let reloadDone = false
let checkInFlight = false

function isBusyNow(): boolean {
  let recording = false
  try {
    recording =
      (window as unknown as { __picallRecording?: boolean }).__picallRecording === true
  } catch {
    recording = false
  }
  return isBusySession(window.location.pathname, recording)
}

// নতুন ভার্সন চালু করা — ব্যস্ত থাকলে শুধু পিছিয়ে দেওয়া হয়, জোর করা হয় না।
async function applyUpdate(remoteVersion: string | null): Promise<void> {
  if (reloadDone) return
  if (isBusyNow()) {
    updatePending = true
    return
  }
  updatePending = false
  reloadDone = true
  if (remoteVersion) markApplied(remoteVersion)
  try {
    const waiting = registration?.waiting
    if (waiting) {
      // নতুন SW অপেক্ষায় থাকলে আগে তাকে সক্রিয় হতে বলা হয়, তারপর রিলোড —
      // SW নিজেও install-এ skipWaiting করে, এটা শুধু নিশ্চিত করা।
      waiting.postMessage({ type: 'SKIP_WAITING' })
      let done = false
      const go = () => {
        if (!done) {
          done = true
          window.location.reload()
        }
      }
      navigator.serviceWorker?.addEventListener('controllerchange', go, { once: true })
      setTimeout(go, 1500)
      return
    }
  } catch {
    /* নিচে সাধারণ রিলোডে পড়বে */
  }
  try {
    window.location.reload()
  } catch {
    /* ignore */
  }
}

// একবারে চেক: SW-কে এখনই আপডেট দেখতে বলা (Chrome-এর ~২৪ ঘণ্টার থ্রটল
// বাইপাস করে) + version.json তুলনা। দুটোর যেকোনো একটা নতুন বললেই সুইচ।
async function checkForUpdate(): Promise<void> {
  if (checkInFlight) return
  checkInFlight = true
  try {
    try {
      await registration?.update()
    } catch {
      /* SW আপডেট চেক ফেল করলেও version.json চেক চলবে */
    }
    if (registration?.waiting && navigator.serviceWorker?.controller) updatePending = true
    const { newer, remote } = await checkVersion(
      (globalThis as unknown as { fetch: FetchLike }).fetch.bind(globalThis),
      RUNNING_VERSION,
    )
    if (newer && remote && !alreadyApplied(remote)) {
      updatePending = true
      await applyUpdate(remote)
    } else if (updatePending) {
      await applyUpdate(remote)
    }
  } finally {
    checkInFlight = false
  }
}

// অ্যাপ চালুর সময় main.tsx থেকে একবার ডাকা হয়।
export function initAppUpdate(): void {
  try {
    if (typeof window === 'undefined') return
    const onLoad = () => {
      if (!('serviceWorker' in navigator)) {
        // SW নেই (প্রিভিউ/ডেমো) — version.json চেক তবুও চলে; নতুন থাকলে
        // সাধারণ রিলোডেই নতুন শেল আসে।
        void checkForUpdate()
        return
      }
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          registration = reg
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing
            if (!worker) return
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                updatePending = true
                void applyUpdate(null)
              }
            })
          })
          if (reg.waiting && navigator.serviceWorker.controller) {
            updatePending = true
            void applyUpdate(null)
          }
          void checkForUpdate()
        })
        .catch(() => {
          // রেজিস্ট্রেশন ফেল করলেও অ্যাপ চলবে — version.json চেক তবুও চলে
          void checkForUpdate()
        })
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    // ফোরগ্রাউন্ডে ফিরলেই আবার চেক — অ্যাপ খোলা থাকলেও নতুন ডেপ্লয় ধরা পড়ে
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void checkForUpdate()
    })
    window.addEventListener('focus', () => {
      void checkForUpdate()
    })
    // রুট বদলালে (কল/লাইভ শেষে ফিরলে) পিছিয়ে থাকা সুইচ আবার চেষ্টা হয়
    window.addEventListener('popstate', () => {
      void checkForUpdate()
    })
  } catch {
    /* আপডেট-চেক কখনো অ্যাপ ভাঙবে না */
  }
}
