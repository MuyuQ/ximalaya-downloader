export function HomePage() {
  const root = document.createElement('div')
  const h1 = document.createElement('h1')
  h1.textContent = '欢迎使用喜马拉雅下载器 Web'
  const p = document.createElement('p')
  p.textContent = '在浏览器中解析与下载音频或专辑，支持并发与进度显示。'
  root.appendChild(h1)
  root.appendChild(p)
  return root
}
