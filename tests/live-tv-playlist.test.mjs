// Live TV — ONE playlist link (M3U) drives the channel list.
// Run: node tests/live-tv-playlist.test.mjs
// (esbuild দিয়ে src/tvPlaylist.ts + src/firestoreMapping.ts বান্ডল করে Node-এ চালায়।)
// যাচাই করে:
//   ১) M3U পার্সার: নাম/লোগো/গ্রুপ/URL ঠিকমতো বের হয়; http লিঙ্ক, .m3u8 নয় এমন
//      লিঙ্ক, ডুপ্লিকেট URL, URL-ছাড়া এন্ট্রি বাদ যায়
//   ২) fetchTvPlaylist: ২০০ + আসল M3U হলে চ্যানেল ফেরে; ৪০৪ / HTML বডি /
//      খেলার মতো চ্যানেল না থাকলে ভুল ধরে
//   ৩) test-streams.mux.dev কোডে আর কোথাও নেই; বেক-ইন তালিকার প্রতিটি streamUrl
//      হয় https .m3u8, নয়তো খালি (link-only); আইডি অনন্য
//   ৪) অ্যাডমিনে আর per-channel ফর্ম নেই — একটাই প্লেলিস্ট URL ফিল্ড
//   ৫) config/public-এ tvPlaylistUrl রাউন্ড-ট্রিপে ফেরে; ভুল লিঙ্ক বাদ যায়
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-tv-test-'))
async function bundle(entry, outName) {
  const outFile = join(outDir, outName)
  await build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', platform: 'node', outfile: outFile, logLevel: 'silent' })
  return import(outFile)
}
const T = await bundle('src/tvPlaylist.ts', 'tvPlaylist.mjs')
const F = await bundle('src/firestoreMapping.ts', 'firestoreMapping.mjs')

const read = (f) => readFileSync(join(root, f), 'utf8')
const dataTs = read('src/data.ts')
const pages = read('src/pages.tsx')
const store = read('src/store.tsx')
const mapping = read('src/firestoreMapping.ts')

