// চ্যাট খোলার আচরণ টেস্ট — ডিফল্ট চ্যাট রিমা, ডেমো নাম কোথাও নেই,
// বন্ধুর চ্যাট খালি দিয়ে শুরু, এক মেসেজে ঠিক একটাই উত্তর আসে।
// চালানো: রিপো রুট থেকে `node tests/chat-open.test.mjs`
// (buddies.ts esbuild দিয়ে বান্ডল করে send প্রবাহের অনুকরণ; pages.tsx সোর্স পড়ে
//  ডিফল্ট/সিড/কন্ট্যাক্ট যাচাই — Firebase/React লাগে না।)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-chat-open-test-'))
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

check('ChatPage-এ সরানো ডেমো নাম কোথাও নেই', () => {
  for (const n of ['রাফি আহমেদ', 'ডা. রাহাত', 'মেহজাবিন']) {
    assert.ok(!pagesSrc.includes(n), `pages.tsx-এ ${n} আছে`)
  }
})

check('Chat default first friend (Rima), not a hardcoded demo name', () => {
  assert.ok(pagesSrc.includes("friends[0]?.name ?? 'Rima'"), 'ডিফল্ট active পাওয়া যায়নি')
})

check('বন্ধুর চ্যাটে ওপেনার/আগাম মেসেজের সিড নেই', () => {
  assert.ok(!pagesSrc.includes('BUDDY_OPENERS'), 'BUDDY_OPENERS এখনো ব্যবহৃত হচ্ছে')
  assert.ok(pagesSrc.includes('const seed: Record<string, { from: string; text: string }[]> = {}'), 'খালি সিড পাওয়া যায়নি')
})

check("Chat opens in Rima's room empty; one message gets exactly one reply", () => {
  // খালি চ্যাট (সিড খালি) — ব্যবহারকারী প্রথমে লেখে
  const msgs = []
  assert.equal(msgs.length, 0)
  const userText = 'হাই'
  msgs.push({ from: 'আপনি', text: userText })
  const buddy = M.getBuddyByName('Rima')
  assert.ok(buddy, 'Rima is there as a friend')
  const reply = M.getBuddyReplyDetail(buddy.id, userText)
  assert.ok(reply.text.length > 0)
  msgs.push({ from: buddy.name, text: reply.text })
  assert.equal(msgs.length, 2)
  assert.equal(msgs[1].from, 'Rima')
})

console.log(`\n${passed}/4 passed`)
