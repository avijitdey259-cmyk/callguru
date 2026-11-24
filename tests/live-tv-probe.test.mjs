// Live TV প্রোব টেস্ট — "চলে" মানে চ্যানেলটা আসলেই চালু হয় (ট্যাপ করলে
// স্ট্রিম শুরু হয়), শুধু URL পিং নয় (মালিকের নির্দেশ ২০২৬-১১-২৪)।
// চালানো: রিপো রুট থেকে `node tests/live-tv-probe.test.mjs`
// (esbuild দিয়ে src/tvProbe.ts বান্ডল করে Node-এ চালায় — নেটওয়ার্ক ডাকা
// হয় না, প্রোবের জায়গায় ভুয়া লোডার বসে; pages.tsx সোর্স পড়ে।)
// যাচাই করে:
//   ১) সাজানো: চলে এমন আগে (আগের ক্রমেই), যাচাই হয়নি এমন মাঝে, চলে না এমন শেষে
//   ২) probeChannels: সফল/ব্যর্থ/timeout, ক্যাশে থাকা ফল আবার যাচাই হয় না,
//      সেশন-ক্যাশ, একসাথে সীমিত সংখ্যক (concurrency)
//   ৩) UI ওয়্যারিং (সোর্স): LiveTV-তে প্রোব + "Checking channels…" +
//      Playing/Not playing পিল + LIVE ব্যাজ + TV মাঝখানে (bottom nav)
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-tv-probe-test-'))
const read = (p) => readFileSync(join(root, p), 'utf8')

