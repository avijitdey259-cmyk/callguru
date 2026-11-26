import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { Avatar } from './avatar'
import { HeaderSearch } from './searchUI'
import { formatPi } from './data'
import { IconBell, IconBriefcase, IconCall, IconChat, IconDating, IconDownload, IconFriends, IconHome, IconLiveTV, IconMegaphone, IconMoon, IconReels, IconSettings, IconShield, IconSun, IconUser, IconWallet } from './icons'

// হেডারের মাঝের নেভ — মোবাইলেও একই, কম্পিউটারেও একই (শুধু জায়গা বদলায়:
// কম্পিউটারে হেডারের মাঝে, মোবাইলে নিচের BottomNav-এ)। Facebook-এর
// মতো আইকন + নাম, সক্রিয় ট্যাবে Pi purple→gold গ্রেডিয়েন্ট।
// ক্রম ডেমোর মতো — লাইভ টিভি মাঝখানে (৩ নম্বরে): হোম, শর্টস, লাইভ টিভি, বন্ধু, ডেটিং।
const CENTER_NAV = [
  { to: '/feed', label: 'Home', icon: IconHome },
  { to: '/reels', label: 'Shorts', icon: IconReels },
  { to: '/live-tv', label: 'Live TV', icon: IconLiveTV },
  { to: '/friends', label: 'Friends', icon: IconFriends },
  { to: '/dating', label: 'Dating', icon: IconDating },
]

