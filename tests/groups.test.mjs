// Groups & Pages test — real create/list/open/join/follow, no fake members.
// Run: node tests/groups.test.mjs
// (esbuild দিয়ে src/groups.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) ফর্ম যাচাই — গ্রুপের নাম/বিবরণ/প্রাইভেসি, পেজের নাম/ক্যাটাগরি/বিবরণ
//   ২) ডক ম্যাপিং — ভুল ডকে null, ভালো ডকে গ্রুপ/পেজ (মালিক প্রথম সদস্য)
//   ৩) সদস্য/ফলোয়ার গণনা — শুধু আসল UID থেকে, ভুয়া সদস্য নেই
//   ৪) লোকাল ক্যাশ মার্জ — Firestore জিতবে, লোকাল-শুধু এন্ট্রি থাকবে
//   ৫) UI স্ট্রিং — Create Group / Create Page ফর্ম, তালিকা, ডিটেইল ভিউ,
//      Join/Follow বোতাম, সদস্য যোগ করা, গ্রুপ/পেজ পোস্ট কম্পোজার,
//      ভুয়া পোস্ট নেই — "posts are coming" placeholder আর নেই
//   ৬) Firestore ফাংশন + নিয়ম — groups / pages কালেকশন, সদস্য যোগ/বাদ,
//      গ্রুপ/পেজ পোস্ট সাবকালেকশন
//   ৭) রুট — /groups তালিকা, /groups/:id ও /pages/:id ডিটেইল
//   ৮) পোস্ট যাচাই — খালি/লম্বা পোস্ট বাতিল, অন্য চ্যাট অ্যাপের লিংক
//      (wa.me, WhatsApp, Telegram, imo, Messenger, ফোন নম্বর) বাতিল
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

check('pages.tsx: GroupDetailPage — open, Join/Follow, member add + group posts, page posts', () => {
  assert.ok(pages.includes('export function GroupDetailPage()'), 'GroupDetailPage নেই')
  assert.ok(pages.includes('Join Group'), 'Join বোতাম নেই')
  assert.ok(pages.includes('Leave Group'), 'Leave বোতাম নেই')
  assert.ok(pages.includes('Follow'), 'Follow বোতাম নেই')
  assert.ok(pages.includes('joinGroup('), 'joinGroup কল নেই')
  assert.ok(pages.includes('followPage('), 'followPage কল নেই')
  assert.ok(pages.includes('Add members'), 'Add members সেকশন নেই')
  assert.ok(pages.includes('Search users by name'), 'সদস্য খোঁজার ইনপুট নেই')
  assert.ok(pages.includes('addGroupMember('), 'addGroupMember কল নেই')
  assert.ok(pages.includes('removeGroupMember('), 'removeGroupMember কল নেই')
  assert.ok(pages.includes('Share something with the group'), 'গ্রুপ পোস্ট কম্পোজার নেই')
  assert.ok(pages.includes('Share something on your page'), 'পেজ পোস্ট কম্পোজার নেই')
  assert.ok(pages.includes('Join the group to post.'), 'Join-to-post বার্তা নেই')
  assert.ok(pages.includes('No posts yet'), 'খালি পোস্ট বার্তা নেই')
  assert.ok(pages.includes('createGroupPostDoc('), 'createGroupPostDoc কল নেই')
  assert.ok(pages.includes('createPagePostDoc('), 'createPagePostDoc কল নেই')
  // "posts are coming" placeholder must be gone — posts are real now
  assert.ok(!pages.includes('posts are coming'), '"posts are coming" placeholder এখনো আছে')
  const start = pages.indexOf('export function GroupDetailPage()')
  const body = pages.slice(start, pages.indexOf('export function ', start + 1))
  assert.ok(!/demo|fake|sample post/i.test(body), 'ডিটেইল ভিউতে ভুয়া পোস্ট/ডেমো আছে')
})