const outFile = join(outDir, 'tvProbe.mjs')
await build({
  entryPoints: [join(root, 'src/tvProbe.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

let passed = 0
function check(name, fn) {
  const r = fn()
  if (r && typeof r.then === 'function') return r.then(() => { passed++; console.log(`ok ${passed} - ${name}`) })
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const ch = (id, streamUrl) => ({ id, name: id, streamUrl })

// ---- সাজানো ----
check('sortChannelsByPlayability: চলে এমন আগে, যাচাই হয়নি মাঝে, চলে না শেষে', () => {
  const list = [ch('a', 'u-a'), ch('b', 'u-b'), ch('c', 'u-c'), ch('d', 'u-d'), ch('e', 'u-e')]
  const status = { 'u-a': false, 'u-b': true, 'u-c': undefined, 'u-d': true, 'u-e': false }
  const sorted = M.sortChannelsByPlayability(list, status).map(c => c.id)
  assert.deepEqual(sorted, ['b', 'd', 'c', 'a', 'e'])
})

check('sortChannelsByPlayability: সমান অবস্থার ক্রম বদলায় না (স্থিতিশীল)', () => {
  const list = [ch('a', 'u-a'), ch('b', 'u-b'), ch('c', 'u-c')]
  const sorted = M.sortChannelsByPlayability(list, {}).map(c => c.id)
  assert.deepEqual(sorted, ['a', 'b', 'c'])
})

check('sortChannelsByPlayability: স্ট্রিম ছাড়া (link-only) চ্যানেল নিচে', () => {
  const list = [ch('a'), ch('b', 'u-b')]
  const sorted = M.sortChannelsByPlayability(list, { 'u-b': true }).map(c => c.id)
  assert.deepEqual(sorted, ['b', 'a'])
})

check('isHlsUrl: শুধু .m3u8-ই HLS', () => {
  assert.equal(M.isHlsUrl('https://x/y.m3u8'), true)
  assert.equal(M.isHlsUrl('https://x/y.m3u8?token=1'), true)
  assert.equal(M.isHlsUrl('https://x/y.mp4'), false)
  assert.equal(M.isHlsUrl('https://x/y'), false)
})

// ---- probeChannels (ভুয়া লোডার) ----
await check('probeChannels: সফল লোডার = চলে, ব্যর্থ/throw = চলে না', async () => {
  M.clearProbeCache()
  const loader = async (url) => url.includes('good')
  const res = await M.probeChannels(['good-1', 'bad-1', 'good-2'], { loader })
  assert.deepEqual(res, { 'good-1': true, 'bad-1': false, 'good-2': true })
  assert.equal(M.getCachedProbe('good-1'), true)
  assert.equal(M.getCachedProbe('bad-1'), false)
})

await check('probeChannels: ক্যাশে থাকা ফল আবার যাচাই হয় না (লোডার ডাক পড়ে না)', async () => {
  M.clearProbeCache()
  let calls = 0
  const loader = async () => { calls++; return true }
  await M.probeChannels(['u1'], { loader })
  assert.equal(calls, 1)
  const seen = []
  await M.probeChannels(['u1', 'u2'], { loader, onProgress: (url, ok) => seen.push([url, ok]) })
  assert.equal(calls, 2, 'শুধু u2-ই আবার যাচাই হয়')
  assert.deepEqual(seen, [['u1', true], ['u2', true]])
})

await check('probeChannels: timeout-এ ফলস — লোডার আটকে থাকলেও শেষ হয়', async () => {
  M.clearProbeCache()
  const loader = () => new Promise(() => {}) // কখনো শেষ হয় না
  const t0 = Date.now()
  const res = await M.probeChannels(['slow-1'], { loader, timeoutMs: 50 })
  assert.deepEqual(res, { 'slow-1': false })
  assert.ok(Date.now() - t0 < 2000, 'timeout-এ আটকে থাকা চলবে না')
})

await check('probeChannels: একসাথে সীমিত সংখ্যক (concurrency 2)', async () => {
  M.clearProbeCache()
  let live = 0
  let maxLive = 0
  const loader = async () => {
    live++; maxLive = Math.max(maxLive, live)
    await new Promise(r => setTimeout(r, 20))
    live--
    return true
  }
  await M.probeChannels(['a', 'b', 'c', 'd', 'e', 'f'], { loader, concurrency: 2 })
  assert.ok(maxLive <= 2, `একসাথে ${maxLive} চলেছে`)
  assert.ok(maxLive === 2, 'concurrency কাজই করেনি')
})

await check('probeChannels: onProgress-এ ফল এলে জানানো হয় (তালিকা ধাপে ধাপে সাজে)', async () => {
  M.clearProbeCache()
  const seen = []
  const loader = async (url) => url === 'fast'
  await M.probeChannels(['slow', 'fast'], { loader, onProgress: (url, ok) => seen.push(url + ':' + ok) })
  assert.equal(seen.length, 2)
  assert.ok(seen.includes('fast:true'))
  assert.ok(seen.includes('slow:false'))
})

// ---- UI ওয়্যারিং (সোর্স) ----
const pages = read('src/pages.tsx')
const components = read('src/components.tsx')

check('LiveTV: প্রোব চলে + ফল দেখায় (Playing/Not playing + যাচাই বার্তা)', () => {
  const start = pages.indexOf('export function LiveTV()')
  const end = pages.indexOf('// ---------- Home services', start)
  const body = pages.slice(start, end)
  assert.ok(body.includes('probeChannels'), 'probeChannels ডাক নেই')
  assert.ok(body.includes('sortChannelsByPlayability'), 'সাজানো নেই')
  assert.ok(body.includes('Checking channels'), 'যাচাই বার্তা নেই')
  assert.ok(body.includes('Playing'), 'Playing পিল নেই')
  assert.ok(body.includes('Not playing'), 'Not playing পিল নেই')
  assert.ok(body.includes('● LIVE'), 'LIVE ব্যাজ নেই')
})

check('Bottom nav: Live TV মাঝখানে (ডেমোর মতো)', () => {
  const start = components.indexOf('CENTER_NAV')
  const body = components.slice(start, start + 800)
  const order = ["'Home'", "'Shorts'", "'Live TV'", "'Friends'", "'Dating'"]
  let last = -1
  for (const label of order) {
    const i = body.indexOf(label)
    assert.ok(i > last, `নেভ ক্রম ভুল: ${label}`)
    last = i
  }
})

console.log(`\n${passed}/11 passed`)
