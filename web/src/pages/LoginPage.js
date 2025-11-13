import { getConfig, setConfig, verifyLogin } from '../webcore/configManager.js'

export function LoginPage() {
  const root = document.createElement('div')
  const h1 = document.createElement('h2')
  h1.textContent = '登录凭证设置'
  root.appendChild(h1)

  const cfg = getConfig()
  const cookieInput = document.createElement('input')
  cookieInput.placeholder = 'Cookie'
  cookieInput.value = cfg.cookie || ''

  const bidInput = document.createElement('input')
  bidInput.placeholder = 'BID'
  bidInput.value = cfg.bid || ''

  const saveBtn = document.createElement('button')
  saveBtn.textContent = '保存'
  saveBtn.onclick = () => {
    setConfig({ cookie: cookieInput.value, bid: bidInput.value })
    alert('已保存')
  }

  const verifyBtn = document.createElement('button')
  verifyBtn.textContent = '验证登录'
  verifyBtn.style.marginLeft = '8px'
  verifyBtn.onclick = async () => {
    const res = await verifyLogin()
    alert(res.success ? `登录有效，用户：${res.username}` : `验证失败：${res.error || '未知错误'}`)
  }

  root.appendChild(cookieInput)
  root.appendChild(document.createElement('br'))
  root.appendChild(bidInput)
  root.appendChild(document.createElement('br'))
  root.appendChild(saveBtn)
  root.appendChild(verifyBtn)

  const guide = document.createElement('details')
  guide.open = true
  const summary = document.createElement('summary')
  summary.textContent = '使用说明与凭证获取'
  guide.appendChild(summary)
  const box = document.createElement('div')
  box.className = 'guide-box'
  box.innerHTML = `
    <p><strong>目的：</strong>在浏览器中请求喜马拉雅接口需要携带 <code>Cookie</code> 与 <code>BID</code> 用于认证。</p>
    <p><strong>获取步骤：</strong></p>
    <ol>
      <li>在浏览器打开 <a href="https://www.ximalaya.com/" target="_blank">https://www.ximalaya.com/</a> 并登录账号。</li>
      <li>按 <code>F12</code> 打开开发者工具，切换到 <em>Network</em> 面板。</li>
      <li>刷新页面或进入任一内容页，选择任意 <em>XHR</em> 请求，查看 <em>Headers</em>。</li>
      <li>复制 <code>Cookie</code> 值到上方输入框。</li>
      <li>复制请求头中的 <code>xm-bid</code> 或签名中的 <code>bid</code> 值到 <code>BID</code> 输入框。</li>
    </ol>
    <p><strong>验证与保存：</strong>点击“保存”后再点击“验证登录”，成功将显示用户昵称。</p>
    <p><strong>常见问题：</strong></p>
    <ul>
      <li>跨域限制：如解析失败或报 <em>CORS</em>，可在本地使用代理转发接口或启用带 <em>CORS</em> 的静态服务。</li>
      <li>权限与限制：部分内容需会员或购买权限；站点可能存在每日下载限制。</li>
      <li>凭证失效：更换设备或退出登录后 <code>Cookie/BID</code> 可能失效，请重新获取并保存。</li>
    </ul>
    <p><strong>安全建议：</strong>凭证仅保存在本地浏览器，可在设置页清除或导出；避免在不可信设备上使用。</p>
    <p><strong>合规提示：</strong>请遵守平台的服务协议、隐私政策与版权声明，仅下载有合法权限的内容。</p>
  `
  guide.appendChild(box)
  const ext = document.createElement('p')
  ext.innerHTML = `
    如需自动获取，可在 Chrome/Edge 开发者模式加载 <code>web/extension</code> 目录为“未打包扩展”，
    打开站点后点击扩展图标复制 <code>Cookie</code> 与 <code>BID</code>，再粘贴到本页输入框。
  `
  guide.appendChild(ext)
  root.appendChild(document.createElement('br'))
  root.appendChild(guide)

  return root
}
