async function getCookieString() {
  const all = []
  try { all.push(...await chrome.cookies.getAll({ domain: 'ximalaya.com' })) } catch {}
  try { all.push(...await chrome.cookies.getAll({ domain: '.ximalaya.com' })) } catch {}
  try { all.push(...await chrome.cookies.getAll({ domain: 'xmcdn.com' })) } catch {}
  try { all.push(...await chrome.cookies.getAll({ domain: '.xmcdn.com' })) } catch {}
  const map = new Map()
  for (const c of all) { if (!map.has(c.name)) map.set(c.name, c.value) }
  return Array.from(map.entries()).map(([k,v])=>`${k}=${v}`).join('; ')
}

function extractBidFromSign(sign) {
  if (!sign || typeof sign !== 'string') return ''
  const m = /bid\s*=\s*([\w-]+)/i.exec(sign)
  return m ? m[1] : ''
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    const bidHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === 'xm-bid')
    const signHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === 'xm-sign')
    const bid = bidHeader?.value || ''
    const sign = signHeader?.value || ''
    const derivedBid = bid || extractBidFromSign(sign)
    const cookie = await getCookieString()
    await chrome.storage.local.set({ cookie, bid: derivedBid, sign, updatedAt: Date.now() })
  },
  { urls: ["https://*.ximalaya.com/*", "https://*.xmcdn.com/*"] },
  ["requestHeaders", "extraHeaders"]
)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg === 'getCredentials') {
    ;(async () => {
      const data = await chrome.storage.local.get(['cookie','bid','sign','updatedAt'])
      if (!data.cookie) data.cookie = await getCookieString()
      sendResponse(data)
    })()
    return true
  }
})
