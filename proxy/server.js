const http = require('http')
const https = require('https')
const { URL } = require('url')

const PORT = process.env.PORT || 8787
const TARGET = 'https://www.ximalaya.com'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie, xm-sign, xm-bid, User-Agent, Authorization, *')
}

const server = http.createServer((req, res) => {
  setCors(res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }

  const incomingUrl = new URL(req.url, `http://localhost:${PORT}`)
  const path = incomingUrl.pathname.startsWith('/api') ? incomingUrl.pathname.replace('/api', '') : incomingUrl.pathname
  const targetUrl = new URL(path + incomingUrl.search, TARGET)

  const headers = { ...req.headers }
  headers.host = 'www.ximalaya.com'
  delete headers['accept-encoding']

  const options = {
    method: req.method,
    headers
  }

  const proxyReq = https.request(targetUrl, options, (proxyRes) => {
    res.statusCode = proxyRes.statusCode || 500
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      if (k.toLowerCase() === 'set-cookie') continue
      if (v) res.setHeader(k, v)
    }
    setCors(res)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    res.statusCode = 502
    res.end(`Proxy error: ${err.message}`)
  })

  req.pipe(proxyReq)
})

server.listen(PORT, () => {
  console.log(`Proxy listening on http://127.0.0.1:${PORT}/api -> ${TARGET}`)
})
