import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider } from './store'
import { initAppUpdate } from './appUpdate'
import './index.css'

// PWA অটো-আপডেট — অ্যাপ খুললেই + ফোরগ্রাউন্ডে ফিরলেই নতুন ভার্সন চেক,
// নতুন থাকলে আপনা-আপনি চালু হয় (ব্যানার/বোতাম নেই); কল/লাইভ/রেকর্ডিং
// চললে সুইচ পিছিয়ে যায়; অফলাইনে ক্যাশ করা ভার্সনই চলে।
initAppUpdate()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
)
