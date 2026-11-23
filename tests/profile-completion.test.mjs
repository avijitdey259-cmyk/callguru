// Profile completion — weights must total 100 (name 15 + photo 15 + DOB 10 +
// gender 10 + district 10 + thana/address 10 + gallery 15 scaled, full at 6+ +
// interests 15). Run: node tests/profile-completion.test.mjs
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-profile-test-'))
const outFile = join(outDir, 'profile.mjs')
await build({
  entryPoints: [join(root, 'src/profile.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const P = await import(outFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}
const empty = { profileDob: '', gender: '', district: '', thana: '', address: '', hideAddress: false, profilePhoto: '', galleryPhotos: [], interests: [] }
const full = { profileDob: '1995-01-01', gender: 'Female', district: 'Chattogram', thana: 'Panchlaish', address: 'House 12', hideAddress: false, profilePhoto: 'data:image/jpeg;base64,A', galleryPhotos: ['a', 'b', 'c', 'd', 'e', 'f'], interests: ['Music'] }

console.log('Profile completion tests:')
check('empty profile = 0%', () => assert.equal(P.profileCompletion('', empty), 0))
check('full profile = 100%', () => assert.equal(P.profileCompletion('Avijit', full), 100))
check('name alone = 15%', () => assert.equal(P.profileCompletion('Avijit', empty), 15))
check('3 gallery photos = 8% (half of 15, rounded)', () => assert.equal(P.profileCompletion('', { ...empty, galleryPhotos: ['a', 'b', 'c'] }), 8))
check('6 gallery photos = full 15%', () => assert.equal(P.profileCompletion('', { ...empty, galleryPhotos: ['a', 'b', 'c', 'd', 'e', 'f'] }), 15))
check('8 gallery photos still = 15% (capped at 6)', () => assert.equal(P.profileCompletion('', { ...empty, galleryPhotos: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }), 15))
check('thana alone counts for thana+address 10%', () => assert.equal(P.profileCompletion('', { ...empty, thana: 'Panchlaish' }), 10))
check('one interest = 15%', () => assert.equal(P.profileCompletion('', { ...empty, interests: ['Cricket'] }), 15))
check('never exceeds 100%', () => assert.equal(P.profileCompletion('Avijit', { ...full, galleryPhotos: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }), 100))

console.log(`\nAll ${passed} profile completion tests passed.`)
