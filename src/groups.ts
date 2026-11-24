// PiCall Groups & Pages — pure logic + local cache + Firestore doc mapping.
// A group is a member community; a page is a public presence (business,
// creator, community). Both start EMPTY — no fake members, no fake posts.
// Members/followers are real user uids only; counts come from those arrays.
import { contactBanCheck } from './data'

/** One group created by a real user. */
export type GroupItem = {
  id: string
  ownerUid: string
  ownerName: string
  name: string
  description: string
  /** 'public' anyone can join; 'private' — shown but join is by owner only. */
  visibility: 'public' | 'private'
  /** Uids of real members (the owner is always a member). */
  memberUids: string[]
  createdAtMs: number
}

/** One page created by a real user. */
export type PageItem = {
  id: string
  ownerUid: string
  ownerName: string
  name: string
  category: string
  description: string
  /** Uids of real followers. */
  followerUids: string[]
  createdAtMs: number
}

export type GroupInput = { name: string; description: string; visibility: 'public' | 'private' }
export type PageInput = { name: string; category: string; description: string }

export const GROUP_NAME_MAX = 80
export const GROUP_DESC_MAX = 500
export const PAGE_NAME_MAX = 80
export const PAGE_CATEGORY_MAX = 40
export const PAGE_DESC_MAX = 500

/** Validate the "Create Group" form. Returns the error to show, or null. */
export function validateGroupInput(input: GroupInput): string | null {
  const name = input.name.trim()
  if (!name) return 'Give your group a name.'
  if (name.length > GROUP_NAME_MAX) return `Name is too long — maximum ${GROUP_NAME_MAX} characters.`
  if (input.description.trim().length > GROUP_DESC_MAX) return `Description is too long — maximum ${GROUP_DESC_MAX} characters.`
  const ban = contactBanCheck(name + ' ' + input.description)
  if (ban) return ban
  if (input.visibility !== 'public' && input.visibility !== 'private') return 'Pick public or private.'
  return null
}

/** Validate the "Create Page" form. Returns the error to show, or null. */
export function validatePageInput(input: PageInput): string | null {
  const name = input.name.trim()
  if (!name) return 'Give your page a name.'
  if (name.length > PAGE_NAME_MAX) return `Name is too long — maximum ${PAGE_NAME_MAX} characters.`
  if (input.category.trim().length > PAGE_CATEGORY_MAX) return `Category is too long — maximum ${PAGE_CATEGORY_MAX} characters.`
  if (input.description.trim().length > PAGE_DESC_MAX) return `Description is too long — maximum ${PAGE_DESC_MAX} characters.`
  const ban = contactBanCheck(name + ' ' + input.category + ' ' + input.description)
  if (ban) return ban
  return null
}

export function memberCount(g: GroupItem): number { return g.memberUids.length }
export function followerCount(p: PageItem): number { return p.followerUids.length }
export function isMember(g: GroupItem, uid: string | null | undefined): boolean { return !!uid && g.memberUids.includes(uid) }
export function isFollower(p: PageItem, uid: string | null | undefined): boolean { return !!uid && p.followerUids.includes(uid) }

// ---------- Firestore doc mapping (never throws; bad docs become null) ----------

function uidArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

export function mapGroupDoc(id: string, data: Record<string, unknown>): GroupItem | null {
  if (!id || typeof data !== 'object' || !data) return null
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : ''
  const ownerName = typeof data.ownerName === 'string' ? data.ownerName.trim() : ''
  if (!name || !ownerUid || !ownerName) return null
  const visibility = data.visibility === 'private' ? 'private' : 'public'
  const memberUids = uidArray(data.memberUids)
  if (!memberUids.includes(ownerUid)) memberUids.unshift(ownerUid)
  return {
    id,
    ownerUid,
    ownerName,
    name: name.slice(0, GROUP_NAME_MAX),
    description: typeof data.description === 'string' ? data.description.slice(0, GROUP_DESC_MAX) : '',
    visibility,
    memberUids,
    createdAtMs: typeof data.createdAtMs === 'number' ? data.createdAtMs : 0,
  }
}

export function mapPageDoc(id: string, data: Record<string, unknown>): PageItem | null {
  if (!id || typeof data !== 'object' || !data) return null
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : ''
  const ownerName = typeof data.ownerName === 'string' ? data.ownerName.trim() : ''
  if (!name || !ownerUid || !ownerName) return null
  return {
    id,
    ownerUid,
    ownerName,
    name: name.slice(0, PAGE_NAME_MAX),
    category: typeof data.category === 'string' ? data.category.trim().slice(0, PAGE_CATEGORY_MAX) : '',
    description: typeof data.description === 'string' ? data.description.slice(0, PAGE_DESC_MAX) : '',
    followerUids: uidArray(data.followerUids),
    createdAtMs: typeof data.createdAtMs === 'number' ? data.createdAtMs : 0,
  }
}

// ---------- Local cache (offline fallback, same graceful pattern as services) ----------
// Firestore is the source of truth; this cache only keeps groups/pages this
// device already saw (or created while offline). It never invents members.

export const LOCAL_GROUPS_KEY = 'callguru:groups'
export const LOCAL_PAGES_KEY = 'callguru:pages'

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function loadLocal<T>(key: string, map: (id: string, d: Record<string, unknown>) => T | null): T[] {
  if (!hasStorage()) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((d) => (d && typeof d === 'object' ? map(String((d as Record<string, unknown>).id ?? ''), d as Record<string, unknown>) : null))
      .filter((x): x is T => x !== null)
  } catch { return [] }
}

function saveLocal(key: string, list: unknown[]): void {
  if (!hasStorage()) return
  try { localStorage.setItem(key, JSON.stringify(list.slice(0, 100))) } catch { /* storage full/blocked — cache is best-effort */ }
}

export function loadLocalGroups(): GroupItem[] { return loadLocal(LOCAL_GROUPS_KEY, mapGroupDoc) }
export function saveLocalGroups(list: GroupItem[]): void { saveLocal(LOCAL_GROUPS_KEY, list) }
export function loadLocalPages(): PageItem[] { return loadLocal(LOCAL_PAGES_KEY, mapPageDoc) }
export function saveLocalPages(list: PageItem[]): void { saveLocal(LOCAL_PAGES_KEY, list) }

/** Merge a locally cached list with a fresh Firestore list: Firestore wins per
 *  id, locally-created (not yet synced) entries are kept, newest first. */
function mergeLists<T extends { id: string; createdAtMs: number }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>()
  for (const x of local) byId.set(x.id, x)
  for (const x of remote) byId.set(x.id, x)
  return [...byId.values()].sort((a, b) => b.createdAtMs - a.createdAtMs)
}

export function mergeGroupLists(local: GroupItem[], remote: GroupItem[]): GroupItem[] { return mergeLists(local, remote) }
export function mergePageLists(local: PageItem[], remote: PageItem[]): PageItem[] { return mergeLists(local, remote) }
