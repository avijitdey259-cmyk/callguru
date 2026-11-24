// নতুন সদস্য টেস্ট — আসল ব্যবহারকারীই শুধু, ভুয়া কেউ নয়।
// চালানো: রিপো রুট থেকে `node tests/new-members.test.mjs`
// (src/newMembers.ts-এর pure logic esbuild দিয়ে বান্ডল করে চালায়; Firestore/
//  নিয়ম/পেজের গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nmSrc = readFileSync(join(root, 'src/newMembers.ts'), 'utf8')
const fsSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-newmembers-test-'))
const outFile = join(outDir, 'newMembers.mjs')
await build({
  entryPoints: [join(root, 'src/newMembers.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const DAY = 86400000
const now = new Date('2026-11-23T12:00:00+06:00').getTime()

// ---- যোগদানের সময় বাংলায় ----
check('Joins today → "Today"', () => {
  assert.equal(M.formatJoinTime(now, now), 'Today')
  assert.equal(M.formatJoinTime(now - 3600000, now), 'Today')
})
check('Joins yesterday → "Yesterday"', () => {
  assert.equal(M.formatJoinTime(now - DAY, now), 'Yesterday')
})
check('Joins 2/5 days ago → day count in English', () => {
  assert.equal(M.formatJoinTime(now - 2 * DAY, now), '2 days ago')
  assert.equal(M.formatJoinTime(now - 5 * DAY, now), '5 days ago')
})
check('Unknown time → "Recently"', () => {
  assert.equal(M.formatJoinTime(null, now), 'Recently')
})

// ---- createdAt রূপান্তর ----
check('Timestamp/সংখ্যা/ISO স্ট্রিং থেকে ms মেলে; বাজে মান null', () => {
  assert.equal(M.toCreatedAtMs({ toDate: () => new Date(now) }), now)
  assert.equal(M.toCreatedAtMs({ seconds: Math.floor(now / 1000), nanoseconds: 0 }), Math.floor(now / 1000) * 1000)
  assert.equal(M.toCreatedAtMs(now), now)
  assert.equal(M.toCreatedAtMs(new Date(now).toISOString()), now)
  assert.equal(M.toCreatedAtMs(null), null)
  assert.equal(M.toCreatedAtMs('not-a-date'), null)
  assert.equal(M.toCreatedAtMs({}), null)
})

// ---- রং নির্ধারিত ও প্যালেটের ভেতরে ----
check('uid থেকে রং নির্ধারিত, সবসময় প্যালেটের ভেতরে', () => {
  const a = M.colourForUid('uid-abc')
  assert.equal(M.colourForUid('uid-abc'), a)
  assert.ok(M.PUBLIC_PROFILE_COLORS.includes(a))
  const seen = new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map(u => M.colourForUid(u)))
  assert.ok(seen.size >= 2, 'সব uid-এ একই রং')
})

// ---- নিজেকে বাদ দেওয়া; ক্রম (নতুন আগে) অপরিবর্তিত ----
check('তালিকায় নিজে থাকলে বাদ যায়; বাকিদের ক্রম একই থাকে', () => {
  const list = [
    { id: 'u1', displayName: 'করিম', createdAtMs: now, colour: '#1877F2' },
    { id: 'me', displayName: 'আমি', createdAtMs: now - DAY, colour: '#E91E63' },
    { id: 'u2', displayName: 'রহিম', createdAtMs: now - 2 * DAY, colour: '#27AE60' },
  ]
  const out = M.filterNewMembers(list, 'me')
  assert.deepEqual(out.map(x => x.id), ['u1', 'u2'])
  assert.deepEqual(M.filterNewMembers(list, null).map(x => x.id), ['u1', 'me', 'u2'])
})

// ---- গঠন: পাবলিক প্রোফাইলে শুধু নাম + সময় + রং ----
check('publicProfiles-এ শুধু নাম/সময়/রং — ইমেইল/ফোন/আইডি/KYC নেই', () => {
  assert.ok(fsSrc.includes('publicProfiles'), 'publicProfiles নেই')
  assert.ok(fsSrc.includes("orderBy('createdAt', 'desc')"), 'createdAt desc অর্ডার নেই')
  assert.ok(fsSrc.includes('limit(limitN)'), 'limit নেই')
  assert.ok(fsSrc.includes('createdAt: serverTimestamp()'), 'createdAt serverTimestamp নেই')
  const wpStart = fsSrc.indexOf('export async function writePublicProfile')
  const wpEnd = fsSrc.indexOf('export async function fetchNewMembers', wpStart)
  const body = fsSrc.slice(wpStart, wpEnd)
  for (const bad of ['email', 'phone', 'nid', 'NID', 'kyc', 'KYC', 'piBalance', 'bonusPi']) {
    assert.ok(!body.toLowerCase().includes(bad.toLowerCase()), `writePublicProfile-এ ${bad} আছে`)
  }
})

// ---- গঠন: users ডক খোলা হয়নি; নিয়ম শুধু publicProfiles-এই সীমিত ----
check('নিয়ম: users নিজেরই থাকে; publicProfiles পড়া সবার, লেখা শুধু নিজের', () => {
  const usersRule = rulesSrc.slice(rulesSrc.indexOf('match /users/{uid}'), rulesSrc.indexOf('match /publicProfiles'))
  assert.ok(usersRule.includes('request.auth.uid == uid'), 'users নিয়ম বদলে গেছে')
  const ppStart = rulesSrc.indexOf('match /publicProfiles/{uid}')
  assert.ok(ppStart > 0)
  const ppBody = rulesSrc.slice(ppStart, rulesSrc.indexOf('}', rulesSrc.indexOf('allow delete', ppStart)) + 1)
  assert.ok(ppBody.includes('allow read: if isSignedIn()'))
  assert.ok(ppBody.includes('allow create, update: if isSignedIn() && request.auth.uid == uid'))
  assert.ok(ppBody.includes('allow delete: if false'))
})

// ---- গঠন: প্রথম লগইনে পাবলিক প্রোফাইল লেখা হয়; অ্যাডমিনও সাধারণ ব্যবহারকারী ----
// referralCode-সহ লেখা হয় (নতুন ব্যবহারকারী + পুরোনো প্রোফাইলের ব্যাকফিল) —
// নাম/আইডি খোঁজায় যাতে সব আসল ব্যবহারকারী মেলে। অ্যাডমিনের প্রোফাইলও লেখা হয় —
// তিনি নতুন সদস্যের তালিকায়, নাম/আইডি খোঁজায় আর বন্ধু হিসেবে আসেন।
check('স্টোর: প্রথম লগইনে পাবলিক প্রোফাইল লেখে; অ্যাডমিনও লেখে (বাদ নয়)', () => {
  assert.ok(storeSrc.includes('writePublicProfile(uid, user.name, referralCode, { gender, district, interests, photo: profilePhoto })'))
  const i = storeSrc.indexOf('writePublicProfile(uid, user.name, referralCode, { gender, district, interests, photo: profilePhoto })')
  const guard = storeSrc.slice(Math.max(0, i - 400), i)
  assert.ok(!guard.includes('!== ADMIN_EMAIL'), 'অ্যাডমিন বাদ দেওয়ার শর্ত এখনো আছে')
  // প্রোফাইল-সিঙ্ক ইফেক্টেও অ্যাডমিনের জন্য early return নেই
  const syncStart = storeSrc.indexOf('পাবলিক প্রোফাইল সিঙ্ক')
  const syncBody = storeSrc.slice(syncStart, storeSrc.indexOf('// Friend photos refresh', syncStart))
  assert.ok(!syncBody.includes('=== ADMIN_EMAIL) return'), 'প্রোফাইল সিঙ্কে অ্যাডমিন early return আছে')
})

// ---- গঠন: অ্যাডমিন প্যানেল আগের মতোই শুধু অ্যাডমিনের ----
// প্রোফাইল সাধারণ ব্যবহারকারীর মতো হলেও /admin রুট আর Admin মেনু isAdmin দিয়েই আটকানো।
check('অ্যাডমিন প্যানেল শুধু অ্যাডমিনের: /admin রুট + Admin মেনু isAdmin-গেটেড', () => {
  assert.ok(storeSrc.includes('isAdmin: !!user && user.email.trim().toLowerCase() === ADMIN_EMAIL'), 'isAdmin নেই')
  const appSrc = readFileSync(join(root, 'src/App.tsx'), 'utf8')
  assert.ok(appSrc.includes("path=\"/admin\" element={isAdmin ? <AdminPage /> : <AdminBlocked />}"), '/admin রুট isAdmin-গেটেড নয়')
  const compSrc = readFileSync(join(root, 'src/components.tsx'), 'utf8')
  assert.ok(compSrc.includes("...(isAdmin ? [{ to: '/admin', label: 'Admin'"), 'Admin মেনু isAdmin-গেটেড নয়')
})

// ---- গঠন: সেকশন হোমে, সার্চের নিচে, ফিড পোস্টের উপরে ----
check('হোমে "নতুন সদস্য" সেকশন: সার্চের নিচে, RefWelcomeBanner-এর উপরে', () => {
  const feedStart = pagesSrc.indexOf('export function Feed()')
  const feed = pagesSrc.slice(feedStart)
  const searchEnd = feed.indexOf('No posts found.')
  const banner = feed.indexOf('<RefWelcomeBanner />')
  const section = feed.indexOf('<NewMembersSection />')
  const h = pagesSrc.indexOf('> New Members</h2>')
  assert.ok(feedStart > 0 && h > 0 && searchEnd > 0 && banner > 0 && section > 0)
  assert.ok(searchEnd < section && section < banner, 'সেকশনের জায়গা ঠিক নেই')
  assert.ok(pagesSrc.includes('Nobody new has joined yet — invite your friend!'))
  assert.ok(pagesSrc.includes('fetchNewMembers(10)'))
  assert.ok(pagesSrc.includes("formatJoinTime(m.createdAtMs)"))
})

// ---- গঠন: সেকশনে কোনো ভুয়া/পারসোনা উৎস নেই ----
check('সেকশনের উৎস শুধু Firestore — পারসোনা/ডেমো নাম নেই', () => {
  const start = pagesSrc.indexOf('function NewMembersSection()')
  const end = pagesSrc.indexOf('// ---------- Feed ----------', start)
  const body = pagesSrc.slice(start, end)
  assert.ok(body.includes('fetchNewMembers'))
  for (const bad of ['BUDDIES', 'রিমা', 'শাকিল', 'ফাহিম', 'মিম', 'আশা', 'তানভীর', 'ফয়সাল', 'ইমরান', 'সাদিয়া', 'তানহা', 'নাবিলা', 'Rima', 'Shakil', 'Fahim', 'Mim', 'Asha', 'Tanvir', 'Faysal', 'Imran', 'Sadia', 'Tanha', 'Nabila', 'ডেমো']) {
    assert.ok(!body.includes(bad), `সেকশনে ${bad} আছে`)
  }
  assert.ok(!nmSrc.includes('রিমা') && !fsSrc.includes('রিমা'), 'ডেটা স্তরে পারসোনা নাম আছে')
})

console.log(`\n${passed}/13 passed`)
