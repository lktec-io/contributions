import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'
import './utils/pwa.js'

registerSW({
  onNeedRefresh() {
    console.log('[PWA] New version available — reload to update')
  },
  onOfflineReady() {
    console.log('[PWA] App is ready for offline use')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
