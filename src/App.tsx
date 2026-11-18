import { Route, Routes, Navigate } from 'react-router-dom'
import { Layout } from './components'
import {
  AdminPage, AdsPage, CallHistory, CallPage, ChatPage, CreateService, DatingPage,
  ExpertProfile, Feed, FriendsPage, GroupsPage, Landing, LiveTV, LoginPage,
  Marketplace, MenuPage, ReelsPage, ServicesPage, WalletPage
} from './pages'

export default function App() {
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
    </Routes>
  )
}
