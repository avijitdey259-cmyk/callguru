// PiCall virtual services — pure logic + local cache + Firestore doc mapping.
// A service is ALWAYS virtual: it is delivered by video call on PiCall, never
// in person. No location / meet-in-person / home-visit field exists anywhere.
// A service is prepaid like an expert call: the caller pays the service's
// Pi-per-minute rate, the call auto-cuts at zero balance, no balance = no call.
// No demo/fake providers or reviews — the list starts empty and only real
// user-created services appear.
import { contactBanCheck, formatPi, roundPi } from './data'

/** One service listing offered by a real user, by video call only. */
export type ServiceListing = {
  id: string
  providerUid: string
  providerName: string
  providerPhoto?: string
  title: string
  description: string
  /** Prepaid rate the caller pays, in Pi per minute. */
  ratePiPerMin: number
  createdAtMs: number
}

/** One review left by a caller after a service call ended. The reviewer's
 *  name is shown to ALL users (owner requirement). */
export type ServiceReview = {
  id: string
  serviceId: string
  reviewerUid: string
  reviewerName: string
  /** 1–5 stars. */
  stars: number
  text: string
  createdAtMs: number
}

export type ServiceInput = { title: string; description: string; ratePiPerMin: number }

export const SERVICE_RATE_MIN_PI = 0.01
export const SERVICE_RATE_MAX_PI = 100
export const SERVICE_TITLE_MAX = 80
export const SERVICE_DESC_MAX = 500
export const REVIEW_TEXT_MAX = 300

/** Validate the "Offer a service" form. Returns the error to show, or null. */
export function validateServiceInput(input: ServiceInput): string | null {
  const title = input.title.trim()
  if (!title) return 'Give your service a title.'
  if (title.length > SERVICE_TITLE_MAX) return `Title is too long — maximum ${SERVICE_TITLE_MAX} characters.`
  if (input.description.trim().length > SERVICE_DESC_MAX) return `Description is too long — maximum ${SERVICE_DESC_MAX} characters.`
  const ban = contactBanCheck(title + ' ' + input.description)
  if (ban) return ban
  const rate = Number(input.ratePiPerMin)
  if (!Number.isFinite(rate) || rate <= 0) return 'Set a rate per minute in Pi.'
  if (rate < SERVICE_RATE_MIN_PI) return `Rate is too low — minimum ${formatPi(SERVICE_RATE_MIN_PI)} per minute.`
  if (rate > SERVICE_RATE_MAX_PI) return `Rate is too high — maximum ${formatPi(SERVICE_RATE_MAX_PI)} per minute.`
  return null
}

/** Validate a review left after a service call. Returns the error, or null. */
export function validateReviewInput(stars: number, text: string): string | null {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return 'Pick 1 to 5 stars.'
  if (text.trim().length > REVIEW_TEXT_MAX) return `Review is too long — maximum ${REVIEW_TEXT_MAX} characters.`
  const ban = contactBanCheck(text)
  if (ban) return ban
  return null
}

/** Average stars + review count from a service's reviews. */
export function averageRating(reviews: Pick<ServiceReview, 'stars'>[]): { avg: number; count: number } {
  const count = reviews.length
  if (count === 0) return { avg: 0, count: 0 }
  const sum = reviews.reduce((a, r) => a + (Number.isFinite(r.stars) ? r.stars : 0), 0)
  return { avg: Math.round((sum / count) * 10) / 10, count }
}

/** Rating line shown on a service card. */
export function ratingSummary(avg: number, count: number): string {
  if (count === 0) return 'No reviews yet'
  return `⭐ ${avg} • ${count} Review${count === 1 ? '' : 's'}`
}

/** Prepaid check for a service call: the free first minute covers it, or the
 *  caller must hold at least one minute's rate. No balance = no call. */
export function canStartServiceCall(balancePi: number, ratePiPerMin: number, freeMinuteAvailable: boolean): boolean {
  if (freeMinuteAvailable) return true
  if (!Number.isFinite(ratePiPerMin) || ratePiPerMin <= 0) return false
  return balancePi >= ratePiPerMin
}

