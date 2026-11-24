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

// ---------- Group & page posts ----------
// Text-only posts (no photo upload — Firebase Storage is not enabled, and
// feed photos are device-local data URLs that must never go to Firestore).
// Only real members post in a group; only the page owner posts on a page.
// Nothing is ever invented — an empty list honestly says "no posts yet".
export type GroupPost = {
  id: string
  authorUid: string
  authorName: string
  text: string
  createdAtMs: number
}
/** A post on a page — same shape as a group post, different parent. */
export type PagePost = GroupPost

export const GROUP_POST_MAX = 1000
export const PAGE_POST_MAX = 1000

/** Shown when a post tries to move the chat off PiCall to another app. */
export const OFF_PLATFORM_LINK_MESSAGE_GROUPS = 'Links to other chat apps are not allowed in groups.'
export const OFF_PLATFORM_LINK_MESSAGE_PAGES = 'Links to other chat apps are not allowed on pages.'

const OFF_PLATFORM_LINK_RE = /(wa\.me|whatsapp|t\.me|telegram|imo\.im|messenger\.com|m\.me|fb\.me|fb\.com|facebook\.com|viber)/

/** True when the text links (or invites) to another chat app — wa.me,
 *  WhatsApp, Telegram, imo, Messenger, Facebook chat — or shares a phone
 *  number to move the chat off PiCall. Mirrors the app's contactBanCheck
 *  policy; server-side rules cannot reliably enforce text content, so the
 *  check runs on submit, client-side. */
export function hasOffPlatformContactLink(text: string): boolean {
  const t = text.toLowerCase()
  if (OFF_PLATFORM_LINK_RE.test(t)) return true
  const digits = text.replace(/[\s-]/g, '')
  if (/(01[3-9]\d{8})|(\+?8801[3-9]\d{8})/.test(digits)) return true
  if (/\b\d{10,}\b/.test(digits)) return true
  return false
}

function validateCommunityPost(text: string, linkMessage: string, max: number): string | null {
  const t = text.trim()
  if (!t) return 'Write something to post.'
  if (t.length > max) return `Post is too long — maximum ${max} characters.`
  if (hasOffPlatformContactLink(t)) return linkMessage
  return null
}

/** Validate a group post. Returns the error to show, or null. */
export function validateGroupPost(text: string): string | null {
  return validateCommunityPost(text, OFF_PLATFORM_LINK_MESSAGE_GROUPS, GROUP_POST_MAX)
}

/** Validate a page post. Returns the error to show, or null. */
export function validatePagePost(text: string): string | null {
  return validateCommunityPost(text, OFF_PLATFORM_LINK_MESSAGE_PAGES, PAGE_POST_MAX)
}

export function mapGroupPostDoc(id: string, data: Record<string, unknown>): GroupPost | null {
  if (!id || typeof data !== 'object' || !data) return null
  const authorUid = typeof data.authorUid === 'string' ? data.authorUid : ''
  const authorName = typeof data.authorName === 'string' ? data.authorName.trim() : ''
  const text = typeof data.text === 'string' ? data.text.trim() : ''
  if (!authorUid || !authorName || !text) return null
  return {
    id,
    authorUid,
    authorName,
    text: text.slice(0, GROUP_POST_MAX),
    createdAtMs: typeof data.createdAtMs === 'number' ? data.createdAtMs : 0,
  }
}

export function mapPagePostDoc(id: string, data: Record<string, unknown>): PagePost | null {
  return mapGroupPostDoc(id, data)
}

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

// ---------- Local cache for group/page posts (per parent, offline fallback) ----------
export const LOCAL_GROUP_POSTS_PREFIX = 'callguru:group-posts:'
export const LOCAL_PAGE_POSTS_PREFIX = 'callguru:page-posts:'

export function loadLocalGroupPosts(groupId: string): GroupPost[] {
  if (!groupId) return []
  return loadLocal(LOCAL_GROUP_POSTS_PREFIX + groupId, mapGroupPostDoc)
}
export function saveLocalGroupPosts(groupId: string, list: GroupPost[]): void {
  if (!groupId) return
  saveLocal(LOCAL_GROUP_POSTS_PREFIX + groupId, list)
}
export function loadLocalPagePosts(pageId: string): PagePost[] {
  if (!pageId) return []
  return loadLocal(LOCAL_PAGE_POSTS_PREFIX + pageId, mapPagePostDoc)
}
export function saveLocalPagePosts(pageId: string, list: PagePost[]): void {
  if (!pageId) return
  saveLocal(LOCAL_PAGE_POSTS_PREFIX + pageId, list)
}
export function mergeGroupPostLists(local: GroupPost[], remote: GroupPost[]): GroupPost[] { return mergeLists(local, remote) }
export function mergePagePostLists(local: PagePost[], remote: PagePost[]): PagePost[] { return mergeLists(local, remote) }
