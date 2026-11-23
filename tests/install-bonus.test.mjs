// ইন্সটল বোনাস টেস্ট — ৫ π একবারই, শুধু গিফটে; কল/তোলা গিফট Pi ছোঁয় না।
// চালানো: রিপো রুট থেকে `node tests/install-bonus.test.mjs`
// (src/giftPi.ts-এর pure logic esbuild দিয়ে বান্ডল করে চালায়; store/pages-এর
//  গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const compSrc = readFileSync(join(root, 'src/components.tsx'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-install-test-'))
const outFile = join(outDir, 'giftPi.mjs')
await build({
  entryPoints: [join(root, 'src/giftPi.ts')],
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

// ---- দাবি-একবার: দ্বিতীয় ইন্সটল ইভেন্টে ০ ----
check('ইন্সটল বোনাস একবারই — দ্বিতীয়বার ০', () => {
  assert.equal(M.INSTALL_BONUS_PI, 5)
  let claimed = false
  let gift = 0
  const claim = () => {
    if (!M.canClaimInstallBonus(claimed)) return 0
    claimed = true
    gift = Math.round((gift + M.INSTALL_BONUS_PI) * 100000) / 100000
    return M.INSTALL_BONUS_PI
  }
  assert.equal(claim(), 5)
  assert.equal(gift, 5)
  assert.equal(claim(), 0)
  assert.equal(gift, 5)
  assert.equal(claim(), 0)
  assert.equal(gift, 5)
})

// ---- গিফটের খরচ: গিফট Pi আগে, তারপর বোনাস, তারপর মূল ----
check('গিফট কিনলে গিফট Pi-ই আগে কাটে', () => {
  const r = M.planGiftSpend(5, 1, 20, 0.1)
  assert.deepEqual(r, { fromGift: 0.1, fromBonus: 0, fromMain: 0, ok: true })
})

check('গিফট Pi শেষ হলে বোনাস, তারপর মূল ব্যালেন্স কাটে', () => {
  const r1 = M.planGiftSpend(0.05, 1, 20, 0.1)
  assert.deepEqual(r1, { fromGift: 0.05, fromBonus: 0.05, fromMain: 0, ok: true })
  const r2 = M.planGiftSpend(0.05, 0.02, 20, 0.1)
  assert.deepEqual(r2, { fromGift: 0.05, fromBonus: 0.02, fromMain: 0.03, ok: true })
})

check('মোটের চেয়ে বেশি চাইলে কিছুই কাটে না', () => {
  const r = M.planGiftSpend(0, 0, 0.05, 0.1)
  assert.deepEqual(r, { fromGift: 0, fromBonus: 0, fromMain: 0, ok: false })
  assert.equal(M.planGiftSpend(5, 1, 20, 0).ok, false)
  assert.equal(M.planGiftSpend(5, 1, 20, -1).ok, false)
})

// ---- খতিয়ান মেলে: বোনাস + খরচের পর মোট Pi ঠিক থাকে ----
check('বোনাস + গিফট খরচের পর মোট Pi ও খতিয়ান মেলে', () => {
  let pi = 20, bonus = 1, gift = 0
  // ইন্সটল বোনাস +৫
  gift += M.INSTALL_BONUS_PI
  const ledger = [M.INSTALL_BONUS_PI]
  // গিফট ০.১ কেনা (গিফট Pi থেকে)
  const plan = M.planGiftSpend(gift, bonus, pi, 0.1)
  assert.equal(plan.ok, true)
  gift = Math.round((gift - plan.fromGift) * 100000) / 100000
  bonus = Math.round((bonus - plan.fromBonus) * 100000) / 100000
  pi = Math.round((pi - plan.fromMain) * 100000) / 100000
  ledger.push(-0.1)
  const total = Math.round((pi + bonus + gift) * 100000) / 100000
  const ledgerSum = Math.round(ledger.reduce((s, x) => s + x, 0) * 100000) / 100000
  assert.equal(total, 25.9)
  assert.equal(ledgerSum, 4.9)
  assert.equal(gift, 4.9)
})

// ---- গঠন: কল/তোলার পথ গিফট Pi ছোঁয় না ----
check('কলের খরচের পথ (spendPiImpl) গিফট Pi ছোঁয় না', () => {
  const start = storeSrc.indexOf('const spendPiImpl')
  const end = storeSrc.indexOf('const spendGiftPiImpl', start)
  assert.ok(start > 0 && end > start)
  const body = storeSrc.slice(start, end)
  assert.ok(!body.includes('setGiftPi'), 'spendPiImpl-এ setGiftPi আছে')
  assert.ok(!body.includes('balRef.current.gift'), 'spendPiImpl-এ gift ব্যালেন্স আছে')
})

check('তোলা শুধু piBalance থেকে — giftPi তোলা যায় না', () => {
  assert.ok(storeSrc.includes("if (!Number.isFinite(m) || m < min || m > piBalance) return false"))
  const wdStart = storeSrc.indexOf('withdrawPi:')
  assert.ok(wdStart > 0)
  const wdBody = storeSrc.slice(wdStart, wdStart + 600)
  assert.ok(!wdBody.includes('giftPi'), 'withdrawPi-তে giftPi আছে')
})

check('স্টোরে giftPi + installBonusClaimed + appinstalled/standalone ধরা আছে', () => {
  assert.ok(storeSrc.includes("load('giftPi', 0)"))
  assert.ok(storeSrc.includes("load('installBonusClaimed', false)"))
  assert.ok(storeSrc.includes('claimInstallBonus'))
  assert.ok(storeSrc.includes("window.addEventListener('appinstalled'"))
  assert.ok(storeSrc.includes("display-mode: standalone"))
  assert.ok(storeSrc.includes('totalPi: roundPi(piBalance + bonusPi + giftPi)'))
  assert.ok(storeSrc.includes('from gift Pi'))
  assert.ok(storeSrc.includes("recordPi('Install Bonus'"))
})

// ---- গিফট পাঠানো spendGiftPi দিয়ে হয় ----
check('লাইভ গিফট spendGiftPi দিয়ে যায়', () => {
  assert.ok(pagesSrc.includes("spendGiftPi(g.pi, 'Gifts Sent'"))
})

// ---- হোম ব্যানার: স্টোরি স্ট্রিপের উপরে, দাবির পর ছোট লাইন ----
check('হোমে ইন্সটল ব্যানার স্টোরির উপরে; দাবির পর ছোট লাইন', () => {
  const banner = pagesSrc.indexOf('Install the app and get 5 π free!')
  const stories = pagesSrc.indexOf('Your Story')
  assert.ok(banner > 0 && stories > 0 && banner < stories, 'ব্যানার স্টোরির উপরে নেই')
  assert.ok(pagesSrc.includes('Install and get a 5 π bonus — gifts only.'))
  assert.ok(pagesSrc.includes('Install bonus received — 5 π gift Pi added'))
  assert.ok(compSrc.includes('Install the app for a 5 π bonus — gifts only.'))
})

// ---- ওয়ালেট: একটাই মোট Pi, আলাদা গিফট Pi লাইন নেই ----
check('ওয়ালেটে একটাই মোট Pi — আলাদা গিফট Pi লাইন নেই', () => {
  const start = pagesSrc.indexOf('export function WalletPage()')
  const end = pagesSrc.indexOf('// ---------- Friends', start)
  const wallet = pagesSrc.slice(start, end)
  assert.ok(wallet.includes('π {formatPi(totalPi)}'), 'একটাই মোট Pi (ব্যালেন্স কার্ড) নেই')
  assert.ok(!wallet.includes('Total Pi: <b>'), 'Pi Wallet-এ বারবার মোট Pi লাইন আছে')
  assert.ok(!wallet.includes('Current Pi Balance:'), 'Pi Report-এ বারবার মোট Pi লাইন আছে')
  assert.ok(!wallet.includes('gift Pi'), 'ওয়ালেটে আলাদা গিফট Pi লাইন আছে')
})

console.log(`\n${passed}/11 passed`)
