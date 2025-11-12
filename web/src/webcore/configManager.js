const KEY = 'ximalaya-downloader-config'

const DEFAULTS = {
  cookie: '',
  bid: '',
  quality: 'high',
  addSequenceNumber: true,
  maxRetries: 3,
  retryDelay: 1000,
  concurrentDownloads: 3,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  useProxy: true,
  proxyBase: 'http://127.0.0.1:8787/api'
}

export function getConfig() {
  try {
    const raw = localStorage.getItem(KEY)
    const cfg = raw ? JSON.parse(raw) : {}
    return { ...DEFAULTS, ...cfg }
  } catch { return { ...DEFAULTS } }
}

export function setConfig(updates) {
  const merged = { ...getConfig(), ...updates }
  localStorage.setItem(KEY, JSON.stringify(merged))
  return merged
}

export function exportConfig() { return getConfig() }
export function importConfig(obj) { setConfig(obj) }

import { httpRequest } from './networkUtils.js'
export async function verifyLogin() {
  try {
    const cfg = getConfig()
    const data = await httpRequest('https://www.ximalaya.com/revision/user/v1/getUserInfo', {
      headers: {
        'Cookie': cfg.cookie,
        'xm-sign': cfg.bid,
        'User-Agent': cfg.userAgent
      },
      retries: 1
    })
    if (data && data.ret === 200 && data.data) {
      return { success: true, username: data.data.nickname || data.data.uid }
    }
    return { success: false, error: '验证失败' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
