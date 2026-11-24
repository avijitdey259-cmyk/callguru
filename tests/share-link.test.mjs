// শেয়ার লিংক / QR টেস্ট — লিংকে ট্যাপ করলেই শেয়ার শিট, QR ট্যাপেও শেয়ার,
// শিট বন্ধ করা ব্যর্থতা নয়, আসল ব্যর্থতায় সত্যি বার্তা।
// চালানো: রিপো রুট থেকে `node tests/share-link.test.mjs`
// (esbuild দিয়ে src/share.ts বান্ডল করে Node-এ চালায়; পেজের গঠন সোর্স
// পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) শেয়ার শিট বন্ধ করা (AbortError) = cancelled, বাকি ভুল = failed
//   ২) QR লিংক — ইনভাইট লিংকই এনকোড করা, সাইজ ঠিক, বিশেষ অক্ষর এনকোড হয়
//   ৩) shareLink — cancelled আলাদা করে, clipboard ফলব্যাক আছে
//   ৪) InviteCard — লিংক নিজেই ট্যাপ করা যায় (বোতাম), QR ছবি আছে + ট্যাপে
//      শেয়ার, লোড না হলে লুকায়, ব্যর্থতায় সত্যি বার্তা
//   ৫) Wallet অ্যাফিলিয়েট লিংক — ট্যাপে শেয়ার হয়, বার্তা দেখায়
//   ৬) পোস্ট শেয়ার + Live TV শেয়ার — শিট বন্ধ করলে ভুল বার্তা নয়
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-share-test-'))
const outFile = join(outDir, 'share.mjs')
await build({ entryPoints: [join(root, 'src/share.ts')], bundle: true, format: 'esm', platform: 'node', outfile: outFile, logLevel: 'silent' })
const S = await import(outFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('শেয়ার শিট বন্ধ করা (AbortError) = cancelled, বাকি ভুল = failed', () => {
  const abort = new DOMException('The user aborted a request.', 'AbortError')
  assert.equal(S.shareErrorToResult(abort), 'cancelled')
  assert.equal(S.shareErrorToResult(new Error('boom')), 'failed')
  assert.equal(S.shareErrorToResult(new DOMException('x', 'NotAllowedError')), 'failed')
  assert.equal(S.shareErrorToResult(null), 'failed')
})

check('QR লিংক — ইনভাইট লিংকই এনকোড করা, সাইজ ঠিক, বিশেষ অক্ষর এনকোড হয়', () => {
  const url = S.inviteQrUrl('https://picallbd.web.app/?ref=ABC123')
  assert.ok(url.startsWith('https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='), 'QR API লিংক নয়')
  assert.ok(url.includes('https%3A%2F%2Fpicallbd.web.app%2F%3Fref%3DABC123'), 'লিংক এনকোড হয়নি')
  assert.ok(S.inviteQrUrl('https://x.test/?ref=A', 240).includes('size=240x240'), 'সাইজ বদলায় না')
})

check('shareLink — cancelled আলাদা করে, clipboard ফলব্যাক আছে', () => {
  assert.ok(pagesSrc.includes("Promise<ShareResult>"), 'shareLink ShareResult ফেরায় না')
  assert.ok(pagesSrc.includes('shareErrorToResult(err)'), 'AbortError আলাদা করা হয় না')
  assert.ok(pagesSrc.includes('navigator.clipboard.writeText'), 'clipboard ফলব্যাক নেই')
})

const inviteStart = pagesSrc.indexOf('export function InviteCard()')
const inviteEnd = pagesSrc.indexOf('export function DailyBonusCard()')
const invite = pagesSrc.slice(inviteStart, inviteEnd)

check('InviteCard — লিংক নিজেই ট্যাপ করা যায় (বোতাম), QR ছবি আছে + ট্যাপে শেয়ার', () => {
  assert.ok(invite.includes('<button onClick={share}'), 'লিংক ট্যাপ করা যায় না — এখনো শুধু লেখা')
  assert.ok(invite.includes('title="Tap to share your link"'), 'লিংকে ট্যাপের ইঙ্গিত নেই')
  assert.ok(invite.includes('inviteQrUrl(link)'), 'QR ছবিতে ইনভাইট লিংক নেই')
  assert.ok(invite.includes('alt="Invite QR code — tap to share"'), 'QR ছবির বর্ণনা নেই')
  assert.ok(invite.includes('onError={() => setQrHidden(true)}'), 'QR লোড না হলে লুকায় না')
  assert.ok(invite.includes('Sharing is not supported here — tap Copy Link.'), 'ব্যর্থতায় সত্যি বার্তা নেই')
})

check('Wallet অ্যাফিলিয়েট লিংক — ট্যাপে শেয়ার হয়, বার্তা দেখায়', () => {
  const wStart = pagesSrc.indexOf('export function WalletPage()')
  const wEnd = pagesSrc.indexOf('export function FriendsPage()')
  const wallet = pagesSrc.slice(wStart, wEnd)
  assert.ok(wallet.includes('<button onClick={shareAffiliateLink}'), 'অ্যাফিলিয়েট লিংক ট্যাপ করা যায় না')
  assert.ok(wallet.includes('shareLink('), 'অ্যাফিলিয়েট শেয়ার shareLink ডাকে না')
  assert.ok(wallet.includes('affiliateMsg'), 'অ্যাফিলিয়েট শেয়ারের বার্তা নেই')
})

check('পোস্ট শেয়ার + Live TV শেয়ার — শিট বন্ধ করলে ভুল বার্তা নয়', () => {
  assert.ok(pagesSrc.includes("if (result === 'cancelled') return"), 'পোস্ট শেয়ারে cancel চুপচাপ নয়')
  assert.ok(pagesSrc.includes("r === 'cancelled' ? ''"), 'Live TV শেয়ারে cancel চুপচাপ নয়')
})

console.log(`\nshare-link: ${passed} checks passed`)
