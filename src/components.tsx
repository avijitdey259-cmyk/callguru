import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { HeaderSearch } from './searchUI'
import { formatPi } from './data'

// হেডারের মাঝের নেভ — মোবাইলেও একই, কম্পিউটারেও একই (শুধু জায়গা বদলায়:
// কম্পিউটারে হেডারের মাঝে, মোবাইলে হেডারের নিচের ট্যাব সারিতে)। Facebook-এর
// মতো আইকন + নাম, সক্রিয় ট্যাবে নীল রং + নিচে নীল দাগ।
const CENTER_NAV = [
  { to: '/feed', label: 'Home', icon: '🏠' },
  { to: '/friends', label: 'Friends', icon: '👥' },
  { to: '/reels', label: 'Video', icon: '▶️' },
  { to: '/dating', label: 'Dating', icon: '❤️' },
  { to: '/live-tv', label: 'Live TV', icon: '📺' },
]

export function TopBar() {
  const { user, totalPi, dark, toggleDark } = useStore()
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-fb-card shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center gap-2 px-3 h-[52px]">
        <Link to="/feed" className="text-[26px] font-extrabold text-fb-blue leading-none shrink-0">PiCall</Link>
        {/* লোগোর পাশেই খোঁজা — এটাই আসল সার্চ (বন্ধু + পোস্ট, সাজেশনসহ); ফিডের নিচে আর আলাদা বাক্স নেই */}
        <div className="hidden md:block w-60 shrink-0"><HeaderSearch /></div>
        <div className="hidden md:flex flex-1 justify-center gap-1">
          {CENTER_NAV.map(n => (
            <NavLink key={n.to} to={n.to} title={n.label} className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium ${isActive ? 'text-fb-blue bg-blue-50 dark:bg-slate-700 border-b-2 border-fb-blue' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>{n.icon} {n.label}</NavLink>
          ))}
        </div>
        <div className="flex-1 md:hidden" />
        <button onClick={() => navigate('/wallet')} className="flex items-center gap-1 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200 text-xs sm:text-sm font-bold px-2 sm:px-3 py-1.5 rounded-full shrink-0" title="Pi Balance">π {formatPi(totalPi)}</button>
        <button onClick={() => setMobileSearchOpen(o => !o)} className="md:hidden w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0" title="Search">🔍</button>
        <button onClick={toggleDark} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0" title="Dark mode">{dark ? '☀️' : '🌙'}</button>
        <button onClick={() => navigate('/chat')} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0" title="Messenger">💬</button>
        <InstallButton compact />
        <button onClick={() => navigate('/menu')} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-fb-blue text-white flex items-center justify-center font-bold shrink-0" title="Profile">{user ? user.name.slice(0, 1) : '👤'}</button>
      </div>
      {/* মোবাইলে 🔍 চাপলে লোগোর নিচে পুরো চওড়া সার্চ বাক্স খোলে — একই HeaderSearch, একই আচরণ */}
      {mobileSearchOpen && (
        <div className="md:hidden px-3 pb-2"><HeaderSearch /></div>
      )}
      {/* মোবাইলে হেডারের নিচে ট্যাব সারি — কম্পিউটারের মাঝের নেভের একই ৫টি গন্তব্য */}
      <div className="md:hidden border-t border-gray-100 dark:border-slate-700">
        <div className="flex justify-around">
          {CENTER_NAV.map(n => (
            <NavLink key={n.to} to={n.to} title={n.label} className={({ isActive }) => `flex flex-col items-center py-1.5 px-2 text-[11px] font-medium ${isActive ? 'text-fb-blue border-b-2 border-fb-blue' : 'text-gray-500 dark:text-gray-300'}`}>
              <span className="text-xl leading-none">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  )
}

export function Sidebar() {
  const { user, isAdmin } = useStore()
  const links = [
    { to: '/feed', label: '📰 Feed' }, { to: '/friends', label: '👥 Friends' },
    { to: '/dating', label: '❤️ Dating 18+' }, { to: '/live-tv', label: '📺 Live TV' },
    { to: '/wallet', label: '💰 Wallet' },
    { to: '/services', label: '🏠 Home Service' }, { to: '/groups', label: '👥 Groups & Pages' },
    { to: '/reels', label: '🎬 Reels' }, { to: '/ads', label: '📢 Place an Ad' },
    { to: '/call-history', label: '📞 Call History' },
    { to: '/menu', label: '⚙️ Settings' },
    // অ্যাডমিন লিংক শুধু অ্যাডমিনের সাইডবারে দেখায় — সাধারণ ব্যবহারকারী কোথাও অ্যাডমিন লিংক দেখেন না
    ...(isAdmin ? [{ to: '/admin', label: '🛡️ Admin' }] : [])
  ]
  return (
    <aside className="hidden md:block w-60 shrink-0">
      <div className="sticky top-[64px] space-y-1 p-2">
        <Link to="/menu" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-fb-card font-medium">
          <span className="w-9 h-9 rounded-full bg-fb-blue text-white flex items-center justify-center font-bold">{user ? user.name.slice(0, 1) : '👤'}</span>
          {user ? user.name : 'Guest user'}
        </Link>
        {links.map(l => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-white dark:bg-fb-card font-bold text-fb-blue' : 'hover:bg-white dark:hover:bg-fb-card'}`}>{l.label}</NavLink>
        ))}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-slate-800 rounded-xl text-xs text-gray-600 dark:text-gray-300">
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
          <span className="relative w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0" style={{ background: f.color }}>{f.name.slice(0, 1)}{f.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />}</span>
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
    <div className="min-h-screen bg-fb-bg dark:bg-fb-dark text-gray-900 dark:text-gray-100">
      <TopBar />
      <div className="max-w-6xl mx-auto flex gap-4 px-0 sm:px-3 pb-8">
        <Sidebar />
        <main className="flex-1 min-w-0 py-3 px-3 sm:px-0"><Outlet /></main>
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-[64px] space-y-4 p-2">
            <SponsoredCard />
            <ContactsCard />
          </div>
        </aside>
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-fb-card rounded-xl shadow-sm p-4 ${className}`}>{children}</div>
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
      <button onClick={install} title="Install App" className={compact ? 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0' : 'w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-fb-blue text-white'}>
        📲 {compact ? '' : 'Install App'}
      </button>
      {!compact && showOffer && !installBonusClaimed && <p className="text-xs mt-1 opacity-90">📲 Install the app for a 5 π bonus — gifts only.</p>}
      {msg && <p className="text-xs text-green-600 mt-1">{msg}</p>}
      {showHelp && (
        <div className="mt-2 text-left bg-blue-50 dark:bg-slate-800 rounded-xl p-3 text-xs space-y-1">
          <p className="font-bold">📲 How to Install the PiCall App on Your Phone</p>
          <p><b>Android (Chrome):</b> Tap the browser ⋮ menu → “Install app” / “Add to Home screen”.</p>
          <p><b>iPhone (Safari):</b> Tap the Share ⬆️ button below → “Add to Home Screen”.</p>
          <p className="text-gray-500">After installing, the PiCall icon will appear on your home screen and open like an app.</p>
        </div>
      )}
    </span>
  )
}

export function Btn({ children, onClick, variant = 'primary', disabled, className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'green'; disabled?: boolean; className?: string }) {
  const styles = variant === 'primary' ? 'bg-fb-blue text-white' : variant === 'green' ? 'bg-green-600 text-white' : variant === 'danger' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100'
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}>{children}</button>
}