check('firestore.ts: groups/pages functions exist', () => {
  for (const f of ['fetchGroups', 'fetchGroup', 'subscribeGroups', 'createGroupDoc', 'joinGroup', 'leaveGroup', 'addGroupMember', 'removeGroupMember', 'fetchGroupPosts', 'subscribeGroupPosts', 'createGroupPostDoc', 'fetchPages', 'fetchPage', 'subscribePages', 'createPageDoc', 'followPage', 'unfollowPage', 'fetchPagePosts', 'subscribePagePosts', 'createPagePostDoc']) {
    assert.ok(firestore.includes(`export async function ${f}`) || firestore.includes(`export function ${f}`), `${f} নেই`)
  }
  assert.ok(firestore.includes('memberUids: [data.ownerUid]'), 'গ্রুপ তৈরিতে মালিক প্রথম সদস্য নয়')
  assert.ok(firestore.includes('arrayUnion(uid)'), 'join/follow arrayUnion নেই')
  assert.ok(firestore.includes("collection(d, 'groups', groupId, 'posts')"), 'গ্রুপ পোস্ট সাবকালেকশন নেই')
  assert.ok(firestore.includes("collection(d, 'pages', pageId, 'posts')"), 'পেজ পোস্ট সাবকালেকশন নেই')
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

check('validateGroupPost / validatePagePost: empty/long rejected; off-platform links blocked with the exact message', () => {
  assert.equal(G.validateGroupPost('Hello group, welcome!'), null)
  assert.equal(G.validatePagePost('New books are here.'), null)
  assert.ok(G.validateGroupPost('   '))
  assert.ok(G.validateGroupPost('x'.repeat(1001)))
  assert.equal(G.validateGroupPost('Chat with me on wa.me/8801XXXXXXXXX'), 'Links to other chat apps are not allowed in groups.')
  assert.equal(G.validateGroupPost('Join my telegram t.me/mygroup'), 'Links to other chat apps are not allowed in groups.')
  assert.equal(G.validateGroupPost('Message me on imo.im/abc'), 'Links to other chat apps are not allowed in groups.')
  assert.equal(G.validateGroupPost('Find me on messenger.com/t/abc'), 'Links to other chat apps are not allowed in groups.')
  assert.equal(G.validateGroupPost('My number is 01712345678, call me'), 'Links to other chat apps are not allowed in groups.')
  assert.equal(G.validatePagePost('WhatsApp me: whatsapp.com/abc'), 'Links to other chat apps are not allowed on pages.')
  assert.equal(G.validatePagePost('m.me/mypage'), 'Links to other chat apps are not allowed on pages.')
  // ordinary links and numbers that are not contact invites pass
  assert.equal(G.validateGroupPost('See our site picallbd.web.app for details'), null)
  assert.equal(G.validateGroupPost('We meet on 24 November 2026'), null)
})

check('hasOffPlatformContactLink: domains + phone invites blocked, plain text passes', () => {
  assert.ok(G.hasOffPlatformContactLink('wa.me/123'))
  assert.ok(G.hasOffPlatformContactLink('https://whatsapp.com/channel/abc'))
  assert.ok(G.hasOffPlatformContactLink('t.me/x'))
  assert.ok(G.hasOffPlatformContactLink('telegram.me/x'))
  assert.ok(G.hasOffPlatformContactLink('imo.im/x'))
  assert.ok(G.hasOffPlatformContactLink('messenger.com/t/x'))
  assert.ok(G.hasOffPlatformContactLink('fb.com/me'))
  assert.ok(G.hasOffPlatformContactLink('m.me/x'))
  assert.ok(G.hasOffPlatformContactLink('call 01812345678'))
  assert.ok(!G.hasOffPlatformContactLink('Hello everyone, welcome to the group!'))
  assert.ok(!G.hasOffPlatformContactLink('Our next meetup is on Friday at 5pm'))
})

check('mapGroupPostDoc / mapPagePostDoc: bad doc -> null; good doc -> post', () => {
  assert.equal(G.mapGroupPostDoc('p1', {}), null)
  assert.equal(G.mapGroupPostDoc('p1', { authorUid: 'u1', authorName: 'A' }), null) // no text
  const gp = G.mapGroupPostDoc('p1', { authorUid: 'u1', authorName: 'Asha', text: 'Hello!', createdAtMs: 7 })
  assert.ok(gp)
  assert.equal(gp?.authorName, 'Asha')
  assert.equal(gp?.text, 'Hello!')
  assert.equal(gp?.createdAtMs, 7)
  const pp = G.mapPagePostDoc('p2', { authorUid: 'u2', authorName: 'Rahim', text: 'Sale today', createdAtMs: 9 })
  assert.ok(pp)
  assert.equal(pp?.text, 'Sale today')
  assert.deepEqual(G.mergeGroupPostLists([], [gp]), [gp])
  assert.deepEqual(G.mergePagePostLists([], [pp]), [pp])
})

check('firestore.rules: group/page posts subcollections — read signed-in, write author-only member/owner', () => {
  const gStart = rules.indexOf('match /groups/{groupId}/posts/{postId}')
  assert.ok(gStart !== -1, 'গ্রুপ পোস্ট নিয়ম নেই')
  const gBody = rules.slice(gStart, rules.indexOf('match /', gStart + 1))
  assert.ok(gBody.includes('allow read: if isSignedIn()'), 'গ্রুপ পোস্ট পড়া নিয়ম নেই')
  assert.ok(gBody.includes('authorUid == request.auth.uid'), 'গ্রুপ পোস্ট লেখায় authorUid শর্ত নেই')
  assert.ok(gBody.includes('memberUids'), 'গ্রুপ পোস্ট নিয়মে সদস্য শর্ত নেই')
  assert.ok(gBody.includes('allow update, delete: if false'), 'গ্রুপ পোস্ট বদলানো/মোছা বন্ধ নেই')
  const pStart = rules.indexOf('match /pages/{pageId}/posts/{postId}')
  assert.ok(pStart !== -1, 'পেজ পোস্ট নিয়ম নেই')
  const pBody = rules.slice(pStart, rules.indexOf('match /', pStart + 1))
  assert.ok(pBody.includes('allow read: if isSignedIn()'), 'পেজ পোস্ট পড়া নিয়ম নেই')
  assert.ok(pBody.includes('authorUid == request.auth.uid'), 'পেজ পোস্ট লেখায় authorUid শর্ত নেই')
  assert.ok(pBody.includes('ownerUid == request.auth.uid'), 'পেজ পোস্ট নিয়মে মালিক শর্ত নেই')
  assert.ok(pBody.includes('allow update, delete: if false'), 'পেজ পোস্ট বদলানো/মোছা বন্ধ নেই')
})

check('App.tsx: /groups list, /groups/:id and /pages/:id detail routes', () => {
  assert.ok(app.includes('<Route path="/groups" element={<GroupsPage />} />'), '/groups রুট নেই')
  assert.ok(app.includes('<Route path="/groups/:id" element={<GroupDetailPage />} />'), '/groups/:id রুট নেই')
  assert.ok(app.includes('<Route path="/pages/:id" element={<GroupDetailPage />} />'), '/pages/:id রুট নেই')
})

console.log(`\ngroups.test.mjs: ${n} checks run`)
