import { render } from './router.js'

window.addEventListener('hashchange', render)
window.addEventListener('load', render)