let passed = 0
async function check(name, fn) {
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-name="Jamuna" tvg-logo="https://example.com/j.png" group-title="Bangla",Jamuna
https://tvsen6.aynaott.com/abc/index.m3u8
#EXTINF:-1 tvg-name="Somoy" group-title="Bangla",Somoy Tv
https://toffee.example.com/somoy_tv/index.m3u8
#EXTINF:-1 tvg-name="T Sports" group-title="Sports",T Sports HD
http://live.example.com:8080/live/10.m3u8
#EXTINF:-1 tvg-name="Dup" group-title="Bangla",Jamuna Dup
https://tvsen6.aynaott.com/abc/index.m3u8
#EXTINF:-1 tvg-name="NoGroup" ,No Group Channel
https://example.com/nogroup/chunks.m3u8
#EXTINF:-1 tvg-name="Dead" group-title="Bangla",Dead Channel
#EXTINF:-1 tvg-name="Mp4" group-title="Bangla",Mp4 Channel
https://example.com/video.mp4
`

await check('parseM3u: keeps https .m3u8 entries with name/logo/group', () => {
  const list = T.parseM3u(SAMPLE)
  assert.equal(list.length, 3)
  const jamuna = list.find(c => c.name === 'Jamuna')
  assert.ok(jamuna)
  assert.equal(jamuna.logo, 'https://example.com/j.png')
  assert.equal(jamuna.group, 'Bangla')
  assert.equal(jamuna.streamUrl, 'https://tvsen6.aynaott.com/abc/index.m3u8')
  assert.ok(list.find(c => c.name === 'Somoy Tv'))
})

await check('parseM3u: skips http streams (cannot play in the https app)', () => {
  const list = T.parseM3u(SAMPLE)
  assert.ok(!list.some(c => c.name === 'T Sports HD'))
})

await check('parseM3u: skips duplicate URLs, non-m3u8, entries with no URL', () => {
  const list = T.parseM3u(SAMPLE)
  assert.ok(!list.some(c => c.name === 'Jamuna Dup'))
  assert.ok(!list.some(c => c.name === 'Mp4 Channel'))
  assert.ok(!list.some(c => c.name === 'Dead Channel'))
  assert.equal(new Set(list.map(c => c.streamUrl)).size, list.length)
})

await check('parseM3u: missing group becomes Other, ids are unique', () => {
  const list = T.parseM3u(SAMPLE)
  assert.equal(list.find(c => c.name === 'No Group Channel').group, 'Other')
  assert.equal(new Set(list.map(c => c.id)).size, list.length)
})

await check('isPlaylistUrl: accepts https .m3u and short links, rejects junk', () => {
  assert.equal(T.isPlaylistUrl('https://example.com/list.m3u'), true)
  assert.equal(T.isPlaylistUrl('https://tinyurl.com/39c9f88d'), true)
  assert.equal(T.isPlaylistUrl(''), false)
  assert.equal(T.isPlaylistUrl('ftp://example.com/list.m3u'), false)
  assert.equal(T.isPlaylistUrl('not a url'), false)
})

await check('DEFAULT_TV_PLAYLIST_URL is the Eamin raw playlist', () => {
  assert.equal(T.DEFAULT_TV_PLAYLIST_URL, 'https://raw.githubusercontent.com/sarsx3/aladin430/refs/heads/main/playlists/eamin-tv.m3u')
})

// ---------- fetchTvPlaylist against a local server ----------
const server = createServer((_req, res) => {
  const url = _req.url || ''
  if (url === '/good.m3u') { res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' }); res.end(SAMPLE) }
  else if (url === '/html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html><body>not a playlist</body></html>') }
  else if (url === '/empty.m3u') { res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl' }); res.end('#EXTM3U\n') }
  else { res.writeHead(404); res.end('nope') }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

await check('fetchTvPlaylist: 200 + valid M3U returns parsed channels', async () => {
  const list = await T.fetchTvPlaylist(`${base}/good.m3u`)
  assert.equal(list.length, 3)
  assert.equal(list[0].name, 'Jamuna')
})

await check('fetchTvPlaylist: 404 throws', async () => {
  await assert.rejects(() => T.fetchTvPlaylist(`${base}/missing.m3u`))
})

await check('fetchTvPlaylist: 200 but HTML body throws', async () => {
  await assert.rejects(() => T.fetchTvPlaylist(`${base}/html`))
})

await check('fetchTvPlaylist: valid M3U with no playable channel throws', async () => {
  await assert.rejects(() => T.fetchTvPlaylist(`${base}/empty.m3u`))
})
server.close()

// ---------- static checks on the source ----------
await check('no test-streams URL anywhere in src', () => {
  for (const [name, src] of [['data.ts', dataTs], ['pages.tsx', pages], ['store.tsx', store], ['tvPlaylist.ts', read('src/tvPlaylist.ts')]]) {
    assert.ok(!src.includes('test-streams'), `${name} still has the test stream`)
  }
})

const CHANNEL_RE = /\{\s*id: '([^']+)', name: '([^']+)', group: '([^']+)', logo: '([^']*)', streamUrl: '([^']*)', officialUrl: '([^']*)' \}/g
const channels = [...dataTs.matchAll(CHANNEL_RE)].map(m => ({ id: m[1], name: m[2], group: m[3], logo: m[4], streamUrl: m[5], officialUrl: m[6] }))

await check('TV_CHANNELS: 50+ built-in channels', () => {
  assert.ok(channels.length >= 50, `only ${channels.length} channels`)
})

await check('TV_CHANNELS: every streamUrl is https .m3u8 or empty (link-only)', () => {
  for (const c of channels) {
    assert.ok(c.streamUrl === '' || /^https:\/\/.*\.m3u8(\?|$)/.test(c.streamUrl), `${c.name}: ${c.streamUrl}`)
  }
})

await check('TV_CHANNELS: ids unique, link-only entries keep their official link', () => {
  assert.equal(new Set(channels.map(c => c.id)).size, channels.length)
  const linkOnly = channels.filter(c => c.streamUrl === '')
  assert.deepEqual(linkOnly.map(c => c.id).sort(), ['independent', 'somoy', 'tsports'])
  for (const c of linkOnly) assert.ok(c.officialUrl.startsWith('https://'), `${c.id} has no official link`)
})

await check('LiveTV page: loads the admin playlist, falls back to TV_CHANNELS', () => {
  assert.ok(pages.includes('fetchTvPlaylist(tvPlaylistUrl || DEFAULT_TV_PLAYLIST_URL)'))
  assert.ok(pages.includes('setChannels(TV_CHANNELS)'))
  assert.ok(pages.includes('This stream is not playing right now'))
})

await check('Admin: one playlist URL field, no per-channel add form', () => {
  assert.ok(pages.includes('Playlist URL (M3U link)'))
  assert.ok(pages.includes('Save Playlist'))
  assert.ok(!pages.includes('Add Live TV Channel'), 'per-channel form is back')
  assert.ok(!pages.includes('tvName'), 'per-channel state is back')
})

// ---------- config/public round-trip ----------
const RATES = { piRateBDT: 100, usdtRateBDT: 120, piWithdrawFeePct: 1, datingRate: 0.1, liveRate: 0.05 }
const PAYMENTS = { bkash: '', nagad: '', rocket: '', usdtBep20: '', usdtErc20: '', binancePayId: '', piDepositAddress: '' }

await check('toPublicConfig/fromPublicConfig: tvPlaylistUrl round-trips', () => {
  const doc = F.toPublicConfig(RATES, PAYMENTS, 'https://example.com/list.m3u')
  assert.equal(doc.tvPlaylistUrl, 'https://example.com/list.m3u')
  assert.equal(F.fromPublicConfig(doc).tvPlaylistUrl, 'https://example.com/list.m3u')
})

await check('fromPublicConfig: bad or missing tvPlaylistUrl is dropped, other fields survive', () => {
  assert.equal(F.fromPublicConfig({ tvPlaylistUrl: 'not a url' }).tvPlaylistUrl, undefined)
  assert.equal(F.fromPublicConfig({}).tvPlaylistUrl, undefined)
  assert.equal(F.fromPublicConfig({ tvPlaylistUrl: 'https://example.com/x.m3u', piRateBDT: 150 }).piRateBDT, 150)
  assert.equal(F.toPublicConfig(RATES, PAYMENTS).tvPlaylistUrl, '')
})

await check('store: tvPlaylistUrl flows through applyPublicConfig path (text)', () => {
  assert.ok(store.includes('tvPlaylistUrl'))
  assert.ok(store.includes('toPublicConfig({ piRateBDT, usdtRateBDT, piWithdrawFeePct, datingRate, liveRate }, adminSettings.payments, tvPlaylistUrl, adminSettings.analytics, adminSettings.ads, bannedUids)'))
  assert.ok(mapping.includes('tvPlaylistUrl'))
})

console.log(`\n${passed} checks passed`)
