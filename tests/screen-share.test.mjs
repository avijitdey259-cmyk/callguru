// কল চলাকালীন স্ক্রিন শেয়ার — 🖥️ বোতামে স্ক্রিন পিয়ারে যায়, থামালে ক্যামেরা ফেরে।
// চালানো: রিপো রুট থেকে `node tests/screen-share.test.mjs`
// (CallPage কম্পোনেন্টের ভেতরের তার — সোর্স পড়ে যাচাই করা হয়, Firebase/React লাগে না।)
// যাচাই করে:
//   ১) toggleShare — getDisplayMedia দিয়ে স্ক্রিন নেওয়া হয়
//   ২) পিয়ারে স্ক্রিনের ট্র্যাক replaceTrack-এ যায় (নতুন সংযোগ নয়)
//   ৩) থামালে ক্যামেরার ট্র্যাক ফেরে; ব্রাউজারের Stop বোতামেও (onended) ক্যামেরা ফেরে
//   ৪) অনুমতি না দিলে চুপচাপ বন্ধ থাকে — ক্র্যাশ নয়, ভুল বার্তাও নয়
//   ৫) কল শেষ হলে স্ক্রিনের ট্র্যাকও বন্ধ হয় (closeCallResources)
//   ৬) শেয়ার চলাকালীন ক্যামেরা বদলানো যায় না (শেয়ার ভাঙত)
//   ৭) সংযোগের আগেই শেয়ার চাপা থাকলে addLocalTracks স্ক্রিনের ট্র্যাক পাঠায়
//   ৮) সেলফ-ভিউ শেয়ারে আয়না নয়; বোতামে toggleShare, শেয়ার চললে লেবেল দেখায়
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

/** CallPage-এর ভেতরের একটা ফাংশনের সোর্স টুকরো (পরের ফাংশনের শুরু পর্যন্ত)। */
function fnBody(startMarker, endMarker) {
  const start = pagesSrc.indexOf(startMarker)
  assert.ok(start >= 0, `${startMarker} নেই`)
  const end = pagesSrc.indexOf(endMarker, start)
  assert.ok(end > start, `${startMarker}–${endMarker} খুঁজে পাওয়া যায়নি`)
  return pagesSrc.slice(start, end)
}

check('toggleShare — getDisplayMedia দিয়ে স্ক্রিন নেওয়া হয়', () => {
  assert.ok(pagesSrc.includes('async function toggleShare()'), 'toggleShare নেই')
  assert.ok(pagesSrc.includes('navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })'), 'getDisplayMedia কল নেই')
  assert.ok(pagesSrc.includes('screen.getVideoTracks()[0]'), 'স্ক্রিনের ভিডিও ট্র্যাক নেওয়া হয় না')
})

check('পিয়ারে স্ক্রিনের ট্র্যাক replaceTrack-এ যায় (নতুন সংযোগ নয়)', () => {
  const body = fnBody('async function toggleShare()', 'function stopShare()')
  assert.ok(body.includes("pcRef.current?.getSenders().find(s => s.track && s.track.kind === 'video')"), 'ভিডিও sender খোঁজা হয় না')
  assert.ok(body.includes('sender.replaceTrack(screenTrack)'), 'স্ক্রিনের ট্র্যাক replaceTrack-এ যায় না')
  assert.ok(body.includes('if (selfRef.current) selfRef.current.srcObject = screen'), 'সেলফ-ভিউয়ে স্ক্রিন দেখায় না')
})

check('থামালে ক্যামেরার ট্র্যাক ফেরে; ব্রাউজারের Stop বোতামেও (onended) ক্যামেরা ফেরে', () => {
  const stop = fnBody('function stopShare()', '// ---------- আসল 1-to-1 কল')
  assert.ok(stop.includes('screen?.getTracks().forEach(t => t.stop())'), 'থামালে স্ক্রিনের ট্র্যাক বন্ধ হয় না')
  assert.ok(stop.includes('sender.replaceTrack(camTrack)'), 'থামালে ক্যামেরার ট্র্যাক ফেরে না')
  assert.ok(stop.includes('if (selfRef.current && streamRef.current) selfRef.current.srcObject = streamRef.current'), 'সেলফ-ভিউ ক্যামেরায় ফেরে না')
  const start = fnBody('async function toggleShare()', 'function stopShare()')
  assert.ok(start.includes('screenTrack.onended = () => { stopShare() }'), 'ব্রাউজারের Stop বোতামে ক্যামেরা ফেরে না')
})

