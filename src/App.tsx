import { useEffect } from 'react'
import { Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from './components'
import { useStore } from './store'
import { installAudioUnlock } from './sounds'
import { IncomingCallHost } from './IncomingCallOverlay'
import {
  AdminPage, AdsPage, CallHistory, CallPage, ChatPage, CreateService, DatingGoLivePage, DatingLivePage, DatingPage,
  ExpertProfile, Feed, FriendsPage, GroupsPage, Landing, LiveTV, LoginPage,
  Marketplace, MenuPage, ReelsPage, ServicesPage, WalletPage
} from './pages'

// অ্যাডমিন নয় এমন ব্যবহারকারী /admin খুললে — কোনো অ্যাডমিন তথ্য (রেট, KYC, টপ-আপ অনুমোদন, ব্যবহারকারী তালিকা) না দেখিয়ে ব্লক করা হয়
function AdminBlocked() {
  const navigate = useNavigate()
  return (
    <div className="max-w-xl mx-auto py-10 px-4 text-center">
      <p className="font-bold text-lg">⛔ Admins only — only the admin can see this page.</p>
      <button onClick={() => navigate('/feed')} className="mt-4 px-4 py-2 rounded-lg font-medium text-sm bg-fb-blue text-white">Back to Feed</button>
    </div>
  )
}

export default function App() {
  // রেফার লিংকে (?ref=কোড) এসে থাকলে ওয়েলকাম বোনাস একবারই মেলে; ফ্রি মিনিটের নিয়ম অপরিবর্তিত থাকে
  const { claimRefArrival, user, isAdmin } = useStore()
  const loc = useLocation()
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code) claimRefArrival(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // অডিও আনলক — মোবাইল ব্রাউজার প্রথম ট্যাপের আগে সাউন্ড বন্ধ রাখে; প্রথম
  // pointer/touch-এ AudioContext চালু হয়, মোবাইল/কম্পিউটার দুটোতেই একইভাবে
  useEffect(() => installAudioUnlock(), [])
  // লগইন দেওয়াল — লগইন ছাড়া /login বাদে কোনো পেজই দেখা যায় না (ল্যান্ডিং পেজ সহ); লগইন না থাকলে /login-এ পাঠানো হয়
  if (!user && loc.pathname !== '/login') return <Navigate to="/login" replace />
  // ইনকামিং-কল হোস্ট — লগইন থাকলে সব পেজেই (হোম পেজ সহ) কল এলে ওভারলে ওঠে;
  // /login-এ নয়, আর /call/* পেজে থাকলে ওভারলে নিজে থেকেই বন্ধ থাকে
  const showCallHost = !!user && loc.pathname !== '/login'
  return (
    <>
      {showCallHost && <IncomingCallHost />}
      <Routes>
      {/* লগইন পেজ Layout-এর বাইরে — লগইন ছাড়া অ্যাপের কিছুই (টপ নেভ, সাইডবার, ডান কলাম) দেখা যায় না, শুধু লগইন কার্ড */}
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/expert/:id" element={<ExpertProfile />} />
        <Route path="/create-service" element={<CreateService />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/call-history" element={<CallHistory />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/dating" element={<DatingPage />} />
        <Route path="/live-tv" element={<LiveTV />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/reels" element={<ReelsPage />} />
        <Route path="/ads" element={<AdsPage />} />
        <Route path="/admin" element={isAdmin ? <AdminPage /> : <AdminBlocked />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="/call/:type/:id" element={<CallPage />} />
      <Route path="/call/:code" element={<CallPage />} />
      <Route path="/dating-live/:id" element={<DatingLivePage />} />
      <Route path="/dating-go-live" element={<DatingGoLivePage />} />
    </Routes>
    </>
  )
}
