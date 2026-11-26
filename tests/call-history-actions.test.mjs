// কল হিস্ট্রি থেকে সরাসরি Call + Chat — প্রতিটা এন্ট্রিতে দুটো বোতাম।
// চালানো: রিপো রুট থেকে `node tests/call-history-actions.test.mjs`
// (পেজ/স্টোরের গঠন সোর্স পড়ে যাচাই করে — React/Firebase লাগে না;
//  রাউটিং নিয়মটা pure ফাংশন হিসেবে এখানেই যাচাই করা হয়, আর সোর্সে
//  একই নিয়ম আছে কি না মিলিয়ে দেখা হয়।)
// যাচাই করে:
//   ১) প্রতিটা হিস্ট্রি এন্ট্রিতে Call + Chat বোতাম (মিসড/সম্পূর্ণ/কাটা — সবগুলোতে)
//   ২) Call সঠিক মানুষটিতে যায় — বন্ধু নামে, ডেটিং/এক্সপার্ট/সার্ভিস UID-তে
//   ৩) Chat সঠিক থ্রেড খোলে (ডেটিংয়ে datingPartnerId, সার্ভিসে peerId)
//   ৪) মিসড এন্ট্রির Call back সঠিক পথে যায়
//   ৫) endCallLocal প্রতিটা ধরনে peerId লেখে (নইলে হিস্ট্রি থেকে কল হতো না)
//   ৬) peerId নেই এমন পুরোনো এন্ট্রিতে ভুল মানুষে কল যায় না
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

// হিস্ট্রি → কল-রাউটের নিয়ম (CallHistory.callPath-এর আয়না — সোর্সেও একই
// নিয়ম আছে কি না নিচের গঠন-যাচাইয়ে মেলানো হয়)।
function callPath(c) {
  if (c.type === 'Friend') return `/call/friend/${encodeURIComponent(c.name)}`
  if (!c.peerId) return null
  if (c.type === 'Dating') return `/call/dating/${c.peerId}`
  if (c.type === 'Expert') return `/call/expert/${c.peerId}`
  if (c.type === 'Service') return `/call/service/${c.peerId}`
  return null
}

console.log('— রাউটিং নিয়ম (pure) —')
check('বন্ধু: নামে কল যায়', () => {
  assert.equal(callPath({ type: 'Friend', name: 'Susmita' }), '/call/friend/Susmita')
  assert.equal(callPath({ type: 'Friend', name: 'Rima das', peerId: 'u-9' }), '/call/friend/Rima%20das')
})
check('ডেটিং/এক্সপার্ট/সার্ভিস: peerId (UID) দিয়ে কল যায়', () => {
  assert.equal(callPath({ type: 'Dating', name: 'Asha', peerId: 'uid-d1' }), '/call/dating/uid-d1')
  assert.equal(callPath({ type: 'Expert', name: 'Dr. X', peerId: 'exp-1' }), '/call/expert/exp-1')
  assert.equal(callPath({ type: 'Service', name: 'Help call', peerId: 'uid-s1' }), '/call/service/uid-s1')
})
check('মিসড এন্ট্রির কল-ব্যাক একই পথে যায় (ধরন অনুযায়ী)', () => {
  assert.equal(callPath({ type: 'Friend', name: 'Susmita', status: 'Missed', peerId: 'u-1' }), '/call/friend/Susmita')
  assert.equal(callPath({ type: 'Dating', name: 'Asha', status: 'Missed', peerId: 'uid-d1' }), '/call/dating/uid-d1')
})
check('peerId নেই এমন পুরোনো ডেটিং/এক্সপার্ট/সার্ভিস এন্ট্রিতে Call নেই (ভুল মানুষে যাবে না)', () => {
  assert.equal(callPath({ type: 'Dating', name: 'Asha' }), null)
  assert.equal(callPath({ type: 'Expert', name: 'Dr. X' }), null)
  assert.equal(callPath({ type: 'Service', name: 'Help call' }), null)
  // বন্ধুর ক্ষেত্রে নামেই যায় — peerId না থাকলেও
  assert.equal(callPath({ type: 'Friend', name: 'Susmita' }), '/call/friend/Susmita')
})
check('তালিকা নতুন থেকে পুরোনো — হিস্ট্রি addCall-এ উপরে বসে (স্টোর)', () => {
  assert.ok(storeSrc.includes("addCall: (c) => setCalls(prev => [{ ...c, id: 'call-' + Date.now()"))
})

console.log('— ওয়্যারিং (সোর্স-গঠন) —')
check('প্রতিটা হিস্ট্রি এন্ট্রিতে Call + Chat বোতাম আছে', () => {
  assert.ok(pagesSrc.includes("Call back' : '📞 Call'"))
  assert.ok(pagesSrc.includes("💬 Chat</Btn>"))
  assert.ok(pagesSrc.includes('const callPath = (c: CallRecord): string | null =>'))
})
check('Call বোতাম সঠিক পথে নেভিগেট করে', () => {
  assert.ok(pagesSrc.includes("if (c.type === 'Friend') return `/call/friend/${encodeURIComponent(c.name)}`"))
  assert.ok(pagesSrc.includes("if (c.type === 'Dating') return `/call/dating/${c.peerId}`"))
  assert.ok(pagesSrc.includes("if (c.type === 'Expert') return `/call/expert/${c.peerId}`"))
  assert.ok(pagesSrc.includes("if (c.type === 'Service') return `/call/service/${c.peerId}`"))
  assert.ok(pagesSrc.includes('onClick={() => navigate(path)}'))
})
check('Chat বোতাম সঠিক থ্রেড খোলে (ডেটিংয়ে datingPartnerId, সার্ভিসে peerId)', () => {
  assert.ok(pagesSrc.includes("...(c.type === 'Dating' && c.peerId ? { datingPartnerId: c.peerId } : {})"))
  assert.ok(pagesSrc.includes("...(c.type === 'Service' && c.peerId ? { peerId: c.peerId } : {})"))
  assert.ok(pagesSrc.includes("navigate('/chat', {"))
})
check('মিসড এন্ট্রিতে "Call back" লেখা + লাল মিসড চিহ্ন', () => {
  assert.ok(pagesSrc.includes("missed ? '📞 Call back' : '📞 Call'"))
  assert.ok(pagesSrc.includes('Missed call — {c.name} called you'))
})
check('এক্সপার্টের Chat বোতাম নেই (এক্সপার্টের চ্যাট থ্রেড নেই)', () => {
  assert.ok(pagesSrc.includes("c.type !== 'Expert' && ("))
})
check('endCallLocal প্রতিটা ধরনে peerId লেখে — নইলে হিস্ট্রি থেকে কল হতো না', () => {
  assert.ok(pagesSrc.includes("const peerId = type === 'friend' ? friends.find((f) => f.name === name)?.id"))
  assert.ok(pagesSrc.includes("type === 'service' ? service?.providerUid"))
  assert.ok(pagesSrc.includes('status: reason.startsWith('))
  assert.ok(pagesSrc.includes("peerId })") || pagesSrc.includes('peerId }'))
})
check('CallRecord-এ peerId আছে (পুরোনো রেকর্ডে না থাকলে নামে মেলানো হয়)', () => {
  assert.ok(storeSrc.includes('peerId?: string'))
})
check('হিস্ট্রি খুললে মিসড "দেখা" হয় (ব্যাজ সরে)', () => {
  assert.ok(pagesSrc.includes('markMissedCallsSeen()'))
})

console.log(`\n${passed} passed`)
