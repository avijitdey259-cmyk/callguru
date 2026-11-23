// PiCall seed data — demo/local mode. No real user data, no secrets.
export type Expert = {
  id: string; name: string; title: string; category: string;
  rate: number; rating: number; calls: number; online: boolean;
  langs: string[]; about: string; avatarColor: string; featured?: boolean;
}

// ফ্রন্টএন্ড সিড এক্সপার্ট সরানো হয়েছে (ডেমো ডেটা) — এক্সপার্ট আসে Railway
// ব্যাকএন্ড (/api/experts) থেকে; সার্ভার না পেলে মার্কেটপ্লেস খালি দেখাবে।
export const EXPERTS: Expert[] = []

export const CATEGORIES = ['সবগুলো', 'স্বাস্থ্য', 'আইন', 'শিক্ষা', 'ক্যারিয়ার', 'ব্যবসা']

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
  { id: 'srv-1', title: 'বাসা পরিষ্কার (২ বেডরুম)', price: 800, category: 'হোম সার্ভিস', provider: 'CleanHome BD', rating: 4.8, desc: 'প্রফেশনাল ক্লিনিং টিম, নিজস্ব সরঞ্জামসহ।' },
  { id: 'srv-2', title: 'এসি সার্ভিসিং', price: 1200, category: 'হোম সার্ভিস', provider: 'CoolCare', rating: 4.7, desc: 'গ্যাস চেক, ফিল্টার ক্লিন ও সাধারণ মেরামত।' },
  { id: 'srv-3', title: 'প্লাম্বার — বাসায় সার্ভিস', price: 500, category: 'হোম সার্ভিস', provider: 'FixIt', rating: 4.6, desc: 'লিক, ট্যাপ ও পাইপ মেরামত।' },
  { id: 'srv-4', title: 'ইলেকট্রিশিয়ান', price: 600, category: 'হোম সার্ভিস', provider: 'PowerFix', rating: 4.8, desc: 'ওয়্যারিং, সুইচ ও ফ্যান মেরামত।' },
  { id: 'srv-5', title: 'অনলাইন গণিত টিউশন (১ মাস)', price: 1500, category: 'শিক্ষা', provider: 'মেহজাবিন চৌধুরী', rating: 4.9, desc: 'সপ্তাহে ৩ দিন, ১ ঘণ্টা করে লাইভ ক্লাস।' },
  { id: 'srv-6', title: 'লোগো ডিজাইন', price: 2000, category: 'ডিজাইন', provider: 'PixelStudio', rating: 4.7, desc: '৩টি কনসেপ্ট, সোর্স ফাইলসহ।' }
]

export type DatingProfile = { id: string; name: string; age: number; city: string; about: string; color: string }
export const DATING_PROFILES: DatingProfile[] = [
  { id: 'dt-1', name: 'তানিয়া', age: 24, city: 'ঢাকা', about: 'বই পড়তে ভালোবাসি, ভ্রমণ পছন্দ করি।', color: '#E91E63' },
  { id: 'dt-2', name: 'রাকিব', age: 27, city: 'চট্টগ্রাম', about: 'ফটোগ্রাফি আর ক্রিকেট — দুটোই ভালোবাসি।', color: '#2196F3' },
  { id: 'dt-3', name: 'সুমাইয়া', age: 23, city: 'সিলেট', about: 'রান্না আর গান — আমার দুই ভালোবাসা।', color: '#9C27B0' },
  { id: 'dt-4', name: 'আরিফ', age: 26, city: 'খুলনা', about: 'স্টার্টআপ নিয়ে কাজ করছি, নতুন মানুষ চিনতে ভালো লাগে।', color: '#009688' },
  { id: 'dt-5', name: 'নুসরাত', age: 25, city: 'ঢাকা', about: 'শিক্ষকতা করি, সিনেমা দেখতে ভালোবাসি।', color: '#FF5722' },
  { id: 'dt-6', name: 'সজীব', age: 28, city: 'রাজশাহী', about: 'ব্যাংকার, সপ্তাহান্তে ঘুরতে যাই।', color: '#607D8B' }
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
export const FREE_MINUTES_NOTE = 'শুধু প্রথম কলের প্রথম ১ মিনিট ফ্রি (প্রথম ব্যবহারকারী / প্রথম বন্ধু)। ২ মিনিট ফ্রি নয়।'
export const TOPUP_PACKS = [100, 200, 500, 1000]

// Contact-ban: phone numbers, WhatsApp/Facebook/Telegram links, emails.
export function contactBanCheck(text: string): string | null {
  const t = text.toLowerCase()
  if (/(01[3-9]\d{8})|(\+?8801[3-9]\d{8})/.test(text.replace(/[\s-]/g, ''))) return 'ফোন নম্বর শেয়ার করা যাবে না।'
  if (/whatsapp|wa\.me|facebook\.com|fb\.com|fb\.me|telegram|t\.me|imo|viber/.test(t)) return 'অন্য যোগাযোগ মাধ্যমের লিংক শেয়ার করা যাবে না।'
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t)) return 'ইমেইল ঠিকানা শেয়ার করা যাবে না।'
  if (/\b\d{10,}\b/.test(text.replace(/[\s-]/g, ''))) return 'নম্বর শেয়ার করা যাবে না।'
  return null
}

export function formatBDT(n: number): string { return `৳${Math.round(n).toLocaleString('en-IN')}` }

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
  { id: 'BEP20', name: 'BEP20 (BNB Smart Chain)', address: '0xd40cca85f0f54f30445a3577e18a0a5abcca95bf', feeHint: 'ফি আনুমানিক ~০.০১ USDT (Binance থেকে) — সবচেয়ে কম খরচ', cheapest: true },
  { id: 'ERC20', name: 'ERC20 (Ethereum)', address: '0x8e2f8559f823cdef7f73edd77b6c29163d00d68d', feeHint: 'ফি আনুমানিক ~০.৬ USDT', cheapest: false },
]
export const PI_DEPOSIT_ADDRESS = 'G6NBQ4XDRDLSB7VTNDAOO6DKUYADIUNNQF34OTCOWBFG5L2ZD7REPL65'
