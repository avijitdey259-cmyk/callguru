// Profile photo everywhere — a changed profile photo must show in the header,
// feed, friends, chat, search, New Members, Dating and Live instead of
// coloured initials. Run: node tests/profile-photo.test.mjs
// (esbuild bundles the pure modules for Node; Avatar is rendered with
// react-dom/server. No Firebase, no demo data.)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { renderToString } from 'react-dom/server'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-photo-test-'))
async function bundle(entry, name, extra = {}) {
  const outFile = join(outDir, name)
  await build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', platform: 'node', outfile: outFile, logLevel: 'silent', ...extra })
  return import(outFile)
}

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}
async function checkAsync(name, fn) {
  n++
  try { await fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

const PHOTO = 'data:image/jpeg;base64,/9j/abc'
const friendSearch = await bundle('src/friendSearch.ts', 'friendSearch.mjs')
const newMembers = await bundle('src/newMembers.ts', 'newMembers.mjs')
const mapping = await bundle('src/firestoreMapping.ts', 'firestoreMapping.mjs')
const avatarMod = await bundle('src/avatar.tsx', 'avatar.mjs', { jsx: 'automatic' })
const { Avatar } = avatarMod

// --- search plumbing: the publicProfiles photo must survive into results ---
check('mergeAllUsers carries a real user photo into search results', () => {
  const out = friendSearch.mergeAllUsers([], [{ id: 'u1', displayName: 'Rima', colour: '#E91E63', photo: PHOTO }], null)
  assert.equal(out.length, 1)
  assert.equal(out[0].photo, PHOTO)
})
check('mergeAllUsers leaves photo off when the user never set one', () => {
  const out = friendSearch.mergeAllUsers([], [{ id: 'u1', displayName: 'Rima', colour: '#E91E63' }], null)
  assert.equal(out[0].photo, undefined)
})
check('buildSearchablePeople carries a friend photo into search', () => {
  const out = friendSearch.buildSearchablePeople([{ id: 'f1', name: 'Rima', color: '#E91E63', online: true, photo: PHOTO }], [], [])
  assert.equal(out[0].photo, PHOTO)
})
check('buildSearchablePeople leaves photo off for personas (no photo)', () => {
  const out = friendSearch.buildSearchablePeople([], [], [{ id: 'bd-rima', name: 'Rima', color: '#E91E63', online: true }])
  assert.equal(out[0].photo, undefined)
})

// --- publicProfiles mapping: photo in, photo out; junk dropped ---
check('mapPublicProfile keeps a valid photo', () => {
  const m = newMembers.mapPublicProfile('u1', { displayName: 'Rima', colour: '#E91E63', photo: PHOTO })
  assert.equal(m.photo, PHOTO)
})
check('mapPublicProfile drops a non-image photo value', () => {
  const m = newMembers.mapPublicProfile('u1', { displayName: 'Rima', colour: '#E91E63', photo: 'not-a-photo' })
  assert.equal(m.photo, undefined)
})

// --- users/{uid} sync: profilePhoto round-trips, private KYC still excluded ---
function baseState() {
  return {
    name: 'Avijit', email: 'a@example.com', freeFirstMinuteUsed: false, calls: [], friends: [], requests: [],
    likesUsed: 0, premium: false, piBalance: 0, bonusPi: 0, points: 0, referrals: 0, liveEarnings: 0,
    kycStatus: 'none', kycInfo: { name: 'Avijit', dob: '1990-01-01', idType: 'NID', idNumber: '1234567890', idLast4: '7890', selfie: PHOTO, submittedAt: '2026-01-01', verifiedAt: null },
    kycRejectReason: '', referralCode: 'cg-abc123', referrer: null, refWelcomeClaimed: false,
    referralRewarded: false, referralPiEarned: 0, hasToppedUp: false, lastClaimDate: null, streak: 0,
    giftBoxClaimedCycle: null, totalShares: 0, reelShares: {}, giftsSentPi: 0, piWalletAddress: null,
    piDeposits: [], piWithdrawals: [], piLedger: [], profileDob: '', gender: '', district: '', thana: '',
    address: '', hideAddress: false, profilePhoto: PHOTO, galleryPhotos: [], interests: [],
    recoveryEmail: '', recoveryPhone: '', recoveryEmailVerified: false, recoveryPhoneVerified: false,
    twoFactorEnabled: false, datingChatPartnerIds: [],
  }
}
check('toUserDoc/fromUserDoc round-trip profilePhoto', () => {
  const doc = mapping.toUserDoc(baseState())
  assert.equal(doc.profilePhoto, PHOTO)
  const back = mapping.fromUserDoc(doc)
  assert.equal(back.profilePhoto, PHOTO)
})
check('toUserDoc still never syncs NID number / selfie (private)', () => {
  const doc = mapping.toUserDoc(baseState())
  const text = JSON.stringify(doc)
  assert.ok(!text.includes('1234567890'), 'full NID must not sync')
  assert.ok(!('selfie' in doc.kyc), 'kyc must not carry selfie')
  assert.equal(doc.profilePhoto, PHOTO, 'profilePhoto itself still syncs')
})

// --- Avatar component: photo wins, initials only as fallback ---
await checkAsync('Avatar renders the photo when present', async () => {
  const html = renderToString(Avatar({ photo: PHOTO, name: 'Rima', color: '#E91E63', className: 'w-10 h-10' }))
  assert.ok(html.includes('<img'), 'expected an <img>')
  assert.ok(html.includes(PHOTO), 'expected the photo src')
})
await checkAsync('Avatar renders the initial (no img) when no photo', async () => {
  const html = renderToString(Avatar({ name: 'Rima', color: '#E91E63', className: 'w-10 h-10' }))
  assert.ok(!html.includes('<img'), 'no photo means no <img>')
  assert.ok(html.includes('>R<'), 'expected the R initial')
})

// --- source guards: every avatar render site uses the photo when it has one ---
// The only remaining initial-only avatars are places with no photo source at
// all: experts (backend sends no photo), the link-call screen (caller known
// by name only), and People You May Know (empty suggestion list, no photos).
const read = (f) => readFileSync(join(root, f), 'utf8')
check('no avatar site renders initials while ignoring an available photo', () => {
  for (const f of ['src/pages.tsx', 'src/components.tsx', 'src/searchUI.tsx', 'src/IncomingCallOverlay.tsx']) {
    const src = read(f)
    for (const line of src.split('\n')) {
      if (!line.includes('.slice(0, 1)')) continue
      const ok = line.includes('expert.avatarColor') // experts: no photo in backend
        || (f === 'src/pages.tsx' && line.includes('{name.slice(0, 1)}')) // link-call screen: name only
        || (f === 'src/pages.tsx' && line.includes('s.color')) // People You May Know: no photos
        || line.includes('user.name.slice(0, 1)') // Menu/TopBar fallback branch (photo branch is the <img> above it)
        || line.includes("(user?.name || 'Y').slice(0, 1)") // composer fallback branch (photo branch is the <img> above it)
        || line.includes('p.displayName.slice(0, 1)') // Dating card fallback branch (photo branch is the <img> above it)
      assert.ok(ok, `${f}: initial-only avatar with no documented reason: ${line.trim()}`)
    }
  }
})
check('removed profile photo clears publicProfiles (deleteField)', () => {
  const src = read('src/firestore.ts')
  assert.ok(src.includes("extraFields.photo === ''"), 'photo removal must be handled')
  assert.ok(src.includes('deleteField()'), 'removed photo must delete the field, not keep the stale photo')
})
check('store refreshes friend photos from publicProfiles', () => {
  const src = read('src/store.tsx')
  assert.ok(src.includes('fetchAllPublicProfiles'), 'store must fetch public profiles to refresh friend photos')
  assert.ok(src.includes('photo?: string'), 'Friend must carry a photo')
})
