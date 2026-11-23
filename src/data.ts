// PiCall seed data — demo/local mode. No real user data, no secrets.
export type Expert = {
  id: string; name: string; title: string; category: string;
  rate: number; rating: number; calls: number; online: boolean;
  langs: string[]; about: string; avatarColor: string; featured?: boolean;
}

// ফ্রন্টএন্ড সিড এক্সপার্ট সরানো হয়েছে (ডেমো ডেটা) — এক্সপার্ট আসে Railway
// ব্যাকএন্ড (/api/experts) থেকে; সার্ভার না পেলে মার্কেটপ্লেস খালি দেখাবে।
export const EXPERTS: Expert[] = []

export const CATEGORIES = ['All', 'Health', 'Law', 'Education', 'Career', 'Business']

export type TvChannel = { id: string; name: string; category: string; streamUrl: string; officialUrl: string }
const HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
export const TV_CHANNELS: TvChannel[] = [
  { id: 'somoy', name: 'Somoy TV', category: 'News', streamUrl: HLS, officialUrl: 'https://www.somoynews.tv' },
  { id: 'jamuna', name: 'Jamuna TV', category: 'News', streamUrl: HLS, officialUrl: 'https://www.jamuna.tv' },
  { id: 'ekattor', name: 'Ekattor TV', category: 'News', streamUrl: HLS, officialUrl: 'https://www.ekattor.tv' },
  { id: 'ntv', name: 'NTV', category: 'News', streamUrl: HLS, officialUrl: 'https://www.ntvbd.com' },
  { id: 'independent', name: 'Independent TV', category: 'News', streamUrl: HLS, officialUrl: 'https://www.independent24.com' },
  { id: 'channel24', name: 'Channel 24', category: 'News', streamUrl: HLS, officialUrl: 'https://www.channel24bd.tv' },
  { id: 'dbc', name: 'DBC News', category: 'News', streamUrl: HLS, officialUrl: 'https://www.dbcnews.tv' },
  { id: 'channeli', name: 'Channel i', category: 'Entertainment', streamUrl: HLS, officialUrl: 'https://www.channelionline.com' },
  { id: 'atn', name: 'ATN Bangla', category: 'Entertainment', streamUrl: HLS, officialUrl: 'https://www.atnbangla.tv' },
  { id: 'rtv', name: 'RTV', category: 'Entertainment', streamUrl: HLS, officialUrl: 'https://www.rtvonline.com' },
  { id: 'banglavision', name: 'Banglavision', category: 'Entertainment', streamUrl: HLS, officialUrl: 'https://www.banglavision.tv' },
  { id: 'maasranga', name: 'Maasranga TV', category: 'Entertainment', streamUrl: HLS, officialUrl: 'https://www.maasranga.tv' },
  { id: 'deepto', name: 'Deepto TV', category: 'Entertainment', streamUrl: HLS, officialUrl: 'https://www.deeptotv.com' },
  { id: 'gtv', name: 'GTV', category: 'Entertainment', streamUrl: HLS, officialUrl: 'https://www.gtvbd.tv' },
  { id: 'tsports', name: 'T Sports', category: 'Sports', streamUrl: HLS, officialUrl: 'https://www.tsports.com' },
  { id: 'zeebangla', name: 'Zee Bangla', category: 'Entertainment', streamUrl: HLS, officialUrl: 'https://www.zeetv.com' },
  { id: 'starjalsha', name: 'Star Jalsha', category: 'Entertainment', streamUrl: HLS, officialUrl: 'https://www.hotstar.com' }
]
export const TV_CATEGORIES = ['All', 'News', 'Entertainment', 'Sports']

