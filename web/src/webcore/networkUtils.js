const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

import { getConfig } from './configManager.js'

export async function httpRequest(url, options = {}) {
  const { method = 'GET', headers = {}, data = null, timeout = 30000, retries = 3, retryDelay = 1000 } = options
  let lastErr
  for (let i = 1; i <= retries; i++) {
    try {
      const controller = new AbortController()
      const t = setTimeout(()=>controller.abort(), timeout)
      const cfg = getConfig()
      let reqUrl = url
      if (cfg.useProxy && url.startsWith('https://www.ximalaya.com')) {
        reqUrl = cfg.proxyBase + url.replace('https://www.ximalaya.com', '')
      }
      const init = { method, headers: { ...DEFAULT_HEADERS, ...headers }, signal: controller.signal }
      if (data && method !== 'GET') {
        init.body = typeof data === 'object' ? JSON.stringify(data) : data
        init.headers['Content-Type'] = 'application/json'
      }
      const res = await fetch(reqUrl, init)
      clearTimeout(t)
      const ct = res.headers.get('content-type') || ''
      const isJson = ct.includes('application/json')
      const body = isJson ? await res.json() : await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      return body
    } catch (e) {
      lastErr = e
      if (i < retries) await new Promise(r=>setTimeout(r, retryDelay))
    }
  }
  throw new Error(`请求失败: ${lastErr?.message || '未知错误'}`)
}
