// সাউন্ড সেটিংস + রিংটোন টেস্ট।
// চালানো: রিপো রুট থেকে `node tests/sounds.test.mjs`
// (esbuild দিয়ে src/sounds.ts বান্ডল করে Node-এ চালায়; startRingtone
// Node-এ window না থাকায় null ফেরে — ব্রাউজারেই বাজে।)
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-sounds-test-'))
const outFile = join(outDir, 'sounds.mjs')
await build({
  entryPoints: [join(root, 'src/sounds.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const S = await import(outFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('ডিফল্ট: রিংটোন চালু, ভলিউম ০.৮', () => {
  assert.equal(S.DEFAULT_SOUND_SETTINGS.ringtoneEnabled, true)
  assert.equal(S.DEFAULT_SOUND_SETTINGS.volume, 0.8)
})

check('কিছু না থাকলে ডিফল্ট ফেরে', () => {
  assert.deepEqual(S.loadSoundSettings(null), S.DEFAULT_SOUND_SETTINGS)
  assert.deepEqual(S.loadSoundSettings(undefined), S.DEFAULT_SOUND_SETTINGS)
  assert.deepEqual(S.loadSoundSettings({}), S.DEFAULT_SOUND_SETTINGS)
})

check('আংশিক সংরক্ষণ ডিফল্টের সাথে মেশে', () => {
  assert.deepEqual(S.loadSoundSettings({ ringtoneEnabled: false }), { ringtoneEnabled: false, volume: 0.8 })
  assert.deepEqual(S.loadSoundSettings({ volume: 0.3 }), { ringtoneEnabled: true, volume: 0.3 })
})

check('ভুল মান ডিফল্টে ফেরে', () => {
  assert.deepEqual(S.loadSoundSettings({ ringtoneEnabled: 'yes', volume: 5 }), S.DEFAULT_SOUND_SETTINGS)
  assert.deepEqual(S.loadSoundSettings({ volume: -1 }), { ringtoneEnabled: true, volume: 0.8 })
})

check('রিংটোন: চালু থাকলে বাজে, বন্ধ/কলে থাকলে নয়', () => {
  assert.equal(S.shouldPlayRingtone(S.DEFAULT_SOUND_SETTINGS, false), true)
  assert.equal(S.shouldPlayRingtone({ ringtoneEnabled: false, volume: 0.8 }, false), false)
  assert.equal(S.shouldPlayRingtone(S.DEFAULT_SOUND_SETTINGS, true), false)
})

check('Node-এ (window নেই) startRingtone null ফেরে — ক্র্যাশ নয়', () => {
  assert.equal(S.startRingtone(S.DEFAULT_SOUND_SETTINGS), null)
})

console.log(`\n${passed}/6 passed`)
