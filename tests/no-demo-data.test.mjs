// Remove ALL demo data — no demo seed may come back (owner: "Live a demo gulo bad dao")
// Run: node tests/no-demo-data.test.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const data = read('src/data.ts')
const pages = read('src/pages.tsx')
const buddies = read('src/buddies.ts')

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

const DEMO_SERVICE_IDS = ['srv-1', 'srv-2', 'srv-3', 'srv-4', 'srv-5', 'srv-6']
const DEMO_DATING_IDS = ['dt-1', 'dt-2', 'dt-3', 'dt-4', 'dt-5', 'dt-6']
const DEMO_NAMES = ['Tania', 'Rakib', 'Sumaiya', 'Arif', 'Nusrat', 'Sajib']
const DEMO_PROVIDERS = ['CleanHome', 'CoolCare', 'FixIt', 'PowerFix', 'PixelStudio', 'Mehjabin']

check('data.ts: no demo service ids (srv-1..srv-6)', () => {
  for (const id of DEMO_SERVICE_IDS) assert.ok(!data.includes(id), `${id} ফিরে এসেছে`)
})

check('data.ts: no demo dating ids (dt-1..dt-6)', () => {
  for (const id of DEMO_DATING_IDS) assert.ok(!data.includes(id), `${id} ফিরে এসেছে`)
})

check('data.ts: no demo dating names', () => {
  for (const name of DEMO_NAMES) assert.ok(!data.includes(name), `${name} ফিরে এসেছে`)
})

check('data.ts: no demo service providers', () => {
  for (const p of DEMO_PROVIDERS) assert.ok(!data.includes(p), `${p} ফিরে এসেছে`)
})

check('data.ts: SERVICES and DATING_PROFILES are empty arrays', () => {
  assert.ok(/export const SERVICES: Service\[\] = \[\]/.test(data), 'SERVICES খালি নয়')
  assert.ok(/export const DATING_PROFILES: DatingProfile\[\] = \[\]/.test(data), 'DATING_PROFILES খালি নয়')
})

check('pages.tsx: no fake groups with invented member counts', () => {
  for (const s of ['IELTS Preparation', 'Freelancers Bangladesh', '12,400', '8,900', '3,200', '5,600']) {
    assert.ok(!pages.includes(s), `ভুয়া গ্রুপ "${s}" ফিরে এসেছে`)
  }
})

check('pages.tsx: no fake expert review', () => {
  assert.ok(!pages.includes('Got very good advice'), 'ভুয়া রিভিউ ফিরে এসেছে')
})

check('pages.tsx: no "Demo — local data" experts badge', () => {
  assert.ok(!pages.includes('Demo — local data'), 'ডেমো ব্যাজ ফিরে এসেছে')
})

check('pages.tsx: real empty states where demo lists went empty', () => {
  for (const s of ['No services yet.', 'No profiles yet', 'No home services yet.', 'No groups or pages yet.', 'No reviews yet.', 'No user totals yet', 'No recordings yet.', 'No attempts logged yet.', 'No reported profiles.']) {
    assert.ok(pages.includes(s), `খালি অবস্থা নেই: "${s}"`)
  }
})

check('pages.tsx: no fake live-viewer simulation (was 14, random walk)', () => {
  assert.ok(!pages.includes('useState(14)'), 'ভুয়া ১৪ দর্শক ফিরে এসেছে')
  assert.ok(!pages.includes('Math.max(3, v + Math.floor'), 'ভুয়া দর্শক সিমুলেশন ফিরে এসেছে')
  assert.ok(pages.includes('Live server is not connected — nobody can watch yet.'), 'লাইভ সার্ভার বার্তা নেই')
})

check('pages.tsx: no fake admin totals or moderation counts', () => {
  for (const s of ['Total users (demo)', '1,240', '3 attempts logged', 'Reported dating profiles: 2', 'added in the demo', 'no real recording in the demo', 'Demo live — viewer count is demo data']) {
    assert.ok(!pages.includes(s), `ভুয়া অ্যাডমিন/লাইভ তথ্য ফিরে এসেছে: "${s}"`)
  }
})

check('buddies.ts: the 5 kept chat personas are untouched', () => {
  for (const id of ['bd-rima', 'bd-shakil', 'bd-fahim', 'bd-mim', 'bd-asha']) {
    assert.ok(buddies.includes(id), `পারসোনা নেই: ${id}`)
  }
})