export type Service = { id: string; title: string; price: number; category: string; provider: string; rating: number; desc: string }
export const SERVICES: Service[] = [
  { id: 'srv-1', title: 'Home Cleaning (2 Bedrooms)', price: 800, category: 'Home Service', provider: 'CleanHome BD', rating: 4.8, desc: 'Professional cleaning team, with their own equipment.' },
  { id: 'srv-2', title: 'AC Servicing', price: 1200, category: 'Home Service', provider: 'CoolCare', rating: 4.7, desc: 'Gas check, filter cleaning and general repair.' },
  { id: 'srv-3', title: 'Plumber — Home Service', price: 500, category: 'Home Service', provider: 'FixIt', rating: 4.6, desc: 'Leak, tap and pipe repair.' },
  { id: 'srv-4', title: 'Electrician', price: 600, category: 'Home Service', provider: 'PowerFix', rating: 4.8, desc: 'Wiring, switch and fan repair.' },
  { id: 'srv-5', title: 'Online Math Tuition (1 Month)', price: 1500, category: 'Education', provider: 'Mehjabin Chowdhury', rating: 4.9, desc: '3 days a week, 1 hour live classes.' },
  { id: 'srv-6', title: 'Logo Design', price: 2000, category: 'Design', provider: 'PixelStudio', rating: 4.7, desc: '3 concepts, with source files.' }
]

export type DatingProfile = { id: string; name: string; age: number; city: string; about: string; color: string }
export const DATING_PROFILES: DatingProfile[] = [
  { id: 'dt-1', name: 'Tania', age: 24, city: 'Dhaka', about: 'I love reading books and travelling.', color: '#E91E63' },
  { id: 'dt-2', name: 'Rakib', age: 27, city: 'Chattogram', about: 'Photography and cricket — I love both.', color: '#2196F3' },
  { id: 'dt-3', name: 'Sumaiya', age: 23, city: 'Sylhet', about: 'Cooking and music — my two loves.', color: '#9C27B0' },
  { id: 'dt-4', name: 'Arif', age: 26, city: 'Khulna', about: 'Working on a startup, I love meeting new people.', color: '#009688' },
  { id: 'dt-5', name: 'Nusrat', age: 25, city: 'Dhaka', about: 'I teach, and I love watching movies.', color: '#FF5722' },
  { id: 'dt-6', name: 'Sajib', age: 28, city: 'Rajshahi', about: 'Banker, I travel on weekends.', color: '#607D8B' }
]

export type Post = { id: string; author: string; time: string; text: string; likes: number; comments: number; shares: number; color: string }
// সিড পোস্ট সরানো হয়েছে (ডেমো ডেটা) — ফিডে শুধু ব্যবহারকারীর নিজের পোস্ট থাকে।
export const SEED_POSTS: Post[] = []

// পুরোনো STORIES সিড সরানো হয়েছে (ডেমো ডেটা) — স্টোরি স্ট্রিপ এখন বন্ধু + ৫ পারসোনা থেকে আসে।

// সিড রিল সরানো হয়েছে (ডেমো ডেটা) — রিলস খালি থাকবে, যতক্ষণ না আসল রিল আসে।
export const REELS = []

// People You May Know-এর সিড সরানো হয়েছে (ডেমো ডেটা) — শুধু আসল বন্ধু + ৫ পারসোনা থাকে।
export const FRIEND_SUGGESTIONS = []

export const FRIEND_RATE = 0.1 // π/min flat for friend calls (সব কল Pi-তে)
export const FREE_MINUTES_NOTE = 'Only the first call\'s first 1 minute is free (first user / first friend). Not 2 minutes free.'
export const TOPUP_PACKS = [100, 200, 500, 1000]

// Contact-ban: phone numbers, WhatsApp/Facebook/Telegram links, emails.
export function contactBanCheck(text: string): string | null {
  const t = text.toLowerCase()
  if (/(01[3-9]\d{8})|(\+?8801[3-9]\d{8})/.test(text.replace(/[\s-]/g, ''))) return 'You cannot share phone numbers.'
  if (/whatsapp|wa\.me|facebook\.com|fb\.com|fb\.me|telegram|t\.me|imo|viber/.test(t)) return 'You cannot share links to other contact channels.'
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t)) return 'You cannot share email addresses.'
  if (/\b\d{10,}\b/.test(text.replace(/[\s-]/g, ''))) return 'You cannot share numbers.'
  return null
}

