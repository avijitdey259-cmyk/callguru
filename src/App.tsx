import { useEffect } from 'react'
import { Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from './components'
import { useStore } from './store'
import { installAudioUnlock } from './sounds'
import { IncomingCallHost } from './IncomingCallOverlay'
import { TV_CHANNELS } from './data'
import { clearProbeCache, probeChannels } from './tvProbe'
import {
  AdminPage, AdsPage, CallHistory, CallPage, ChatPage, CreateService, DatingGoLivePage, DatingLivePage, DatingPage,
  ExpertProfile, Feed, FriendsPage, GroupsPage, GroupDetailPage, Landing, LiveTV, LoginPage,
  MenuPage, ReelsPage, SearchResultsPage, ServicesPage, UserProfilePage, WalletPage
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

// ব্যান হওয়া ব্যবহারকারী — অ্যাডমিন config/public-এর bannedUids-এ UID বসালে
// এই অ্যাকাউন্টে অ্যাপের কিছুই (ফিড, চ্যাট, কল) খোলে না; শুধু ব্যান-বার্তা + লগআউট।
// (Firebase Auth ব্যবহারকারী মোছা যায় না ক্লায়েন্ট থেকে — ব্যান মানেই অ্যাপ-স্তরে বন্ধ।)
function BannedScreen() {
  const { logout } = useStore()
  return (
    <div className="min-h-screen bg-[#faf8fc] dark:bg-[#16121f] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-4xl">⛔</p>
      <p className="font-bold text-lg mt-3">Your account is banned</p>
      <p className="text-sm text-gray-500 mt-2 max-w-md">The admin has banned this account — calls, chat and all other features are blocked. If you think this is a mistake, contact the admin.</p>
      <button onClick={logout} className="mt-5 px-4 py-2 rounded-lg font-medium text-sm bg-fb-blue text-white">Log out</button>
    </div>
  )
}

export default function App() {
  // রেফার লিংকে (?ref=কোড) এসে থাকলে ওয়েলকাম বোনাস একবারই মেলে; ফ্রি মিনিটের নিয়ম অপরিবর্তিত থাকে
  const { claimRefArrival, user, isAdmin, isBanned } = useStore()
  const loc = useLocation()
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code) claimRefArrival(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // অডিও আনলক — মোবাইল ব্রাউজার প্রথম ট্যাপের আগে সাউন্ড বন্ধ রাখে; প্রথম
  // pointer/touch-এ AudioContext চালু হয়, মোবাইল/কম্পিউটার দুটোতেই একইভাবে
  useEffect(() => installAudioUnlock(), [])
  // লাইভ টিভি যাচাই — অ্যাপে ঢুকলেই (লগইন থাকলে, প্রতি সেশনে একবার)
  // সব চ্যানেল চালিয়ে দেখা হয়; চলে এমন উপরে, না-চলা নিচে। ব্যাকগ্রাউন্ডে
  // চলে, UI আটকায় না; ফল সেশন-ক্যাশে থাকে, হোমের TV প্রিভিউ আর Live TV
  // পেজ সেটাই পড়ে। রিলোড/নতুন সেশন = নতুন যাচাই।
  useEffect(() => {
    if (!user) return
    clearProbeCache()
    const urls = TV_CHANNELS.map(c => c.streamUrl).filter(Boolean) as string[]
    if (urls.length > 0) void probeChannels(urls)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])
  // লগইন দেওয়াল — লগইন ছাড়া /login বাদে কোনো পেজই দেখা যায় না (ল্যান্ডিং পেজ সহ); লগইন না থাকলে /login-এ পাঠানো হয়
  if (!user && loc.pathname !== '/login') return <Navigate to="/login" replace />
  // ব্যান দেওয়াল — ব্যান হওয়া অ্যাকাউন্টে লগইন থাকলেও অ্যাপের কিছুই খোলে না
  if (user && isBanned) return <BannedScreen />
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
        <Route path="/marketplace" element={<Navigate to="/services" replace />} />
        <Route path="/expert/:id" element={<ExpertProfile />} />
        <Route path="/create-service" element={<CreateService />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/call-history" element={<CallHistory />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/profile/:id" element={<UserProfilePage />} />
        <Route path="/dating" element={<DatingPage />} />
        <Route path="/live-tv" element={<LiveTV />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:id" element={<GroupDetailPage />} />
        <Route path="/pages/:id" element={<GroupDetailPage />} />
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
