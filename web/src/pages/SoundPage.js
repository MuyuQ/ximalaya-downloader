import { analyzeSound } from '../webcore/audioParser.js'
import { downloadSingle } from '../webcore/downloader.js'

export function SoundPage() {
  const root = document.createElement('div')
  const h1 = document.createElement('h2')
  h1.textContent = '单集下载'
  root.appendChild(h1)

  const idInput = document.createElement('input')
  idInput.placeholder = '音频ID'
  const parseBtn = document.createElement('button')
  parseBtn.textContent = '解析'
  const infoDiv = document.createElement('div')
  const qualitySelect = document.createElement('select')
  ;['high','medium','low'].forEach(q=>{ const o=document.createElement('option'); o.value=q; o.textContent=q; qualitySelect.appendChild(o) })
  const downloadBtn = document.createElement('button')
  downloadBtn.textContent = '下载'

  let lastInfo = null

  parseBtn.onclick = async () => {
    infoDiv.textContent = '解析中...'
    lastInfo = await analyzeSound(idInput.value)
    if (!lastInfo) { infoDiv.textContent = '解析失败'; return }
    infoDiv.textContent = `标题：${lastInfo.title} 时长：${lastInfo.duration}s 类型：${lastInfo.type}`
  }

  downloadBtn.onclick = async () => {
    if (!lastInfo) { alert('请先解析'); return }
    const res = await downloadSingle(lastInfo, qualitySelect.value, (progress)=>{ infoDiv.textContent = `下载进度：${progress}%` })
    alert(res.success ? '下载完成' : `下载失败：${res.error}`)
  }

  root.appendChild(idInput)
  root.appendChild(parseBtn)
  root.appendChild(document.createElement('br'))
  root.appendChild(infoDiv)
  root.appendChild(qualitySelect)
  root.appendChild(downloadBtn)
  return root
}