export function TopBar() {
  const { user, totalPi, dark, toggleDark, requests, profilePhoto } = useStore()
  const navigate = useNavigate()
  const pendingCount = requests.length
  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#211a30] shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center gap-2 px-3 h-[52px]">
        {/* ডেমোর লোগো-মার্ক — Pi purple বর্গে π, পাশে PiCall */}
        <Link to="/feed" className="flex items-center gap-2 shrink-0" title="PiCall — Home">
          <span className="w-[38px] h-[38px] rounded-[12px] pb-gradient text-white grid place-items-center font-display font-extrabold text-[21px] shadow-sm">π</span>
          <span className="text-[26px] font-extrabold pb-gradient-text leading-none font-display">PiCall</span>
        </Link>
        {/* লোগোর পাশেই খোঁজা — এটাই আসল সার্চ (বন্ধু + পোস্ট, সাজেশনসহ); ফিডের নিচে আর আলাদা বাক্স নেই */}
        <div className="hidden md:block w-60 shrink-0"><HeaderSearch /></div>
        <div className="hidden md:flex flex-1 justify-center gap-1">
          {CENTER_NAV.map(n => (
            <NavLink key={n.to} to={n.to} title={n.label} className={({ isActive }) => `relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${isActive ? 'pb-gradient text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}><n.icon className="w-5 h-5" /> {n.label}{n.to === '/friends' && pendingCount > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pi-gold text-white text-[11px] font-bold flex items-center justify-center">{pendingCount > 9 ? '9+' : pendingCount}</span>}</NavLink>
          ))}
        </div>
        <div className="flex-1 md:hidden" />
        {/* Pi ব্যালেন্স পিল — ডেমোর সোনালি পিল (হালকা সোনালি পটভূমি, গাঢ় সোনালি লেখা) */}
        <button onClick={() => navigate('/wallet')} className="flex items-center gap-1 bg-[#fef3c7] dark:bg-[#3a2c07] text-[#b45309] dark:text-[#fbbf24] text-xs sm:text-sm font-bold px-2 sm:px-3 py-1.5 rounded-full shrink-0" title="Pi Balance">{formatPi(totalPi)}</button>
        {/* নোটিফিকেশন ঘণ্টা — ঝুলে থাকা বন্ধু-অনুরোধের সংখ্যা সোনালি ব্যাজে, ট্যাপে Friends পাতা */}
        <button onClick={() => navigate('/friends')} className="relative w-[42px] h-[42px] rounded-[14px] bg-[#f1ecf9] dark:bg-[#2b2142] flex items-center justify-center shrink-0" title="Notifications">
          <IconBell className="w-5 h-5" />
          {pendingCount > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pi-gold text-white text-[11px] font-bold flex items-center justify-center">{pendingCount > 9 ? '9+' : pendingCount}</span>}
        </button>
        <button onClick={toggleDark} className="w-[42px] h-[42px] rounded-[14px] bg-[#f1ecf9] dark:bg-[#2b2142] flex items-center justify-center shrink-0" title="Dark mode">{dark ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}</button>
        <button onClick={() => navigate('/chat')} className="w-[42px] h-[42px] rounded-[14px] bg-[#f1ecf9] dark:bg-[#2b2142] flex items-center justify-center shrink-0" title="Messenger"><IconChat className="w-5 h-5" /></button>
        <InstallButton compact />
        <button onClick={() => navigate('/menu')} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full pb-gradient text-white flex items-center justify-center font-bold shrink-0 overflow-hidden" title="Profile">{profilePhoto ? <img src={profilePhoto} alt="Profile photo" className="w-full h-full object-cover" /> : (user ? user.name.slice(0, 1) : <IconUser className="w-5 h-5" />)}</button>
      </div>
      {/* মোবাইলে হেডারের নিচে সবসময় পুরো চওড়া সার্চ সারি — একই HeaderSearch, একই আচরণ */}
      <div className="md:hidden px-3 pb-2"><HeaderSearch /></div>
    </header>
  )
}

// মোবাইলে নিচের নেভ — ডেমোর নতুন আইকন বার: সক্রিয় আইকনের পেছনে হালকা
// বেগুনি পিল, আইকনের নিচে নাম, টাচ টার্গেট ৫৪px। কম্পিউটারে দেখায় না।
// (কম্পিউটারের মাঝের নেভে গ্রেডিয়েন্ট পিলই থাকে — সেটা Style 6-এর চিহ্ন।)
export function BottomNav() {
  // ঝুলে থাকা বন্ধু-অনুরোধের ব্যাজ — Friends আইকনে সোনালি সংখ্যা; রিকোয়েস্ট
  // এলেই লাইভ সাবস্ক্রিপশনে সংখ্যা ওঠে, গ্রহণ/বাতিলে মিলিয়ে যায়।
  const { requests } = useStore()
  const pendingCount = requests.length
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#211a30] border-t border-[#e7e0f2] dark:border-[#372b52] shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex px-2 py-2">
        {CENTER_NAV.map(n => (
          <NavLink key={n.to} to={n.to} title={n.label} className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-[3px] py-[5px] text-[11.5px] font-semibold rounded-[14px] min-h-[54px] ${isActive ? 'text-pi-purple dark:text-[#a78bfa]' : 'text-gray-500 dark:text-gray-400'}`}>
            {({ isActive }) => (
              <>
                <span className={`relative w-[46px] h-[30px] rounded-full grid place-items-center ${isActive ? 'bg-[#f1ecf9] dark:bg-[#2b2142]' : ''}`}><n.icon className="w-[23px] h-[23px]" />{n.to === '/friends' && pendingCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-pi-gold text-white text-[11px] font-bold flex items-center justify-center">{pendingCount > 9 ? '9+' : pendingCount}</span>}</span>
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function Sidebar() {
  const { user, isAdmin, profilePhoto, requests } = useStore()
  const pendingCount = requests.length
  const links = [
    { to: '/feed', label: 'Feed', icon: IconHome }, { to: '/friends', label: 'Friends', icon: IconFriends },
    { to: '/dating', label: 'Dating 18+', icon: IconDating }, { to: '/live-tv', label: 'Live TV', icon: IconLiveTV },
    { to: '/wallet', label: 'Wallet', icon: IconWallet },
    { to: '/services', label: 'Services', icon: IconBriefcase }, { to: '/groups', label: 'Groups & Pages', icon: IconFriends },
    { to: '/reels', label: 'Reels', icon: IconReels }, { to: '/ads', label: 'Place an Ad', icon: IconMegaphone },
    { to: '/call-history', label: 'Call History', icon: IconCall },
    { to: '/menu', label: 'Settings', icon: IconSettings },
    // অ্যাডমিন লিংক শুধু অ্যাডমিনের সাইডবারে দেখায় — সাধারণ ব্যবহারকারী কোথাও অ্যাডমিন লিংক দেখেন না
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: IconShield }] : [])
  ]
  return (
    <aside className="hidden md:block w-60 shrink-0">
      <div className="sticky top-[64px] space-y-1 p-2">
        <Link to="/menu" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-fb-card font-medium">
          {user ? <Avatar photo={profilePhoto} name={user.name} color="#7C3AED" className="w-9 h-9" /> : <span className="w-9 h-9 rounded-full pb-gradient text-white flex items-center justify-center font-bold"><IconUser className="w-5 h-5" /></span>}
          {user ? user.name : 'Guest user'}
        </Link>
        {links.map(l => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `relative flex items-center gap-2.5 px-3 py-2 rounded-full text-sm ${isActive ? 'pb-gradient text-white font-bold shadow-sm' : 'hover:bg-white dark:hover:bg-fb-card'}`}><l.icon className="w-5 h-5 shrink-0" />{l.label}{l.to === '/friends' && pendingCount > 0 && <span className="absolute right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-pi-gold text-white text-[11px] font-bold flex items-center justify-center">{pendingCount > 9 ? '9+' : pendingCount}</span>}</NavLink>
        ))}
        <div className="mt-4 p-3 bg-violet-50 dark:bg-slate-800 rounded-xl text-xs text-gray-600 dark:text-gray-300">
          <b className="text-fb-blue">First call's first 1 minute free</b><br />Only for the first user / first friend. Not 2 minutes free.
        </div>
      </div>
    </aside>
  )
}

// ডান কলামের কার্ড দুটো — কম্পিউটারে ডান সাইডবারে, মোবাইলে ফিডের নিচে (একই
// কম্পোনেন্ট, একই আচরণ; শুধু জায়গা বদলায় — মোবাইলেও সবকিছু থাকে)।
export function SponsoredCard() {
  return (
    <div className="bg-white dark:bg-fb-card rounded-xl p-4 shadow-sm">
      <h3 className="font-bold text-gray-500 text-sm mb-2">Sponsored</h3>
      <p className="text-sm">PiCall Premium — unlimited likes in Dating, see who liked you. Only Tk 99/month.</p>
      <Link to="/dating" className="text-fb-blue text-sm font-medium">Details →</Link>
    </div>
  )
}

export function ContactsCard() {
  const { friends } = useStore()
  const navigate = useNavigate()
  return (
    <div className="bg-white dark:bg-fb-card rounded-xl p-4 shadow-sm">
      <h3 className="font-bold text-gray-500 text-sm mb-2">Contacts • Online</h3>
      {friends.length === 0 && <p className="text-sm text-gray-500">No friends yet.</p>}
      {friends.map(f => (
        <button key={f.id} onClick={() => navigate('/chat', { state: { with: f.name } })} className="flex items-center gap-2 py-1.5 px-1 text-sm w-full text-left rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
          <Avatar photo={f.photo} name={f.name} color={f.color} className="w-7 h-7 text-xs" online={f.online} />
          {f.name}
        </button>
      ))}
    </div>
  )
}

export function Layout() {
  const loc = useLocation()
  const hideChrome = loc.pathname.startsWith('/call/')
  if (hideChrome) return <Outlet />
  return (
    <div className="min-h-screen bg-[#faf8fc] dark:bg-[#16121f] text-gray-900 dark:text-gray-100">
      <TopBar />
      <div className="max-w-6xl mx-auto flex gap-4 px-0 sm:px-3 pb-20 md:pb-8">
        <Sidebar />
        <main className="flex-1 min-w-0 py-3 px-3 sm:px-0"><Outlet /></main>
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-[64px] space-y-4 p-2">
            <SponsoredCard />
            <ContactsCard />
          </div>
        </aside>
      </div>
      <BottomNav />
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-[#211a30] rounded-[20px] border border-[#e7e0f2] dark:border-[#372b52] shadow-sm p-4 ${className}`}>{children}</div>
}

// ---------- PWA ইন্সটল ----------
// ব্রাউজারের beforeinstallprompt ধরলে সরাসরি ইন্সটল হয়; না ধরলে (iPhone Safari, আগেই ইন্সটল) প্রতি-ব্রাউজার ধাপ দেখানো হয়।
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export function InstallButton({ compact = false, showOffer = true }: { compact?: boolean; showOffer?: boolean }) {
  const { installBonusClaimed } = useStore()
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent) }
    window.addEventListener('beforeinstallprompt', onBIP)
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])
  async function install() {
    setMsg('')
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      setDeferred(null)
      setMsg(choice.outcome === 'accepted' ? '✅ Install started — look for the PiCall icon on your home screen.' : 'Install cancelled — please try again later.')
    } else {
      setShowHelp(s => !s)
    }
  }
  return (
    <span className={compact ? '' : 'block'}>
      <button onClick={install} title="Install App" className={compact ? 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0' : 'w-full px-4 py-2.5 rounded-lg font-medium text-sm pb-gradient text-white shadow-sm flex items-center justify-center gap-2'}>
        <IconDownload className="w-5 h-5 shrink-0" /> {compact ? '' : 'Install App'}
      </button>
      {!compact && showOffer && !installBonusClaimed && <p className="text-xs mt-1 opacity-90 flex items-center gap-1"><IconDownload className="w-3.5 h-3.5 shrink-0" /> Install the app for a 5 π bonus — gifts only.</p>}
      {msg && <p className="text-xs text-green-600 mt-1">{msg}</p>}
      {showHelp && (
        <div className="mt-2 text-left bg-violet-50 dark:bg-slate-800 rounded-xl p-3 text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5"><IconDownload className="w-4 h-4 shrink-0" /> How to Install the PiCall App on Your Phone</p>
          <p><b>Android (Chrome):</b> Tap the browser ⋮ menu → “Install app” / “Add to Home screen”.</p>
          <p><b>iPhone (Safari):</b> Tap the Share ⬆️ button below → “Add to Home Screen”.</p>
          <p className="text-gray-500">After installing, the PiCall icon will appear on your home screen and open like an app.</p>
        </div>
      )}
    </span>
  )
}

export function Btn({ children, onClick, variant = 'primary', disabled, className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'green'; disabled?: boolean; className?: string }) {
  const styles = variant === 'primary' ? 'pb-gradient text-white shadow-sm' : variant === 'green' ? 'bg-green-600 text-white' : variant === 'danger' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100'
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}>{children}</button>
}