export function formatBDT(n: number): string { return `Tk ${Math.round(n).toLocaleString('en-IN')}` }

// অ্যাপের একমাত্র মুদ্রা Pi (π) — কল, লাইভ, গিফট, বোনাস, রেফারেল সব Pi-তে
// দরগুলোর ডিফল্ট মান — আসল দর অ্যাডমিন নির্ধারণ করেন (স্টোরে piRateBDT/usdtRateBDT), এখানে শুধু ডিফল্ট
export const DEFAULT_PI_RATE_BDT = 100 // ডিফল্ট: ১ π = ৳১০০ (ডেমো রেট, আসল বাজারদর নয়)
export const DEFAULT_USDT_RATE_BDT = 120 // ডিফল্ট: ১ USDT = ৳১২০ (ডেমো রেট)
export const DEFAULT_PI_WITHDRAW_FEE_PCT = 1 // ডিফল্ট Pi তোলার ফি ১% (সর্বনিম্ন ০.১ π)
export const roundPi = (n: number) => Math.round(n * 100000) / 100000 // ৫ দশমিক পর্যন্ত — ডেইলি বোনাস ০.০০০২৫ π-র মতো মান যেন গোল হয়ে না যায়
export function formatPi(n: number): string { const v = roundPi(n); return `π ${v.toLocaleString('en-IN', { maximumFractionDigits: 5 })}` }
// এক্সপার্টদের টাকার রেট → Pi — নির্দিষ্ট ৳১০০ = ১ π রেফারেন্সে (৳১৫ → π ০.১৫); অ্যাডমিনের Pi দর (piRateBDT) থেকে আলাদা, মেশানো হয় না
export const takaToPi = (taka: number) => roundPi(taka / 100)
export const PI_MIN_WITHDRAW_USDT = 10 // Pi তুলতে কমপক্ষে ১০ USDT সমান Pi লাগবে
export const piMinWithdraw = (piRateBDT: number, usdtRateBDT: number) => roundPi((PI_MIN_WITHDRAW_USDT * usdtRateBDT) / piRateBDT) // ডিফল্ট দরে ১২ π
export const piWithdrawFee = (amount: number, feePct: number) => Math.max(0.1, roundPi((amount * feePct) / 100)) // ফি: feePct%, সর্বনিম্ন ০.১ π
// ম্যানুয়াল টপ-আপের ডেমো ঠিকানা/আইডি — আসল ঠিকানা নয়, ডেমো; অ্যাডমিন আসলগুলো বসাবেন
export const BINANCE_PAY_ID = 'PICALL-DEMO-0000'
export const MANUAL_TOPUP_METHODS = ['bKash', 'Nagad', 'Rocket', 'USDT', 'Binance Pay']
// USDT নেটওয়ার্ক — দুটিই ম্যানুয়াল (TRC20 নেই); প্রতিটির আলাদা ডেমো ঠিকানা (ফি আনুমানিক, পরিবর্তন হতে পারে)
export const USDT_NETWORKS = [
  { id: 'BEP20', name: 'BEP20 (BNB Smart Chain)', address: '0xd40cca85f0f54f30445a3577e18a0a5abcca95bf', feeHint: 'Fee approx. ~0.01 USDT (from Binance) — cheapest', cheapest: true },
  { id: 'ERC20', name: 'ERC20 (Ethereum)', address: '0x8e2f8559f823cdef7f73edd77b6c29163d00d68d', feeHint: 'Fee approx. ~0.6 USDT', cheapest: false },
]
export const PI_DEPOSIT_ADDRESS = 'G6NBQ4XDRDLSB7VTNDAOO6DKUYADIUNNQF34OTCOWBFG5L2ZD7REPL65'
