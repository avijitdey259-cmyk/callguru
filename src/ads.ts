// PiCall user product ads — pure logic + local cache + Firestore doc mapping.
// A user advertises THEIR OWN product: photo, title, description, price and a
// link to their own website/business. Submitting saves the ad as PENDING for
// admin review; only APPROVED ads show in the Feed (labelled "Sponsored").
// No invented reach numbers, no payment yet — the payment model is undecided.
// This is NOT Adsterra (owner's own earning, wired later when his codes arrive).
// No demo/fake ads — the list starts empty and only real user ads appear.
import { contactBanCheck, formatBDT } from './data'

/** CPM/CPC billing rates for user product ads — set by the admin in
 *  Admin → Settings. Owner-approved defaults (2026-11-24): CPM ৳50 per 1000
 *  views, CPC ৳3 per click. The admin can change them later; both 0 means
 *  ads show free until rates are set again. */
export type AdRateSettings = { cpmRateBDT: number; cpcRateBDT: number }
export const DEFAULT_AD_RATES: AdRateSettings = { cpmRateBDT: 50, cpcRateBDT: 3 }

/** True when at least one rate is set — otherwise the ad shows free. */
export function adRatesSet(rates: AdRateSettings | null | undefined): boolean {
  if (!rates) return false
  return (Number(rates.cpmRateBDT) > 0) || (Number(rates.cpcRateBDT) > 0)
}

/** Amount due for one ad: views/1000 × CPM rate + clicks × CPC rate (Tk). */
export function adAmountDue(ad: Pick<UserAd, 'views' | 'clicks'>, rates: AdRateSettings | null | undefined): number {
  if (!rates) return 0
  const views = Number(ad.views) || 0
  const clicks = Number(ad.clicks) || 0
  const due = (views / 1000) * (Number(rates.cpmRateBDT) || 0) + clicks * (Number(rates.cpcRateBDT) || 0)
  return Math.round(due * 100) / 100
}

/** One user product ad. Status is set by the admin, never by the submitter. */
export type UserAd = {
  id: string
  ownerUid: string
  ownerName: string
  title: string
  description: string
  /** Price in Taka. */
  priceBDT: number
  /** The user's own website/business link — must start with http(s)://. */
  link: string
  /** Product photo (downscaled data URL), optional. */
  photo?: string
  status: 'pending' | 'approved' | 'rejected'
  /** CPM billing — views (impressions) of the approved ad in the Feed. */
  views: number
  /** CPC billing — clicks through to the user's website/business link. */
  clicks: number
  createdAtMs: number
}

export type AdInput = { title: string; description: string; priceBDT: number; link: string; photo?: string }

export const AD_TITLE_MAX = 80
export const AD_DESC_MAX = 500
export const AD_LINK_MAX = 500

/** Validate the "Place an Ad" form. Returns the error to show, or null. */
export function validateAdInput(input: AdInput): string | null {
  const title = input.title.trim()
  if (!title) return 'Give your product a title.'
  if (title.length > AD_TITLE_MAX) return `Title is too long — maximum ${AD_TITLE_MAX} characters.`
  if (input.description.trim().length > AD_DESC_MAX) return `Description is too long — maximum ${AD_DESC_MAX} characters.`
  const ban = contactBanCheck(title + ' ' + input.description)
  if (ban) return ban
  const price = Number(input.priceBDT)
  if (!Number.isFinite(price) || price <= 0) return 'Set a price in Tk (more than 0).'
  const link = input.link.trim()
  if (!link) return 'Add your website or business link.'
  if (link.length > AD_LINK_MAX) return `Link is too long — maximum ${AD_LINK_MAX} characters.`
  if (!/^https?:\/\/.+\..+/.test(link)) return 'Link must start with http:// or https://.'
  return null
}

/** Price as shown on the ad card, e.g. "Tk 1,290". */
export function adPriceLabel(priceBDT: number): string {
  return formatBDT(priceBDT)
}

/** Status label shown on the user's own ads list. */
export function adStatusLabel(status: UserAd['status']): string {
  if (status === 'approved') return '✅ Approved — showing in Feed'
  if (status === 'rejected') return '❌ Rejected by admin'
  return '⏳ Pending admin review'
}

// ---------- Firestore doc mapping (never throws; bad docs become null) ----------

export function mapAdDoc(id: string, data: Record<string, unknown>): UserAd | null {
  if (!id || typeof data !== 'object' || !data) return null
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : ''
  const ownerName = typeof data.ownerName === 'string' ? data.ownerName.trim() : ''
  const link = typeof data.link === 'string' ? data.link.trim() : ''
  const price = typeof data.priceBDT === 'number' ? data.priceBDT : NaN
  const status = data.status === 'approved' || data.status === 'rejected' ? data.status : 'pending'
  if (!title || !ownerUid || !ownerName || !link || !Number.isFinite(price) || price < 0) return null
  const photo = typeof data.photo === 'string' && data.photo ? data.photo : undefined
  const views = typeof data.views === 'number' && Number.isFinite(data.views) && data.views >= 0 ? Math.trunc(data.views) : 0
  const clicks = typeof data.clicks === 'number' && Number.isFinite(data.clicks) && data.clicks >= 0 ? Math.trunc(data.clicks) : 0
  return {
    id,
    ownerUid,
    ownerName,
    ...(photo ? { photo } : {}),
    title: title.slice(0, AD_TITLE_MAX),
    description: typeof data.description === 'string' ? data.description.slice(0, AD_DESC_MAX) : '',
    priceBDT: Math.round(price * 100) / 100,
    link: link.slice(0, AD_LINK_MAX),
    status,
    views,
    clicks,
    createdAtMs: typeof data.createdAtMs === 'number' ? data.createdAtMs : 0,
  }
}

// ---------- Local cache (offline fallback, same graceful pattern as the feed) ----------
// Firestore is the source of truth; this cache only keeps ads this device
// already saw (or created while offline) so the section still shows them when
// Firestore is unreachable. It never invents ads.

export const LOCAL_ADS_KEY = 'callguru:ads'

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

export function loadLocalAds(): UserAd[] {
  if (!hasStorage()) return []
  try {
    const raw = localStorage.getItem(LOCAL_ADS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((d) => (d && typeof d === 'object' ? mapAdDoc(String((d as Record<string, unknown>).id ?? ''), d as Record<string, unknown>) : null))
      .filter((a): a is UserAd => a !== null)
  } catch { return [] }
}

export function saveLocalAds(list: UserAd[]): void {
  if (!hasStorage()) return
  try { localStorage.setItem(LOCAL_ADS_KEY, JSON.stringify(list.slice(0, 100))) } catch { /* storage full/blocked — cache is best-effort */ }
}

/** Merge a locally cached list with a fresh Firestore list: Firestore wins per
 *  id, locally-created (not yet synced) entries are kept, newest first. */
export function mergeAdLists(local: UserAd[], remote: UserAd[]): UserAd[] {
  const byId = new Map<string, UserAd>()
  for (const a of local) byId.set(a.id, a)
  for (const a of remote) byId.set(a.id, a)
  return [...byId.values()].sort((a, b) => b.createdAtMs - a.createdAtMs)
}
