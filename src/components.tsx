import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { formatPi } from './data'

const NAV = [
  { to: '/feed', label: 'হোম', icon: '🏠' },
  { to: '/reels', label: 'ভিডিও', icon: '▶️' },
  { to: '/marketplace', label: 'গুরু', icon: '🎓' },
  { to: '/wallet', label: 'ওয়ালেট', icon: '💰' },
  { to: '/menu', label: 'মেনু', icon: '☰' }
]

export function TopBar() {
  const { user, totalPi, dark, toggleDark } = useStore()
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-fb-card shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center gap-2 px-3 h-[52px]">
        <Link to="/feed" className="text-[26px] font-extrabold text-fb-blue leading-none">PiCall</Link>
        <div className="hidden md:flex flex-1 justify-center gap-1">
          {[
            { to: '/feed', label: '🏠 হোম' }, { to: '/reels', label: '▶️ ভিডিও' },
            { to: '/marketplace', label: '🛍️ মার্কেটপ্লেস' }, { to: '/groups', label: '👥 গ্রুপ' },
            { to: '/live-tv', label: '📺 লাইভ টিভি' }
          ].map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium ${isActive ? 'text-fb-blue bg-blue-50 dark:bg-slate-700' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>{n.label}</NavLink>
          ))}
        </div>
        <div className="flex-1 md:hidden" />
        <button onClick={() => navigate('/wallet')} className="hidden sm:flex items-center gap-1 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200 text-sm font-bold px-3 py-1.5 rounded-full" title="Pi ব্যালেন্স">π {formatPi(totalPi)}</button>
        <button onClick={toggleDark} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center" title="Dark mode">{dark ? '☀️' : '🌙'}</button>
        <button onClick={() => navigate('/chat')} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center" title="মেসেঞ্জার">💬</button>
        <InstallButton compact />
        <button onClick={() => navigate('/menu')} className="w-9 h-9 rounded-full bg-fb-blue text-white flex items-center justify-center font-bold" title="প্রোফাইল">{user ? user.name.slice(0, 1) : '👤'}</button>
      </div>
    </header>
  )
}

export function BottomNav() {
  const { totalPi } = useStore()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-fb-card border-t border-gray-200 dark:border-slate-700 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
      <div className="grid grid-cols-5">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `flex flex-col items-center py-2 text-[11px] font-medium ${isActive ? 'text-fb-blue' : 'text-gray-500 dark:text-gray-300'}`}>
            <span className="text-xl leading-none">{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </div>
      <div className="text-center text-[10px] text-gray-400 pb-1">Pi ব্যালেন্স: {formatPi(totalPi)} • চ্যাট ফ্রি, কল প্রিপেইড</div>
    </nav>
  )
}

export function Sidebar() {
  const { user, isAdmin } = useStore()
  const links = [
    { to: '/feed', label: '📰 ফিড' }, { to: '/friends', label: '👥 বন্ধুরা' },
    { to: '/dating', label: '❤️ ডেটিং ১৮+' }, { to: '/live-tv', label: '📺 লাইভ টিভি' },
    { to: '/services', label: '🏠 হোম সার্ভিস' }, { to: '/groups', label: '👥 গ্রুপ ও পেজ' },
    { to: '/reels', label: '🎬 রিলস' }, { to: '/ads', label: '📢 বিজ্ঞাপন দিন' },
    { to: '/call-history', label: '📞 কল হিস্ট্রি' },
    // অ্যাডমিন লিংক শুধু অ্যাডমিনের সাইডবারে দেখায় — সাধারণ ব্যবহারকারী কোথাও অ্যাডমিন লিংক দেখেন না
    ...(isAdmin ? [{ to: '/admin', label: '🛡️ অ্যাডমিন' }] : [])
  ]
  return (
    <aside className="hidden md:block w-60 shrink-0">
      <div className="sticky top-[64px] space-y-1 p-2">
        <Link to="/menu" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-fb-card font-medium">
          <span className="w-9 h-9 rounded-full bg-fb-blue text-white flex items-center justify-center font-bold">{user ? user.name.slice(0, 1) : '👤'}</span>
          {user ? user.name : 'অতিথি ব্যবহারকারী'}
        </Link>
        {links.map(l => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-white dark:bg-fb-card font-bold text-fb-blue' : 'hover:bg-white dark:hover:bg-fb-card'}`}>{l.label}</NavLink>
        ))}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-slate-800 rounded-xl text-xs text-gray-600 dark:text-gray-300">
          <b className="text-fb-blue">প্রথম কলের প্রথম ১ মিনিট ফ্রি</b><br />শুধু প্রথম ব্যবহারকারী / প্রথম বন্ধুর জন্য। ২ মিনিট ফ্রি নয়।
        </div>
      </div>
    </aside>
  )
}

