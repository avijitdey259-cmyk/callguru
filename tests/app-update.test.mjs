// অটো-আপডেট (ব্যানার নেই) + ক্যাশের ভাগাভাগি — চেক।
// চালানো: রিপো রুট থেকে `node tests/app-update.test.mjs`
// (esbuild দিয়ে src/appUpdate.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) ব্যানার/রিফ্রেশ বোতাম কোথাও নেই — আপডেট আপনা-আপনি হয়
//   ২) SW রেজিস্ট্রেশন + registration.update() খুললেই হয়, আর
//      ফোরগ্রাউন্ডে ফিরলে (visibilitychange/focus) আবার হয়
//   ৩) version.json তুলনা: নতুন হলেই আপডেট, একই/খালি হলে নয়
//   ৪) অফলাইন/ফেল করা fetch অ্যাপকে ছোঁয় না — কোনো ব্যানার/রিলোড নয়, চুপচাপ
//   ৫) কল/লাইভ/রেকর্ডিং চললে সুইচ পিছিয়ে যায় (busy গার্ড)
//   ৬) SW: version.json কখনো ক্যাশ নয়; শেল network-first (v4);
//      মিডিয়া আলাদা ক্যাশে cache-first; শেল বদলালে মিডিয়া-ক্যাশ বাঁচে
//   ৭) দেখা পোস্টের টেক্সট localStorage-এ থাকে — আপডেট সেটা মোছে না
//   ৮) vite.config বিল্ড-ভার্সন (version.json + __APP_VERSION__) দেয়
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-app-update-test-'))
const outFile = join(outDir, 'appUpdate.mjs')
await build({
  entryPoints: [join(root, 'src/appUpdate.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

const appUpdate = read('src/appUpdate.ts')
const main = read('src/main.tsx')
const sw = read('public/sw.js')
const viteConfig = read('vite.config.ts')
const store = read('src/store.tsx')
const pages = read('src/pages.tsx')

let n = 0
function check(name, fn) {
  n++
  try {
    const r = fn()
    if (r && typeof r.then === 'function') throw new Error('async check — await করা হয়নি')
    console.log(`ok ${n} - ${name}`)
  } catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}
async function checkAsync(name, fn) {
  n++
  try { await fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

// ---------- ১) ব্যানার/বোতাম নেই ----------
check('কোথাও ব্যানার/রিফ্রেশ বোতাম নেই — আপডেট আপনা-আপনি হয়', () => {
  for (const [name, src] of [['appUpdate.ts', appUpdate], ['main.tsx', main], ['sw.js', sw]]) {
    assert.ok(!src.includes('New version available'), `${name}-এ ব্যানার লেখা আছে`)
    assert.ok(!src.includes('Tap to refresh'), `${name}-এ Tap to refresh আছে`)
    assert.ok(!/UpdateBanner|update-banner|updateBanner/.test(src), `${name}-এ ব্যানার কম্পোনেন্ট আছে`)
  }
  assert.ok(!/Refresh/.test(appUpdate), 'appUpdate.ts-এ Refresh বোতাম/লেখা আছে')
  assert.ok(main.includes('initAppUpdate'), 'main.tsx initAppUpdate ডাকে না')
})

// ---------- ২) update() খুললেই + ফোরগ্রাউন্ডে ফিরলে ----------
check('registration.update() লোডে হয়, visibilitychange/focus-এ আবার হয়', () => {
  assert.ok(appUpdate.includes("navigator.serviceWorker"), 'SW রেজিস্টার নেই')
  assert.ok(appUpdate.includes("register('/sw.js')"), '/sw.js রেজিস্টার নেই')
  assert.ok(appUpdate.includes('registration.update()') || appUpdate.includes('.update()'), 'registration.update() নেই')
  assert.ok(appUpdate.includes("addEventListener('load'"), 'load লিসেনার নেই')
  assert.ok(appUpdate.includes("visibilitychange"), 'visibilitychange লিসেনার নেই')
  assert.ok(appUpdate.includes("!document.hidden"), 'visible হলেই চেক করে না')
  assert.ok(appUpdate.includes("addEventListener('focus'"), 'focus লিসেনার নেই')
  assert.ok(appUpdate.includes('onupdatefound') || appUpdate.includes("'updatefound'"), 'updatefound নেই (নতুন worker ধরা পড়ে না)')
  assert.ok(appUpdate.includes('SKIP_WAITING'), 'waiting worker-কে SKIP_WAITING পাঠায় না')
})

// ---------- ৩) version তুলনা ----------
check('version তুলনা: নতুন হলে true, একই/খালি হলে false', () => {
  assert.equal(M.isNewerVersion('2026-11-24T01:00:00.000Z', '2026-11-24T02:00:00.000Z'), true)
  assert.equal(M.isNewerVersion('2026-11-24T02:00:00.000Z', '2026-11-24T02:00:00.000Z'), false)
  assert.equal(M.isNewerVersion('2026-11-24T02:00:00.000Z', ''), false)
  assert.equal(M.isNewerVersion('2026-11-24T02:00:00.000Z', null), false)
  assert.equal(M.isNewerVersion('2026-11-24T02:00:00.000Z', undefined), false)
  assert.equal(M.isNewerVersion('', '2026-11-24T02:00:00.000Z'), false)
})

await checkAsync('version.json চেক: নতুন ভার্সন পেলে newer=true', async () => {
  const stub = async () => ({ ok: true, json: async () => ({ version: '2099-01-01T00:00:00.000Z' }) })
  const r = await M.checkVersion(stub, '2026-11-24T00:00:00.000Z')
  assert.equal(r.newer, true)
  assert.equal(r.remote, '2099-01-01T00:00:00.000Z')
  // no-store চাওয়া হয় — SW-ও যেন ক্যাশ থেকে না দেয়
  let seenInit
  const spy = async (_url, init) => { seenInit = init; return { ok: true, json: async () => ({ version: '2026-11-24T00:00:00.000Z' }) } }
  await M.checkVersion(spy, '2026-11-24T00:00:00.000Z')
  assert.equal(seenInit?.cache, 'no-store')
})

await checkAsync('version.json চেক: একই ভার্সন হলে newer=false', async () => {
  const stub = async () => ({ ok: true, json: async () => ({ version: '2026-11-24T00:00:00.000Z' }) })
  const r = await M.checkVersion(stub, '2026-11-24T00:00:00.000Z')
  assert.equal(r.newer, false)
})

// ---------- ৪) অফলাইন/ফেল ----------
await checkAsync('অফলাইন: fetch ফেল করলে কোনো থ্রো নয়, newer=false', async () => {
  const failing = async () => { throw new Error('offline') }
  const r = await M.checkVersion(failing, '2026-11-24T00:00:00.000Z')
  assert.equal(r.newer, false)
  assert.equal(r.remote, null)
})
await checkAsync('version.json 404/খারাপ JSON হলেও newer=false, থ্রো নয়', async () => {
  const notOk = async () => ({ ok: false, json: async () => ({}) })
  assert.equal((await M.checkVersion(notOk, '2026-11-24T00:00:00.000Z')).newer, false)
  const noVersion = async () => ({ ok: true, json: async () => ({}) })
  assert.equal((await M.checkVersion(noVersion, '2026-11-24T00:00:00.000Z')).newer, false)
})

// ---------- ৫) ব্যস্ত গার্ড ----------
check('কল/লাইভ/রেকর্ডিং চললে busy=true, নইলে false', () => {
  assert.equal(M.isBusySession('/call/abc123'), true)
  assert.equal(M.isBusySession('/call/expert/xyz'), true)
  assert.equal(M.isBusySession('/dating-live/42'), true)
  assert.equal(M.isBusySession('/dating-go-live'), true)
  assert.equal(M.isBusySession('/feed', true), true)
  assert.equal(M.isBusySession('/menu', true), true)
  assert.equal(M.isBusySession('/feed'), false)
  assert.equal(M.isBusySession('/dating'), false)
  assert.equal(M.isBusySession('/login'), false)
  assert.equal(M.isBusySession('/'), false)
})
check('KYC রেকর্ডিং ফ্ল্যাগ appUpdate-এর গার্ডে পৌঁছায়', () => {
  assert.ok(pages.includes('__picallRecording'), 'KycPage রেকর্ডিং ফ্ল্যাগ বসায় না')
  assert.ok(appUpdate.includes('__picallRecording'), 'appUpdate রেকর্ডিং ফ্ল্যাগ পড়ে না')
})

// ---------- ৬) SW: ভাগাভাগি ----------
check('SW: version.json কখনো ক্যাশ নয় (network-only, no-store)', () => {
  const vIdx = sw.indexOf("'/version.json'")
  assert.ok(vIdx !== -1, 'version.json শাখা নেই')
  const branch = sw.slice(vIdx, vIdx + 400)
  assert.ok(branch.includes('no-store'), 'version.json no-store নয়')
  assert.ok(!branch.includes('caches.match') && !branch.includes('cache.put'), 'version.json শাখায় ক্যাশ ছোঁয়া হয়')
  // version.json শাখা /api/ শাখার আগে — ক্যাশ-ফার্স্টে পড়ার আগেই ধরা পড়ে
  assert.ok(vIdx < sw.indexOf("startsWith('/api/')"), 'version.json শাখা /api/ শাখার পরে')
})
check('SW: শেল ক্যাশ v4, network-first + অফলাইনে ক্যাশ ফলব্যাক', () => {
  assert.ok(sw.includes("picall-shell-v5"), 'শেল ক্যাশ v5 নয়')
  assert.ok(!sw.includes('picall-shell-v4'), 'পুরোনো v4 ক্যাশ নাম এখনো আছে')
  const shellIdx = sw.indexOf('অ্যাপ শেল + নিজের অ্যাসেট')
  assert.ok(shellIdx !== -1, 'শেল শাখা নেই')
  const shell = sw.slice(shellIdx)
  assert.ok(shell.indexOf('fetch(request)') < shell.indexOf('caches.match'), 'শেল cache-first রয়ে গেছে — network-first নয়')
  assert.ok(shell.includes('.catch(() =>'), 'অফলাইনে ক্যাশ ফলব্যাক নেই')
})
check('SW: মিডিয়া আলাদা ক্যাশে cache-first, শুধু Firebase Storage', () => {
  assert.ok(sw.includes("picall-media-v1"), 'মিডিয়া ক্যাশ নেই')
  assert.ok(sw.includes('firebasestorage.googleapis.com'), 'মিডিয়া হোস্ট Firebase Storage নয়')
  const mIdx = sw.indexOf('MEDIA_CACHE')
  assert.ok(mIdx !== -1, 'MEDIA_CACHE ব্যবহার নেই')
  const media = sw.slice(sw.indexOf('url.hostname === MEDIA_HOST'))
  assert.ok(media.indexOf('cache.match') < media.indexOf('fetch(request)'), 'মিডিয়া cache-first নয়')
  assert.ok(media.includes("headers.has('range')"), 'Range চাওয়া (ভিডিও সিক) ক্যাশ থেকে বাদ দেওয়া হয়নি')
  assert.ok(M.isUserMediaUrl('https://firebasestorage.googleapis.com/v0/b/picall/o/uploads%2Fu1%2Fv.mp4?alt=media&token=x'), 'Storage URL মিডিয়া হিসেবে চেনে না')
  assert.equal(M.isUserMediaUrl('https://mumt04.tangotv.in/m18aqlK4GOLDMINES/index.m3u8'), false, 'লাইভ টিভি স্ট্রিম মিডিয়া-ক্যাশে পড়ছে')
  assert.equal(M.isUserMediaUrl('https://static.wikia.nocookie.net/jhmovie/images/7/7b/Goldmines_logo.png'), false, 'টিভি লোগো মিডিয়া-ক্যাশে পড়ছে')
  assert.equal(M.isUserMediaUrl('/assets/index-abc.js'), false, 'নিজের বান্ডল মিডিয়া-ক্যাশে পড়ছে')
})
check('SW: activate শুধু পুরোনো শেল-ক্যাশ মোছে — মিডিয়া-ক্যাশ বাঁচে', () => {
  assert.ok(sw.includes("startsWith('picall-shell-')"), 'activate শেল-প্রিফিক্স দিয়ে মোছে না')
  assert.ok(sw.includes('k !== MEDIA_CACHE'), 'activate মিডিয়া-ক্যাশ রক্ষা করে না')
})
check('SW: Web Push (ইনকামিং কল) অটুট, /api/ network-first অটুট', () => {
  assert.ok(sw.includes("addEventListener('push'"), 'push হ্যান্ডলার নেই')
  assert.ok(sw.includes("addEventListener('notificationclick'"), 'notificationclick হ্যান্ডলার নেই')
  assert.ok(sw.includes("addEventListener('message'"), 'SKIP_WAITING মেসেজ হ্যান্ডলার নেই')
  const apiIdx = sw.indexOf("startsWith('/api/')")
  assert.ok(apiIdx !== -1, '/api/ শাখা নেই')
  const api = sw.slice(apiIdx, apiIdx + 400)
  assert.ok(api.indexOf('fetch(request)') < api.indexOf('caches.match'), '/api/ network-first নয়')
})

// ---------- ৭) দেখা পোস্টের টেক্সট থাকে ----------
check('পোস্ট localStorage-এ থাকে; আপডেট কোড তা মোছে না', () => {
  assert.ok(store.includes("load<Post[]>('posts'"), 'পোস্ট localStorage থেকে লোড হয় না')
  assert.ok(store.includes("save('posts', posts.slice(0, 20))"), 'পোস্ট localStorage-এ সংরক্ষণ হয় না')
  assert.ok(!/localStorage\s*\./.test(appUpdate), 'appUpdate localStorage ছোঁয়')
  assert.ok(!/localStorage\s*\./.test(sw), 'SW localStorage ছোঁয়')
  assert.ok(!appUpdate.includes('callguru:posts'), 'appUpdate পোস্ট-ডেটা ছোঁয়')
  assert.ok(!/caches\.delete\(MEDIA_CACHE\)/.test(sw), 'SW মিডিয়া-ক্যাশ মোছে')
})

// ---------- ৮) বিল্ড-ভার্সন ----------
check('vite.config: version.json বানায় + __APP_VERSION__ define করে', () => {
  assert.ok(viteConfig.includes('version.json'), 'version.json প্লাগইন নেই')
  assert.ok(viteConfig.includes('generateBundle'), 'generateBundle নেই')
  assert.ok(viteConfig.includes('__APP_VERSION__'), '__APP_VERSION__ define নেই')
  assert.ok(viteConfig.includes('appVersion'), 'একটাই ভার্সন মান দুই জায়গায় যায় না')
})

// ---------- ৯) No Testnet / ইংরেজি-মাত্র UI ----------
check('নতুন/বদলানো কোডে Pi Testnet লেখা নেই', () => {
  for (const [name, src] of [['appUpdate.ts', appUpdate], ['sw.js', sw], ['vite.config.ts', viteConfig]]) {
    assert.ok(!src.includes('Pi Testnet'), `${name}-এ Pi Testnet আছে`)
  }
})

console.log(`\napp-update: ${n} checks, ${process.exitCode ? 'FAILED' : 'all passed'}`)
