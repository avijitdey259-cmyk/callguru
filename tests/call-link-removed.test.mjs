// কল-লিংক দেখানো বন্ধ — মালিক দুবার বলেছেন কল স্ক্রিনে কোনো লিংক দেখতে চান না
// ("aita del korte bolcholam", ২০২৬-১১-২৬)। কল লিংক ছাড়াই যাবে — ওপাশের
// ফোনে অ্যাপ খোলা থাকলে Accept আসে, সেটাই নিয়ম।
// চালানো: রিপো রুট থেকে `node tests/call-link-removed.test.mjs`
// (CallPage কম্পোনেন্টের ভেতরের তার — সোর্স পড়ে যাচাই করা হয়, Firebase/React লাগে না।)
// যাচাই করে:
//   ১) অপেক্ষার পর্দায় ("Waiting for the other person…") কল-লিংকের ব্লক নেই —
//      "Call link — send it…" লেখা নেই, লিংকের URL নেই, "🔗 Copy Link" বোতাম নেই
//   ২) "No answer" অবস্থাও একই অপেক্ষার পর্দাতেই দেখায় — সেখানেও লিংক নেই
//   ৩) "Call ended" পর্দায় লিংক নেই
//   ৪) সেটআপ পর্দায় "Once the call starts you will get a link…" বাক্যটা নেই
//   ৫) "Call not found" পর্দায় "send the link again" নেই
//   ৬) অপেক্ষার পর্দার বাকিটা আগের মতো আছে — নাম, "Waiting…", টাকা-না-কাটার
//      নোট, Reject বোতাম
//   ৭) লিংক-রুট আর ইনভাইট ব্যবস্থা অক্ষত — /call/<code> রুট, Accept-এ
//      /call/<code>-এ ঢোকা, পুশ নোটিফিকেশনের deep-link, callCode/invite
//      কোডের পথ কিছুই ভাঙেনি (শুধু লিংক দেখানোটা গেছে)
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const appSrc = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const overlaySrc = readFileSync(join(root, 'src/IncomingCallOverlay.tsx'), 'utf8')
const pushSrc = readFileSync(join(root, 'src/pushNotify.ts'), 'utf8')
const callSrc = readFileSync(join(root, 'src/call.ts'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

/** CallPage-এর অপেক্ষার পর্দার টুকরো (শুরু থেকে পরের `if (!started)` পর্যন্ত)। */
function waitingScreen() {
  const start = pagesSrc.indexOf('if (started && !connected && !ended) {')
  assert.ok(start >= 0, 'অপেক্ষার পর্দার if নেই')
  const end = pagesSrc.indexOf('if (!started) {', start)
  assert.ok(end > start, 'অপেক্ষার পর্দার শেষ খুঁজে পাওয়া যায়নি')
  return pagesSrc.slice(start, end)
}

/** CallPage-এর "Call ended" পর্দার টুকরো। */
function endedScreen() {
  const start = pagesSrc.indexOf("  if (ended) {\n    const cost = isLinkCall")
  assert.ok(start >= 0, '"Call ended" পর্দা নেই')
  const end = pagesSrc.indexOf('// সার্ভিস কল: সার্ভিস না পেলে', start)
  assert.ok(end > start, '"Call ended" পর্দার শেষ খুঁজে পাওয়া যায়নি')
  return pagesSrc.slice(start, end)
}

const waiting = waitingScreen()
const ended = endedScreen()

check('অপেক্ষার পর্দায় "Call link — send it…" লেখা নেই', () => {
  assert.ok(!waiting.includes('Call link — send it'), 'অপেক্ষার পর্দায় এখনো "Call link — send it" লেখা আছে')
  assert.ok(!pagesSrc.includes('Call link — send it'), 'pages.tsx-এ কোথাও "Call link — send it" লেখা আছে')
})

check('অপেক্ষার পর্দায় কলের URL দেখানো হয় না', () => {
  assert.ok(!waiting.includes('callLink('), 'অপেক্ষার পর্দায় callLink() ডাকা হয়')
  assert.ok(!waiting.includes('picallbd.web.app/call'), 'অপেক্ষার পর্দায় কলের URL লেখা আছে')
  assert.ok(!pagesSrc.includes('callLink('), 'pages.tsx-এ কোথাও callLink() ডাকা হয় (লিংক দেখানোর পথ বাকি)')
})

check('অপেক্ষার পর্দায় "🔗 Copy Link" বোতাম নেই, copyCallLink ফাংশনও নেই', () => {
  assert.ok(!waiting.includes('Copy Link'), 'অপেক্ষার পর্দায় "Copy Link" বোতাম আছে')
  assert.ok(!pagesSrc.includes('copyCallLink'), 'copyCallLink ফাংশন এখনো আছে')
  assert.ok(!pagesSrc.includes('🔗 Copy Link'), 'pages.tsx-এ কোথাও "🔗 Copy Link" আছে')
})

check('"No answer" একই অপেক্ষার পর্দায় দেখায় — সেখানেও লিংক নেই', () => {
  assert.ok(waiting.includes('callError'), '"No answer" লাল বাক্স (callError) অপেক্ষার পর্দায় নেই')
  assert.ok(waiting.includes('Waiting for the other person…'), 'অপেক্ষার লেখা নেই')
  assert.ok(!waiting.includes('Call link'), '"No answer" অবস্থার পর্দায় "Call link" লেখা আছে')
})

check('"Call ended" পর্দায় লিংক নেই', () => {
  assert.ok(ended.includes('Call ended'), '"Call ended" লেখা নেই')
  assert.ok(ended.includes('Cost:'), 'খরচের লাইন নেই')
  assert.ok(!ended.includes('Call link'), '"Call ended" পর্দায় "Call link" আছে')
  assert.ok(!ended.includes('Copy Link'), '"Call ended" পর্দায় "Copy Link" আছে')
  assert.ok(!ended.includes('callLink('), '"Call ended" পর্দায় callLink() আছে')
})

check('সেটআপ পর্দায় "Once the call starts you will get a link…" বাক্য নেই', () => {
  assert.ok(!pagesSrc.includes('Once the call starts you will get a link'), 'সেটআপ পর্দায় এখনো লিংকের প্রতিশ্রুতি আছে')
  assert.ok(!pagesSrc.includes('you will get a link'), 'pages.tsx-এ "you will get a link" বাকি আছে')
})

check('"Call not found" পর্দায় "send the link again" নেই', () => {
  assert.ok(!pagesSrc.includes('send the link again'), '"Call not found" পর্দায় এখনো "send the link again" আছে')
  assert.ok(!pagesSrc.includes('The link may be wrong'), '"Call not found" পর্দায় এখনো "The link may be wrong" আছে')
  assert.ok(pagesSrc.includes('The call may have ended. Ask the caller to call again.'), '"Call not found" পর্দার নতুন লেখা নেই')
})

check('অপেক্ষার পর্দার বাকিটা আগের মতো আছে — নাম, Waiting, টাকা-না-কাটার নোট, Reject', () => {
  assert.ok(waiting.includes('📞 {name}'), 'কলারের নাম নেই')
  assert.ok(waiting.includes('Waiting for the other person…'), '"Waiting for the other person…" নেই')
  assert.ok(waiting.includes('No money will be cut while waiting — the timer and billing start only after connecting.'), 'টাকা-না-কাটার নোট নেই')
  assert.ok(waiting.includes("hangUp('Call cancelled')"), 'Reject বোতাম নেই')
  assert.ok(waiting.includes('❌ Reject'), '❌ Reject লেখা নেই')
})

check('লিংক-রুট অক্ষত — /call/:code রুট আছে', () => {
  assert.ok(appSrc.includes('<Route path="/call/:code" element={<CallPage />} />'), '/call/:code রুট নেই')
  assert.ok(appSrc.includes('<Route path="/call/:type/:id" element={<CallPage />} />'), '/call/:type/:id রুট নেই')
})

check('Accept-এ গ্রহণকারী /call/<code>-এ ঢোকে (কোডের পথ অক্ষত)', () => {
  assert.ok(overlaySrc.includes('navigate(`/call/${invite.code}`)'), 'Accept-এ /call/<code>-এ যাওয়া নেই')
  assert.ok(pagesSrc.includes('fetchCallInfo'), 'লিংক-কলের তথ্য আনা (fetchCallInfo) নেই')
  assert.ok(pagesSrc.includes('const [callCode, setCallCode]'), 'callCode স্টেট নেই')
})

check('পুশ নোটিফিকেশনের deep-link অক্ষত — ট্যাপে কল খোলে', () => {
  assert.ok(pushSrc.includes('url: `/call/${invite.code}`'), 'পুশ ডেটায় /call/<code> URL নেই')
})

check('callLink হেল্পার src/call.ts-এ আছে (ডিসপ্লে নয় — রুট/কোডের যন্ত্রাংশ)', () => {
  assert.ok(callSrc.includes('export function callLink(code: string): string'), 'callLink হেল্পার নেই')
})

console.log(`\n${passed} passed`)
