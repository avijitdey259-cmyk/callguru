// PiCall shared data — no seed/demo data. Lists that used to hold demo
// entries are empty; real content comes from the backend / Firestore / the user.
export type Expert = {
  id: string; name: string; title: string; category: string;
  rate: number; rating: number; calls: number; online: boolean;
  langs: string[]; about: string; avatarColor: string; featured?: boolean;
}

// ফ্রন্টএন্ড সিড এক্সপার্ট সরানো হয়েছে (ডেমো ডেটা) — এক্সপার্ট আসে Railway
// ব্যাকএন্ড (/api/experts) থেকে; সার্ভার না পেলে মার্কেটপ্লেস খালি দেখাবে।
export const EXPERTS: Expert[] = []

export const CATEGORIES = ['All', 'Health', 'Law', 'Education', 'Career', 'Business']

export type TvChannel = { id: string; name: string; group: string; logo: string; streamUrl: string; officialUrl: string }
// Built-in Live TV list — used ONLY when the admin playlist (config/public →
// tvPlaylistUrl) cannot be loaded. Every streamUrl here was verified live
// 2026-11-24 (HTTP 200 + #EXTM3U); the three entries with an empty streamUrl
// could NOT be verified (Somoy/Independent: their proxy redirects fail from
// here; T Sports: http-only, cannot play inside the https app) — they show
// as link-only, with the official site link. The streams come from a
// third-party aggregator playlist, not the channels' own official streams.
export const TV_CHANNELS: TvChannel[] = [
  { id: 'peace-tv-bangla', name: 'Peace TV Bangla', group: 'Islamic', logo: 'https://i.postimg.cc/vTYq396x/20250529-071345.png', streamUrl: 'https://dzkyvlfyge.erbvr.com/PeaceTvBangla/tracks-v3a1/mono.m3u8', officialUrl: '' },
  { id: 'iqra-bangla', name: 'Iqra Bangla', group: 'Islamic', logo: 'https://i.postimg.cc/qqLNkFLg/20250531-104940.png', streamUrl: 'https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/iqrabanglatvoffice.stream/live-orgin/iqrabanglatvoffice.stream/chunks.m3u8', officialUrl: '' },
  { id: 'madani-bangla', name: 'Madani Bangla', group: 'Islamic', logo: 'https://i.postimg.cc/1tDgdXVG/20250531-105059.png', streamUrl: 'https://tvsen3.aynaott.com/z24qLsqV/index.m3u8', officialUrl: '' },
  { id: 'quran-tv', name: 'Quran TV', group: 'Islamic', logo: 'https://i.postimg.cc/T3f1NQyV/20260524-024937.png', streamUrl: 'https://live.kwikmotion.com/sharjahtvquranlive/shqurantv.smil/sharjahtvquranpublish/shqurantv_source/chunks.m3u8', officialUrl: '' },
  { id: 'iqraa-tv', name: 'Iqraa TV', group: 'Islamic', logo: 'https://i.postimg.cc/gcHKBtjy/20260524-023828.png', streamUrl: 'https://playlist.fasttvcdn.com/pl/dlkqw1ftuvuuzkcb4pxdcg/Iqraafasttv1/playlist.m3u8', officialUrl: '' },
  { id: 'btv-hd', name: 'BTV HD', group: 'Bangla', logo: 'https://i.postimg.cc/JnWdHSrq/20250529-071604.png', streamUrl: 'https://nkafmbewiff.gpcdn.net/tile_2/master.m3u8', officialUrl: '' },
  { id: 'btv-chottogram', name: 'BTV Chottogram', group: 'Bangla', logo: 'https://i.postimg.cc/VNJ90KyZ/20260913-101041.png', streamUrl: 'https://tvsen6.aynaott.com/TjGR1GcxKetHNVcMVxbq/index.m3u8', officialUrl: '' },
  { id: 'jamuna', name: 'Jamuna', group: 'Bangla', logo: 'https://i.postimg.cc/L4D0hyrt/P-071035.png', streamUrl: 'https://tvsen6.aynaott.com/KGdZEdA7qQ43dmPkgk1j/index.m3u8', officialUrl: 'https://www.jamuna.tv' },
  { id: 'channel-24', name: 'Channel 24', group: 'Bangla', logo: 'https://i.postimg.cc/nLmPznJr/20250529-071852.png', streamUrl: 'https://tvsen6.aynaott.com/YrVDF8gujkdh/index.m3u8', officialUrl: 'https://www.channel24bd.tv' },
  { id: 'ekattor-hd', name: 'Ekattor HD', group: 'Bangla', logo: 'https://i.postimg.cc/D0xCDZqj/20250529-071258.png', streamUrl: 'https://tvsen6.aynaott.com/EWDrV5QskgarZEUBb3pU/index.m3u8', officialUrl: 'https://www.ekattor.tv' },
  { id: 'dbc-news', name: 'DBC News', group: 'Bangla', logo: 'https://i.postimg.cc/nzvgdpRg/20250529-102312.png', streamUrl: 'https://tvsen6.aynaott.com/pF66Tkz0qFwP2aMMqHyt/index.m3u8', officialUrl: 'https://www.dbcnews.tv' },
  { id: 'sa-tv', name: 'SA TV', group: 'Bangla', logo: 'https://i.postimg.cc/CLvtrv7h/20250529-073029.png', streamUrl: 'https://tvsen6.aynaott.com/rELXiuUXqbgzPb06Npom/index.m3u8', officialUrl: '' },
  { id: 'news-24', name: 'News 24', group: 'Bangla', logo: 'https://i.postimg.cc/K8jXZXj3/20250529-103008.png', streamUrl: 'https://tvsen6.aynaott.com/cdgr3tw6WoG7JyRnLbi0/index.m3u8', officialUrl: '' },
  { id: 'atn-news', name: 'ATN News', group: 'Bangla', logo: 'https://i.postimg.cc/4NBkk4fT/20250529-102724.png', streamUrl: 'https://tvsen6.aynaott.com/da6WMXAk/index.m3u8', officialUrl: '' },
  { id: 'n-tv', name: 'N TV', group: 'Bangla', logo: 'https://i.postimg.cc/kgzHqBLL/20250529-072107.png', streamUrl: 'https://tvsen5.aynaott.com/xV4jEKf3D9zc/index.m3u8', officialUrl: 'https://www.ntvbd.com' },
  { id: 'desh-tv', name: 'Desh TV', group: 'Bangla', logo: 'https://i.postimg.cc/FHM5wnxZ/20260913-092819.png', streamUrl: 'https://tvsen6.aynaott.com/ryFkXfd1a4CQ7mMdc820/index.m3u8', officialUrl: '' },
  { id: 'banglavision', name: 'Banglavision', group: 'Bangla', logo: 'https://i.postimg.cc/JzGFfbYb/20250529-072833.png', streamUrl: 'https://tvsen5.aynaott.com/tgUzpPc9r6xw/index.m3u8', officialUrl: 'https://www.banglavision.tv' },
  { id: 'channel-i', name: 'Channel i', group: 'Bangla', logo: 'https://i.postimg.cc/J47vqwbY/20250529-101717.png', streamUrl: 'https://tvsen6.aynaott.com/FNHpYvGZ7FkCE10PwTHm/index.m3u8', officialUrl: 'https://www.channelionline.com' },
  { id: 'me-tv', name: 'Me Tv', group: 'Bangla', logo: 'https://i.postimg.cc/j2hVjtyP/20250529-103904.png', streamUrl: 'https://iptvbd.live/metv1080/1080.m3u8', officialUrl: '' },
  { id: 'deepto', name: 'Deepto', group: 'Bangla', logo: 'https://i.postimg.cc/9XPHbts0/20250529-103607.png', streamUrl: 'https://byphdgllyk.gpcdn.net/hls/deeptotv/index.m3u8', officialUrl: 'https://www.deeptotv.com' },
  { id: 'maasranga', name: 'Maasranga', group: 'Bangla', logo: 'https://i.postimg.cc/WbnjN67C/20250529-104926.png', streamUrl: 'https://nkafmbewiff.gpcdn.net/tile_4/master.m3u8', officialUrl: 'https://www.maasranga.tv' },
  { id: 'srk', name: 'SRK', group: 'Bangla', logo: 'https://i.postimg.cc/6QCJKLj9/20260913-092122.png', streamUrl: 'https://srknowapp.ncare.live/srktvhlswodrm/srktv.stream/playlist.m3u8', officialUrl: '' },
  { id: 'boishakhi', name: 'Boishakhi', group: 'Bangla', logo: 'https://i.postimg.cc/Y0MVZZT9/20250529-101947.png', streamUrl: 'https://tvsen6.aynaott.com/1d3uG9VCgrR9DRtWZM57/index.m3u8', officialUrl: '' },
  { id: '52-channel', name: '52 Channel', group: 'Bangla', logo: 'https://i.postimg.cc/nhybNw1j/20260913-093359.png', streamUrl: 'https://tvsen6.aynaott.com/channel52/index.m3u8', officialUrl: '' },
  { id: 'g-tv', name: 'G TV', group: 'Bangla', logo: 'https://i.postimg.cc/jjKGfnW8/20250704-201040.png', streamUrl: 'https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/gazibdz.stream/live-orgin/gazibdz.stream/playlist.m3u8', officialUrl: 'https://www.gtvbd.tv' },
  { id: 'nagorik', name: 'Nagorik', group: 'Bangla', logo: 'https://i.postimg.cc/8zQ0DYBH/20250720-201346.png', streamUrl: 'https://box.bbaria.net:8083/Nagorik_TV/index.m3u8', officialUrl: '' },
  { id: 'asian', name: 'Asian', group: 'Bangla', logo: 'https://i.postimg.cc/PqvBwmmt/20250529-102106.png', streamUrl: 'https://tvsen6.aynaott.com/pKb5k6NnzxsKpWUs6E8M/index.m3u8', officialUrl: '' },
  { id: 'channel-9', name: 'Channel 9', group: 'Bangla', logo: 'https://i.postimg.cc/pVq6vZYV/20250729-030034.png', streamUrl: 'https://nkafmbewiff.gpcdn.net/tile_7/master.m3u8', officialUrl: '' },
  { id: 'atn-bangla', name: 'ATN Bangla', group: 'Bangla', logo: 'https://i.postimg.cc/FHBMzPkW/20250529-102502.png', streamUrl: 'https://tvsen5.aynaott.com/P3y2URgG7LDe/index.m3u8', officialUrl: 'https://www.atnbangla.tv' },
  { id: 'r-tv', name: 'R TV', group: 'Bangla', logo: 'https://i.postimg.cc/8kmxMkrr/20250529-101852.png', streamUrl: 'https://tvsen5.aynaott.com/ba47dHpDk3Se/index.m3u8', officialUrl: 'https://www.rtvonline.com' },
  { id: 'ekushe-tv', name: 'Ekushe TV', group: 'Bangla', logo: 'https://i.postimg.cc/L6R2F0jj/20250529-105209.png', streamUrl: 'https://tvsen5.aynaott.com/SyQuXz8sC3TB/index.m3u8', officialUrl: '' },
  { id: 'nexus-tv', name: 'Nexus TV', group: 'Bangla', logo: 'https://i.postimg.cc/XvZ0gM06/20250529-104547.png', streamUrl: 'https://tvsen6.aynaott.com/Epm7WrFa/index.m3u8', officialUrl: '' },
  { id: 'ekhon-tv', name: 'Ekhon TV', group: 'Bangla', logo: 'https://i.postimg.cc/sggzvQ6X/20250529-105045.png', streamUrl: 'https://tvsen6.aynaott.com/fbgZV3X17hwWcyfZ4pdb/index.m3u8', officialUrl: '' },
  { id: 'enter-tv', name: 'Enter TV', group: 'Bangla', logo: 'https://i.postimg.cc/g06jByt1/entertv.jpg', streamUrl: 'https://live1.entertv.com.bd/entertv/index.m3u8', officialUrl: '' },
  { id: 'bangla-tv', name: 'Bangla Tv', group: 'Bangla', logo: 'https://i.postimg.cc/tTWQLhTr/20250529-104243.png', streamUrl: 'https://tvsen6.aynaott.com/39ee93nUbCCmm5LsyD4t/index.m3u8', officialUrl: '' },
  { id: 'mohona-tv', name: 'Mohona Tv', group: 'Bangla', logo: 'https://i.postimg.cc/CKWpPvFB/20250529-104420.png', streamUrl: 'https://tvsen6.aynaott.com/AkyX5dunzju4cpo26dr7/index.m3u8', officialUrl: '' },
  { id: 'bijoy-tv', name: 'Bijoy Tv', group: 'Bangla', logo: 'https://i.postimg.cc/3xfTp8VZ/20250529-104739.png', streamUrl: 'https://tvsen6.aynaott.com/N8Xbo5vdwVU6sF43RsW0/index.m3u8', officialUrl: '' },
  { id: 'ananda-tv', name: 'Ananda Tv', group: 'Bangla', logo: 'https://i.postimg.cc/yYV4b3zP/20250529-103431.png', streamUrl: 'https://tvsen6.aynaott.com/LeUAm4F1iixYns3s3Non/index.m3u8', officialUrl: '' },
  { id: 'my-tv', name: 'My Tv', group: 'Bangla', logo: 'https://i.postimg.cc/HxGF4V2b/20250529-103226.png', streamUrl: 'https://tvsen6.aynaott.com/XMpHaEf0ANBhv8w6NWR7/index.m3u8', officialUrl: '' },
  { id: 'drama-24', name: 'Drama 24', group: 'Bangla', logo: 'https://i.postimg.cc/yN04KXfX/20260913-092650.png', streamUrl: 'https://vods2.aynaott.com/gseriesDrama/index.m3u8', officialUrl: '' },
  { id: 'deshi-tv', name: 'Deshi Tv', group: 'Bangla', logo: 'https://i.postimg.cc/t4KQ8mzr/20260913-092735.png', streamUrl: 'https://deshitv.deshitv24.net/live/myStream/playlist.m3u8', officialUrl: '' },
  { id: 'channel-s', name: 'Channel S', group: 'Bangla', logo: 'https://i.postimg.cc/nV38nLkH/20260913-092507.png', streamUrl: 'https://box.bbaria.net:8083/ChannelS/video.m3u8', officialUrl: '' },
  { id: 'matribhumi-tv', name: 'MatriBhumi TV', group: 'Bangla', logo: 'https://i.postimg.cc/g0xWsM0M/20260930-231840.png', streamUrl: 'https://live.playmax.live/matribhumi/index.m3u8', officialUrl: '' },
  { id: 'star-jalsha-hd', name: 'Star Jalsha HD', group: 'Indian Bangla', logo: 'https://i.postimg.cc/hvRgj26W/20250529-105408.png', streamUrl: 'https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starjalsha.smil/playlist.m3u8', officialUrl: 'https://www.hotstar.com' },
  { id: 'zee-bangla-hd', name: 'Zee Bangla HD', group: 'Indian Bangla', logo: 'https://i.postimg.cc/ry5MbLR8/20250529-105712.png', streamUrl: 'https://d1rc86nwwc9fag.cloudfront.net/260723/smil:zeebangla.smil/chunklist_b2628000.m3u8', officialUrl: 'https://www.zeetv.com' },
  { id: 'enter-10-bangla', name: 'Enter 10 Bangla', group: 'Indian Bangla', logo: 'https://i.postimg.cc/LX122cy3/20250529-111624.png', streamUrl: 'https://live-bangla.akamaized.net/liveabr/pub-iobanglakp3sff/live_720p/chunks.m3u8', officialUrl: '' },
  { id: 'jalsha-movies-sd', name: 'Jalsha Movies SD', group: 'Indian Bangla', logo: 'https://i.postimg.cc/G3gmTZRs/20260204-142159.png', streamUrl: 'https://box.bbaria.net:8083/Jalsha_Movie/index.m3u8', officialUrl: '' },
  { id: 'colors', name: 'Colors', group: 'Indian Hindi', logo: 'https://i.postimg.cc/pdy3k1qZ/20251202-090150.png', streamUrl: 'https://da86m1sqpm3o0.cloudfront.net/28072023/smil:colorsme.smil/media-udh.m3u8', officialUrl: '' },
  { id: 'colors-cineplex', name: 'Colors Cineplex', group: 'Indian Hindi', logo: 'https://i.postimg.cc/HLvX9R1x/colors-cineplex-hd.png', streamUrl: 'https://d1rc86nwwc9fag.cloudfront.net/260723/smil:rishteycineplexukdev.smil/chunklist_b1928000.m3u8', officialUrl: '' },
  { id: 'zee-cinema-hd', name: 'Zee Cinema HD', group: 'Indian Hindi', logo: 'https://i.postimg.cc/nhDsSWxB/20250529-133753.png', streamUrl: 'https://j6nfugukcl.gpcdn.net/tile_5/master.m3u8', officialUrl: '' },
  { id: 'sony-kal', name: 'Sony Kal', group: 'Indian Hindi', logo: 'https://i.postimg.cc/L5TmcvqR/hridoytvgate-(14).webp', streamUrl: 'https://e77bef9b.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctY2FfU29ueUtBTF9ITFM/playlist.m3u8', officialUrl: '' },
  { id: 'gold-mines', name: 'Gold Mines', group: 'Indian Hindi', logo: 'https://static.wikia.nocookie.net/jhmovie/images/7/7b/Goldmines_logo.png/revision/latest/scale-to-width-down/360?cb=20240404141630', streamUrl: 'https://mumt04.tangotv.in/m18aqlK4GOLDMINES/index.m3u8', officialUrl: '' },
  { id: 'gold-mines-movies', name: 'Gold Mines Movies', group: 'Indian Hindi', logo: 'https://static.wikia.nocookie.net/jhmovie/images/7/7b/Goldmines_logo.png/revision/latest/scale-to-width-down/360?cb=20240404141630', streamUrl: 'https://mumt04.tangotv.in/m18aqlK4GOLDMINEMOVIES/index.m3u8', officialUrl: '' },
  { id: 'sangeet-bangla', name: 'Sangeet Bangla', group: 'Music', logo: 'https://i.postimg.cc/pdddb1bs/20250529-120025.png', streamUrl: 'https://cdn.pishow.tv/ott/live/1143/master.m3u8', officialUrl: '' },
  { id: '9xm', name: '9xm', group: 'Music', logo: 'https://i.postimg.cc/P5yq7ncL/20250529-120144.png', streamUrl: 'https://wiselp.wiseplayout.com/9XM/master.m3u8', officialUrl: '' },
  { id: '9xm-jalwa', name: '9xm Jalwa', group: 'Music', logo: 'https://i.postimg.cc/gj7ghJrx/20250630-053007.png', streamUrl: 'https://wiselp.wiseplayout.com/9X_Jalwa/master.m3u8', officialUrl: '' },
  { id: 'ptc-music', name: 'PTC Music', group: 'Music', logo: 'https://i.postimg.cc/KYFJhFYp/Hridoy-TV-pro-(64).webp', streamUrl: 'https://d2lk5u59tns74c.cloudfront.net/out/v1/f913cf893c594f73b114216e74a2efbc/index.m3u8', officialUrl: '' },
  { id: 'bojopuri', name: 'Bojopuri', group: 'Music', logo: 'https://i.postimg.cc/VLG87B0t/20250630-045918.png', streamUrl: 'https://cdn.pishow.tv/ott/live/1229/master.m3u8', officialUrl: '' },
  { id: 'a-sports-hd', name: 'A Sports HD', group: 'Sports', logo: 'https://i.postimg.cc/ZqbZdnHq/20251002-225834.png', streamUrl: 'https://tvsen6.aynaott.com/zv68oqPDu7MZZwmHhRxt/index.m3u8', officialUrl: '' },
  { id: 'somoy', name: 'Somoy TV', group: 'News', logo: '', streamUrl: '', officialUrl: 'https://www.somoynews.tv' },
  { id: 'independent', name: 'Independent TV', group: 'News', logo: '', streamUrl: '', officialUrl: 'https://www.independent24.com' },
  { id: 'tsports', name: 'T Sports', group: 'Sports', logo: '', streamUrl: '', officialUrl: 'https://www.tsports.com' },
]

