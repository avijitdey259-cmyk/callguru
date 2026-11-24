// ইউজার ব্লক টেস্ট — যেকোনো ব্যবহারকারী অন্য যেকোনো ব্যবহারকারীকে
// মেসেজ + কল থেকে ব্লক করতে পারেন (মালিকের নির্দেশ ২০২৬-১১-২৪)।
// চালানো: রিপো রুট থেকে `node tests/block-user.test.mjs`
// (esbuild দিয়ে src/blocking.ts + src/incomingCall.ts বান্ডল করে Node-এ
// চালায় — নেটওয়ার্ক/Firebase ডাকা হয় না; pages.tsx/store.tsx সোর্স পড়ে।)
// যাচাই করে:
//   ১) বিশুদ্ধ ফাংশন: cleanUidList / isBlockedBy / blockRoomId /
//      filterBlockedRooms / filterBlockedMessages
//   ২) ইনকামিং-কল গেট: ব্লক করা কলকারীর ইনভাইট ওঠে না (reason 'blocked')
//   ৩) UI ওয়্যারিং (সোর্স): চ্যাটে Call + Block/Unblock, Friends-এ Block,
//      Menu-তে Blocked users তালিকা, CallPage-এ কল শুরুর আগে ব্লক চেক,
//      store-এ setRoomBlocked, firestore-এ blockedBy
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-block-test-'))
const read = (p) => readFileSync(join(root, p), 'utf8')