export function Layout() {
  const loc = useLocation()
  const { friends } = useStore()
  const hideChrome = loc.pathname.startsWith('/call/')
  if (hideChrome) return <Outlet />
  return (
    <div className="min-h-screen bg-fb-bg dark:bg-fb-dark text-gray-900 dark:text-gray-100">
      <TopBar />
      <div className="max-w-6xl mx-auto flex gap-4 px-0 sm:px-3 pb-24 md:pb-8">
        <Sidebar />
        <main className="flex-1 min-w-0 py-3 px-3 sm:px-0"><Outlet /></main>
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-[64px] space-y-4 p-2">
            <div className="bg-white dark:bg-fb-card rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-500 text-sm mb-2">Sponsored</h3>
              <p className="text-sm">PiCall প্রিমিয়াম — ডেটিংয়ে আনলিমিটেড লাইক, কে লাইক দিয়েছে দেখুন। মাত্র ৳৯৯/মাস।</p>
              <Link to="/dating" className="text-fb-blue text-sm font-medium">বিস্তারিত →</Link>
            </div>
            <div className="bg-white dark:bg-fb-card rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-500 text-sm mb-2">Contacts • অনলাইন</h3>
              {friends.length === 0 && <p className="text-sm text-gray-500">এখনো কোনো বন্ধু নেই।</p>}
              {friends.map(f => (
                <div key={f.id} className="flex items-center gap-2 py-1.5 text-sm"><span className="relative w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold" style={{ background: f.color }}>{f.name.slice(0, 1)}{f.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />}</span>{f.name}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <BottomNav />
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-fb-card rounded-xl shadow-sm p-4 ${className}`}>{children}</div>
}

// ---------- PWA ইন্সটল ----------
// ব্রাউজারের beforeinstallprompt ধরলে সরাসরি ইন্সটল হয়; না ধরলে (iPhone Safari, আগেই ইন্সটল) প্রতি-ব্রাউজার ধাপ দেখানো হয়।
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export function InstallButton({ compact = false }: { compact?: boolean }) {
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
      setMsg(choice.outcome === 'accepted' ? '✅ ইন্সটল শুরু হয়েছে — হোম স্ক্রিনে PiCall আইকন দেখুন।' : 'ইন্সটল বাতিল হয়েছে — পরে আবার চেষ্টা করুন।')
    } else {
      setShowHelp(s => !s)
    }
  }
  return (
    <span className={compact ? '' : 'block'}>
      <button onClick={install} title="অ্যাপ ইন্সটল করুন" className={compact ? 'w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center' : 'w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-fb-blue text-white'}>
        📲 {compact ? '' : 'অ্যাপ ইন্সটল করুন'}
      </button>
      {msg && <p className="text-xs text-green-600 mt-1">{msg}</p>}
      {showHelp && (
        <div className="mt-2 text-left bg-blue-50 dark:bg-slate-800 rounded-xl p-3 text-xs space-y-1">
          <p className="font-bold">📲 ফোনে PiCall অ্যাপ বসানোর নিয়ম</p>
          <p><b>Android (Chrome):</b> ব্রাউজারের ⋮ মেনু → “Install app” / “Add to Home screen” চাপুন।</p>
          <p><b>iPhone (Safari):</b> নিচের Share ⬆️ বোতাম → “Add to Home Screen” চাপুন।</p>
          <p className="text-gray-500">ইন্সটল হলে PiCall আইকন হোম স্ক্রিনে আসবে, অ্যাপের মতো খুলবে।</p>
        </div>
      )}
    </span>
  )
}

export function Btn({ children, onClick, variant = 'primary', disabled, className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'green'; disabled?: boolean; className?: string }) {
  const styles = variant === 'primary' ? 'bg-fb-blue text-white' : variant === 'green' ? 'bg-green-600 text-white' : variant === 'danger' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100'
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}>{children}</button>
}
