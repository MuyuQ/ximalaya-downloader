import { getConfig } from './configManager.js'

function pickUrl(info, quality) {
  const u = info.urls || {}
  if (quality === 'high') return u.AI || u.M4A_128 || u.MP3_64 || Object.values(u)[0]
  if (quality === 'medium') return u.M4A_128 || u.MP3_64 || u.MP3_32 || Object.values(u)[0]
  if (quality === 'low') return u.MP3_64 || u.MP3_32 || Object.values(u)[0]
  return Object.values(u)[0]
}

export async function downloadSingle(info, quality, onProgress) {
  try {
    const url = pickUrl(info, quality)
    if (!url) return { success: false, error: '无可用链接' }
    const res = await fetch(url)
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
    const total = Number(res.headers.get('content-length') || 0)
    const reader = res.body.getReader()
    const chunks = []
    let loaded = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      if (onProgress && total) onProgress(Math.round(loaded * 100 / total))
    }
    const blob = new Blob(chunks)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${info.title || 'audio'}.mp3`
    a.click()
    URL.revokeObjectURL(a.href)
    return { success: true }
  } catch (e) { return { success: false, error: e.message } }
}

export async function downloadBatch(tracks, quality, concurrency, onProgress) {
  const total = tracks.length
  let completed = 0, successCount = 0, failureCount = 0
  const queue = tracks.slice()
  const active = new Set()
  const runOne = async (t) => {
    try {
      // 简化：先解析每个 track 的播放 URL（与单集解析相同接口，需扩展）
      const info = { title: t.title, urls: {} }
      // 占位：实际应先用 track.id 调用单集解析接口获取 urls
      const single = await downloadSingle(info, quality)
      if (single.success) successCount++; else failureCount++
    } catch { failureCount++ }
    completed++
    if (onProgress) onProgress(Math.round(completed * 100 / total))
    active.delete(t.id)
    if (queue.length) { const next = queue.shift(); active.add(next.id); runOne(next) }
  }
  const start = Math.min(concurrency, total)
  for (let i = 0; i < start; i++) { const t = queue.shift(); active.add(t.id); runOne(t) }
  while (active.size) { await new Promise(r=>setTimeout(r, 50)) }
  return { success: true, totalCount: total, successCount, failureCount }
}