async function loadModule(entry) {
  // Firebase SDK-এর আসল কোড বান্ডলে ঢুকলে @grpc/grpc-js-এর dynamic
  // require ভাঙে, আর external করলে /tmp থেকে node_modules মেলে না — তাই
  // Firebase মডিউলগুলোকে ডামি স্টাবে বদলে বান্ডল করা হয়। টেস্টে আসল
  // Firestore ছোঁয়াই হয় না (শুধু blockRoomId → chatRoomId, বিশুদ্ধ ফাংশন)।
  const stubDir = join(outDir, 'stubs')
  await import('node:fs').then(fs => fs.mkdirSync(stubDir, { recursive: true }))
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(stubDir, 'firebase-app.mjs'), 'export const initializeApp = () => null\n')
  writeFileSync(join(stubDir, 'firebase-auth.mjs'), 'export class GoogleAuthProvider {}\nexport const getAuth = () => null\nexport const signInWithPopup = async () => null\nexport const getAdditionalUserInfo = () => null\nexport const sendSignInLinkToEmail = async () => null\nexport const signInWithEmailLink = async () => null\nexport const isSignInWithEmailLink = () => false\nexport const createUserWithEmailAndPassword = async () => null\nexport const signInWithEmailAndPassword = async () => null\nexport const sendPasswordResetEmail = async () => null\nexport const updateProfile = async () => null\nexport const onAuthStateChanged = () => () => {}\n')
  writeFileSync(join(stubDir, 'firebase-firestore.mjs'), 'export const getFirestore = () => null\nexport const doc = () => null\nexport const getDoc = async () => null\nexport const setDoc = async () => null\nexport const updateDoc = async () => null\nexport const collection = () => null\nexport const query = () => null\nexport const where = () => null\nexport const getDocs = async () => null\nexport const orderBy = () => null\nexport const limit = () => null\nexport const serverTimestamp = () => null\nexport const addDoc = async () => null\nexport const onSnapshot = () => () => {}\nexport const deleteField = () => null\nexport const increment = () => null\nexport const arrayUnion = (...a) => a\nexport const arrayRemove = (...a) => a\nexport const runTransaction = async () => null\n')
  const outFile = join(outDir, entry.replace(/[^a-z]/gi, '') + '.mjs')
  await build({
    entryPoints: [join(root, 'src', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outFile,
    logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_URL': '""' },
    alias: {
      'firebase/app': join(stubDir, 'firebase-app.mjs'),
      'firebase/auth': join(stubDir, 'firebase-auth.mjs'),
      'firebase/firestore': join(stubDir, 'firebase-firestore.mjs'),
    },
  })
  return import(outFile)
}

const BL = await loadModule('blocking.ts')
const IC = await loadModule('incomingCall.ts')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

// ---- বিশুদ্ধ ফাংশন ----
check('cleanUidList: ভুল মান বাদ, ডুপ্লিকেট বাদ, সর্বোচ্চ ২০০', () => {
  assert.deepEqual(BL.cleanUidList(null), [])
  assert.deepEqual(BL.cleanUidList('uid'), [])
  assert.deepEqual(BL.cleanUidList(['a', 'b', 'a', '', '   ', 7, null]), ['a', 'b'])
  assert.equal(BL.cleanUidList(Array.from({ length: 250 }, (_, i) => 'u' + i)).length, 200)
})

check('isBlockedBy: blockedBy তালিকায় UID থাকলেই ব্লক', () => {
  assert.equal(BL.isBlockedBy(['u1', 'u2'], 'u2'), true)
  assert.equal(BL.isBlockedBy(['u1'], 'u2'), false)
  assert.equal(BL.isBlockedBy(undefined, 'u2'), false)
  assert.equal(BL.isBlockedBy('u2', 'u2'), false)
})

check('blockRoomId: দুই দিক থেকে একই রুম (সাজানো জোড়া)', () => {
  assert.equal(BL.blockRoomId('aaa', 'zzz'), BL.blockRoomId('zzz', 'aaa'))
  assert.notEqual(BL.blockRoomId('aaa', 'zzz'), BL.blockRoomId('aaa', 'yyy'))
})

check('filterBlockedRooms: ব্লক করা পাঠকের রুম বাদ, বাকি থাকে', () => {
  const rooms = [{ otherUid: 'a' }, { otherUid: 'b' }, { otherUid: 'c' }]
  assert.deepEqual(BL.filterBlockedRooms(rooms, ['b']), [{ otherUid: 'a' }, { otherUid: 'c' }])
  assert.deepEqual(BL.filterBlockedRooms(rooms, []), rooms)
})

check('filterBlockedMessages: ব্লক করা পাঠকের নতুন মেসেজ বাদ, পুরোনো ইতিহাস নয়', () => {
  const msgs = [{ fromUid: 'a', text: 'hi' }, { fromUid: 'b', text: 'hey' }]
  assert.deepEqual(BL.filterBlockedMessages(msgs, ['b']), [{ fromUid: 'a', text: 'hi' }])
  assert.deepEqual(BL.filterBlockedMessages(msgs, []), msgs)
})

// ---- ইনকামিং-কল গেট ----
check('shouldShowInvite: ব্লক করা কলকারীর ইনভাইট ওঠে না', () => {
  const invite = { code: 'ABC123', fromId: 'caller1', fromName: 'Caller', kind: 'friend' }
  const base = { privacy: 'everyone', isFriend: true, inCall: false, selfId: 'me' }
  const blocked = IC.shouldShowInvite(invite, { ...base, isBlocked: true })
  assert.equal(blocked.show, false)
  assert.equal(blocked.reason, 'blocked')
  const allowed = IC.shouldShowInvite(invite, { ...base, isBlocked: false })
  assert.equal(allowed.show, true)
  assert.equal(allowed.reason, 'ok')
})

// ---- UI ওয়্যারিং (সোর্স) ----
const pages = read('src/pages.tsx')
const store = read('src/store.tsx')
const firestore = read('src/firestore.ts')

check('ChatPage: খোলা চ্যাটে Call + Block/Unblock বোতাম', () => {
  const start = pages.indexOf('export function ChatPage()')
  const end = pages.indexOf('// ---------- ডেটিং KYC', start)
  const body = pages.slice(start, end)
  assert.ok(body.includes("navigate(`/call/friend/${encodeURIComponent(active)}`)"), 'চ্যাটে Call বোতাম নেই')
  assert.ok(body.includes("navigate(`/call/friend/${encodeURIComponent(f.name)}`)"), 'চ্যাট তালিকায় Call বোতাম নেই')
  assert.ok(body.includes('🚫 Block'), 'Block বোতাম নেই')
  assert.ok(body.includes('Unblock'), 'Unblock বোতাম নেই')
  assert.ok(body.includes('blockedUids'), 'blockedUids পড়া নেই')
})

check('ChatPage: ব্লক করা চ্যাটে মেসেজ পাঠানো আটকায়', () => {
  const start = pages.indexOf('export function ChatPage()')
  const end = pages.indexOf('// ---------- ডেটিং KYC', start)
  const body = pages.slice(start, end)
  assert.ok(body.includes('if (iBlockedThem || blockedByThem) return'), 'send()-এ ব্লক গার্ড নেই')
  assert.ok(body.includes('filterBlockedMessages'), 'নতুন মেসেজে ব্লক ফিল্টার নেই')
  assert.ok(body.includes('filterBlockedRooms'), 'ইনকামিং রুমে ব্লক ফিল্টার নেই')
})

check('FriendsPage: আসল বন্ধুর পাশে Block/Unblock', () => {
  const start = pages.indexOf('export function FriendsPage()')
  const end = pages.indexOf('export function ChatPage()', start)
  const body = pages.slice(start, end)
  assert.ok(body.includes('🚫 Block'), 'Friends-এ Block নেই')
  assert.ok(body.includes('Unblock'), 'Friends-এ Unblock নেই')
  assert.ok(body.includes('isBuddyId(f.id)'), 'পারসোনাদের Block বাদ দেওয়া নেই')
})

check('MenuPage: Blocked users তালিকা + Unblock', () => {
  const start = pages.indexOf('export function MenuPage()')
  const body = pages.slice(start)
  assert.ok(body.includes('🚫 Blocked users'), 'Blocked users কার্ড নেই')
  assert.ok(body.includes('No blocked users.'), 'খালি অবস্থা নেই')
  assert.ok(body.includes('unblockUser'), 'Unblock ওয়্যারিং নেই')
})

check('CallPage: কল শুরুর আগে ব্লক চেক (শেয়ার করা রুম ডক)', () => {
  const start = pages.indexOf('export function CallPage()')
  const end = pages.indexOf('// ---------- Wallet ----------', start)
  const body = pages.slice(start, end)
  assert.ok(body.includes('fetchChatRoomDoc'), 'রুম ডক পড়া নেই')
  assert.ok(body.includes("room?.blockedBy?.includes(peerUid)"), 'blockedBy চেক নেই')
  assert.ok(body.includes('This user is not accepting calls from you right now.'), 'ব্লক বার্তা নেই')
})

check('store + firestore: ব্লক দুই জায়গায় লেখা হয়, নিয়ম বদল লাগে না', () => {
  assert.ok(store.includes('blockUser'), 'store-এ blockUser নেই')
  assert.ok(store.includes('unblockUser'), 'store-এ unblockUser নেই')
  assert.ok(store.includes('setRoomBlocked'), 'store-এ setRoomBlocked ডাক নেই')
  assert.ok(store.includes('blockedUids'), 'store-এ blockedUids নেই')
  assert.ok(firestore.includes('setRoomBlocked'), 'firestore-এ setRoomBlocked নেই')
  assert.ok(firestore.includes('blockedBy'), 'firestore-এ blockedBy নেই')
  assert.ok(firestore.includes('fetchChatRoomDoc'), 'firestore-এ fetchChatRoomDoc নেই')
})

check('CallPage: আমি ব্লক করলেও কল শুরু হয় না (দুই দিকেই বন্ধ)', () => {
  const start = pages.indexOf('export function CallPage()')
  const end = pages.indexOf('// ---------- Wallet ----------', start)
  const body = pages.slice(start, end)
  assert.ok(body.includes('blockedUids.includes(peerUid)'), 'আমি-ব্লক-করেছি চেক নেই')
  assert.ok(body.includes('You have blocked this user — unblock them to call.'), 'আমি-ব্লক-করেছি বার্তা নেই')
})

check('FriendsPage + ChatPage: ব্লক করা বন্ধুর পাশে Call বোতাম লুকানো', () => {
  const fStart = pages.indexOf('export function FriendsPage()')
  const fEnd = pages.indexOf('export function ChatPage()', fStart)
  const friendsBody = pages.slice(fStart, fEnd)
  assert.ok(friendsBody.includes('!blockedUids.includes(f.id) && <Btn variant="green"'), 'Friends-এ ব্লক করা বন্ধুর Call লুকানো নেই')
  const cStart = pages.indexOf('export function ChatPage()')
  const chatBody = pages.slice(cStart)
  assert.ok(chatBody.includes('!blockedUids.includes(f.id)'), 'চ্যাট তালিকায় ব্লক চেক নেই')
})

check('MenuPage: ব্লক কপি — ব্লক করা পক্ষ বুঝতে পারে', () => {
  const start = pages.indexOf('export function MenuPage()')
  const body = pages.slice(start)
  assert.ok(!body.includes('They cannot see that they are blocked'), 'ভুল কপি এখনো আছে')
  assert.ok(body.includes('They will see that you are not accepting messages or calls from them right now.'), 'সঠিক কপি নেই')
})

console.log(`\n${passed}/15 passed`)
