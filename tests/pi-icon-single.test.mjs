// Pi আইকন একটাই — ডাবল পাই (ডাবল ফায়ার নয়) ফিক্সের টেস্ট।
// মালিকের অভিযোগ: ব্যালেন্সে Pi আইকন দুবার দেখায় ("π π 5")।
// কারণ: formatPi() নিজেই 'π <সংখ্যা>' ফেরায়, আবার UI-তেও সামনে 'π '
// লেখা হতো। সঙ্গে 'π Pi <নাম>' (চিহ্ন + শব্দ) জোড়াও একটাই করা হয়েছে।
// চালানো: রিপো রুট থেকে `node tests/pi-icon-single.test.mjs`
// (সোর্স পড়ে যাচাই — Firebase/React লাগে না।)
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const comp = read('src/components.tsx')
const data = read('src/data.ts')
const pay = read('src/paymentMethods.ts')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

function countPi(line) {
  return [...line].filter((c) => c === 'π').length
}
function lineWith(src, needle) {
  const i = src.indexOf(needle)
  assert.ok(i !== -1, `${needle} নেই`)
  return src.slice(src.lastIndexOf('\n', i) + 1, src.indexOf('\n', i))
}

check('formatPi নিজেই π দেয় — একমাত্র উৎস', () => {
  assert.ok(data.includes('return `π ${v.toLocaleString'), 'formatPi-তে π নেই')
})

check('কোথাও π + formatPi জোড়া নেই (π π হবে)', () => {
  for (const [name, src] of [['pages', pages], ['components', comp]]) {
    assert.ok(!src.includes('π {formatPi('), `${name}-এ π {formatPi( আছে`)
    assert.ok(!src.includes('π{formatPi('), `${name}-এ π{formatPi( আছে`)
  }
})

check('হেডার ব্যালেন্স বোতামে একটাই π', () => {
  const line = lineWith(comp, "title=\"Pi Balance\"")
  assert.ok(line.includes('{formatPi(totalPi)}'), 'হেডার ব্যালেন্স formatPi নয়')
  // লাইনে আক্ষরিক π ০টা — formatPi রানটাইমে একটাই π দেয়; ১টা থাকলেই 'π π' হতো
  assert.equal(countPi(line), 0, `হেডার ব্যালেন্স লাইনে আক্ষরিক π ${countPi(line)}টা: ${line.trim()}`)
})

check('ওয়ালেটের বড় ব্যালেন্সে একটাই π', () => {
  const line = lineWith(pages, 'text-4xl font-extrabold pb-gradient-text')
  assert.ok(line.includes('{formatPi(totalPi)}'), 'বড় ব্যালেন্স formatPi নয়')
  // লাইনে আক্ষরিক π ০টা — formatPi রানটাইমে একটাই π দেয়
  assert.equal(countPi(line), 0, `বড় ব্যালেন্স লাইনে আক্ষরিক π ${countPi(line)}টা: ${line.trim()}`)
})

check('মেনু পেজের ব্যালেন্স বোতামে একটাই π', () => {
  const menu = pages.slice(pages.indexOf('export function MenuPage()'))
  assert.ok(menu.includes('{formatPi(totalPi)}'), 'মেনু ব্যালেন্স formatPi নয়')
  assert.ok(!menu.includes('π {formatPi(totalPi)}'), 'মেনু ব্যালেন্সে π দুবার')
})

check('ডেটিং লাইভের দুই ব্যালেন্স লাইনে একটাই π', () => {
  const live = pages.slice(pages.indexOf('export function DatingLivePage()'))
  assert.ok(live.includes('Your Pi: <b>{formatPi(totalPi)}</b>'), 'লাইভ Your Pi লাইন নেই')
  assert.ok(!live.includes('π Your Pi'), 'লাইভে π Your Pi এখনো আছে')
  assert.ok(!live.includes('π {formatPi(totalPi)}'), 'লাইভে π {formatPi} এখনো আছে')
  for (const needle of ['Your Pi: <b>{formatPi(totalPi)}</b>']) {
    // লাইনে আক্ষরিক π ০টা — formatPi রানটাইমে একটাই π দেয়
    assert.equal(countPi(lineWith(live, needle)), 0, `লাইভ লাইনে আক্ষরিক π আছে: ${needle}`)
  }
})

check('π Pi (চিহ্ন + শব্দ) জোড়া UI-তে নেই', () => {
  for (const bad of ['π Pi Report', 'π Pi Deposit', 'π Pi Withdraw', 'π Pi Rate', 'Buy π Pi', 'π Pi Gifter']) {
    assert.ok(!pages.includes(bad), `pages-এ ${bad} এখনো আছে`)
  }
  assert.ok(!pay.includes('π Pi Deposit'), 'paymentMethods-এ π Pi Deposit এখনো আছে')
  for (const good of ['📊 Pi Report', 'Pi Deposit</p>', 'Pi Withdraw</p>', 'Pi Rate (set by admin)', '>Buy Pi</Btn>', '>Pi Gifter</span>']) {
    assert.ok(pages.includes(good), `ঠিক করা লেখা নেই: ${good}`)
  }
  assert.ok(pay.includes("'Pi Deposit এখন বন্ধ আছে"), 'Pi Deposit বন্ধ বার্তা ঠিক হয়নি')
})

check('একই অঙ্কে চিহ্ন + শব্দ Pi দুবার নেই (π 5 Pi)', () => {
  assert.ok(!pages.includes('π {referralPiEarned} Pi'), 'রেফারেল আয়ে π + Pi দুবার')
  assert.ok(pages.includes('{formatPi(referralPiEarned)}'), 'রেফারেল আয় formatPi নয়')
  assert.ok(!pages.includes(')} Pi will be added'), 'Pi will be added-এ π + Pi দুবার')
  assert.ok(pages.includes('will be added after admin approval'), 'টপ-আপ বার্তা নেই')
})

check('লেবেল + একক π ঠিক আছে (Pi Balance: π 5 — একটাই চিহ্ন)', () => {
  // 'Pi Balance: π 5' — লেবেলে শব্দ, মানে একটাই চিহ্ন; এগুলো ভুল নয়।
  assert.ok(pages.includes('Pi Balance: <b>{formatPi(totalPi)}</b>'), 'Pi Balance লাইন নেই')
  assert.ok(pages.includes('Current Pi Balance: <b>{formatPi(totalPi)}</b>'), 'Current Pi Balance লাইন নেই')
})

console.log(`\n${passed}/9 passed`)
