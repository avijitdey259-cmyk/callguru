// অ্যাডমিন Users তালিকা — আসল ব্যবহারকারীই শুধু, publicProfiles থেকে।
// চালানো: রিপো রুট থেকে `node tests/admin-users.test.mjs`
// (src/newMembers.ts-এর pure filter esbuild দিয়ে বান্ডল করে চালায়;
//  পেজের গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-adminusers-test-'))
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

const members = [
  { id: 'u1', displayName: 'Avijit Dey', createdAtMs: 1795510000000, colour: '#1877F2', referralCode: 'cg-avijit1' },
  { id: 'u2', displayName: 'Susmita', createdAtMs: 1795420000000, colour: '#E91E63', referralCode: 'cg-b4rk4e' },
  { id: 'u3', displayName: 'Rahim Uddin', createdAtMs: null, colour: '#27AE60' },
]

// ---- খোঁজার ফিল্টার (pure) ----
check('Name match, case-insensitive', () => {
  assert.deepEqual(M.filterAdminUsers(members, 'avijit').map(m => m.id), ['u1'])
  assert.deepEqual(M.filterAdminUsers(members, 'SUSMITA').map(m => m.id), ['u2'])
  assert.deepEqual(M.filterAdminUsers(members, 'rahim').map(m => m.id), ['u3'])
})
check('Referral code match', () => {
  assert.deepEqual(M.filterAdminUsers(members, 'cg-b4rk4e').map(m => m.id), ['u2'])
  assert.deepEqual(M.filterAdminUsers(members, 'CG-AVIJIT1').map(m => m.id), ['u1'])
})
check('No match → empty list', () => {
  assert.deepEqual(M.filterAdminUsers(members, 'nobody-here'), [])
})
check('Empty / blank query → whole list', () => {
  assert.deepEqual(M.filterAdminUsers(members, ''), members)
  assert.deepEqual(M.filterAdminUsers(members, '   '), members)
})
check('Query is trimmed before matching', () => {
  assert.deepEqual(M.filterAdminUsers(members, '  avijit  ').map(m => m.id), ['u1'])
})

// ---- পেজের গঠন (Admin → Users ট্যাব) ----
const tabStart = pagesSrc.indexOf("{tab === 'users' && <Card>")
assert.ok(tabStart !== -1, 'Users ট্যাব পাওয়া যায়নি')
const tabEnd = pagesSrc.indexOf("{tab === 'recordings'", tabStart)
const tabSrc = pagesSrc.slice(tabStart, tabEnd === -1 ? tabStart + 4000 : tabEnd)

check('Old placeholder is gone', () => {
  assert.ok(!pagesSrc.includes('No user totals yet'), 'পুরনো placeholder এখনো আছে')
})
check('AdminPage fetches publicProfiles when the Users tab opens', () => {
  assert.ok(pagesSrc.includes('function refreshAdminUsers()'), 'refreshAdminUsers নেই')
  assert.ok(pagesSrc.includes('fetchAllPublicProfiles(100).then(list => setAdminUsers(list))'), 'fetchAllPublicProfiles(100) দিয়ে লোড হয় না')
  assert.ok(pagesSrc.includes("useEffect(() => { if (tab === 'users') refreshAdminUsers() }, [tab])"), 'Users ট্যাব খুললে লোড হয় না')
})
check('Users tab renders name + referral code + joined date + colour dot', () => {
  assert.ok(tabSrc.includes('{m.displayName}'), 'displayName দেখানো হয় না')
  assert.ok(tabSrc.includes('{m.referralCode ??'), 'referralCode দেখানো হয় না')
  assert.ok(tabSrc.includes("new Date(m.createdAtMs).toLocaleDateString('en-GB')"), 'joined date দেখানো হয় না')
  assert.ok(tabSrc.includes('backgroundColor: m.colour'), 'colour avatar dot নেই')
})
check('Search box filters by name or referral code', () => {
  assert.ok(tabSrc.includes('Search by name or referral code'), 'খোঁজার বাক্স নেই')
  assert.ok(pagesSrc.includes('filterAdminUsers(adminUsers ?? [], adminUsersQuery)'), 'ফিল্টারে filterAdminUsers ব্যবহার হয় না')
})
check('Cap, loading and empty states are honest', () => {
  assert.ok(tabSrc.includes('Showing 100 users'), '100 ছুঁলে ক্যাপের কথা লেখা নেই')
  assert.ok(tabSrc.includes('Loading users'), 'লোডিং অবস্থা নেই')
  assert.ok(tabSrc.includes('No users found.'), 'খালি অবস্থা নেই')
})
check('Dating KYC line stays below the list', () => {
  assert.ok(tabSrc.includes('Dating KYC:'), 'Dating KYC লাইনটা উঠে গেছে')
})
check('No private data in the Users tab — no email/phone, no users/{uid} reads', () => {
  assert.ok(!/email/i.test(tabSrc), 'Users ট্যাবে email আছে')
  assert.ok(!/phone/i.test(tabSrc), 'Users ট্যাবে phone আছে')
  assert.ok(!tabSrc.includes('fetchUserDoc'), 'Users ট্যাবে ব্যক্তিগত users ডক পড়া হচ্ছে')
})