export function isOwnService(service: ServiceListing, uid: string | null | undefined): boolean {
  return !!uid && service.providerUid === uid
}

/** Rate as shown on the card, e.g. "π 0.15/minute". */
export function serviceRateLabel(ratePiPerMin: number): string {
  return `${formatPi(ratePiPerMin)}/minute`
}

// ---------- Firestore doc mapping (never throws; bad docs become null) ----------

export function mapServiceDoc(id: string, data: Record<string, unknown>): ServiceListing | null {
  if (!id || typeof data !== 'object' || !data) return null
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const providerUid = typeof data.providerUid === 'string' ? data.providerUid : ''
  const providerName = typeof data.providerName === 'string' ? data.providerName.trim() : ''
  const rate = typeof data.ratePiPerMin === 'number' ? roundPi(data.ratePiPerMin) : NaN
  if (!title || !providerUid || !providerName || !Number.isFinite(rate) || rate <= 0) return null
  const photo = typeof data.providerPhoto === 'string' && data.providerPhoto ? data.providerPhoto : undefined
  return {
    id,
    providerUid,
    providerName,
    ...(photo ? { providerPhoto: photo } : {}),
    title: title.slice(0, SERVICE_TITLE_MAX),
    description: typeof data.description === 'string' ? data.description.slice(0, SERVICE_DESC_MAX) : '',
    ratePiPerMin: rate,
    createdAtMs: typeof data.createdAtMs === 'number' ? data.createdAtMs : 0,
  }
}

export function mapReviewDoc(id: string, serviceId: string, data: Record<string, unknown>): ServiceReview | null {
  if (!id || !serviceId || typeof data !== 'object' || !data) return null
  const stars = typeof data.stars === 'number' ? Math.trunc(data.stars) : NaN
  const reviewerUid = typeof data.reviewerUid === 'string' ? data.reviewerUid : ''
  const reviewerName = typeof data.reviewerName === 'string' ? data.reviewerName.trim() : ''
  if (!Number.isInteger(stars) || stars < 1 || stars > 5 || !reviewerUid || !reviewerName) return null
  return {
    id,
    serviceId,
    reviewerUid,
    reviewerName,
    stars,
    text: typeof data.text === 'string' ? data.text.slice(0, REVIEW_TEXT_MAX) : '',
    createdAtMs: typeof data.createdAtMs === 'number' ? data.createdAtMs : 0,
  }
}

// ---------- Local cache (offline fallback, same graceful pattern as the feed) ----------
// Firestore is the source of truth; this cache only keeps services this device
// already saw (or created while offline) so the section still shows them when
// Firestore is unreachable. It never invents providers or reviews.

export const LOCAL_SERVICES_KEY = 'callguru:services'

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

export function loadLocalServices(): ServiceListing[] {
  if (!hasStorage()) return []
  try {
    const raw = localStorage.getItem(LOCAL_SERVICES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((d) => (d && typeof d === 'object' ? mapServiceDoc(String((d as Record<string, unknown>).id ?? ''), d as Record<string, unknown>) : null))
      .filter((s): s is ServiceListing => s !== null)
  } catch { return [] }
}

export function saveLocalServices(list: ServiceListing[]): void {
  if (!hasStorage()) return
  try { localStorage.setItem(LOCAL_SERVICES_KEY, JSON.stringify(list.slice(0, 100))) } catch { /* storage full/blocked — cache is best-effort */ }
}

/** Merge a locally cached list with a fresh Firestore list: Firestore wins per
 *  id, locally-created (not yet synced) entries are kept, newest first. */
export function mergeServiceLists(local: ServiceListing[], remote: ServiceListing[]): ServiceListing[] {
  const byId = new Map<string, ServiceListing>()
  for (const s of local) byId.set(s.id, s)
  for (const s of remote) byId.set(s.id, s)
  return [...byId.values()].sort((a, b) => b.createdAtMs - a.createdAtMs)
}
