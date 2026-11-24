// Analytics — Meta Pixel + Google Analytics 4 + Microsoft Clarity, ID-driven.
// ONE place holds the three IDs: this module. Feeds (per-field, env wins):
//   1. Build-time env: VITE_PIXEL_ID / VITE_GA4_ID / VITE_CLARITY_ID
//      (GitHub Actions secrets — same pattern as VITE_FIREBASE_*; the workflow
//      passes them at build time. Works for logged-out visitors and every
//      signup path, including OTP on a fresh device.)
//   2. Admin → ⚙️ Settings fields, stored in adminSettings.analytics and synced
//      to config/public for every signed-in user (same pattern as payments).
//      Works once the user is signed in; a fresh-device OTP signup cannot fetch
//      config/public (no Firebase session), so its CompleteRegistration only
//      fires when the IDs are also set via build env.
// Empty / missing ID = that tracker simply never loads and never errors —
// no placeholder IDs, no fake/demo IDs, no console errors, no failed network
// requests. Real IDs are supplied by the owner later; this is wiring only.
// Pixel/GA4/Clarity IDs are public identifiers by design (they appear in page
// source once set) — never put secrets here.
export type AnalyticsIds = { pixelId: string; ga4Id: string; clarityId: string }

export type SignupMethod = 'google' | 'email_link' | 'email_otp' | 'sms_otp' | 'password'

export const EMPTY_ANALYTICS_IDS: AnalyticsIds = { pixelId: '', ga4Id: '', clarityId: '' }

// IDs go into script URLs — only the characters a real Pixel/GA4/Clarity ID
// can contain survive (letters, digits, '-' and '_'), max 64 chars.
export function sanitizeAnalyticsId(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.trim().slice(0, 64).replace(/[^A-Za-z0-9_-]/g, '')
}

function cleanIds(ids: Partial<AnalyticsIds> | null | undefined): AnalyticsIds {
  return {
    pixelId: sanitizeAnalyticsId(ids?.pixelId),
    ga4Id: sanitizeAnalyticsId(ids?.ga4Id),
    clarityId: sanitizeAnalyticsId(ids?.clarityId),
  }
}

// Build-time env — same import.meta.env access pattern as src/firebase.ts.
export function envAnalyticsIds(): AnalyticsIds {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}
  return cleanIds({ pixelId: env.VITE_PIXEL_ID, ga4Id: env.VITE_GA4_ID, clarityId: env.VITE_CLARITY_ID })
}

// Resolve the effective IDs: env wins per field, admin settings fill the gaps.
export function resolveAnalyticsIds(envIds: Partial<AnalyticsIds> | null | undefined, adminIds: Partial<AnalyticsIds> | null | undefined): AnalyticsIds {
  const env = cleanIds(envIds)
  const admin = cleanIds(adminIds)
  return {
    pixelId: env.pixelId || admin.pixelId,
    ga4Id: env.ga4Id || admin.ga4Id,
    clarityId: env.clarityId || admin.clarityId,
  }
}

export function hasAnyAnalyticsId(ids: Partial<AnalyticsIds> | null | undefined): boolean {
  const c = cleanIds(ids)
  return Boolean(c.pixelId || c.ga4Id || c.clarityId)
}

// Minimal DOM surface the loaders need — real Document/Window satisfy it
// structurally, and tests pass a fake.
export type AnalyticsTarget = {
  document: {
    createElement(tag: string): { async: boolean; src: string }
    head: { appendChild(node: { async: boolean; src: string }): void }
  }
  window: Record<string, unknown>
}

function defaultTarget(): AnalyticsTarget | null {
  const g = globalThis as unknown as { document?: unknown; window?: unknown }
  if (!g.document || typeof g.document !== 'object') return null
  return {
    document: g.document as AnalyticsTarget['document'],
    window: ((g.window ?? g) as Record<string, unknown>) || {},
  }
}

function appendScript(target: AnalyticsTarget, src: string): void {
  const el = target.document.createElement('script')
  el.async = true
  el.src = src
  target.document.head.appendChild(el)
}

