// Wallet Pi balance BDT value test — balance shows its Taka value at the
// admin-set Pi rate.
// Run: node tests/wallet-bdt.test.mjs
// যাচাই করে:
//   ১) Wallet পেজে বড় Pi ব্যালেন্সের নিচে সরাসরি "≈ ৳X" (totalPi × piRateBDT)
//   ২) Withdrawable লাইনেও তার BDT মান (piBalance × piRateBDT)
//   ৩) দর স্টোরের piRateBDT থেকে আসে — কোথাও হার্ডকোড দর নেই
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

const walletStart = pages.indexOf('export function WalletPage()')
assert.ok(walletStart !== -1, 'WalletPage নেই')
const wallet = pages.slice(walletStart, pages.indexOf('export function ', walletStart + 1))

check('Wallet: total Pi balance shows its BDT value directly underneath (totalPi x piRateBDT)', () => {
  assert.ok(wallet.includes('{formatPi(totalPi)}'), 'বড় Pi ব্যালেন্স নেই')
  assert.ok(wallet.includes('formatBDT(totalPi * piRateBDT)'), 'মোট ব্যালেন্সের BDT মান নেই')
  // the BDT line sits right under the big balance line
  const bal = wallet.indexOf('{formatPi(totalPi)}')
  const bdt = wallet.indexOf('formatBDT(totalPi * piRateBDT)')
  assert.ok(bdt > bal && bdt - bal < 300, 'BDT মান ব্যালেন্সের ঠিক নিচে নেই')
  assert.ok(wallet.includes('≈'), '≈ চিহ্ন নেই')
})

check('Wallet: Withdrawable line also shows its BDT value (piBalance x piRateBDT)', () => {
  assert.ok(wallet.includes('formatBDT(piBalance * piRateBDT)'), 'Withdrawable-এর BDT মান নেই')
  assert.ok(wallet.includes('Withdrawable:'), 'Withdrawable লাইন নেই')
})

check('Wallet: rate comes from the store piRateBDT — no hardcoded rate', () => {
  assert.ok(wallet.includes('piRateBDT'), 'piRateBDT ব্যবহার নেই')
  // no hardcoded "x 100" style conversion in the Wallet card
  const card = wallet.slice(0, wallet.indexOf('Reward Points'))
  assert.ok(!/totalPi \* 100|piBalance \* 100/.test(card), 'হার্ডকোড ১০০ দর আছে')
})

console.log(`\nwallet-bdt.test.mjs: ${n} checks run`)