// ---- নাম এডিট (firestore.ts) ----
const fsSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
check('updatePublicProfileName updates only displayName, validates the name', () => {
  assert.ok(fsSrc.includes('export async function updatePublicProfileName(uid: string, displayName: string): Promise<boolean>'), 'updatePublicProfileName নেই')
  assert.ok(fsSrc.includes("await updateDoc(doc(d, 'publicProfiles', uid), { displayName: name })"), 'শুধু displayName আপডেট হয় না')
  assert.ok(fsSrc.includes('name.length > 60'), 'নামের দৈর্ঘ্য যাচাই নেই')
})

// ---- ব্যান তালিকার config রাউন্ড-ট্রিপ (firestoreMapping.ts) ----
const mapOutFile = join(outDir, 'firestoreMapping.mjs')
await build({
  entryPoints: [join(root, 'src/firestoreMapping.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: mapOutFile,
  logLevel: 'silent',
})
const FM = await import(mapOutFile)
const rates = { piRateBDT: 100, usdtRateBDT: 120, piWithdrawFeePct: 1, datingRate: 0.1, liveRate: 0.05 }
const pays = { bkash: '01XXXXXXXXX', nagad: '', rocket: '', usdtBep20: '0xabc', usdtErc20: '', binancePayId: 'PICALL-1', piDepositAddress: 'GABC', piTestnetAddress: 'GTEST' }

check('toPublicConfig carries bannedUids (deduped, capped)', () => {
  const cfg = FM.toPublicConfig(rates, pays, '', undefined, undefined, ['u1', 'u2', 'u1', '', 'u3'])
  assert.deepEqual(cfg.bannedUids, ['u1', 'u2', 'u3'])
  const empty = FM.toPublicConfig(rates, pays)
  assert.deepEqual(empty.bannedUids, [])
})
check('fromPublicConfig parses bannedUids; empty array clears the ban', () => {
  assert.deepEqual(FM.fromPublicConfig({ bannedUids: ['u1', 'u2'] }).bannedUids, ['u1', 'u2'])
  assert.deepEqual(FM.fromPublicConfig({ bannedUids: [] }).bannedUids, [])
  assert.equal('bannedUids' in FM.fromPublicConfig({}), false)
  assert.equal('bannedUids' in FM.fromPublicConfig({ bannedUids: 'u1' }), false)
  assert.deepEqual(FM.fromPublicConfig({ bannedUids: ['u1', 42, null, 'u2'] }).bannedUids, ['u1', 'u2'])
})

// ---- স্টোর: ব্যান অবস্থা + অ্যাডমিন-শুধু সেটার ----
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
check('Store holds bannedUids, exposes isBanned, admin-only setBannedUids writes config', () => {
  assert.ok(storeSrc.includes("useState<string[]>(() => cleanUidList(load<string[]>('bannedUids', [])))"), 'bannedUids state নেই')
  assert.ok(storeSrc.includes("if (c.bannedUids !== undefined)"), 'applyPublicConfig-এ bannedUids নেই')
  assert.ok(storeSrc.includes('isBanned: !!uid && bannedUids.includes(uid)'), 'isBanned নেই')
  assert.ok(storeSrc.includes('setBannedUids: async (list) =>'), 'setBannedUids নেই')
  assert.ok(storeSrc.includes("if (!user || user.email.trim().toLowerCase() !== ADMIN_EMAIL) return false"), 'setBannedUids-এ অ্যাডমিন যাচাই নেই')
  assert.ok(storeSrc.includes('writePublicConfig(toPublicConfig('), 'setBannedUids config লেখে না')
})
check('Admin config writes never wipe the ban list', () => {
  const hits = storeSrc.split('adminSettings.ads, bannedUids)').length - 1
  assert.ok(hits >= 2, `toPublicConfig-এ bannedUids পাস হয় ${hits} জায়গায়, ২ জায়গায় হওয়ার কথা`)
  assert.ok(storeSrc.includes('adminSettings.ads, next)'), 'setBannedUids-এ নতুন তালিকা পাস হয় না')
})

// ---- অ্যাপ-স্তরের ব্যান গেট (App.tsx) ----
const appSrc = readFileSync(join(root, 'src/App.tsx'), 'utf8')
check('Banned users see a banned screen instead of the app', () => {
  assert.ok(appSrc.includes('function BannedScreen()'), 'BannedScreen নেই')
  assert.ok(appSrc.includes('Your account is banned'), 'ব্যান-বার্তা নেই')
  assert.ok(appSrc.includes('if (user && isBanned) return <BannedScreen />'), 'ব্যান গেট নেই')
})

// ---- Users ট্যাবে Edit + Ban UI ----
check('Users tab has inline edit (save/cancel) and Ban/Unban, never Ban on own row', () => {
  assert.ok(tabSrc.includes('✏️ Edit'), 'Edit বাটন নেই')
  assert.ok(tabSrc.includes('onClick={() => saveEditName(m)}'), 'Save বাটন saveEditName ডাকে না')
  assert.ok(tabSrc.includes('setEditingUid(null)'), 'Cancel নেই')
  assert.ok(tabSrc.includes('🚫 Ban') && tabSrc.includes('✅ Unban'), 'Ban/Unban বাটন নেই')
  assert.ok(tabSrc.includes('m.id !== uid'), 'নিজের সারিতে Ban বন্ধ করা হয়নি')
  assert.ok(tabSrc.includes('🚫 Banned'), 'ব্যান ব্যাজ নেই')
  assert.ok(pagesSrc.includes('updatePublicProfileName(m.id, name)'), 'এডিট সেভ updatePublicProfileName ডাকে না')
  assert.ok(pagesSrc.includes('setBannedUids(next)'), 'Ban/Unban setBannedUids ডাকে না')
  assert.ok(pagesSrc.includes('rules update may not be published yet'), 'নিয়ম publish না হলে সেভ-ভুলের কথা লেখা নেই')
})
check('Banned users cannot start calls or send chat messages', () => {
  assert.ok(pagesSrc.includes("if (isBanned) { setCallError('Your account is banned — calls are blocked.'); return }"), 'startCall-এ ব্যান গেট নেই')
  assert.ok(pagesSrc.includes("if (isBanned) { setBan('Your account is banned — messaging is blocked.'); return }"), 'চ্যাট send-এ ব্যান গেট নেই')
})

// ---- নিয়ম: অ্যাডমিন শুধু displayName/colour বদলাতে পারেন ----
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')
check('Rules let the admin update only displayName/colour on publicProfiles', () => {
  assert.ok(rulesSrc.includes("allow update: if isAdmin() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'colour']);"), 'অ্যাডমিন-এডিট নিয়ম নেই')
})

console.log(`\nAll ${passed} admin-users tests passed.`)
