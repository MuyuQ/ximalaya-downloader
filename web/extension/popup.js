function load() {
  chrome.runtime.sendMessage('getCredentials', (data) => {
    const c = document.getElementById('cookie')
    const b = document.getElementById('bid')
    const d = data || {}
    c.value = d.cookie || ''
    b.value = d.bid || d.sign || ''
  })
}

document.getElementById('refresh').addEventListener('click', load)
document.getElementById('copy').addEventListener('click', async () => {
  const text = `Cookie=${document.getElementById('cookie').value}\nBID=${document.getElementById('bid').value}`
  await navigator.clipboard.writeText(text)
  alert('已复制')
})

load()
