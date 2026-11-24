// Payment method on/off toggles — Admin Settings flags in
// adminSettings.payments.enabled; Wallet top-up shows only enabled methods,
// falls back when the selected method is disabled, and shows a clean
// message when all are off. Toggling off never erases the saved number/address.
// Run: node tests/payment-methods.test.mjs
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const store = read('src/store.tsx')
const mappingSrc = read('src/firestoreMapping.ts')

// paymentMethods.ts + firestoreMapping.ts are pure — bundle + import for real checks.
const outDir = mkdtempSync(join(tmpdir(), 'picall-payments-test-'))
const pmFile = join(outDir, 'paymentMethods.mjs')
await build({
  entryPoints: [join(root, 'src/paymentMethods.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: pmFile,
  logLevel: 'silent',
})
const PM = await import(pmFile)
const mapFile = join(outDir, 'mapping.mjs')
await build({
  entryPoints: [join(root, 'src/firestoreMapping.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: mapFile,
  logLevel: 'silent',
})
const M = await import(mapFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('Payment method toggles tests:')

check('legacy/empty enabled map means every method is on', () => {
  assert.deepEqual(PM.normalizePaymentEnabled(undefined), { bkash: true, nagad: true, rocket: true, usdt: true, binancePay: true, piDeposit: true })
  assert.deepEqual(PM.normalizePaymentEnabled({}), { bkash: true, nagad: true, rocket: true, usdt: true, binancePay: true, piDeposit: true })
  assert.deepEqual(PM.enabledTopUpMethods(undefined), ['bKash', 'Nagad', 'Rocket', 'USDT', 'Binance Pay'])
})

check('partial enabled map keeps missing methods on', () => {
  assert.deepEqual(PM.normalizePaymentEnabled({ bkash: false }), { bkash: false, nagad: true, rocket: true, usdt: true, binancePay: true, piDeposit: true })
  assert.equal(PM.isPaymentMethodEnabled({ bkash: false }, 'bkash'), false)
  assert.equal(PM.isPaymentMethodEnabled({ bkash: false }, 'nagad'), true)
})

check('toggle off hides the method from top-up', () => {
  const enabled = { bkash: false, nagad: true, rocket: true, usdt: true, binancePay: true, piDeposit: true }
  assert.deepEqual(PM.enabledTopUpMethods(enabled), ['Nagad', 'Rocket', 'USDT', 'Binance Pay'])
  assert.equal(PM.resolveTopUpMethod(enabled, 'bKash'), 'Nagad')
})

check('toggle on brings the method back', () => {
  const enabled = { bkash: false, nagad: true, rocket: true, usdt: true, binancePay: true, piDeposit: true }
  const backOn = { ...enabled, bkash: true }
  assert.deepEqual(PM.enabledTopUpMethods(backOn), ['bKash', 'Nagad', 'Rocket', 'USDT', 'Binance Pay'])
  assert.equal(PM.resolveTopUpMethod(backOn, 'bKash'), 'bKash')
})

check('disabled selected method falls back to the first enabled one', () => {
  const enabled = { bkash: false, nagad: false, rocket: true, usdt: false, binancePay: true, piDeposit: true }
  assert.equal(PM.resolveTopUpMethod(enabled, 'bKash'), 'Rocket')
  assert.equal(PM.resolveTopUpMethod(enabled, 'Binance Pay'), 'Binance Pay')
})

check('all methods off resolves to null and shows the all-off message', () => {
  const allOff = { bkash: false, nagad: false, rocket: false, usdt: false, binancePay: false, piDeposit: false }
  assert.deepEqual(PM.enabledTopUpMethods(allOff), [])
  assert.equal(PM.resolveTopUpMethod(allOff, 'bKash'), null)
  assert.equal(PM.PAYMENTS_ALL_DISABLED_MESSAGE, 'কোনো পেমেন্ট মাধ্যম এখন চালু নেই — অ্যাডমিনকে জানান')
  assert.equal(PM.isPaymentMethodEnabled(allOff, 'piDeposit'), false)
})

check('config/public round-trip keeps the flags AND the numbers', () => {
  const payments = {
    bkash: '01XXXXXXXX1', nagad: '01XXXXXXXX2', rocket: '01XXXXXXXX3',
    usdtBep20: '0xbep', usdtErc20: '0xerc', binancePayId: 'BP-1',
    piDepositAddress: 'GABC', piTestnetAddress: '',
    enabled: { bkash: false, nagad: true, rocket: true, usdt: false, binancePay: true, piDeposit: false },
  }
  const doc = M.toPublicConfig({ piRateBDT: 100, usdtRateBDT: 120, piWithdrawFeePct: 1, datingRate: 1, liveRate: 1 }, payments, '', M.EMPTY_ANALYTICS_IDS)
  const back = M.fromPublicConfig(doc)
  assert.deepEqual(back.payments.enabled, payments.enabled)
  assert.equal(back.payments.bkash, '01XXXXXXXX1')
  assert.equal(back.payments.usdtBep20, '0xbep')
  assert.equal(back.payments.piDepositAddress, 'GABC')
})

check('toggling a method off then on never erases its number (round-trip)', () => {
  const payments = {
    bkash: '01XXXXXXXX1', nagad: '', rocket: '', usdtBep20: '', usdtErc20: '',
    binancePayId: '', piDepositAddress: '', piTestnetAddress: '',
    enabled: { bkash: true, nagad: true, rocket: true, usdt: true, binancePay: true, piDeposit: true },
  }
  const off = M.toPublicConfig({ piRateBDT: 100, usdtRateBDT: 120, piWithdrawFeePct: 1, datingRate: 1, liveRate: 1 }, { ...payments, enabled: { ...payments.enabled, bkash: false } }, '', M.EMPTY_ANALYTICS_IDS)
  assert.equal(M.fromPublicConfig(off).payments.bkash, '01XXXXXXXX1')
  assert.equal(M.fromPublicConfig(off).payments.enabled.bkash, false)
  const on = M.toPublicConfig({ piRateBDT: 100, usdtRateBDT: 120, piWithdrawFeePct: 1, datingRate: 1, liveRate: 1 }, { ...payments, enabled: { ...payments.enabled, bkash: true } }, '', M.EMPTY_ANALYTICS_IDS)
  assert.equal(M.fromPublicConfig(on).payments.bkash, '01XXXXXXXX1')
  assert.equal(M.fromPublicConfig(on).payments.enabled.bkash, true)
})

check('legacy config/public doc without enabled still reads (all on by default)', () => {
  const legacy = { schemaVersion: 1, piRateBDT: 100, usdtRateBDT: 120, piWithdrawFeePct: 1, datingRate: 1, liveRate: 1, tvPlaylistUrl: '', payments: { bkash: '01XXXXXXXX1', nagad: '', rocket: '', usdtBep20: '', usdtErc20: '', binancePayId: '', piDepositAddress: '', piTestnetAddress: '' } }
  const back = M.fromPublicConfig(legacy)
  assert.equal(back.payments.bkash, '01XXXXXXXX1')
  assert.equal(back.payments.enabled, undefined)
  assert.deepEqual(PM.enabledTopUpMethods(back.payments.enabled), ['bKash', 'Nagad', 'Rocket', 'USDT', 'Binance Pay'])
})

check('store keeps the flags in adminSettings.payments.enabled', () => {
  assert.ok(store.includes('enabled: PaymentEnabledMap'), 'PaymentSettings must carry an enabled map')
  assert.ok(store.includes('enabled: { ...DEFAULT_PAYMENT_ENABLED }'), 'default payments must enable all methods')
  assert.ok(store.includes('normalizePaymentEnabled'), 'store must normalize legacy payments without enabled')
})

check('Wallet top-up renders only enabled methods + the all-off message', () => {
  assert.ok(pages.includes('enabledTopUpMethods(adminSettings.payments.enabled)'), 'top-up buttons must come from the enabled list')
  assert.ok(pages.includes('resolveTopUpMethod(adminSettings.payments.enabled, method)'), 'selected method must fall back to the first enabled one')
  assert.ok(pages.includes('PAYMENTS_ALL_DISABLED_MESSAGE'), 'all-off state must render the message')
  assert.ok(!pages.includes("['bKash', 'Nagad', 'Rocket', 'USDT', 'Binance Pay']"), 'top-up buttons must no longer be a hardcoded list')
})

check('Pi Deposit card is gated by the piDeposit flag', () => {
  assert.ok(pages.includes("isPaymentMethodEnabled(adminSettings.payments.enabled, 'piDeposit')"), 'Pi Deposit must check its flag')
  assert.ok(pages.includes('PI_DEPOSIT_DISABLED_MESSAGE'), 'disabled Pi Deposit must show its message')
})

check('Admin Settings has one toggle per method (6)', () => {
  for (const [id, label] of [['bkash', 'bKash'], ['nagad', 'Nagad'], ['rocket', 'Rocket'], ['usdt', 'USDT'], ['binancePay', 'Binance Pay'], ['piDeposit', 'Pi Deposit']]) {
    assert.ok(pages.includes(`payToggle('${id}'`), `missing admin toggle for ${label}`)
  }
  assert.ok(pages.includes('togglePayMethod'), 'admin toggle handler must exist')
  assert.ok(mappingSrc.includes('enabled'), 'firestore mapping must carry the flags')
})

console.log(`\nPayment method toggles: ${passed} passed.`)