export type Service = { id: string; title: string; price: number; category: string; provider: string; rating: number; desc: string }
// সার্ভিস সিড সরানো হয়েছে (ডেমো ডেটা) — মার্কেটপ্লেস খালি থাকবে, যতক্ষণ না আসল সার্ভিস আসে।
export const SERVICES: Service[] = []

export type DatingProfile = { id: string; name: string; age: number; city: string; about: string; color: string; compat?: number }
// ডেটিং প্রোফাইল সিড সরানো হয়েছে (ডেমো ডেটা) — ডেটিং তালিকা খালি থাকবে, যতক্ষণ না আসল প্রোফাইল আসে।
export const DATING_PROFILES: DatingProfile[] = []

export type PostComment = { id: string; author: string; text: string; time: string }
// mine — নিজের পোস্ট (নিজের পোস্টে ⋯ মেনু: Edit/Delete); commentsList — আসল কমেন্টের
// তালিকা (সিড পোস্টের comments সংখ্যাটা শুধু সংখ্যা — তালিকা খালি থাকতে পারে)
export type Post = { id: string; author: string; time: string; text: string; likes: number; comments: number; shares: number; color: string; authorPhoto?: string; title?: string; location?: string; audience?: 'Public' | 'Friends'; boosted?: boolean; imageUrl?: string; videoUrl?: string; mine?: boolean; commentsList?: PostComment[] }
// ফিডের পারসোনা পোস্ট — শুধু ৫ রাখা চ্যাট পারসোনা (রিমা/শাকিল/ফাহিম/মিম/আশা)
// থেকে, যাতে ফিড খালি/নতুন না লাগে (মালিকের নির্দেশ ২০২৬-১১-২৪)। সরানো
// ডেমো ডেটা (রাফি/সাবরিনা, সিড ডেটিং হোস্ট, সিড ফিড পোস্ট) ফিরে আসেনি —
// এগুলো পারসোনাদেরই লেখা, নতুন ভুয়া ব্যবহারকারী নয়।
export const SEED_POSTS: Post[] = [
  { id: 'persona-rima-1', author: 'Rima', time: '2h', text: 'Morning tea and a clear sky — today feels like a good day for something new. ☕', likes: 24, comments: 6, shares: 2, color: '#E91E63' },
  { id: 'persona-shakil-1', author: 'Shakil', time: '4h', text: 'Sometimes a quiet evening and a good song are all you need. What are you listening to tonight?', likes: 18, comments: 9, shares: 1, color: '#1877F2' },
  { id: 'persona-fahim-1', author: 'Fahim', time: '6h', text: 'Small thing I learned today: a 10-minute walk after lunch really wakes you up. Try it and tell me if it works for you too.', likes: 31, comments: 5, shares: 4, color: '#27AE60' },
  { id: 'persona-mim-1', author: 'Mim', time: '9h', text: 'Found an old song I used to hum as a kid — some tunes never leave you. 🎵 What song takes you back?', likes: 27, comments: 11, shares: 3, color: '#9C27B0' },
  { id: 'persona-asha-1', author: 'Asha', time: 'Yesterday', text: 'Dreaming a little bigger today. Small steps every day — that is the whole plan. ✨', likes: 35, comments: 8, shares: 5, color: '#FF9800' },
  { id: 'persona-rima-2', author: 'Rima', time: 'Yesterday', text: 'Tell me one good thing that happened to you this week — I need happy stories today!', likes: 42, comments: 14, shares: 2, color: '#E91E63' },
  // নতুন ৬ বন্ধুর পোস্ট (মালিকের নির্দেশ ২০২৬-১১-২৪, "সদস্য বাড়াই দাও") —
  // ৪টিতে ছবি আসবে (জেনেরিক দৃশ্য: মুরগি, পড়ার টেবিল, চা, হেডফোন — কোনো
  // মানুষের ছবি নয়): ছবির ফাইল (public/persona-*.jpg) GitHub-এ ব্রাউজার
  // দিয়ে আপলোড হলে imageUrl ফিরিয়ে দেওয়া হবে — বাইনারি ফাইল snapshot
  // push-এ যায় না বলে আপাতত লেখা-পোস্ট হিসেবে লাইভ হচ্ছে। সরানো ডেমো
  // পোস্টের কেউ এতে নেই।
  { id: 'persona-tanvir-1', author: 'Tanvir', time: '3h', text: 'Why did the chicken cross the road? To prove it wasn\'t chicken! 😂 Okay okay, I\'ll stop now... or will I?', likes: 19, comments: 12, shares: 3, color: '#0EA5E9', imageUrl: '/persona-tanvir-1.jpg' },
  { id: 'persona-faysal-1', author: 'Faysal', time: '5h', text: 'Study tip that actually works: read for 25 minutes, rest 5, repeat. Your brain will thank you. 📚', likes: 22, comments: 4, shares: 6, color: '#14B8A6', imageUrl: '/persona-faysal-1.jpg' },
  { id: 'persona-imran-1', author: 'Imran', time: '7h', text: 'Long day? Make yourself a cup of tea, sit by the window, and breathe. You did enough today. ☕❤️', likes: 28, comments: 7, shares: 2, color: '#65A30D', imageUrl: '/persona-imran-1.jpg' },
  { id: 'persona-sadia-1', author: 'Sadia', time: '10h', text: 'Headphones on, world off. 🎧 Which song is on repeat for you this week?', likes: 33, comments: 15, shares: 4, color: '#8B5CF6', imageUrl: '/persona-sadia-1.jpg' },
  { id: 'persona-tanha-1', author: 'Tanha', time: 'Yesterday', text: 'The sky was on fire tonight. Some sunsets feel like the day is saying goodbye properly. 🌇', likes: 41, comments: 9, shares: 7, color: '#F59E0B' },
  { id: 'persona-nabila-1', author: 'Nabila', time: 'Yesterday', text: 'Rain on the window, a warm blanket, and nothing to do. Perfect evening. ☔ What\'s your rainy-day favourite?', likes: 26, comments: 10, shares: 3, color: '#EC4899' },
]

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
// ম্যানুয়াল টপ-আপের পদ্ধতি — আসল নম্বর/ঠিকানা অ্যাডমিন সেটিংসে বসান; না বসানো
// থাকলে ওয়ালেটে "Not set up yet" দেখাবে — কোনো ভুয়া নম্বর/ঠিকানা দেখানো হয় না।
export const MANUAL_TOPUP_METHODS = ['bKash', 'Nagad', 'Rocket', 'USDT', 'Binance Pay']
// USDT নেটওয়ার্ক — দুটিই ম্যানুয়াল (TRC20 নেই); ফি আনুমানিক, পরিবর্তন হতে পারে
export const USDT_NETWORKS = [
  { id: 'BEP20', name: 'BEP20 (BNB Smart Chain)', feeHint: 'Fee approx. ~0.01 USDT (from Binance) — cheapest', cheapest: true },
  { id: 'ERC20', name: 'ERC20 (Ethereum)', feeHint: 'Fee approx. ~0.6 USDT', cheapest: false },
]

