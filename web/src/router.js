import { HomePage } from './pages/HomePage.js'
import { LoginPage } from './pages/LoginPage.js'
import { SoundPage } from './pages/SoundPage.js'
import { AlbumPage } from './pages/AlbumPage.js'
import { SettingsPage } from './pages/SettingsPage.js'

const routes = {
  '/': HomePage,
  '/login': LoginPage,
  '/sound': SoundPage,
  '/album': AlbumPage,
  '/settings': SettingsPage
}

export function render() {
  const app = document.getElementById('app')
  const path = location.hash.replace('#', '') || '/'
  const Page = routes[path] || HomePage
  app.innerHTML = ''
  const el = Page()
  app.appendChild(el)
}
