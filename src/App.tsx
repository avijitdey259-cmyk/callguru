import { useEffect } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { Layout } from './components'
import { useStore } from './store'
import {
  AdminPage, AdsPage, CallHistory, CallPage, ChatPage, CreateService, DatingGoLivePage, DatingLivePage, DatingPage,
  ExpertProfile, Feed, FriendsPage, GroupsPage, Landing, LiveTV, LoginPage,
  Marketplace, MenuPage, ReelsPage, ServicesPage, WalletPage
} from './pages'

export default function App() {
  // রেফার লিংকে (?ref=কোড) এসে থাকলে ওয়েলকাম বোনাস একবারই মেলে; ফ্রি মিনিটের নিয়ম অপরিবর্তিত থাকে
  const { claimRefArrival } = useStore()
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code) claimRefArrival(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginPage />} />
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
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="/call/:type/:id" element={<CallPage />} />
      <Route path="/dating-live/:id" element={<DatingLivePage />} />
      <Route path="/dating-go-live" element={<DatingGoLivePage />} />
    </Routes>
  )
}
