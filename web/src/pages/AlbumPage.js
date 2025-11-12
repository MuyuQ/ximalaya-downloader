import { analyzeAlbum, getAllAlbumTracks } from '../webcore/audioParser.js'
import { downloadBatch } from '../webcore/downloader.js'

export function AlbumPage() {
  const root = document.createElement('div')
  const h1 = document.createElement('h2')
  h1.textContent = '专辑下载'
  root.appendChild(h1)

  const idInput = document.createElement('input')
  idInput.placeholder = '专辑ID'
  const parseBtn = document.createElement('button')
  parseBtn.textContent = '解析'
  const infoDiv = document.createElement('div')
  const rangeInput = document.createElement('input')
  rangeInput.placeholder = '范围，例如 1-10'
  const qualitySelect = document.createElement('select')
  ;['high','medium','low'].forEach(q=>{ const o=document.createElement('option'); o.value=q; o.textContent=q; qualitySelect.appendChild(o) })
  const concurrencyInput = document.createElement('input')
  concurrencyInput.type = 'number'
  concurrencyInput.value = '3'
  const downloadBtn = document.createElement('button')
  downloadBtn.textContent = '批量下载'

  let lastAlbum = null

  parseBtn.onclick = async () => {
    infoDiv.textContent = '解析中...'
    const base = await analyzeAlbum(idInput.value)
    if (!base) { infoDiv.textContent = '解析失败'; return }
    lastAlbum = await getAllAlbumTracks(idInput.value)
    infoDiv.textContent = `专辑：${base.title} 音频数：${lastAlbum.tracks.length}`
  }

  downloadBtn.onclick = async () => {
    if (!lastAlbum) { alert('请先解析'); return }
    let tracks = lastAlbum.tracks
    const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(rangeInput.value||'')
    if (m) { const s=Number(m[1]), e=Number(m[2]); tracks = tracks.slice(s-1, e) }
    const res = await downloadBatch(tracks, qualitySelect.value, Number(concurrencyInput.value), (p)=>{ infoDiv.textContent = `总体进度：${p}%` })
    alert(res.success ? `完成：${res.successCount}/${res.totalCount}` : `失败：${res.error}`)
  }

  root.appendChild(idInput)
  root.appendChild(parseBtn)
  root.appendChild(document.createElement('br'))
  root.appendChild(infoDiv)
  root.appendChild(rangeInput)
  root.appendChild(qualitySelect)
  root.appendChild(concurrencyInput)
  root.appendChild(downloadBtn)
  return root
}
