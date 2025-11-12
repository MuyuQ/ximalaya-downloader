import { getConfig, setConfig, exportConfig, importConfig } from '../webcore/configManager.js'

export function SettingsPage() {
  const root = document.createElement('div')
  const h1 = document.createElement('h2')
  h1.textContent = '设置'
  root.appendChild(h1)

  const cfg = getConfig()
  const concurrency = document.createElement('input')
  concurrency.type = 'number'; concurrency.value = String(cfg.concurrentDownloads||3)
  const retry = document.createElement('input')
  retry.type = 'number'; retry.value = String(cfg.maxRetries||3)
  const ua = document.createElement('input')
  ua.value = cfg.userAgent || ''
  const saveBtn = document.createElement('button')
  saveBtn.textContent = '保存'
  saveBtn.onclick = ()=>{ setConfig({ concurrentDownloads:Number(concurrency.value), maxRetries:Number(retry.value), userAgent:ua.value }); alert('已保存') }

  const exportBtn = document.createElement('button')
  exportBtn.textContent = '导出配置'
  exportBtn.style.marginLeft = '8px'
  exportBtn.onclick = ()=>{ const blob = new Blob([JSON.stringify(getConfig(), null, 2)], { type: 'application/json' }); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='config.json'; a.click(); URL.revokeObjectURL(a.href) }

  const importInput = document.createElement('input')
  importInput.type = 'file'
  const importBtn = document.createElement('button')
  importBtn.textContent = '导入配置'
  importBtn.onclick = async ()=>{ const f=importInput.files?.[0]; if(!f){ alert('请选择文件'); return } const txt=await f.text(); try { importConfig(JSON.parse(txt)); alert('已导入'); } catch(e){ alert('导入失败') } }

  const useProxy = document.createElement('input')
  useProxy.type = 'checkbox'
  useProxy.checked = !!cfg.useProxy
  const proxyBase = document.createElement('input')
  proxyBase.value = cfg.proxyBase || ''
  const saveProxy = document.createElement('button')
  saveProxy.textContent = '保存代理设置'
  saveProxy.onclick = ()=>{ setConfig({ useProxy: useProxy.checked, proxyBase: proxyBase.value }); alert('已保存代理设置') }

  root.appendChild(document.createTextNode('并发数'))
  root.appendChild(concurrency)
  root.appendChild(document.createElement('br'))
  root.appendChild(document.createTextNode('重试次数'))
  root.appendChild(retry)
  root.appendChild(document.createElement('br'))
  root.appendChild(document.createTextNode('User-Agent'))
  root.appendChild(ua)
  root.appendChild(document.createElement('br'))
  root.appendChild(saveBtn)
  root.appendChild(exportBtn)
  root.appendChild(document.createElement('br'))
  root.appendChild(importInput)
  root.appendChild(importBtn)
  root.appendChild(document.createElement('hr'))
  root.appendChild(document.createTextNode('启用代理'))
  root.appendChild(useProxy)
  root.appendChild(document.createElement('br'))
  root.appendChild(document.createTextNode('代理地址'))
  root.appendChild(proxyBase)
  root.appendChild(document.createElement('br'))
  root.appendChild(saveProxy)
  return root
}
