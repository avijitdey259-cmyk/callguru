// Live TV — ONE IPTV playlist link (M3U) drives the whole channel list.
// Admin pastes a single playlist URL (config/public → tvPlaylistUrl); the app
// fetches + parses it and shows every channel inside it. If the playlist
// cannot be loaded, the built-in TV_CHANNELS list (verified streams) is used.
//
// Pure module — no Firebase/React imports, so Node can test it directly
// (tests/live-tv-playlist.test.mjs).
//
// Honest note: the default playlist is a third-party aggregator list, not the
// channels' own official streams — links can break and there is a copyright
// risk. Only https .m3u8 streams are kept: http streams cannot play inside
// the https app (mixed content), so the parser skips them.

export const DEFAULT_TV_PLAYLIST_URL = 'https://raw.githubusercontent.com/sarsx3/aladin430/refs/heads/main/playlists/eamin-tv.m3u'

export type PlaylistChannel = { id: string; name: string; logo: string; group: string; streamUrl: string }

function slug(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s || 'channel'
}

// A playlist URL the admin may paste — any http(s) link (short links are
// allowed: they redirect to the real .m3u file).
export function isPlaylistUrl(u: string): boolean {
  return typeof u === 'string' && /^https?:\/\//.test(u.trim()) && u.trim().length <= 500
}

function isPlayableStreamUrl(u: string): boolean {
  return /^https:\/\//.test(u) && /\.m3u8(\?|$)/i.test(u)
}

// Parse an M3U playlist: each #EXTINF line carries the channel (tvg-name /
// tvg-logo / group-title + display name after the comma); the next line is
// the stream URL. Only playable (https .m3u8) entries are kept; duplicates
// (same URL) are dropped.
export function parseM3u(text: string): PlaylistChannel[] {
  const lines = text.split(/\r?\n/)
  const out: PlaylistChannel[] = []
  const seenUrls = new Set<string>()
  const seenIds = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('#EXTINF')) continue
    const logo = /tvg-logo="([^"]*)"/.exec(line)?.[1] ?? ''
    const group = /group-title="([^"]*)"/.exec(line)?.[1] ?? ''
    const comma = line.indexOf(',')
    const name = comma >= 0 ? line.slice(comma + 1).trim() : ''
    let url = ''
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim()
      if (!next) continue
      if (next.startsWith('#')) break
      url = next
      break
    }
    if (!name || !url || !isPlayableStreamUrl(url) || seenUrls.has(url)) continue
    seenUrls.add(url)
    let id = slug(name)
    const base = id
    let k = 2
    while (seenIds.has(id)) { id = `${base}-${k}`; k++ }
    seenIds.add(id)
    out.push({ id, name, logo, group: group || 'Other', streamUrl: url })
  }
  return out
}

// Fetch + parse a playlist URL. Throws on network failure, non-200, a body
// that is not an M3U playlist, or zero playable channels.
export async function fetchTvPlaylist(url: string, timeoutMs = 15000): Promise<PlaylistChannel[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`Playlist request failed: ${res.status}`)
    const text = await res.text()
    if (!text.includes('#EXTM3U')) throw new Error('Not an M3U playlist')
    const channels = parseM3u(text)
    if (channels.length === 0) throw new Error('No playable channels in playlist')
    return channels
  } finally {
    clearTimeout(timer)
  }
}