// বাংলাদেশের ৬৪ জেলা — প্রোফাইল সেটিংসে জেলা বাছাই + এলাকা-ভিত্তিক ম্যাচে ব্যবহৃত হয়।
export const DISTRICTS = [
  'Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria', 'Chandpur',
  'Chapainawabganj', 'Chattogram', 'Chuadanga', "Cox's Bazar", 'Cumilla', 'Dhaka', 'Dinajpur', 'Faridpur',
  'Feni', 'Gaibandha', 'Gazipur', 'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokati',
  'Jhenaidah', 'Joypurhat', 'Khagrachari', 'Khulna', 'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur',
  'Lalmonirhat', 'Madaripur', 'Magura', 'Manikganj', 'Meherpur', 'Moulvibazar', 'Munshiganj', 'Mymensingh',
  'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona', 'Nilphamari', 'Noakhali',
  'Pabna', 'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati', 'Rangpur',
  'Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon',
]

// প্রোফাইল ইন্টারেস্ট — ব্যবহারকারী একাধিক বাছতে পারেন; এলাকা-ভিত্তিক ম্যাচে
// একই ইন্টারেস্ট গোনা হয়। তালিকাটি নির্দিষ্ট — নতুন ইন্টারেস্ট যোগ করতে এখানেই বাড়াতে হয়।
export const INTERESTS = [
  'Music', 'Movies', 'Travel', 'Cricket', 'Football', 'Cooking', 'Reading', 'Photography',
  'Gaming', 'Gardening', 'Fishing', 'Shopping', 'Dance', 'Singing', 'Technology', 'Sports',
]

