// আসল (Firebase) চ্যাটের সিঙ্ক-পথ + ChatPage লেআউট টেস্ট।
// চালানো: রিপো রুট থেকে `node tests/chat-sync.test.mjs`
// (firestore.ts ব্রাউজার-বান্ডল করে Node-এ চালায় — Firebase env ছাড়া getDb()
//  null ফেরে, তাই লাইভ Firebase ছাড়াই সিঙ্ক-ব্যর্থতার পথটা যাচাই করা যায়;
//  pages.tsx / firestore.rules সোর্স পড়ে ChatPage-র আচরণ যাচাই করে।)
// যাচাই করে:
//   ১) রুমের চাবি দুই দিক থেকে একই (chatRoomId), সদস্য বের করা যায়
//   ২) Firebase না থাকলে পাঠানো/শোনা দুটোই ব্যর্থ হয় (false/null) —
//      চুপচাপ লোকাল-অনলি হয়ে যায় না, ChatPage-তে চিহ্ন দেখায়
//   ৩) ডেটিং ম্যাচ থেকে চ্যাট খুললে ম্যাচটা বন্ধু হিসেবে যোগ হয় (নইলে roomId null)
//   ৪) আমার রুমগুলোর সাবস্ক্রিপশন আছে — প্রাপক রুম খুঁজে পায়
//   ৫) চ্যাট খুললে শুধু সেই চ্যাটটাই পূর্ণ পর্দায় দেখায় (পাশে/উপরে তালিকা নেই),
//      "All chats"-এ ফিরলে তালিকা দেখায়
//   ৬) সিঙ্ক-ব্যর্থতার ব্যানার + "Only on this device" চিহ্ন আছে
//   ৭) chats/{roomId} সূচক ডকের নিয়ম আছে (শুধু দুই সদস্য)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')
const chatSrc = pagesSrc.slice(pagesSrc.indexOf('export function ChatPage()'))
const chatPage = chatSrc.slice(0, chatSrc.indexOf('// ---------- ডেটিং KYC'))

const outDir = mkdtempSync(join(tmpdir(), 'picall-chat-sync-test-'))
const outFile = join(outDir, 'firestore.mjs')
await build({
  entryPoints: [join(root, 'src/firestore.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: outFile,
  logLevel: 'silent',
})
const FS = await import(outFile)

let passed = 0
function check(name, fn) {
  const r = fn()
  if (r && typeof r.then === 'function') return r.then(() => { passed++; console.log(`ok ${passed} - ${name}`) })
  passed++
  console.log(`ok ${passed} - ${name}`)
}

await check('রুমের চাবি দুই দিক থেকে একই, সদস্য বের করা যায়', () => {
  assert.equal(FS.chatRoomId('uidB', 'uidA'), FS.chatRoomId('uidA', 'uidB'))
  assert.equal(FS.chatRoomId('uidA', 'uidB'), 'uidA_uidB')
  assert.deepEqual(FS.chatRoomMembers('uidA_uidB'), ['uidA', 'uidB'])
  assert.equal(FS.otherRoomMember('uidA_uidB', 'uidA'), 'uidB')
  assert.equal(FS.otherRoomMember('uidA_uidB', 'uidB'), 'uidA')
  assert.equal(FS.otherRoomMember('uidA_uidB', 'uidX'), null)
  assert.equal(FS.chatRoomMembers('nonsense'), null)
})

await check('Firebase না থাকলে পাঠানো ব্যর্থ হয় (false) — লোকাল-অনলি', async () => {
  assert.equal(FS.getDb(), null)
  assert.equal(await FS.sendChatMessage('uidA_uidB', 'uidA', 'A', 'hello'), false)
})

await check('Firebase না থাকলে শোনার সাবস্ক্রিপশন নেই (null) — কিছুই আসে না', () => {
  assert.equal(FS.subscribeChatMessages('uidA_uidB', () => {}), null)
  assert.equal(FS.subscribeMyChatRooms('uidA', () => {}), null)
})

check('ডেটিং ম্যাচ থেকে চ্যাট খুললে ম্যাচটা বন্ধু হিসেবে যোগ হয়', () => {
  assert.ok(chatPage.includes('datingPartnerId'), 'datingPartnerId নেই')
  assert.ok(/addFriend\(\{ id: st\.datingPartnerId/.test(chatPage), 'ম্যাচকে addFriend করা হয় না — roomId null থাকবে')
})

check('আমার রুমগুলোর সাবস্ক্রিপশন আছে — প্রাপক রুম খুঁজে পায়', () => {
  assert.ok(chatPage.includes('subscribeMyChatRooms(uid'), 'subscribeMyChatRooms ডাকা হয় না')
  assert.ok(chatPage.includes('New chats'), '"New chats" তালিকা নেই')
  assert.ok(/openIncoming/.test(chatPage), 'incoming রুম খোলার পথ নেই')
})

check('চ্যাট খুললে শুধু সেই চ্যাটটাই পূর্ণ পর্দায় — পাশে/উপরে তালিকা নেই', () => {
  assert.ok(!chatPage.includes('grid md:grid-cols-3'), 'আগের side-by-side গ্রিড এখনো আছে')
  assert.ok(!chatPage.includes('md:col-span-1'), 'আগের তালিকার কলাম এখনো আছে')
  assert.ok(!chatPage.includes('md:col-span-2'), 'আগের চ্যাটের কলাম এখনো আছে')
  assert.ok(chatPage.includes('← All chats'), '"All chats"-এ ফেরার বোতাম নেই')
  assert.ok(chatPage.includes('setShowList(false)'), 'চ্যাট খুললে তালিকা লুকায় না')
  assert.ok(chatPage.includes('if (showList)'), 'তালিকা/চ্যাট আলাদা ভিউ নেই')
})

check('সিঙ্ক-ব্যর্থতার ব্যানার আছে — চুপচাপ লোকাল-অনলি নয়', () => {
  assert.ok(chatPage.includes('stay on this device only'), 'সিঙ্ক-ব্যর্থতার ব্যানার নেই')
  assert.ok(chatPage.includes('log in with Google or an email link'), 'OTP লগইনে কী করতে হবে লেখা নেই')
  assert.ok(chatPage.includes('could not be sent'), 'পাঠানো-ব্যর্থতার ব্যানার নেই')
  assert.ok(chatPage.includes('Only on this device — not sent'), 'লোকাল-অনলি মেসেজের চিহ্ন নেই')
})

check('chats/{roomId} সূচক ডকের নিয়ম আছে — শুধু দুই সদস্য', () => {
  assert.ok(rulesSrc.includes('match /chats/{roomId}'), 'রুম ডকের নিয়ম নেই')
  assert.ok(/match \/chats\/\{roomId\}[\s\S]{0,600}request\.auth\.uid in request\.resource\.data\.members/.test(rulesSrc), 'members যাচাই নেই')
})

console.log(`\n${passed}/8 passed`)
