// Reels page — Upload Reel entry point + honest video-upload failure.
// Run: node tests/reels-upload.test.mjs
// (esbuild bundles src/videoUpload.ts and runs it in Node with mocked storage.)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-reels-upload-test-'))
const outFile = join(outDir, 'videoUpload.mjs')
await build({
  entryPoints: [join(root, 'src/videoUpload.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

const pages = read('src/pages.tsx')
const videoUpload = read('src/videoUpload.ts')

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

const storageErr = (code, message = '') => {
  const e = new Error(message || code)
  e.code = code
  return e
}
const mockDeps = (impl) => ({
  getFirebaseApp: () => ({ name: 'test-app' }),
  getStorage: (app) => ({ app, bucket: 'test-bucket' }),
  storageRef: (storage, path) => ({ storage, path }),
  uploadBytes: async (ref, file) => ({ ref }),
  getDownloadURL: async (ref) => `https://example.com/${ref.path}`,
  ...impl,
})
const fakeFile = { name: 'my reel.mp4', size: 1024 }

// ---------- (b) Storage-disabled failure shows the honest message ----------
check('storage/unauthorized maps to the storage-off message, not a connection error', () => {
  const msg = M.videoUploadErrorMessage(storageErr('storage/unauthorized', 'User does not have permission to access this object.'))
  assert.equal(msg, M.VIDEO_UPLOAD_STORAGE_DISABLED_MESSAGE)
  assert.match(msg, /cloud storage is off/i)
  assert.match(msg, /connection is fine/i)
  assert.doesNotMatch(msg, /check your connection/i)
})
check('storage/unknown with a missing-bucket message maps to the storage-off message', () => {
  const msg = M.videoUploadErrorMessage(storageErr('storage/unknown', 'Firebase Storage: No default bucket found.'))
  assert.equal(msg, M.VIDEO_UPLOAD_STORAGE_DISABLED_MESSAGE)
})
check('storage/bucket-not-found maps to the storage-off message', () => {
  assert.equal(M.videoUploadErrorMessage(storageErr('storage/bucket-not-found')), M.VIDEO_UPLOAD_STORAGE_DISABLED_MESSAGE)
})
check('a plain network failure still says connection, never storage-off', () => {
  const msg = M.videoUploadErrorMessage(new Error('Failed to fetch'))
  assert.equal(msg, M.VIDEO_UPLOAD_NETWORK_MESSAGE)
  assert.match(msg, /check your connection/i)
  assert.doesNotMatch(msg, /cloud storage is off/i)
})
check('storage/retry-limit-exceeded (network) still says connection', () => {
  assert.equal(M.videoUploadErrorMessage(storageErr('storage/retry-limit-exceeded')), M.VIDEO_UPLOAD_NETWORK_MESSAGE)
})
check('storage/unknown with an unrelated message is NOT mislabelled as storage-off', () => {
  assert.equal(M.videoUploadErrorMessage(storageErr('storage/unknown', 'Something unexpected happened.')), M.VIDEO_UPLOAD_NETWORK_MESSAGE)
})
check('new messages are English-only (no Bangla in UI strings)', () => {
  for (const s of [M.VIDEO_UPLOAD_STORAGE_DISABLED_MESSAGE, M.VIDEO_UPLOAD_NETWORK_MESSAGE]) {
    assert.doesNotMatch(s, /[\u0980-\u09FF]/, `Bangla in message: ${s}`)
  }
})

// ---------- (b) upload path still works with mocked storage ----------
await checkAsync('successful upload with mocked storage returns the download URL', async () => {
  const url = await M.uploadVideoFile(fakeFile, 'uid-123', mockDeps())
  assert.match(url, /^https:\/\/example\.com\/uploads\/uid-123\/\d+-my_reel\.mp4$/)
})
await checkAsync('upload still calls uploadBytes with the file under uploads/<uid>/', async () => {
  let seen = null
  const url = await M.uploadVideoFile(fakeFile, 'uid-123', mockDeps({
    uploadBytes: async (ref, file) => { seen = { ref, file }; return { ref } },
  }))
  assert.ok(seen, 'uploadBytes was not called')
  assert.equal(seen.file, fakeFile)
  assert.equal(seen.ref.path.split('/')[0], 'uploads')
  assert.equal(seen.ref.path.split('/')[1], 'uid-123')
  assert.ok(url.length > 0)
})
await checkAsync('Storage-disabled upload throws the honest message (not the generic one)', async () => {
  await assert.rejects(
    M.uploadVideoFile(fakeFile, 'uid-123', mockDeps({
      uploadBytes: async () => { throw storageErr('storage/unauthorized', 'User does not have permission to access this object.') },
    })),
    (e) => e.message === M.VIDEO_UPLOAD_STORAGE_DISABLED_MESSAGE,
  )
})
await checkAsync('network failure on upload throws the connection message', async () => {
  await assert.rejects(
    M.uploadVideoFile(fakeFile, 'uid-123', mockDeps({
      uploadBytes: async () => { throw new Error('Failed to fetch') },
    })),
    (e) => e.message === M.VIDEO_UPLOAD_NETWORK_MESSAGE,
  )
})
await checkAsync('no login (no app / no uid) throws the login message', async () => {
  await assert.rejects(
    M.uploadVideoFile(fakeFile, '', mockDeps()),
    (e) => /needs login/i.test(e.message),
  )
  await assert.rejects(
    M.uploadVideoFile(fakeFile, 'uid-123', mockDeps({ getFirebaseApp: () => null })),
    (e) => /needs login/i.test(e.message),
  )
})

// ---------- (a) Reels page has an Upload Reel entry point into the composer ----------
check('ReelsPage has an "Upload Reel" button', () => {
  const start = pages.indexOf('export function ReelsPage()')
  const end = pages.indexOf('export function AdsPage()')
  assert.ok(start !== -1 && end > start, 'ReelsPage not found')
  const reels = pages.slice(start, end)
  assert.ok(reels.includes('Upload Reel'), 'no "Upload Reel" button on the Reels page')
  assert.ok(reels.includes("navigate('/feed', { state: { openComposerVideo: true } })"), 'Upload Reel does not open the composer video flow via /feed state')
  assert.ok(!reels.includes('uploadBytes'), 'ReelsPage builds a second uploader — it must reuse the composer flow')
})

check('Feed opens the composer video picker when navigated with openComposerVideo', () => {
  const start = pages.indexOf('export function Feed()')
  const end = pages.indexOf('export function Marketplace()')
  assert.ok(start !== -1 && end > start, 'Feed not found')
  const feed = pages.slice(start, end)
  assert.ok(feed.includes('openComposerVideo'), 'Feed does not handle openComposerVideo state')
  assert.ok(feed.includes('setComposerOpen(true)'), 'Feed does not open the composer for the reel upload')
  assert.ok(feed.includes('videoInputRef.current?.click()'), 'Feed does not trigger the composer video picker')
})

check('composer video upload reuses uploadVideoFile (real uploadBytes path kept)', () => {
  assert.ok(pages.includes('uploadVideoFile(f, uid)'), 'onComposerVideo does not call uploadVideoFile')
  assert.ok(videoUpload.includes('uploadBytes('), 'uploadBytes call is gone from videoUpload.ts')
  assert.ok(videoUpload.includes('getDownloadURL('), 'getDownloadURL call is gone from videoUpload.ts')
  assert.ok(!pages.includes('Video upload failed — check your connection and try again.'), 'old generic catch-all message still in pages.tsx')
})

// ---------- (c) empty state stays honest, no fake reels ----------
check('empty state is still the honest "No reels yet." — no seeded reels', () => {
  const start = pages.indexOf('export function ReelsPage()')
  const end = pages.indexOf('export function AdsPage()')
  const reels = pages.slice(start, end)
  assert.ok(reels.includes('No reels yet.'), '"No reels yet." empty state is gone')
  assert.ok(!/REELS = \[[^\]]+\]/.test(read('src/data.ts')), 'REELS seeded with demo reels in data.ts')
})

console.log(`\nreels-upload: ${n} checks, ${process.exitCode ? 'FAILED' : 'all passed'}`)