// Module state — which trackers are live, and signups that happened before
// the IDs arrived (e.g. Google/link signup on a fresh device, IDs landing a
// moment later via config/public hydration).
const initialized = { pixel: false, ga4: false, clarity: false }
let pageViewSent = false
// Queued signups waiting for the IDs to arrive — one entry per signup
// (deduped by key, see trackSignup).
let pendingSignups: { method: SignupMethod; key: string }[] = []
// Idempotency: keys of signups already fired in this page load. A signup
// must fire CompleteRegistration / sign_up exactly once even if the caller
// triggers it twice (double tap, double effect, queue flush + direct fire).
// The key is the account identity (see trackSignup) — a different account
// signing up later in the same page load has a different key and still fires.
const firedSignupKeys = new Set<string>()
let activeTarget: AnalyticsTarget | null = null

/** Test-only seam — clears the loaded flags, the PageView flag, the
 *  pending-signup queue and the fired-signup keys so each test scenario
 *  starts clean. */
export function resetAnalyticsForTests(): void {
  initialized.pixel = false
  initialized.ga4 = false
  initialized.clarity = false
  pageViewSent = false
  pendingSignups = []
  firedSignupKeys.clear()
  activeTarget = null
}

function fireSignupEvents(target: AnalyticsTarget, method: SignupMethod): void {
  const w = target.window
  if (initialized.pixel && typeof w.fbq === 'function') {
    try { (w.fbq as (...a: unknown[]) => void)('track', 'CompleteRegistration') } catch { /* never break login */ }
  }
  if (initialized.ga4 && typeof w.gtag === 'function') {
    try { (w.gtag as (...a: unknown[]) => void)('event', 'sign_up', { method }) } catch { /* never break login */ }
  }
  // Clarity needs no event — session recordings cover the signup.
}

/** Fire one signup's events at most once per page load (idempotency key).
 *  Returns true when the events fired, false when this signup already fired. */
function fireSignupOnce(target: AnalyticsTarget, method: SignupMethod, key: string): boolean {
  if (firedSignupKeys.has(key)) return false
  firedSignupKeys.add(key)
  fireSignupEvents(target, method)
  return true
}

export type AnalyticsInitResult = { pixel: boolean; ga4: boolean; clarity: boolean }

/** Load every configured tracker (idempotent — safe to call on every settings
 *  change and at boot). Empty IDs load nothing. Fires PageView once for the
 *  Pixel, then flushes any signups that were queued before the IDs arrived. */
export function initAnalytics(ids: Partial<AnalyticsIds> | null | undefined, target?: AnalyticsTarget): AnalyticsInitResult {
  const t = target ?? defaultTarget()
  if (!t) return { pixel: initialized.pixel, ga4: initialized.ga4, clarity: initialized.clarity }
  activeTarget = t
  const c = cleanIds(ids)
  const w = t.window

  if (c.pixelId && !initialized.pixel) {
    // Standard fbq stub — calls queue until fbevents.js loads and replays them.
    if (typeof w.fbq !== 'function') {
      const queue: unknown[][] = []
      const fbq = (...args: unknown[]) => { queue.push([...args]) }
      ;(fbq as unknown as Record<string, unknown>).queue = queue
      ;(fbq as unknown as Record<string, unknown>).push = fbq
      ;(fbq as unknown as Record<string, unknown>).loaded = true
      ;(fbq as unknown as Record<string, unknown>).version = '2.0'
      w.fbq = fbq
    }
    appendScript(t, 'https://connect.facebook.net/en_US/fbevents.js')
    try { (w.fbq as (...a: unknown[]) => void)('init', c.pixelId) } catch { /* ignore */ }
    initialized.pixel = true
  }
  if (c.pixelId && initialized.pixel && !pageViewSent && typeof w.fbq === 'function') {
    try { (w.fbq as (...a: unknown[]) => void)('track', 'PageView') } catch { /* ignore */ }
    pageViewSent = true
  }

  if (c.ga4Id && !initialized.ga4) {
    // Standard gtag stub — dataLayer queues until gtag.js loads.
    if (!Array.isArray(w.dataLayer)) w.dataLayer = []
    if (typeof w.gtag !== 'function') {
      w.gtag = (...args: unknown[]) => { (w.dataLayer as unknown[][]).push([...args]) }
    }
    appendScript(t, `https://www.googletagmanager.com/gtag/js?id=${c.ga4Id}`)
    try {
      (w.gtag as (...a: unknown[]) => void)('js', new Date())
      ;(w.gtag as (...a: unknown[]) => void)('config', c.ga4Id)
    } catch { /* ignore */ }
    initialized.ga4 = true
  }

  if (c.clarityId && !initialized.clarity) {
    // Standard Clarity stub — calls queue until the tag loads.
    if (typeof w.clarity !== 'function') {
      const clarity = (...args: unknown[]) => {
        const q = ((clarity as unknown as Record<string, unknown>).q as unknown[][] | undefined) || []
        q.push([...args])
        ;(clarity as unknown as Record<string, unknown>).q = q
      }
      w.clarity = clarity
    }
    appendScript(t, `https://www.clarity.ms/tag/${c.clarityId}`)
    initialized.clarity = true
  }

  if (pendingSignups.length > 0) {
    const queued = pendingSignups
    pendingSignups = []
    for (const q of queued) fireSignupOnce(t, q.method, q.key)
  }
  return { pixel: initialized.pixel, ga4: initialized.ga4, clarity: initialized.clarity }
}

