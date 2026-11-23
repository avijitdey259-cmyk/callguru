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
//      ওপেনার নেই (বন্ধুরা নিজে থেকে লেখে না), ৫ পারসোনাই আছে
//   ৮) প্রতিধ্বনি: চেনা বিষয়ের শব্দ থাকলে উত্তর সেই বিষয়টাই ধরে (ঘুম/আজকে/মা)
//   ৯) মজার মোড়: একই বিষয়ে মাঝে মাঝে মজার উত্তর, পরপর দুবার নয়, মজায় বিষয় থাকেই
//      আর তথ্যভিত্তিক প্রশ্নে (অ্যাপ/Pi) মজার মোড় আসে না
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
  assert.ok(/আরে|হ্যালো|হাই|ওহে/.test(r), r)  // funny ভ্যারিয়েন্ট 'ওহে! এসেছো তাহলে…' ও সালাম
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
  assert.ok(/বুঝলাম না|বুঝতে পারলাম না|ধরতে পারছি না|ধরতে পারলাম না|জানা নেই|দিতে পারছি না/.test(r), r) // ফলব্যাকের সব ভ্যারিয়েন্ট — সোজা বলে বোঝেনি
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

check('৫ পারসোনা, স্বর আলাদা, ওপেনার নেই (বন্ধুরা নিজে থেকে লেখে না)', () => {
  assert.equal(M.BUDDIES.length, 5)
  const voices = new Set(M.BUDDIES.map(b => b.voice))
  assert.equal(voices.size, 5)
  assert.equal(M.BUDDY_OPENERS, undefined)
  // একই প্রশ্নে ভিন্ন পারসোনার উত্তর একরকম নয় (অন্তত ৩ জন আলাদা)
  const rs = new Set(M.BUDDIES.map(b => M.getBuddyReply(b.id, 'কেমন আছো?')))
  assert.ok(rs.size >= 3, [...rs].join(' | '))
})

check('খালি/ফাঁকা মেসেজে ক্র্যাশ করে না', () => {
  assert.ok(M.getBuddyReply('bd-rima', '').length > 0)
  assert.ok(M.getBuddyReply('bd-rima', '   ').length > 0)
})

// ---- প্রতিধ্বনি (echo): চেনা বিষয় থাকলে উত্তর সেই বিষয়টাই ধরে ----
check('"ঘুম আসছে না" বললে ঘুমের উত্তর আসে, জেনেরিক নয়', () => {
  const r = M.getBuddyReply('bd-shakil', 'ঘুম আসছে না')
  assert.ok(/ঘুম/.test(r), r)
  assert.ok(!/বুঝলাম না|বুঝতে পারলাম না/.test(r), r)
})

check('"আজকে খুব ভালো দিন" বললে আজকের উত্তর আসে', () => {
  const r = M.getBuddyReply('bd-rima', 'আজকে খুব ভালো দিন')
  assert.ok(/আজকে/.test(r), r)
})

check('"আমার মা অসুস্থ" বললে মায়ের কথা ধরে উত্তর আসে', () => {
  const r = M.getBuddyReply('bd-shakil', 'আমার মা অসুস্থ')
  assert.ok(/মা/.test(r), r)
  assert.ok(!/বুঝলাম না|বুঝতে পারলাম না/.test(r), r)
})

check('"বৃষ্টি হচ্ছে" বললে বৃষ্টির উত্তর আসে', () => {
  const r = M.getBuddyReply('bd-mim', 'বৃষ্টি হচ্ছে')
  assert.ok(/বৃষ্টি/.test(r), r)
})

check('"মন খারাপ" বললে সহানুভূতির উত্তর আসে, নাম ধরে', () => {
  const r = M.getBuddyReply('bd-shakil', 'মন খারাপ')
  assert.ok(/মন খারাপ|খারাপ লাগছে/.test(r), r)
  assert.ok(/❤️|আহা|শুনছি|হালকা|বিশ্রাম|পাশে/.test(r), r) // caring ভ্যারিয়েন্ট 'খারাপ লাগছে? একটু বিশ্রাম নাও, আমি আছি পাশে…' ও সহানুভূতি
})

// ---- ফলো-আপের বৈচিত্র্য: একই ধরনের দুই মেসেজে একই ছক নয় ----
check('একই বিষয়ে দুই মেসেজে দুই রকম উত্তর আসে', () => {
  const r1 = M.getBuddyReply('bd-rima', 'বৃষ্টি হচ্ছে')
  const r2 = M.getBuddyReply('bd-rima', 'বৃষ্টি ভালো লাগে', r1)
  assert.notEqual(r2, r1)
  assert.ok(/বৃষ্টি/.test(r1) && /বৃষ্টি/.test(r2), `${r1} | ${r2}`)
})

// ---- দৈর্ঘ্যের বৈচিত্র্য: ছোট-বড় মিশিয়ে ----
check('একই প্রশ্নে ছোট-বড় মিশিয়ে উত্তর আসে', () => {
  const rs = []
  let prev = ''
  for (let i = 0; i < 15; i++) {
    const r = M.getBuddyReply('bd-rima', 'কেমন আছো?', prev)
    rs.push(r)
    prev = r
  }
  const lens = rs.map(r => r.length)
  assert.ok(new Set(rs).size >= 3, rs.join(' | '))
  assert.ok(Math.max(...lens) - Math.min(...lens) >= 8, lens.join(','))
})

// ---- মজার মোড় ----
check('একই প্রশ্ন ৬ বার করলে মজা আর সাধারণ মিশিয়ে আসে, মজায় বিষয় থাকে', () => {
  const seq = [0.05, 0.95]
  let i = 0
  const rnd = () => seq[i++ % seq.length]
  let lastWasFun = false
  let funCount = 0
  for (let n = 0; n < 6; n++) {
    const b = M.BUDDIES[n % M.BUDDIES.length]
    const r = M.getBuddyReplyDetail(b.id, 'বৃষ্টি হচ্ছে', undefined, { lastWasFun, random: rnd })
    if (r.fun) {
      funCount++
      assert.ok(r.text.includes('বৃষ্টি'), r.text)
    }
    lastWasFun = r.fun
  }
  assert.ok(funCount >= 1 && funCount <= 5, `funCount=${funCount}`)
})

check('সবসময় মজা চাইলেও পরপর দুবার মজা আসে না', () => {
  let lastWasFun = false
  let funCount = 0
  for (let n = 0; n < 6; n++) {
    const r = M.getBuddyReplyDetail('bd-rima', 'বৃষ্টি হচ্ছে', undefined, { lastWasFun, random: () => 0.01 })
    if (r.fun) funCount++
    assert.ok(!(lastWasFun && r.fun), 'পরপর দুবার মজা')
    lastWasFun = r.fun
  }
  assert.equal(funCount, 3)
})

check('তথ্যভিত্তিক প্রশ্নে মজার মোড় আসে না (উত্তর এড়ায় না)', () => {
  for (let n = 0; n < 5; n++) {
    const r1 = M.getBuddyReplyDetail('bd-fahim', 'এই অ্যাপ কীভাবে চালাবো?', undefined, { random: () => 0.01 })
    assert.equal(r1.fun, false, r1.text)
    const r2 = M.getBuddyReplyDetail('bd-fahim', 'Pi কিনবো কীভাবে?', undefined, { random: () => 0.01 })
    assert.equal(r2.fun, false, r2.text)
  }
})

console.log(`\n${passed}/27 passed`)