check('অনুমতি না দিলে চুপচাপ বন্ধ থাকে — ক্র্যাশ নয়, ভুল বার্তাও নয়', () => {
  const body = fnBody('async function toggleShare()', 'function stopShare()')
  // Denied/cancelled — catch-এ শুধু return, setCallError/setShareError নয়।
  const catchStart = body.indexOf('} catch {')
  assert.ok(catchStart >= 0, 'getDisplayMedia-র catch নেই')
  const catchBodyStart = catchStart + '} catch {'.length
  const catchBlock = body.slice(catchBodyStart, body.indexOf('}', catchBodyStart) + 1)
  assert.ok(catchBlock.includes('return'), 'অনুমতি না দিলে ফেরা হয় না')
  assert.ok(!catchBlock.includes('setCallError') && !catchBlock.includes('setShareError'), 'অনুমতি না দিলে ভুল বার্তা দেখানো হয়')
  // getDisplayMedia না থাকলে (পুরোনো ব্রাউজার) শুধু ছোট বার্তা — ক্র্যাশ নয়।
  assert.ok(body.includes("if (!navigator.mediaDevices?.getDisplayMedia)"), 'অসমর্থিত ব্রাউজারের গার্ড নেই')
  assert.ok(body.includes("setShareError('Screen sharing is not supported in this browser.')"), 'অসমর্থিত ব্রাউজারে বার্তা নেই')
})

check('কল শেষ হলে স্ক্রিনের ট্র্যাকও বন্ধ হয় (closeCallResources)', () => {
  const body = fnBody('function closeCallResources()', 'function ensurePc()')
  assert.ok(body.includes('screenStreamRef.current?.getTracks().forEach(t => t.stop())'), 'কল শেষে স্ক্রিনের ট্র্যাক বন্ধ হয় না')
  assert.ok(body.includes('sharingRef.current = false'), 'কল শেষে sharing ফ্ল্যাগ শূন্য হয় না')
})

check('শেয়ার চলাকালীন ক্যামেরা বদলানো যায় না (শেয়ার ভাঙত)', () => {
  const body = fnBody('async function switchCamera()', 'async function toggleShare()')
  assert.ok(body.includes('if (switching || camCount === 1 || sharing) return'), 'switchCamera শেয়ার চলাকালীন গার্ড নেই')
  assert.ok(pagesSrc.includes('disabled={switching || camCount === 1 || sharing}'), 'শেয়ার চলাকালীন ক্যামেরা বোতাম নিষ্ক্রিয় নয়')
})

check('সংযোগের আগেই শেয়ার চাপা থাকলে addLocalTracks স্ক্রিনের ট্র্যাক পাঠায়', () => {
  const body = fnBody('function addLocalTracks()', '// কলকারী: পিয়ার ঢুকেছে')
  assert.ok(body.includes("if (t.kind === 'video' && sharingRef.current && screenStreamRef.current)"), 'addLocalTracks শেয়ার দেখে না')
  assert.ok(body.includes('pc.addTrack(st, screenStreamRef.current)'), 'স্ক্রিনের ট্র্যাক addTrack-এ যায় না')
})

check('সেলফ-ভিউ শেয়ারে আয়না নয়; বোতামে toggleShare, শেয়ার চললে লেবেল দেখায়', () => {
  assert.ok(pagesSrc.includes("onClick={toggleShare}"), '🖥️ বোতামে toggleShare নেই')
  assert.ok(pagesSrc.includes("transform: sharing ? 'none' : (facing === 'user' ? 'scaleX(-1)' : 'none')"), 'শেয়ারে সেলফ-ভিউ আয়না বন্ধ হয় না')
  assert.ok(pagesSrc.includes("🖥️ Sharing your screen — the other person sees your screen, not your camera."), 'শেয়ার চললে লেবেল নেই')
  assert.ok(pagesSrc.includes('{sharing && <p className="text-xs mt-2 pb-gradient inline-block px-2 py-1 rounded">🖥️ Screen Sharing</p>}'), 'অপেক্ষার পর্দায় Screen Sharing লেবেল নেই')
})

console.log(`\n${passed} passed`)
