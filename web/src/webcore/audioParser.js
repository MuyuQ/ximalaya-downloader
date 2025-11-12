import { httpRequest } from './networkUtils.js'
import { getConfig } from './configManager.js'

export async function analyzeSound(soundId) {
  if (!soundId) return null
  const cfg = getConfig()
  const url = `https://www.ximalaya.com/revision/play/v1/audio?id=${soundId}&ptype=1`
  const data = await httpRequest(url, { headers: { 'Cookie': cfg.cookie, 'xm-sign': cfg.bid, 'User-Agent': cfg.userAgent } })
  if (!data || data.ret !== 200 || !data.data) return null
  const a = data.data
  const info = { id: soundId, title: a.title || '未知标题', duration: a.duration || 0, type: a.isPaid ? 'vip' : 'free', urls: {} }
  if (a.src) info.urls['MP3_64'] = a.src
  if (a.epInfo) {
    const e = a.epInfo
    if (e.AI) info.urls['AI'] = e.AI
    if (e.M4A_128) info.urls['M4A_128'] = e.M4A_128
    if (e.MP3_64) info.urls['MP3_64'] = e.MP3_64
    if (e.MP3_32) info.urls['MP3_32'] = e.MP3_32
  }
  return info
}

export async function analyzeAlbum(albumId, page = 1, pageSize = 30) {
  if (!albumId) return null
  const cfg = getConfig()
  const url = `https://www.ximalaya.com/revision/album/v1/getTracksList?albumId=${albumId}&pageNum=${page}&pageSize=${pageSize}`
  const data = await httpRequest(url, { headers: { 'Cookie': cfg.cookie, 'xm-sign': cfg.bid, 'User-Agent': cfg.userAgent } })
  if (!data || data.ret !== 200 || !data.data) return null
  const d = data.data
  const album = { id: albumId, title: d.albumTitle || '未知专辑', coverUrl: d.coverUrl || '', totalCount: d.totalCount || d.trackTotalCount || 0, tracks: [] }
  if (Array.isArray(d.tracks)) {
    album.tracks = d.tracks.map(t=>({ id: t.trackId, title: t.title, duration: t.duration||0, index: t.orderNum||0, isPaid: !!t.isPaid }))
  }
  return album
}

export async function getAllAlbumTracks(albumId) {
  const first = await analyzeAlbum(albumId, 1, 30)
  if (!first) return null
  const totalPages = Math.ceil((first.totalCount||0) / 30)
  const tracks = [...first.tracks]
  for (let p = 2; p <= totalPages; p++) {
    const page = await analyzeAlbum(albumId, p, 30)
    if (page?.tracks) tracks.push(...page.tracks)
  }
  return { ...first, tracks }
}
