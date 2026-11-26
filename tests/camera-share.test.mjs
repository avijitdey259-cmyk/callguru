// ক্যামেরা বদল + স্ক্রিন শেয়ার — মালিকের ফোনে (Android) দুটোই ভাঙা ছিল।
// চালানো: রিপো রুট থেকে `node tests/camera-share.test.mjs`
// (src/cameraSwitch.ts pure লজিক esbuild দিয়ে বান্ডল করে চালায়;
//  কল-পেজের গঠন সোর্স পড়ে যাচাই করে — আসল ফোন-ক্যামেরা ব্রাউজার
//  ছাড়া যাচাই করা যায় না, তাই চূড়ান্ত প্রমাণ মালিকের ফোনে ট্যাপ-থ্রু।)
// যাচাই করে:
//   ১) ক্যামেরা বদল: deviceId দিয়ে বেছে নেওয়া (লেবেল/অন্য ডিভাইস),
//      exact → ideal চেষ্টার ধারা, একই ক্যামেরা ফিরলে সৎ ভুল
//   ২) স্ক্রিন শেয়ার: Android-এ (Chrome/PWA/WebView) getDisplayMedia
//      নেই — সৎ বার্তা (কম্পিউটার লাগবে), Chrome-এ ফোনে হবে না
//   ৩) ডেস্কটপে API থাকলে শেয়ার চলে; থামালে ক্যামেরা ফেরে; শেয়ার
//      চলাকালীন ক্যামেরা বদল বন্ধ থাকে
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-camshare-test-'))
const outFile = join(outDir, 'cameraSwitch.mjs')
await build({
  entryPoints: [join(root, 'src/cameraSwitch.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const FRONT = { deviceId: 'cam-front', label: 'Front Camera', kind: 'videoinput' }
const BACK = { deviceId: 'cam-back', label: 'Back Camera', kind: 'videoinput' }
const MIC = { deviceId: 'mic-1', label: 'Microphone', kind: 'audioinput' }
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 11; Redmi Note 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

console.log('— ক্যামেরা বেছে নেওয়া (deviceId) —')
check('পেছনের ক্যামেরা: লেবেলে back থাকলে সেটাই বেছে নেওয়া হয়', () => {
  assert.deepEqual(M.pickCameraDevice([FRONT, BACK], 'cam-front', 'environment'), BACK)
})
check('সামনের ক্যামেরা: লেবেলে front থাকলে সেটাই', () => {
  assert.deepEqual(M.pickCameraDevice([FRONT, BACK], 'cam-back', 'user'), FRONT)
})
check('লেবেল না থাকলেও বর্তমান deviceId ছাড়া অন্য ক্যামেরা মেলে', () => {
  const a = { deviceId: 'cam-a', label: '', kind: 'videoinput' }
  const b = { deviceId: 'cam-b', label: '', kind: 'videoinput' }
  assert.deepEqual(M.pickCameraDevice([a, b], 'cam-a', 'environment'), b)
})
check('একটাই ক্যামেরা থাকলে বদলের লক্ষ্য নেই (null)', () => {
  assert.equal(M.pickCameraDevice([FRONT], 'cam-front', 'environment'), null)
  assert.equal(M.pickCameraDevice([], null, 'environment'), null)
})
check('অডিও ডিভাইস ক্যামেরা হিসেবে গোনা হয় না', () => {
  assert.equal(M.countCameras([FRONT, BACK, MIC]), 2)
  assert.equal(M.countCameras([MIC]), 0)
})
check('চেষ্টার ধারা: deviceId exact → facingMode exact → facingMode ideal', () => {
  const attempts = M.cameraConstraintAttempts('cam-back', 'environment')
  assert.equal(attempts.length, 3)
  assert.deepEqual(attempts[0], { video: { deviceId: { exact: 'cam-back' } } })
  assert.deepEqual(attempts[1], { video: { facingMode: { exact: 'environment' } } })
  assert.deepEqual(attempts[2], { video: { facingMode: 'environment' } })
  // deviceId না জানা থাকলে exact-ধাপ নেই, facingMode দিয়েই শুরু
  const noId = M.cameraConstraintAttempts(null, 'user')
  assert.equal(noId.length, 2)
  assert.deepEqual(noId[0], { video: { facingMode: { exact: 'user' } } })
})
check('একই ক্যামেরা ফিরলে ধরা পড়ে (ideal ফলব্যাকের চুপচাপ ভুল)', () => {
  assert.equal(M.isSameCameraDevice('cam-front', 'cam-front'), true)
  assert.equal(M.isSameCameraDevice('cam-front', 'cam-back'), false)
  // deviceId না জানা গেলে মিথ্যা সন্দেহ নয়
  assert.equal(M.isSameCameraDevice(null, 'cam-back'), false)
  assert.equal(M.isSameCameraDevice('cam-front', undefined), false)
})

console.log('— স্ক্রিন শেয়ার: সাপোর্ট যাচাই —')
check('Android ফোনে (Chrome/PWA/WebView) শেয়ার চলে না — মোবাইল-কারণ + সৎ বার্তা', () => {
  const r = M.getScreenShareSupport({ hasGetDisplayMedia: false, userAgent: ANDROID_UA })
  assert.equal(r.supported, false)
  assert.equal(r.reason, 'mobile')
  assert.ok(r.message.includes('computer'), r.message)
  assert.ok(!r.message.includes('browser not supported'))
})
check('Android-এ API দেখালেও (পুরোনো Chrome) মোবাইল-কারণেই আটকায়', () => {
  const r = M.getScreenShareSupport({ hasGetDisplayMedia: true, userAgent: ANDROID_UA })
  assert.equal(r.supported, false)
  assert.equal(r.reason, 'mobile')
})
check('মোবাইল শনাক্ত: iPhone UA / coarse পয়েন্টারেও মোবাইল', () => {
  assert.equal(M.isMobileBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', false), true)
  assert.equal(M.isMobileBrowser('Mozilla/5.0 (X11; Linux x86_64)', true), true)
  assert.equal(M.isMobileBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', false), false)
})
check('কম্পিউটারে API না থাকলে missing-api বার্তা (কোন ব্রাউজারে হবে তা সহ)', () => {
  const r = M.getScreenShareSupport({ hasGetDisplayMedia: false, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })
  assert.equal(r.supported, false)
  assert.equal(r.reason, 'missing-api')
  assert.ok(r.message.includes('Chrome or Edge'))
})
check('ডেস্কটপ Chrome-এ API থাকলে শেয়ার চলে', () => {
  const r = M.getScreenShareSupport({ hasGetDisplayMedia: true, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' })
  assert.deepEqual(r, { supported: true })
})

console.log('— ওয়্যারিং (সোর্স-গঠন) —')
check('ক্যামেরা গোনা হয় অনুমতির পরেই (আগে গুনলে Android-এ ১/০ আসত)', () => {
  const idx = pagesSrc.indexOf('অনুমতির পরেই ক্যামেরা গোনা যায়')
  assert.ok(idx > 0)
  // getUserMedia-র .then-এর ভেতরে enumerateDevices — আগে নয়
  const effect = pagesSrc.slice(pagesSrc.indexOf('if (!started) return'), pagesSrc.indexOf('}, [started])'))
  assert.ok(effect.indexOf('getUserMedia') < effect.indexOf('enumerateDevices'))
})
check('switchCamera deviceId দিয়ে বদলায় + নতুন ট্র্যাক যাচাই করে', () => {
  assert.ok(pagesSrc.includes('pickCameraDevice(devices, oldDeviceId, next)'))
  assert.ok(pagesSrc.includes('cameraConstraintAttempts(target?.deviceId ?? null, next)'))
  assert.ok(pagesSrc.includes('isSameCameraDevice(oldDeviceId, newDeviceId)'))
  assert.ok(pagesSrc.includes('sender.replaceTrack(newVideo)'))
})
check('বদল না হলে সৎ ভুল দেখায় (একই ক্যামেরা ফিরেছে / একটাই ক্যামেরা)', () => {
  assert.ok(pagesSrc.includes('Could not switch to the'))
  assert.ok(pagesSrc.includes('This device has only one camera'))
})
check('বোতাম শুধু অনুমতির-পরের গোনায় ১ প্রমাণিত হলেই বন্ধ (null-এ নয়)', () => {
  assert.ok(pagesSrc.includes('disabled={switching || (camCount !== null && camCount <= 1) || sharing}'))
})
check('ট্র্যাকের আসল facing-ই আয়না/অবস্থা ঠিক করে (চাওয়া facing নয়)', () => {
  assert.ok(pagesSrc.includes("actualFacing === 'environment' ? 'environment'"))
})
check('স্ক্রিন শেয়ার: সাপোর্ট যাচাই + সৎ বার্তা; পুরোনো "browser not supported" নেই', () => {
  assert.ok(pagesSrc.includes('getScreenShareSupport({'))
  assert.ok(pagesSrc.includes('setShareError(support.message)'))
  assert.ok(!pagesSrc.includes("setShareError('Screen sharing is not supported in this browser.')"))
})
check('শেয়ার চললে replaceTrack-এ স্ক্রিনের ট্র্যাক যায়; থামালে ক্যামেরা ফেরে', () => {
  assert.ok(pagesSrc.includes('await sender.replaceTrack(screenTrack)'))
  assert.ok(pagesSrc.includes('screenTrack.onended = () => { stopShare() }'))
  assert.ok(pagesSrc.includes('if (sender) sender.replaceTrack(camTrack).catch(() => {})'))
})
check('শেয়ার চলাকালীন ক্যামেরা বদল বন্ধ থাকে', () => {
  assert.ok(pagesSrc.includes('if (switching || sharing) return'))
})

console.log(`\n${passed} passed`)
console.log('NOTE: আসল ফোন-ক্যামেরা ব্রাউজার-টেস্টে যাচাই করা যায় না — চূড়ান্ত প্রমাণ মালিকের ফোনে ট্যাপ-থ্রু (সামনে ↔ পেছনে)।')
