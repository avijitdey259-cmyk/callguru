import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider } from './store'
import { initAppUpdate } from './appUpdate'
import { EMPTY_ANALYTICS_IDS, envAnalyticsIds, initAnalytics, resolveAnalyticsIds } from './analytics'
import './index.css'

// PWA অটো-আপডেট — অ্যাপ খুললেই + ফোরগ্রাউন্ডে ফিরলেই নতুন ভার্সন চেক,
// নতুন থাকলে আপনা-আপনি চালু হয় (ব্যানার/বোতাম নেই); কল/লাইভ/রেকর্ডিং
// চললে সুইচ পিছিয়ে যায়; অফলাইনে ক্যাশ করা ভার্সনই চলে।
initAppUpdate()

// Analytics — build env থেকে ID থাকলে (VITE_PIXEL_ID / VITE_GA4_ID /
// VITE_CLARITY_ID) লগইন ছাড়াই ট্র্যাকার চালু হয়; ID না থাকলে কিছুই লোড হয় না।
// অ্যাডমিন সেটিংস থেকে আসা ID স্টোরের effect-এ চালু হয়।
initAnalytics(resolveAnalyticsIds(envAnalyticsIds(), EMPTY_ANALYTICS_IDS))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
)
