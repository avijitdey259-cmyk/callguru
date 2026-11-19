import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider } from './store'
import './index.css'

// PWA: সার্ভিস ওয়ার্কার রেজিস্টার — অফলাইন অ্যাপ শেল + ইন্সটল প্রম্পটের জন্য লাগে
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* ডেমো/প্রিভিউতে SW না চললেও অ্যাপ চলবে */ })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
)
