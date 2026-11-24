// Groups & Pages test — real create/list/open/join/follow, no fake members.
// Run: node tests/groups.test.mjs
// (esbuild দিয়ে src/groups.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) ফর্ম যাচাই — গ্রুপের নাম/বিবরণ/প্রাইভেসি, পেজের নাম/ক্যাটাগরি/বিবরণ
//   ২) ডক ম্যাপিং — ভুল ডকে null, ভালো ডকে গ্রুপ/পেজ (মালিক প্রথম সদস্য)
//   ৩) সদস্য/ফলোয়ার গণনা — শুধু আসল UID থেকে, ভুয়া সদস্য নেই
//   ৪) লোকাল ক্যাশ মার্জ — Firestore জিতবে, লোকাল-শুধু এন্ট্রি থাকবে
//   ৫) UI স্ট্রিং — Create Group / Create Page ফর্ম, তালিকা, ডিটেইল ভিউ,
//      Join/Follow বোতাম, "posts coming" সৎ বার্তা, ভুয়া পোস্ট নেই
//   ৬) Firestore ফাংশন + নিয়ম — groups / pages কালেকশন
//   ৭) রুট — /groups তালিকা, /groups/:id ও /pages/:id ডিটেইল
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-groups-test-'))
const outFile = join(outDir, 'groups.mjs')
await build({
  entryPoints: [join(root, 'src/groups.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const G = await import(outFile)

const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const firestore = read('src/firestore.ts')
const rules = read('firestore.rules')
const app = read('src/App.tsx')

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

check('validateGroupInput: valid input passes; empty name / bad visibility rejected', () => {
  assert.equal(G.validateGroupInput({ name: 'Chattogram Book Lovers', description: 'We read together.', visibility: 'public' }), null)
  assert.equal(G.validateGroupInput({ name: 'Secret', description: '', visibility: 'private' }), null)
  assert.ok(G.validateGroupInput({ name: '   ', description: '', visibility: 'public' }))
  assert.ok(G.validateGroupInput({ name: 'x'.repeat(81), description: '', visibility: 'public' }))
  assert.ok(G.validateGroupInput({ name: 'G', description: 'x'.repeat(501), visibility: 'public' }))
  assert.ok(G.validateGroupInput({ name: 'G', description: '', visibility: 'open' }))
})

check('validatePageInput: valid input passes; empty name / long category rejected', () => {
  assert.equal(G.validatePageInput({ name: 'Jhuli BD', category: 'Bookstore', description: 'Bengali children books.' }), null)
  assert.ok(G.validatePageInput({ name: '   ', category: '', description: '' }))
  assert.ok(G.validatePageInput({ name: 'x'.repeat(81), category: '', description: '' }))
  assert.ok(G.validatePageInput({ name: 'P', category: 'x'.repeat(41), description: '' }))
})

check('mapGroupDoc: bad doc -> null; good doc -> group, owner is first member', () => {
  assert.equal(G.mapGroupDoc('g1', {}), null)
  assert.equal(G.mapGroupDoc('g1', { name: 'G', ownerUid: 'u1' }), null) // no ownerName
  const g = G.mapGroupDoc('g1', { ownerUid: 'u1', ownerName: 'A', name: 'G', description: 'D', visibility: 'private', memberUids: [], createdAtMs: 5 })
  assert.ok(g)
  assert.equal(g?.visibility, 'private')
  assert.deepEqual(g?.memberUids, ['u1'])
  assert.equal(G.memberCount(g), 1)
  assert.ok(G.isMember(g, 'u1'))
  assert.ok(!G.isMember(g, 'u2'))
})

check('mapPageDoc: bad doc -> null; good doc -> page with follower count', () => {
  assert.equal(G.mapPageDoc('p1', {}), null)
  const p = G.mapPageDoc('p1', { ownerUid: 'u1', ownerName: 'A', name: 'P', category: 'Bookstore', description: 'D', followerUids: ['u1', 'u2'], createdAtMs: 5 })
  assert.ok(p)
  assert.equal(G.followerCount(p), 2)
  assert.ok(G.isFollower(p, 'u2'))
  assert.ok(!G.isFollower(p, 'u9'))
})

check('mergeGroupLists / mergePageLists: Firestore wins per id, local-only kept', () => {
  const local = [{ id: 'g1', ownerUid: 'u', ownerName: 'A', name: 'Local', description: '', visibility: 'public', memberUids: ['u'], createdAtMs: 10 }]
  const remote = [{ id: 'g1', ownerUid: 'u', ownerName: 'A', name: 'Remote', description: '', visibility: 'public', memberUids: ['u', 'u2'], createdAtMs: 20 }]
  const merged = G.mergeGroupLists(local, remote)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].name, 'Remote')
  assert.equal(G.memberCount(merged[0]), 2)
  const pages_merged = G.mergePageLists([], [{ id: 'p1', ownerUid: 'u', ownerName: 'A', name: 'P', category: '', description: '', followerUids: [], createdAtMs: 1 }])
  assert.equal(pages_merged.length, 1)
})

check('pages.tsx: GroupsPage — Create Group + Create Page forms, lists', () => {
  assert.ok(pages.includes('export function GroupsPage()'), 'GroupsPage নেই')
  assert.ok(pages.includes('Create Group'), 'Create Group ফর্ম নেই')
  assert.ok(pages.includes('Create Page'), 'Create Page ফর্ম নেই')
  assert.ok(pages.includes('Public — anyone can join'), 'পাবলিক অপশন নেই')
  assert.ok(pages.includes('Private — members join by owner'), 'প্রাইভেট অপশন নেই')
  assert.ok(pages.includes('createGroupDoc('), 'createGroupDoc কল নেই')
  assert.ok(pages.includes('createPageDoc('), 'createPageDoc কল নেই')
  assert.ok(pages.includes('No groups yet'), 'খালি গ্রুপ বার্তা নেই')
  assert.ok(pages.includes('No pages yet'), 'খালি পেজ বার্তা নেই')
  // placeholder "No groups or pages yet." must be gone
  assert.ok(!pages.includes('No groups or pages yet.'), 'পুরোনো placeholder এখনো আছে')
})

check('pages.tsx: GroupDetailPage — open, Join/Follow, honest posts-coming note, no fake posts', () => {
  assert.ok(pages.includes('export function GroupDetailPage()'), 'GroupDetailPage নেই')
  assert.ok(pages.includes('Join Group'), 'Join বোতাম নেই')
  assert.ok(pages.includes('Leave Group'), 'Leave বোতাম নেই')
  assert.ok(pages.includes('Follow'), 'Follow বোতাম নেই')
  assert.ok(pages.includes('joinGroup('), 'joinGroup কল নেই')
  assert.ok(pages.includes('followPage('), 'followPage কল নেই')
  assert.ok(pages.includes('posts are coming'), 'posts coming বার্তা নেই')
  const start = pages.indexOf('export function GroupDetailPage()')
  const body = pages.slice(start, pages.indexOf('export function ', start + 1))
  assert.ok(!/demo|fake|sample post/i.test(body), 'ডিটেইল ভিউতে ভুয়া পোস্ট/ডেমো আছে')
})

check('firestore.ts: groups/pages functions exist', () => {
  for (const f of ['fetchGroups', 'fetchGroup', 'subscribeGroups', 'createGroupDoc', 'joinGroup', 'leaveGroup', 'fetchPages', 'fetchPage', 'subscribePages', 'createPageDoc', 'followPage', 'unfollowPage']) {
    assert.ok(firestore.includes(`export async function ${f}`) || firestore.includes(`export function ${f}`), `${f} নেই`)
  }
  assert.ok(firestore.includes('memberUids: [data.ownerUid]'), 'গ্রুপ তৈরিতে মালিক প্রথম সদস্য নয়')
  assert.ok(firestore.includes('arrayUnion(uid)'), 'join/follow arrayUnion নেই')
})

check('firestore.rules: groups/pages — read signed-in, create own only, join/follow own uid only', () => {
  for (const coll of ['groups', 'pages']) {
    const start = rules.indexOf(`match /${coll}/{`)
    assert.ok(start !== -1, `${coll} নিয়ম নেই`)
    const body = rules.slice(start, rules.indexOf('match /', start + 1))
    assert.ok(body.includes('allow read: if isSignedIn()'), `${coll} পড়া নিয়ম নেই`)
    assert.ok(body.includes('ownerUid == request.auth.uid'), `${coll} create-এ মালিক শর্ত নেই`)
    assert.ok(body.includes('allow delete: if false'), `${coll} মোছা বন্ধ নেই`)
  }
  assert.ok(rules.includes('memberUids'), 'groups নিয়মে memberUids নেই')
  assert.ok(rules.includes('followerUids'), 'pages নিয়মে followerUids নেই')
})

check('App.tsx: /groups list, /groups/:id and /pages/:id detail routes', () => {
  assert.ok(app.includes('<Route path="/groups" element={<GroupsPage />} />'), '/groups রুট নেই')
  assert.ok(app.includes('<Route path="/groups/:id" element={<GroupDetailPage />} />'), '/groups/:id রুট নেই')
  assert.ok(app.includes('<Route path="/pages/:id" element={<GroupDetailPage />} />'), '/pages/:id রুট নেই')
})

console.log(`\ngroups.test.mjs: ${n} checks run`)
