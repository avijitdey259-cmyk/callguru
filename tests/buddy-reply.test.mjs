// চ্যাট বন্ধুর উত্তর-মেলানো টেস্ট — প্রশ্ন একটা, উত্তর আরেকটা যেন না আসে।
// চালানো: রিপো রুট থেকে `node tests/buddy-reply.test.mjs`
// (esbuild দিয়ে src/buddies.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) ছোট ল্যাটিন কি ("hi"/"pi"/"live") অন্য শব্দের ভেতরে মিলে ভুল বিষয় ধরে না
//      ("picture", "pink", "they", "deliver" — এগুলোতে Pi/লাইভ/সালামের উত্তর আসবে না)
//   ২) ছোট বাংলা শব্দ ("কল", "বাই") অন্য শব্দের ভেতরে মিলে না ("কলকাতা", "বাইরে")
//   ৩) নাম/পরিচয় প্রশ্নে পারসোনা নিজের নামে পরিচয় দেয়
//   ৪) অ্যাপ-সাহায্য প্রশ্নে ("এই অ্যাপ কীভাবে চালাবো?") অ্যাপের সাহায্য আসে
//   ৫) "কী করছো?"-তে পারসোনা নিজে কী করছে বলে
//   ৬) কোনো বিষয় না মিললে প্রশ্নের উত্তরে সোজা বলে বোঝেনি, অন্য বিষয়ে লাফ দেয় না
//   ৭) আগের আচরণ অটুট: একই কথায় পরপর একই উত্তর না, পারসোনা ভেদে স্বর আলাদা,
//      ওপেনার আছে, ৫ পারসোনাই আছে
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-buddy-test-'))
const outFile = join(outDir, 'buddies.mjs')
await build({
  entryPoints: [join(root, 'src/buddies.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

// ---- মিসফায়ার: ছোট ল্যাটিন কি অন্য শব্দের ভেতরে ----
check('"picture" বললে Pi-র উত্তর আসবে না', () => {
  const r = M.getBuddyReply('bd-rima', 'picture')
  assert.ok(!/Pi|পাই|ওয়ালেট|টপ-আপ/.test(r), r)
})

check('"pink" বললে Pi-র উত্তর আসবে না', () => {
  const r = M.getBuddyReply('bd-rima', 'pink')
  assert.ok(!/Pi|পাই|ওয়ালেট|টপ-আপ/.test(r), r)
})

check('"they" বললে সালামের উত্তর আসবে না', () => {
  const r = M.getBuddyReply('bd-rima', 'they')
  assert.ok(!/আসসালামু|হ্যালো|হাই!|কেমন আছো/.test(r), r)
})

check('"deliver" বললে লাইভের উত্তর আসবে না', () => {
  const r = M.getBuddyReply('bd-rima', 'deliver')
  assert.ok(!/লাইভ|ডেটিং লাইভ/.test(r), r)
})

// ---- মিসফায়ার: ছোট বাংলা শব্দ অন্য শব্দের ভেতরে ----
check('"কলকাতা" বললে কলের উত্তর আসবে না', () => {
  const r = M.getBuddyReply('bd-rima', 'কলকাতা')
  assert.ok(!/কল কর|ভিডিও কল|প্রিপেইড|মিনিট/.test(r), r)
})

check('"বাইরে" বললে বিদায়ের উত্তর আসবে না', () => {
  const r = M.getBuddyReply('bd-rima', 'বাইরে')
  assert.ok(!/বাই বাই|আল্লাহ হাফেজ|শুভ রাত্রি|ভালো থেকো/.test(r), r)
})

// ---- ঠিক শব্দ মিললে ঠিক উত্তরই আসে ----
check('"কল করবো" বললে কলের উত্তর আসে', () => {
  const r = M.getBuddyReply('bd-fahim', 'কল করবো')
  assert.ok(/কল|Pi|মিনিট/.test(r), r)
})

check('"গান শোনাও" বললে গানের উত্তর আসে', () => {
  const r = M.getBuddyReply('bd-mim', 'গান শোনাও')
  assert.ok(/গান/.test(r), r)
})

check('"হাই" বললে সালামের উত্তর আসে', () => {
  const r = M.getBuddyReply('bd-rima', 'হাই')
  assert.ok(/আরে|হ্যালো|হাই/.test(r), r)
})

// ---- নতুন বিষয়: নাম/পরিচয় ----
check('"তোমার নাম কী?" বললে নিজের নামে পরিচয় দেয়', () => {
  for (const b of M.BUDDIES) {
    const r = M.getBuddyReply(b.id, 'তোমার নাম কী?')
    assert.ok(r.includes(b.name), `${b.id}: ${r}`)
  }
})

check('"তুমি কে?" বললে নিজের নামে পরিচয় দেয়', () => {
  for (const b of M.BUDDIES) {
    const r = M.getBuddyReply(b.id, 'তুমি কে?')
    assert.ok(r.includes(b.name), `${b.id}: ${r}`)
  }
})

// ---- নতুন বিষয়: অ্যাপ-সাহায্য ----
check('"এই অ্যাপ কীভাবে চালাবো?" বললে অ্যাপের সাহায্য আসে', () => {
  const r = M.getBuddyReply('bd-fahim', 'এই অ্যাপ কীভাবে চালাবো?')
  assert.ok(/চ্যাট|কল|লাইভ|ওয়ালেট|অ্যাপ/.test(r), r)
})

// ---- নতুন বিষয়: কী করছো ----
check('"কী করছো?" বললে নিজে কী করছে বলে', () => {
  const r = M.getBuddyReply('bd-rima', 'কী করছো?')
  assert.ok(r.length > 0)
  assert.ok(!/বুঝলাম না|বুঝতে পারলাম না/.test(r), r)
})

// ---- ফলব্যাক: না বুঝলে সোজা বলে, অন্য বিষয়ে লাফ দেয় না ----
check('অচেনা প্রশ্নে সোজা বলে বোঝেনি, অন্য বিষয় আনে না', () => {
  const r = M.getBuddyReply('bd-shakil', 'মঙ্গল গ্রহে কি মানুষ থাকে?')
  assert.ok(/বুঝলাম না|বুঝতে পারলাম না|আরেকভাবে|সহজ করে/.test(r), r)
  assert.ok(!/গান|লাইভ|কল কর|Pi কিন/.test(r), r)
})

// ---- আগের আচরণ অটুট ----
check('একই কথায় পরপর একই উত্তর আসে না', () => {
  for (const b of M.BUDDIES) {
    let prev = ''
    for (let i = 0; i < 30; i++) {
      const r = M.getBuddyReply(b.id, 'কেমন আছো?', prev)
      assert.notEqual(r, prev, `${b.id} repeat`)
      assert.ok(r.length > 0)
      prev = r
    }
  }
})

check('৫ পারসোনা, স্বর আলাদা, ওপেনার আছে', () => {
  assert.equal(M.BUDDIES.length, 5)
  const voices = new Set(M.BUDDIES.map(b => b.voice))
  assert.equal(voices.size, 5)
  for (const b of M.BUDDIES) {
    assert.ok(M.BUDDY_OPENERS[b.id] && M.BUDDY_OPENERS[b.id].includes(b.name), b.id)
  }
  // একই প্রশ্নে ভিন্ন পারসোনার উত্তর একরকম নয় (অন্তত ৩ জন আলাদা)
  const rs = new Set(M.BUDDIES.map(b => M.getBuddyReply(b.id, 'কেমন আছো?')))
  assert.ok(rs.size >= 3, [...rs].join(' | '))
})

check('খালি/ফাঁকা মেসেজে ক্র্যাশ করে না', () => {
  assert.ok(M.getBuddyReply('bd-rima', '').length > 0)
  assert.ok(M.getBuddyReply('bd-rima', '   ').length > 0)
})

console.log(`\n${passed}/17 passed`)