/** Successful signup — CompleteRegistration (Pixel) + sign_up (GA4).
 *  Fires at once when the trackers are live; otherwise the signup is queued
 *  and flushed by the next initAnalytics (IDs arriving via config/public
 *  hydration right after a Google/link signup). Never throws, never blocks
 *  login. Only call for a FIRST signup, not a repeat login (see callers).
 *  Idempotent per signup: `key` identifies the account that signed up
 *  (e.g. 'google:user@example.com', 'email:user@example.com',
 *  'phone:01700000000'). A second call with the same key — double tap,
 *  double effect, or queue flush followed by a direct fire — fires nothing.
 *  A different account (different key) still fires. Without a key the
 *  method itself is the key, so pass a key from every caller. */
export function trackSignup(method: SignupMethod, target?: AnalyticsTarget, key?: string): void {
  const k = (key || '').trim() || method
  if (firedSignupKeys.has(k)) return
  const queue = () => {
    if (pendingSignups.length < 5 && !pendingSignups.some((q) => q.key === k)) pendingSignups.push({ method, key: k })
  }
  const t = target ?? activeTarget ?? defaultTarget()
  if (!t) {
    queue()
    return
  }
  if (!initialized.pixel && !initialized.ga4 && !initialized.clarity) {
    queue()
    return
  }
  fireSignupOnce(t, method, k)
}

// ---------- First-signup record (OTP logins have no Firebase user) ----------
// Device-local list of accounts that already completed signup on this device,
// so a repeat OTP login (after the 1h session expires) is not counted as a
// new registration. Google/link use Firebase's isNewUser instead (exact).
const SIGNUP_RECORDED_KEY = 'picall:signupRecorded'

type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void }

function defaultStorage(): StorageLike | null {
  try {
    const s = (globalThis as unknown as { localStorage?: StorageLike }).localStorage
    return s ?? null
  } catch {
    return null
  }
}

function readRecorded(storage: StorageLike | null): string[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(SIGNUP_RECORDED_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function wasSignupRecorded(key: string, storage?: StorageLike | null): boolean {
  return readRecorded(storage ?? defaultStorage()).includes(key)
}

export function markSignupRecorded(key: string, storage?: StorageLike | null): void {
  const s = storage ?? defaultStorage()
  if (!s) return
  try {
    const list = readRecorded(s).filter((x) => x !== key)
    list.unshift(key)
    s.setItem(SIGNUP_RECORDED_KEY, JSON.stringify(list.slice(0, 50)))
  } catch { /* ignore */ }
}
