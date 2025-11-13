import { render } from './router.js'

function applyTheme() {
  const t = localStorage.getItem('theme') || 'auto'
  const root = document.documentElement
  if (t === 'auto') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', t)
  }
  updateToggleIcon(t)
}

function updateToggleIcon(state) {
  const btn = document.getElementById('theme-toggle')
  if (!btn) return
  if (state === 'auto') {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    btn.textContent = isDark ? '🌙' : '🌞'
    btn.title = `主题：自动（${isDark ? '深色' : '浅色'}）`
  } else if (state === 'dark') {
    btn.textContent = '🌙'
    btn.title = '主题：深色'
  } else {
    btn.textContent = '🌞'
    btn.title = '主题：浅色'
  }
}

function cycleTheme() {
  const t = localStorage.getItem('theme') || 'auto'
  const next = t === 'auto' ? 'dark' : t === 'dark' ? 'light' : 'auto'
  localStorage.setItem('theme', next)
  applyTheme()
}

window.addEventListener('hashchange', render)
window.addEventListener('load', () => {
  applyTheme()
  render()
  const btn = document.getElementById('theme-toggle')
  if (btn) btn.addEventListener('click', cycleTheme)
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
  if (mq) mq.addEventListener('change', () => {
    const t = localStorage.getItem('theme') || 'auto'
    if (t === 'auto') updateToggleIcon('auto')
  })
})
