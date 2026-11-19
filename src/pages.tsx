import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Hls from 'hls.js'
import { useStore } from './store'
import { useExperts } from './api'
import { connectLive, createLiveRoom, endLiveRoom, fetchLiveRooms, sendSignal, ICE_SERVERS, type LiveRoom } from './live'
import { Btn, Card } from './components'
import {
  CATEGORIES, DATING_PROFILES, FRIEND_RATE, FRIEND_SUGGESTIONS, FREE_MINUTES_NOTE,
  REELS, SEED_POSTS, SERVICES, STORIES, TV_CATEGORIES, TV_CHANNELS, TOPUP_PACKS,
  contactBanCheck, formatBDT, type Expert
} from './data'

// ---------- Landing ----------
export function Landing() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <Card className="text-center py-10 bg-gradient-to-br from-blue-600 to-blue-400 !text-white">
        <h1 className="text-4xl font-extrabold">CallGuru</h1>
        <p className="mt-2 text-lg">লাইভ এক্সপার্ট পরামর্শ • সোশ্যাল কমিউনিটি • ক্রিয়েটর মার্কেটপ্লেস</p>
        <p className="mt-1 text-sm opacity-90">চ্যাট সম্পূর্ণ ফ্রি • কল প্রিপেইড • প্রথম কলের প্রথম ১ মিনিট ফ্রি</p>
        <div className="mt-5 flex gap-3 justify-center">
          <Btn variant="green" onClick={() => navigate('/login')}>Gmail দিয়ে ১-ক্লিক লগইন</Btn>
          <Btn variant="ghost" className="!bg-white !text-blue-700" onClick={() => navigate('/feed')}>ফিড দেখুন</Btn>
        </div>
      </Card>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { t: '🎓 এক্সপার্ট কল', d: 'ডাক্তার, আইনজীবী, শিক্ষক — প্রতি মিনিটে পে করুন। টপ-আপ আগে, কল পরে।' },
          { t: '💬 ফ্রি চ্যাট', d: 'বন্ধু, এক্সপার্ট, ডেটিং — সব চ্যাট সম্পূর্ণ ফ্রি। নম্বর/লিংক শেয়ার ব্লক।' },
          { t: '📺 লাইভ টিভি', d: 'দেশের জনপ্রিয় চ্যানেল — বিজ্ঞাপনসহ ফ্রি। শুধু অফিসিয়াল স্ট্রিম।' }
        ].map(f => <Card key={f.t}><h3 className="font-bold">{f.t}</h3><p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{f.d}</p></Card>)}
      </div>
      <Card>
        <h2 className="font-bold text-lg mb-2">কীভাবে কাজ করে</h2>
        <ol className="list-decimal ml-5 text-sm space-y-1">
          <li>Gmail দিয়ে ১-ক্লিক লগইন করুন।</li>
          <li>ওয়ালেটে টপ-আপ করুন — bKash / Nagad / ব্যাংক / USDT (TRC20)।</li>
          <li>এক্সপার্ট বেছে কল করুন। প্রথম কলের প্রথম ১ মিনিট ফ্রি।</li>
          <li>ব্যালেন্স শেষ হলে কল নিজে থেকেই কেটে যাবে — কোনো ঋণ নয়।</li>
        </ol>
        <p className="text-xs text-gray-500 mt-3">{FREE_MINUTES_NOTE}</p>
      </Card>
    </div>
  )
}

// ---------- Login ----------
export function LoginPage() {
  const { login } = useStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const googleLogin = () => { login('Avijit Dey', 'avijitdey259@gmail.com'); navigate('/feed') }
  return (
    <div className="max-w-md mx-auto">
      <Card>
        <h1 className="text-2xl font-bold text-center">CallGuru-তে স্বাগতম</h1>
        <p className="text-center text-sm text-gray-500 mt-1">Gmail ১-ক্লিক লগইন • ইমেইল/পাসওয়ার্ড • OTP</p>
        <button onClick={googleLogin} className="w-full mt-5 py-3 rounded-lg border font-medium flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-800">
          <span className="font-extrabold text-lg"><span className="text-blue-500">G</span><span className="text-red-500">o</span><span className="text-yellow-500">o</span><span className="text-blue-500">g</span><span className="text-green-500">l</span><span className="text-red-500">e</span></span>
          Gmail দিয়ে ১-ক্লিক লগইন
        </button>
        <p className="text-xs text-center text-gray-400 mt-1">ডেমো মোডে Google লগইন স্থানীয়ভাবে কাজ করে। আসল Firebase Auth সংযোগের জন্য Firebase প্রজেক্টের তথ্য লাগবে।</p>
        <div className="my-4 border-t" />
        <label className="text-sm font-medium">নাম</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={name} onChange={e => setName(e.target.value)} placeholder="আপনার নাম" />
        <label className="text-sm font-medium mt-3 block">ইমেইল</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <Btn className="w-full mt-4" onClick={() => { if (!name || !email.includes('@')) { setMsg('নাম ও সঠিক ইমেইল দিন।'); return } login(name, email); navigate('/feed') }}>ইমেইল দিয়ে লগইন</Btn>
        <button className="w-full mt-2 text-sm text-fb-blue" onClick={() => setMsg('OTP ডেমো: 123456 ব্যবহার করুন (আসল SMS গেটওয়ের জন্য অ্যাকাউন্ট লাগবে)।')}>OTP দিয়ে লগইন</button>
        {msg && <p className="text-sm text-center mt-2 text-gray-600 dark:text-gray-300">{msg}</p>}
        <p className="text-xs text-gray-400 mt-4 text-center">লগইন করলে আপনি শর্তাবলি ও গোপনীয়তা নীতিতে সম্মত হচ্ছেন। কল রেকর্ডিং শুধু অ্যাডমিন দেখতে পারেন (আপিল/বিরোধের জন্য, ৩০ দিন সংরক্ষণ)।</p>
      </Card>
    </div>
  )
}

// ---------- Feed ----------
export function Feed() {
  const [posts, setPosts] = useState(SEED_POSTS)
  const [text, setText] = useState('')
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const navigate = useNavigate()
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x-scroll pb-1">
        {STORIES.map(s => (
          <div key={s.id} className="shrink-0 w-24 h-36 rounded-xl bg-gradient-to-b from-blue-500 to-blue-300 text-white p-2 flex flex-col justify-end cursor-pointer" style={s.mine ? undefined : { background: (s as any).color }}>
            <span className="text-lg">{s.mine ? '➕' : '👤'}</span><span className="text-xs font-bold">{s.name}</span>
          </div>
        ))}
      </div>
      <Card>
        <p className="font-medium">আপনার মনে কী আছে?</p>
        <textarea className="w-full border rounded-lg p-2 mt-2 dark:bg-slate-800 dark:border-slate-600" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="কিছু লিখুন…" />
        <div className="flex justify-end mt-2"><Btn disabled={!text.trim()} onClick={() => { setPosts([{ id: 'p' + Date.now(), author: 'আপনি', time: 'এখনই', text, likes: 0, comments: 0, shares: 0, color: '#1877F2' }, ...posts]); setText('') }}>পোস্ট করুন</Btn></div>
      </Card>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {REELS.map(r => (
          <div key={r.id} onClick={() => navigate('/reels')} className="shrink-0 w-36 rounded-xl bg-slate-900 text-white p-3 cursor-pointer">
            <div className="text-2xl">🎬</div><p className="text-sm font-medium mt-2">{r.title}</p><p className="text-xs opacity-70">{r.views} ভিউ • {r.creator}</p>
          </div>
        ))}
      </div>
      {posts.map(p => (
        <Card key={p.id}>
          <div className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ background: p.color }}>{p.author.slice(0, 1)}</span>
            <div><p className="font-bold text-sm">{p.author}</p><p className="text-xs text-gray-400">{p.time}</p></div>
          </div>
          <p className="mt-3 text-sm">{p.text}</p>
          <div className="flex gap-4 mt-3 pt-3 border-t text-sm text-gray-500 dark:text-gray-300">
            <button onClick={() => setLiked(l => ({ ...l, [p.id]: !l[p.id] }))}>{liked[p.id] ? '❤️' : '👍'} লাইক ({p.likes + (liked[p.id] ? 1 : 0)})</button>
            <span>💬 কমেন্ট ({p.comments})</span>
            <button onClick={() => setPosts(ps => ps.map(x => x.id === p.id ? { ...x, shares: x.shares + 1 } : x))}>↗️ শেয়ার ({p.shares})</button>
          </div>
          <div className="flex gap-2 mt-3">
            <input className="flex-1 border rounded-full px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" placeholder="কমেন্ট লিখুন…" value={commentDraft[p.id] || ''} onChange={e => setCommentDraft(d => ({ ...d, [p.id]: e.target.value }))} />
            <Btn variant="ghost" onClick={() => setCommentDraft(d => ({ ...d, [p.id]: '' }))}>পাঠান</Btn>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------- Marketplace / Discover / Experts ----------
export function Marketplace() {
  const [cat, setCat] = useState('সবগুলো')
  const [services, setServices] = useState(SERVICES)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const { experts: liveExperts, source } = useExperts()
  const filteredExperts = liveExperts.filter(e => (cat === 'সবগুলো' || e.category === cat) && (e.name + e.title).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <h1 className="text-xl font-bold flex-1">মার্কেটপ্লেস — এক্সপার্ট ও সার্ভিস</h1>
        <Btn variant="green" onClick={() => navigate('/create-service')}>+ সার্ভিস তৈরি করুন</Btn>
      </div>
      <input className="w-full border rounded-lg px-3 py-2 dark:bg-fb-card dark:border-slate-600" placeholder="খুঁজুন — ডাক্তার, শিক্ষক, আইনজীবী…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="flex gap-2 flex-wrap">{CATEGORIES.map(c => <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-sm ${cat === c ? 'bg-fb-blue text-white' : 'bg-white dark:bg-fb-card'}`}>{c}</button>)}</div>
      <h2 className="font-bold flex items-center gap-2 flex-wrap">এক্সপার্ট — প্রতি মিনিটে কল
        {source === 'live'
          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">● Live — Railway ব্যাকএন্ড</span>
          : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Demo — স্থানীয় ডেটা</span>}
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {filteredExperts.map(e => <ExpertCard key={e.id} expert={e} />)}
        {filteredExperts.length === 0 && <p className="text-sm text-gray-500">কোনো এক্সপার্ট পাওয়া যায়নি।</p>}
      </div>
      <h2 className="font-bold pt-2">সার্ভিস মার্কেটপ্লেস</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {services.map(s => (
          <Card key={s.id}>
            <p className="font-bold">{s.title}</p>
            <p className="text-sm text-gray-500">{s.provider} • ⭐ {s.rating} • {s.category}</p>
            <p className="text-sm mt-1">{s.desc}</p>
            <div className="flex justify-between items-center mt-3"><span className="font-bold text-fb-blue">{formatBDT(s.price)}</span><Btn onClick={() => alert('ডেমো: অর্ডারটি কল-কনফার্মেশনের জন্য পেন্ডিং থাকবে। টিম কল করে নিশ্চিত করবে।')}>অর্ডার করুন</Btn></div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-gray-400">নতুন সার্ভিস তৈরি করলে তা এখানেই দেখাবে (ডেমোতে স্থানীয়ভাবে সংরক্ষিত হয়)।</p>
      <input type="hidden" value={services.length} readOnly />
    </div>
  )
}

export function ExpertCard({ expert }: { expert: Expert }) {
  const navigate = useNavigate()
  return (
    <Card>
      <div className="flex gap-3">
        <span className="w-14 h-14 rounded-full text-white text-xl flex items-center justify-center font-bold shrink-0" style={{ background: expert.avatarColor }}>{expert.name.slice(0, 1)}</span>
        <div className="min-w-0">
          <p className="font-bold truncate">{expert.name} {expert.featured && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">⭐ Featured</span>}</p>
          <p className="text-sm text-gray-500">{expert.title} • {expert.category}</p>
          <p className="text-xs text-gray-400">⭐ {expert.rating} • {expert.calls} কল • {expert.langs.join(', ')}</p>
        </div>
        <span className={`ml-auto text-xs font-bold ${expert.online ? 'text-green-600' : 'text-gray-400'}`}>{expert.online ? '● অনলাইন' : '○ অফলাইন'}</span>
      </div>
      <p className="text-sm mt-2">{expert.about}</p>
      <div className="flex justify-between items-center mt-3">
        <span className="font-bold text-fb-blue">{formatBDT(expert.rate)}/মিনিট</span>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => navigate(`/expert/${expert.id}`)}>প্রোফাইল</Btn>
          <Btn variant="green" onClick={() => navigate(`/call/expert/${expert.id}`)}>📞 কল করুন</Btn>
        </div>
      </div>
    </Card>
  )
}

export function ExpertProfile() {
  const { id } = useParams()
  const { experts: liveExperts } = useExperts()
  const expert = liveExperts.find(e => e.id === id)
  const navigate = useNavigate()
  if (!expert) return <Card>এক্সপার্ট পাওয়া যায়নি। <Link className="text-fb-blue" to="/marketplace">ফিরে যান</Link></Card>
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <div className="flex gap-4 items-center">
          <span className="w-20 h-20 rounded-full text-white text-3xl flex items-center justify-center font-bold" style={{ background: expert.avatarColor }}>{expert.name.slice(0, 1)}</span>
          <div><h1 className="text-xl font-bold">{expert.name}</h1><p className="text-gray-500">{expert.title}</p><p className="text-sm">⭐ {expert.rating} • {expert.calls} কল • {expert.online ? 'অনলাইন' : 'অফলাইন'}</p></div>
        </div>
        <p className="mt-3 text-sm">{expert.about}</p>
        <p className="mt-2 font-bold text-fb-blue text-lg">{formatBDT(expert.rate)} / মিনিট</p>
        <p className="text-xs text-gray-500">{FREE_MINUTES_NOTE}</p>
        <div className="flex gap-2 mt-4">
          <Btn variant="green" className="flex-1" onClick={() => navigate(`/call/expert/${expert.id}`)}>📞 এখনই কল করুন</Btn>
          <Btn variant="ghost" onClick={() => navigate('/chat')}>💬 ফ্রি চ্যাট</Btn>
        </div>
      </Card>
      <Card><h2 className="font-bold mb-2">রিভিউ</h2><p className="text-sm">⭐⭐⭐⭐⭐ “খুব ভালো পরামর্শ পেয়েছি, সময়মতো কল ধরেছেন।” — একজন ব্যবহারকারী</p></Card>
    </div>
  )
}

export function CreateService() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [desc, setDesc] = useState('')
  const [done, setDone] = useState(false)
  return (
    <div className="max-w-lg mx-auto"><Card>
      <h1 className="text-xl font-bold">সার্ভিস তৈরি করুন</h1>
      <label className="text-sm font-medium block mt-3">সার্ভিসের নাম</label>
      <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={title} onChange={e => setTitle(e.target.value)} />
      <label className="text-sm font-medium block mt-3">দাম (৳)</label>
      <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" type="number" value={price} onChange={e => setPrice(e.target.value)} />
      <label className="text-sm font-medium block mt-3">বিবরণ</label>
      <textarea className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" rows={3} value={desc} onChange={e => setDesc(e.target.value)} />
      <Btn className="w-full mt-4" disabled={!title || !price} onClick={() => setDone(true)}>প্রকাশ করুন</Btn>
      {done && <p className="text-sm text-green-600 mt-3">✅ সার্ভিসটি ডেমোতে প্রকাশিত হয়েছে। <button className="text-fb-blue" onClick={() => navigate('/marketplace')}>মার্কেটপ্লেস দেখুন</button></p>}
    </Card></div>
  )
}

// ---------- Call (WhatsApp-style, prepaid) ----------
export function CallPage() {
  const { type, id } = useParams()
  const { balance, deduct, freeFirstMinuteUsed, markFreeMinuteUsed, addCall, user, datingRate, kycVerified } = useStore()
  const navigate = useNavigate()
  const { experts: liveExperts } = useExperts()
  const expert = type === 'expert' ? liveExperts.find(e => e.id === id) : undefined
  const isDating = type === 'dating'
  const datingProfile = isDating ? DATING_PROFILES.find(p => p.id === id) : undefined
  const friendName = type === 'friend' ? (id || 'বন্ধু') : undefined
  const rate = expert ? expert.rate : isDating ? datingRate : FRIEND_RATE // ডেটিং রেট অ্যাডমিন থেকে বদলানো যায় (ডিফল্ট ৳১০); বন্ধুর কল ৳১০ ফ্ল্যাট
  const name = expert ? expert.name : isDating ? (datingProfile?.name || decodeURIComponent(id || 'ডেটিং')) : decodeURIComponent(friendName || 'বন্ধু')
  // ডেটিং কল সম্পূর্ণ প্রিপেইড — গ্লোবাল প্রথম-১-মিনিট-ফ্রি এখানে প্রযোজ্য নয়, ফ্রি মিনিট খরচও হবে না
  const isFreeAvailable = !isDating && !freeFirstMinuteUsed
  const [started, setStarted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [sharing, setSharing] = useState(false)
  // Camera facing: 'user' = সামনের (ফ্রন্ট) ক্যামেরা, 'environment' = পেছনের (ব্যাক) ক্যামেরা
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [camCount, setCamCount] = useState<number | null>(null)
  const [switching, setSwitching] = useState(false)
  const [camError, setCamError] = useState('')
  const facingRef = useRef<'user' | 'environment'>('user')
  const streamRef = useRef<MediaStream | null>(null)
  function setFacingBoth(f: 'user' | 'environment') { facingRef.current = f; setFacing(f) }
  const [ended, setEnded] = useState(false)
  const [endReason, setEndReason] = useState('')
  const [chat, setChat] = useState<{ from: string; text: string }[]>([])
  const [chatDraft, setChatDraft] = useState('')
  const [banMsg, setBanMsg] = useState('')
  const [banCount, setBanCount] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const selfRef = useRef<HTMLVideoElement>(null)

  const freeSeconds = isFreeAvailable ? 60 : 0
  const paidSeconds = Math.max(0, seconds - freeSeconds)
  const billedMinutes = Math.ceil(paidSeconds / 60)
  const liveCost = billedMinutes * rate
  const maxPaidMinutes = Math.floor(balance / rate)
  const maxSeconds = freeSeconds + maxPaidMinutes * 60
  const talkableMinutes = freeSeconds / 60 + maxPaidMinutes
  const canStart = isFreeAvailable || balance >= rate

  useEffect(() => {
    if (!started || ended) return
    const t = setInterval(() => setSeconds(s => {
      const next = s + 1
      if (next >= maxSeconds && maxSeconds > 0) { endCall('Auto-cut — ব্যালেন্স শেষ') }
      return next
    }), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, ended, maxSeconds])

  useEffect(() => {
    if (!started) return
    let cancelled = false
    // ক্যামেরা কয়টি আছে গুনে নেওয়া (অনুমতি পাওয়ার পর লেবেলসহ গোনা যায়)
    navigator.mediaDevices?.enumerateDevices?.().then(devices => {
      if (!cancelled) setCamCount(devices.filter(d => d.kind === 'videoinput').length)
    }).catch(() => { /* গোনা না গেলেও কল চলবে */ })
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: facingRef.current }, audio: true }).then(s => {
      if (cancelled) { s.getTracks().forEach(t => t.stop()); return }
      streamRef.current = s
      if (selfRef.current) selfRef.current.srcObject = s
    }).catch(() => { /* camera unavailable in demo — placeholder stays */ })
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }, [started])

  // সামনের ↔ পেছনের ক্যামেরা বদলান — কল, টাইমার বা বিলিং থামবে না; অডিও ট্র্যাক চালু থাকবে
  async function switchCamera() {
    if (switching || camCount === 1) return
    const next = facingRef.current === 'user' ? 'environment' : 'user'
    setSwitching(true); setCamError('')
    let newStream: MediaStream | null = null
    try {
      // প্রথমে exact চাওয়া — না হলে (ডিভাইসে ওই ক্যামেরা নেই) সাধারণ facingMode দিয়ে চেষ্টা
      newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next } }, audio: false })
    } catch {
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false })
      } catch {
        setCamError('এই ক্যামেরাটা চালু করা যায়নি — আগের ক্যামেরাতেই থাকলো।')
        setSwitching(false)
        return
      }
    }
    // পুরোনো ভিডিও ট্র্যাকই শুধু বন্ধ করা — অডিও ট্র্যাক চালু থাকবে, কল চলতেই থাকবে
    const oldAudio = streamRef.current?.getAudioTracks() ?? []
    streamRef.current?.getVideoTracks().forEach(t => t.stop())
    const combined = new MediaStream([...newStream.getVideoTracks(), ...oldAudio])
    streamRef.current = combined
    if (selfRef.current) selfRef.current.srcObject = combined
    setFacingBoth(next)
    // ক্যামেরা গোনা আবার আপডেট করা (কিছু ডিভাইসে অনুমতির পরেই সঠিক সংখ্যা আসে)
    navigator.mediaDevices?.enumerateDevices?.().then(devices => {
      setCamCount(devices.filter(d => d.kind === 'videoinput').length)
    }).catch(() => { /* ignore */ })
    setSwitching(false)
  }

  function fmt(s: number) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

  function endCall(reason: string) {
    if (ended) return
    setEnded(true); setEndReason(reason || 'কল শেষ')
    const cost = Math.ceil(Math.max(0, seconds - freeSeconds) / 60) * rate
    if (cost > 0) deduct(cost)
    if (isFreeAvailable && seconds > 0) markFreeMinuteUsed()
    addCall({ name, type: expert ? 'Expert' : isDating ? 'Dating' : 'Friend', rate, durationSec: seconds, cost, freeMinute: isFreeAvailable && seconds > 0, status: reason.startsWith('Auto-cut') ? 'Auto-cut' : 'Completed' })
  }

  function sendChat() {
    const err = contactBanCheck(chatDraft)
    if (err) { setBanMsg(err + ` (চেষ্টা ${banCount + 1} — অ্যাডমিন লগে সংরক্ষিত)`); setBanCount(c => c + 1); return }
    if (!chatDraft.trim()) return
    setChat(c => [...c, { from: user?.name || 'আপনি', text: chatDraft }]); setChatDraft(''); setBanMsg('')
  }

  // KYC ছাড়া ডেটিং কল শুরু করা যাবে না — কল শুরু হলে টাকাও কাটবে না
  if (isDating && !kycVerified) {
    return <DatingKycBlocked />
  }

  if (ended) {
    const cost = Math.ceil(Math.max(0, seconds - freeSeconds) / 60) * rate
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">কল শেষ হয়েছে</h1>
          <p className="mt-2">{name} • {fmt(seconds)}</p>
          <p className="mt-1 text-sm">খরচ: {formatBDT(cost)}{isFreeAvailable && seconds > 0 ? ' (প্রথম ১ মিনিট ফ্রি প্রযোজ্য হয়েছে)' : ''}</p>
          <p className="text-sm text-gray-300">{endReason}</p>
          <p className="text-sm mt-1">বর্তমান ব্যালেন্স: {formatBDT(balance - cost < 0 ? 0 : balance - cost)}</p>
          <div className="flex gap-2 mt-5 justify-center">
            <Btn variant="green" onClick={() => navigate('/call-history')}>কল হিস্ট্রি</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/feed')}>ফিডে ফিরুন</Btn>
          </div>
        </Card>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full">
          <h1 className="text-xl font-bold">📞 {name}</h1>
          <p className="text-sm text-gray-300">{expert ? `${expert.title} • ` : isDating ? 'ডেটিং • ' : 'বন্ধু • '}{formatBDT(rate)}/মিনিট</p>
          {isFreeAvailable && <p className="mt-2 text-sm bg-green-600 rounded-lg px-3 py-2">🎉 ১ম মিনিট ফ্রি — আপনার প্রথম কলের প্রথম ১ মিনিট সম্পূর্ণ ফ্রি!</p>}
          {isDating && <div className="mt-2 space-y-2">
            <p className="text-sm bg-pink-600 rounded-lg px-3 py-2">💳 প্রিপেইড ভিডিও কল — {formatBDT(rate)}/মিনিট। শুধু আপনি (কলকারী) দেবেন, যাকে কল করছেন তার টাকা কাটবে না। এই কলে ফ্রি মিনিট প্রযোজ্য নয়।</p>
            <p className="text-xs text-gray-300">🔴 এই কলটিও অন্যান্য কলের মতো অ্যাডমিন-অনলি রেকর্ডিংয়ের আওতায় থাকে — শুধু আপিল/বিরোধের ক্ষেত্রে অ্যাডমিন দেখতে পারে।</p>
          </div>}
          <div className="mt-4 space-y-1 text-sm">
            <p>ব্যালেন্স: <b>{formatBDT(balance)}</b></p>
            <p>কথা বলা যাবে: <b>~{talkableMinutes} মিনিট</b>{isFreeAvailable ? ' (১ মিনিট ফ্রি সহ)' : ''}</p>
            <p>প্রতি মিনিট: <b>{formatBDT(rate)}</b> • ব্যালেন্স শেষ হলে কল নিজে থেকেই কেটে যাবে।</p>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-300 mb-2">📷 কোন ক্যামেরা দিয়ে শুরু করবেন?</p>
            <div className="flex gap-2">
              <button onClick={() => setFacingBoth('user')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${facing === 'user' ? 'bg-fb-blue text-white' : 'bg-slate-700 text-white'}`}>🤳 সামনের ক্যামেরা</button>
              <button onClick={() => setFacingBoth('environment')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${facing === 'environment' ? 'bg-fb-blue text-white' : 'bg-slate-700 text-white'}`}>📷 পেছনের ক্যামেরা</button>
            </div>
            <p className="text-xs text-gray-400 mt-1">কল চলাকালীনও নিচের 🔄 বোতামে ক্যামেরা বদলানো যাবে।</p>
          </div>
          {!canStart && <p className="mt-3 bg-red-600 rounded-lg px-3 py-2 text-sm font-medium">⚠️ টপ-আপ ছাড়া কল করা যাবে না। প্রিপেইড কল — আগে টপ-আপ করুন।</p>}
          <div className="flex gap-2 mt-5">
            <Btn variant="green" className="flex-1" disabled={!canStart} onClick={() => setStarted(true)}>▶️ কল শুরু করুন</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>💰 টপ-আপ</Btn>
          </div>
          <button className="text-sm text-gray-300 mt-3" onClick={() => navigate(-1)}>← ফিরে যান</button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative">
      {/* small red dot only — no "Recording" text by design; recording is admin-only for appeals */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" title="Admin-only recording indicator" />
        <span className="text-xs bg-black/50 px-2 py-1 rounded-full">{fmt(seconds)} • {liveCost === 0 ? 'ফ্রি' : formatBDT(liveCost)}</span>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" autoPlay playsInline muted />
        <div className="text-center">
          <span className="w-28 h-28 rounded-full bg-fb-blue text-4xl flex items-center justify-center font-bold mx-auto">{name.slice(0, 1)}</span>
          <p className="text-xl font-bold mt-3">{name}</p>
          <p className="text-gray-300 text-sm">{fmt(seconds)} • {isFreeAvailable && seconds < 60 ? '১ম মিনিট ফ্রি' : `${formatBDT(liveCost)}`}</p>
          {sharing && <p className="text-xs mt-2 bg-blue-600 inline-block px-2 py-1 rounded">🖥️ স্ক্রিন শেয়ার চলছে</p>}
          {camOff && <p className="text-xs mt-2">📷 ক্যামেরা বন্ধ</p>}
        </div>
        {/* সামনের ক্যামেরায় সেলফ-ভিউ আয়নার মতো (mirror), পেছনের ক্যামেরায় নয় */}
        <video ref={selfRef} style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }} className="absolute bottom-24 right-4 w-28 h-36 rounded-xl object-cover border-2 border-white bg-slate-700" autoPlay playsInline muted />
      </div>
      <div className="px-3 pb-3">
        <div className="max-w-md mx-auto bg-black/40 rounded-xl p-2 mb-3 max-h-32 overflow-y-auto">
          {chat.length === 0 && <p className="text-xs text-gray-300 text-center">ইন-কল চ্যাট — নম্বর/লিংক/ইমেইল শেয়ার ব্লক করা আছে।</p>}
          {chat.map((m, i) => <p key={i} className="text-sm"><b>{m.from}:</b> {m.text}</p>)}
        </div>
        {banMsg && <p className="text-xs text-red-300 text-center mb-2">{banMsg}</p>}
        <div className="flex gap-2 max-w-md mx-auto mb-4">
          <input className="flex-1 rounded-full px-3 py-2 text-sm text-black" placeholder="মেসেজ লিখুন…" value={chatDraft} onChange={e => setChatDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
          <Btn onClick={sendChat}>পাঠান</Btn>
        </div>
        <div className="flex justify-center gap-3 pb-2">
          <button onClick={() => setMuted(m => !m)} className="w-14 h-14 rounded-full bg-slate-700 text-2xl" title="মাইক">{muted ? '🔇' : '🎤'}</button>
          <button onClick={() => setCamOff(c => !c)} className="w-14 h-14 rounded-full bg-slate-700 text-2xl" title="ক্যামেরা">{camOff ? '📷' : '📹'}</button>
          <button onClick={() => setSharing(s => !s)} className={`w-14 h-14 rounded-full text-2xl ${sharing ? 'bg-blue-600' : 'bg-slate-700'}`} title="স্ক্রিন শেয়ার">🖥️</button>
          <button onClick={switchCamera} disabled={switching || camCount === 1} className="h-14 px-3 rounded-full bg-slate-700 text-sm font-bold disabled:opacity-50" title="ক্যামেরা বদলান — সামনে ↔ পেছনে">🔄 {switching ? 'বদলানো হচ্ছে…' : `ক্যামেরা: ${facing === 'user' ? 'সামনে' : 'পেছনে'}`}</button>
          <button onClick={() => endCall('আপনি কল শেষ করেছেন')} className="w-16 h-16 rounded-full bg-red-600 text-3xl" title="কল শেষ">📞</button>
        </div>
        {camCount === 1 && <p className="text-center text-xs text-yellow-300 mb-1">এই ডিভাইসে ১টি ক্যামেরা পাওয়া গেছে — ক্যামেরা বদলানো যাবে না।</p>}
        {camError && <p className="text-center text-xs text-red-300 mb-1">{camError}</p>}
        <p className="text-center text-xs text-gray-400">ব্যালেন্স শেষ হলে কল অটো-কাট হবে • সর্বোচ্চ {fmt(maxSeconds)}</p>
      </div>
    </div>
  )
}

// ---------- Call history ----------
export function CallHistory() {
  const { calls } = useStore()
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">📞 কল হিস্ট্রি</h1>
      {calls.length === 0 && <Card><p className="text-sm text-gray-500">এখনো কোনো কল হয়নি। প্রথম কলের প্রথম ১ মিনিট ফ্রি!</p></Card>}
      {calls.map(c => (
        <Card key={c.id}>
          <div className="flex justify-between"><b>{c.name}</b><span className="text-xs text-gray-400">{c.time}</span></div>
          <p className="text-sm text-gray-500">{c.type} • {formatBDT(c.rate)}/মিনিট • {Math.floor(c.durationSec / 60)} মি {c.durationSec % 60} সে • {c.status}</p>
          <p className="text-sm font-bold">খরচ: {formatBDT(c.cost)}{c.freeMinute ? ' (১ম মিনিট ফ্রি সহ)' : ''}</p>
        </Card>
      ))}
    </div>
  )
}

// ---------- Wallet ----------
export function WalletPage() {
  const { balance, topUp, points, referrals, coins, addCoins, deduct } = useStore()
  const [amount, setAmount] = useState(500)
  const [method, setMethod] = useState('bKash')
  const [trx, setTrx] = useState('')
  const [msg, setMsg] = useState('')
  const [coinMsg, setCoinMsg] = useState('')
  function buyCoins(pack: number) {
    if (balance < pack) { setCoinMsg('ব্যালেন্স যথেষ্ট নয় — আগে টপ-আপ করুন।'); return }
    deduct(pack); addCoins(pack); setCoinMsg(`✅ ${pack} কয়েন কেনা হয়েছে। নতুন কয়েন ব্যালেন্স: ${coins + pack}।`)
  }
  const [affiliateOn, setAffiliateOn] = useState(false)
  const usdtRate = 120
  function doTopUp() {
    if (amount <= 0) { setMsg('সঠিক পরিমাণ দিন।'); return }
    if ((method === 'bKash' || method === 'Nagad') && !trx.trim()) { setMsg('TrxID দিন — SMS অটো-ভেরিফাই হবে।'); return }
    topUp(amount, method); setMsg(`✅ ${formatBDT(amount)} টপ-আপ হয়েছে (${method})। নতুন ব্যালেন্স ${formatBDT(balance + amount)}।`)
  }
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card className="text-center">
        <p className="text-gray-500 text-sm">ওয়ালেট ব্যালেন্স</p>
        <p className="text-4xl font-extrabold text-green-600">{formatBDT(balance)}</p>
        <p className="text-sm text-gray-500 mt-1">রিওয়ার্ড পয়েন্ট: {points} • রেফারেল: {referrals} জন</p>
        <p className="text-xs text-gray-400 mt-1">কল প্রিপেইড — ব্যালেন্স ছাড়া কল করা যাবে না।</p>
      </Card>
      <Card>
        <h2 className="font-bold">💰 টপ-আপ করুন</h2>
        <div className="flex gap-2 flex-wrap mt-3">{TOPUP_PACKS.map(p => <button key={p} onClick={() => setAmount(p)} className={`px-4 py-2 rounded-lg border font-bold ${amount === p ? 'bg-fb-blue text-white' : 'bg-gray-50 dark:bg-slate-800'}`}>{formatBDT(p)}</button>)}</div>
        <label className="text-sm block mt-3">পরিমাণ (৳)</label>
        <input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={amount} onChange={e => setAmount(Number(e.target.value))} />
        <label className="text-sm block mt-3">পেমেন্ট মাধ্যম</label>
        <div className="flex gap-2 flex-wrap mt-1">{['bKash', 'Nagad', 'Bank', 'USDT (TRC20)'].map(m => <button key={m} onClick={() => setMethod(m)} className={`px-3 py-1.5 rounded-full text-sm border ${method === m ? 'bg-fb-blue text-white' : ''}`}>{m}</button>)}</div>
        {method === 'USDT (TRC20)' && <p className="text-sm mt-2">রেট: ১ USDT = ৳{usdtRate} • গেটওয়ে ফি ১% • {formatBDT(amount)} পেতে {(amount / usdtRate).toFixed(2)} USDT পাঠান।</p>}
        {(method === 'bKash' || method === 'Nagad') && <><label className="text-sm block mt-3">TrxID</label><input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={trx} onChange={e => setTrx(e.target.value)} placeholder="যেমন: 9HX7..." /><p className="text-xs text-gray-400 mt-1">অফিসিয়াল সেন্ডার (bKash/Nagad/16216) থেকে SMS এলে অটো-অ্যাপ্রুভ হবে। একই TrxID দুবার ব্যবহার করা যাবে না।</p></>}
        <Btn variant="green" className="w-full mt-4" onClick={doTopUp}>টপ-আপ করুন</Btn>
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </Card>
      <Card>
        <h2 className="font-bold">🪙 কয়েন কিনুন (লাইভ গিফটের জন্য)</h2>
        <p className="text-sm mt-1">আপনার কয়েন: <b>{coins}</b> • ১ কয়েন = ৳১ • গিফট শুধু CallGuru কয়েন দিয়েই কেনা যায়।</p>
        <div className="flex gap-2 flex-wrap mt-3">{[10, 50, 100].map(p => <button key={p} onClick={() => buyCoins(p)} className="px-4 py-2 rounded-lg border font-bold bg-gray-50 dark:bg-slate-800">{p} কয়েন — {formatBDT(p)}</button>)}</div>
        <p className="text-xs text-gray-400 mt-2">ওয়ালেট ব্যালেন্স থেকে কাটবে — ব্যালেন্স কম থাকলে আগে টপ-আপ করুন।</p>
        {coinMsg && <p className="text-sm mt-2">{coinMsg}</p>}
      </Card>
      <Card>
        <h2 className="font-bold">🔗 অ্যাফিলিয়েট ও রেফারেল</h2>
        <p className="text-sm mt-1">আপনার লিংক: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">callguru.app/r/avijit</code></p>
        <p className="text-sm mt-1">কমিশন <b>১০%</b> — শুধুমাত্র রেফার করা ব্যবহারকারীর <b>প্রথম ডিপোজিট + প্রথম কেনাকাটা (কল/সার্ভিস/প্রিমিয়াম)</b> সম্পূর্ণ হলেই পাবেন। শুধু সাইনআপ বা ক্লিকে কমিশন নেই।</p>
        <p className="text-sm mt-1">রেফারেল ২-স্তর: লেভেল-১ = ১.০ পয়েন্ট, লেভেল-২ = ০.৫ পয়েন্ট • ১ পয়েন্ট = ৳৫০।</p>
        <Btn variant="ghost" className="mt-3" onClick={() => setAffiliateOn(a => !a)}>{affiliateOn ? 'ড্যাশবোর্ড লুকান' : 'অ্যাফিলিয়েট ড্যাশবোর্ড দেখুন'}</Btn>
        {affiliateOn && <p className="text-sm mt-2">এখন পর্যন্ত আয়: ৳০ • যোগ্য রেফারেল: ০ জন (প্রথম ডিপোজিট + কেনাকাটা বাকি)।</p>}
      </Card>
    </div>
  )
}

// ---------- Friends ----------
export function FriendsPage() {
  const { friends, requests, acceptRequest, removeFriend, addFriend } = useStore()
  const navigate = useNavigate()
  const [sent, setSent] = useState<Record<string, boolean>>({})
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">👥 বন্ধুরা</h1>
      <Card>
        <h2 className="font-bold">ফ্রেন্ড রিকোয়েস্ট ({requests.length})</h2>
        {requests.length === 0 && <p className="text-sm text-gray-500 mt-1">কোনো নতুন রিকোয়েস্ট নেই।</p>}
        {requests.map(r => (
          <div key={r.id} className="flex items-center gap-3 py-2">
            <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ background: r.color }}>{r.name.slice(0, 1)}</span>
            <span className="flex-1 font-medium">{r.name}</span>
            <Btn onClick={() => acceptRequest(r.id)}>Confirm</Btn>
            <Btn variant="ghost" onClick={() => removeFriend(r.id)}>Delete</Btn>
          </div>
        ))}
      </Card>
      <Card>
        <h2 className="font-bold">আমার বন্ধুরা ({friends.length}) — চ্যাট ফ্রি, কল প্রিপেইড ৳১০/মিনিট</h2>
        {friends.map(f => (
          <div key={f.id} className="flex items-center gap-3 py-2">
            <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ background: f.color }}>{f.name.slice(0, 1)}</span>
            <span className="flex-1 font-medium">{f.name} <span className="text-xs text-gray-400">{f.online ? '● অনলাইন' : '○ অফলাইন'}</span></span>
            <Btn variant="ghost" onClick={() => navigate('/chat')}>💬 চ্যাট</Btn>
            <Btn variant="green" onClick={() => navigate(`/call/friend/${encodeURIComponent(f.name)}`)}>📞 কল</Btn>
            <Btn variant="ghost" onClick={() => removeFriend(f.id)}>Unfriend</Btn>
          </div>
        ))}
      </Card>
      <Card>
        <h2 className="font-bold">People You May Know</h2>
        {FRIEND_SUGGESTIONS.map(s => (
          <div key={s.id} className="flex items-center gap-3 py-2">
            <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ background: s.color }}>{s.name.slice(0, 1)}</span>
            <span className="flex-1"><span className="font-medium">{s.name}</span><span className="block text-xs text-gray-400">{s.mutual} জন মিউচুয়াল বন্ধু</span></span>
            {sent[s.id] ? <Btn variant="ghost" onClick={() => setSent(v => ({ ...v, [s.id]: false }))}>Remove</Btn>
              : <Btn onClick={() => { setSent(v => ({ ...v, [s.id]: true })); addFriend({ id: s.id, name: s.name, color: s.color, online: true }) }}>Add Friend</Btn>}
          </div>
        ))}
      </Card>
    </div>
  )
}

// ---------- Chat (free, contact-ban) ----------
export function ChatPage() {
  const { user } = useStore()
  const [active, setActive] = useState('রাফি আহমেদ')
  const [msgs, setMsgs] = useState<Record<string, { from: string; text: string }[]>>({
    'রাফি আহমেদ': [{ from: 'রাফি আহমেদ', text: 'আসসালামু আলাইকুম! কেমন আছো?' }],
    'ডা. রাহাত': [{ from: 'ডা. রাহাত', text: 'কল করার আগে এখানে প্রশ্ন লিখতে পারেন — চ্যাট সম্পূর্ণ ফ্রি।' }]
  })
  const [draft, setDraft] = useState('')
  const [ban, setBan] = useState('')
  const [warn, setWarn] = useState(0)
  function send() {
    const err = contactBanCheck(draft)
    if (err) { setBan(err + ' বারবার চেষ্টা করলে সতর্কবার্তা বাড়বে।'); setWarn(w => w + 1); return }
    if (!draft.trim()) return
    setMsgs(m => ({ ...m, [active]: [...(m[active] || []), { from: user?.name || 'আপনি', text: draft }] }))
    setDraft(''); setBan('')
  }
  return (
    <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
      <Card className="md:col-span-1">
        <h2 className="font-bold mb-2">চ্যাট — সম্পূর্ণ ফ্রি</h2>
        {['রাফি আহমেদ', 'ডা. রাহাত', 'মেহজাবিন'].map(n => (
          <button key={n} onClick={() => setActive(n)} className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${active === n ? 'bg-blue-50 dark:bg-slate-700 font-bold' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}>{n}</button>
        ))}
        <p className="text-xs text-gray-400 mt-3">ফোন নম্বর, WhatsApp/Facebook/Telegram লিংক বা ইমেইল শেয়ার করা যাবে না — স্বয়ংক্রিয়ভাবে ব্লক হবে।</p>
        {warn > 0 && <p className="text-xs text-red-500 mt-1">সতর্কবার্তা: {warn} বার নিয়ম ভাঙার চেষ্টা হয়েছে।</p>}
      </Card>
      <Card className="md:col-span-2">
        <h2 className="font-bold">{active}</h2>
        <div className="h-64 overflow-y-auto space-y-2 mt-3">
          {(msgs[active] || []).map((m, i) => <p key={i} className={`text-sm px-3 py-2 rounded-xl max-w-[80%] ${m.from === (user?.name || 'আপনি') ? 'bg-blue-100 dark:bg-blue-900 ml-auto' : 'bg-gray-100 dark:bg-slate-700'}`}><b>{m.from}:</b> {m.text}</p>)}
        </div>
        {ban && <p className="text-sm text-red-500 mt-2">{ban}</p>}
        <div className="flex gap-2 mt-3">
          <input className="flex-1 border rounded-full px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="মেসেজ লিখুন… (চ্যাট ফ্রি)" />
          <Btn onClick={send}>পাঠান</Btn>
        </div>
      </Card>
    </div>
  )
}

// ---------- ডেটিং KYC (একবারই) ----------
// KYC ছাড়া ডেটিংয়ের কিছুই দেখা যাবে না। সম্পন্ন হলে আর কখনো চাওয়া হয় না।
// ডেমো KYC — আসল যাচাইয়ের জন্য ভেরিফায়েড KYC সার্ভিস লাগবে।
function ageFromDob(dobStr: string): number | null {
  if (!dobStr) return null
  const d = new Date(dobStr)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

// সেলফি ছোট আকারে নামানো হয় (সর্বোচ্চ ৩২০px, JPEG ০.৭) — অ্যাডমিন দেখে মিলাতে পারবেন, আর localStorage-এ জায়গাও কম লাগবে
function downscaleImage(source: HTMLVideoElement | HTMLImageElement, w: number, h: number): string {
  const scale = Math.min(1, 320 / w)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale))
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(source, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.7)
}

function KycPage({ onComplete, onEnter }: { onComplete: () => void; onEnter: () => void }) {
  const { submitKyc: submitKycToStore, kycStatus, kycInfo, kycRejectReason, resetKyc } = useStore()
  const [step, setStep] = useState<1 | 2>(1)
  const [resubmit, setResubmit] = useState(false)
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [err, setErr] = useState('')
  const [captured, setCaptured] = useState<string | null>(null)
  const [videoClip, setVideoClip] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [videoNote, setVideoNote] = useState('')
  const [camError, setCamError] = useState('')
  const [camKey, setCamKey] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // ভিডিও রেকর্ডিং চলার সময় ক্যামেরা-ইফেক্টের cleanup যেন ট্র্যাক বন্ধ না করে — নইলে ক্লিপটি মাঝপথে কেটে যাবে
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingRef = useRef(false)
  const cancelRecordRef = useRef(false)

  function startCamera() {
    setCamError('')
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'user' }, audio: false }).then(s => {
      streamRef.current = s
      if (videoRef.current) videoRef.current.srcObject = s
    }).catch(() => setCamError('ক্যামেরা চালু করা যায়নি — নিচে ছবি আপলোড করে সেলফি দিন।'))
  }
  useEffect(() => {
    if (step !== 2 || captured) return
    startCamera()
    return () => { if (recordingRef.current) return; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, camKey])

  function captureSelfie() {
    const v = videoRef.current
    const stream = streamRef.current
    if (!v || !v.videoWidth) { setCamError('ক্যামেরা থেকে ছবি নেওয়া যায়নি — আবার চেষ্টা করুন বা ছবি আপলোড করুন।'); return }
    // অ্যাডমিন দেখে মিলাতে পারবেন — ছোট আকারে সংরক্ষণ করা হয়
    setCaptured(downscaleImage(v, v.videoWidth, v.videoHeight))
    // লাইভ ভিডিও ক্লিপ (~৩ সেকেন্ড, কম বিটরেট) — অ্যাডমিন ভিডিও চালিয়ে ব্যক্তি মেলাতে পারবেন
    setVideoClip(null); setVideoNote(''); cancelRecordRef.current = false
    if (stream && typeof MediaRecorder !== 'undefined') {
      try {
        const rec = new MediaRecorder(stream, { videoBitsPerSecond: 200000 })
        recorderRef.current = rec
        const chunks: Blob[] = []
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
        rec.onstop = () => {
          recordingRef.current = false
          recorderRef.current = null
          setRecording(false)
          if (!cancelRecordRef.current) {
            const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' })
            if (blob.size > 0 && blob.size < 900000) {
              const r = new FileReader()
              r.onload = () => setVideoClip(String(r.result))
              r.readAsDataURL(blob)
            } else {
              setVideoNote('লাইভ ভিডিওটি এই ডিভাইসে সংরক্ষণ করা যায়নি — শুধু সেলফি ছবি দিয়ে যাচাই করা হবে।')
            }
          }
          stream.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }
        rec.start()
        recordingRef.current = true
        setRecording(true)
        setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, 3000)
      } catch {
        setVideoNote('লাইভ ভিডিও রেকর্ড করা যায়নি — শুধু সেলফি ছবি দিয়ে যাচাই করা হবে।')
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    } else {
      setVideoNote('লাইভ ভিডিও রেকর্ড করা যায়নি — শুধু সেলফি ছবি দিয়ে যাচাই করা হবে।')
      stream?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => setCaptured(downscaleImage(img, img.width, img.height))
      img.src = String(r.result)
    }
    r.readAsDataURL(f)
    // আপলোড করা ছবিতে লাইভ ভিডিও থাকে না — শুধু সেলফি ছবি দিয়েই যাচাই হবে
    setVideoClip(null)
    setVideoNote('আপলোড করা ছবিতে লাইভ ভিডিও থাকে না — শুধু সেলফি ছবি দিয়ে যাচাই করা হবে।')
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }
  function submitIdentity() {
    const age = ageFromDob(dob)
    if (!name.trim() || !dob || !idType || !idNumber.trim()) { setErr('সব ঘর পূরণ করুন।'); return }
    if (age === null) { setErr('জন্ম তারিখ সঠিকভাবে দিন।'); return }
    if (age < 18) { setErr('ডেটিংয়ের জন্য বয়স কমপক্ষে ১৮ বছর হতে হবে।'); return }
    if (idNumber.trim().length < 4) { setErr('সঠিক আইডি নম্বর দিন।'); return }
    setErr('')
    setStep(2)
  }
  function submitKyc() {
    if (!captured) return
    // পুরো আইডি নম্বর কখনো সংরক্ষণ করা হয় না — শুধু শেষ ৪ সংখ্যা; সেলফি ও লাইভ ভিডিও ক্লিপ শুধু অ্যাডমিন যাচাইয়ের জন্য রাখা হয়
    submitKycToStore({ name: name.trim(), dob, idType, idLast4: idNumber.trim().slice(-4), selfie: captured, selfieVideo: videoClip ?? undefined })
    onComplete()
  }
  function startResubmit() {
    resetKyc()
    setName(''); setDob(''); setIdType(''); setIdNumber(''); setCaptured(null); setVideoClip(null); setRecording(false); setVideoNote(''); setErr(''); setCamError('')
    setResubmit(true); setStep(1)
  }

  // অনুমোদিত হলে ডেটিংয়ে ঢোকার স্ক্রিন (DatingPage-এ kycSuccess থাকলে এই স্ক্রিন দেখায়)
  if (kycStatus === 'approved') {
    return (
      <div className="max-w-md mx-auto"><Card className="text-center">
        <h1 className="text-xl font-bold">✅ KYC অনুমোদিত হয়েছে</h1>
        <p className="text-sm text-gray-500 mt-2">{kycInfo?.name ?? name} • অনুমোদনের তারিখ: {kycInfo?.verifiedAt ? new Date(kycInfo.verifiedAt).toLocaleDateString('bn-BD') : new Date().toLocaleDateString('bn-BD')}</p>
        <p className="text-sm text-green-600 mt-2 font-medium">আর কখনো KYC করতে হবে না — একবারই যথেষ্ট।</p>
        <Btn className="mt-4 w-full" onClick={onEnter}>❤️ ডেটিংয়ে যান</Btn>
      </Card></div>
    )
  }
  // জমা দেওয়ার পর অ্যাডমিনের অনুমোদনের অপেক্ষা — ডেটিং এখনো বন্ধ
  if (kycStatus === 'pending') {
    return (
      <div className="max-w-md mx-auto"><Card className="text-center">
        <h1 className="text-xl font-bold">⏳ KYC পর্যালোচনাধীন</h1>
        <p className="text-sm text-gray-500 mt-2">আপনার KYC জমা হয়েছে ({kycInfo?.name ?? name} • {kycInfo ? new Date(kycInfo.submittedAt).toLocaleDateString('bn-BD') : ''})। অ্যাডমিন আপনার নাম, বয়স, আইডি আর সেলফি মিলিয়ে দেখছেন — অনুমোদন হলে ডেটিং খুলে যাবে।</p>
        <p className="text-sm text-gray-400 mt-2">অনুমোদন না হওয়া পর্যন্ত ডেটিংয়ের কিছুই দেখা যাবে না।</p>
      </Card></div>
    )
  }
  // বাতিল হলে কারণ দেখিয়ে আবার জমা দেওয়ার সুযোগ
  if (kycStatus === 'rejected' && !resubmit) {
    return (
      <div className="max-w-md mx-auto"><Card className="text-center">
        <h1 className="text-xl font-bold">❌ KYC বাতিল হয়েছে</h1>
        <p className="text-sm text-gray-500 mt-2">অ্যাডমিন আপনার KYC বাতিল করেছেন।</p>
        <p className="text-sm mt-2 bg-red-50 dark:bg-red-900 rounded-lg px-3 py-2">বাতিলের কারণ: <b>{kycRejectReason || 'কারণ দেওয়া হয়নি'}</b></p>
        <p className="text-sm text-gray-400 mt-2">তথ্য ঠিক করে আবার KYC জমা দিতে পারেন।</p>
        <Btn className="mt-4 w-full" onClick={startResubmit}>🔄 আবার KYC জমা দিন</Btn>
      </Card></div>
    )
  }

  return (
    <div className="max-w-md mx-auto"><Card>
      <h1 className="text-xl font-bold text-center">🛡️ ডেটিং KYC — একবারই করতে হবে</h1>
      <p className="text-sm text-gray-500 mt-2 text-center">ডেটিংয়ের কিছু দেখতে হলে প্রথমে লাইভ KYC করতে হবে। KYC ছাড়া ডেটিংয়ের প্রোফাইল, লাইভ বা কল — কিছুই দেখা যাবে না।</p>
      <div className="flex gap-2 mt-4 justify-center text-sm">
        <span className={`px-3 py-1 rounded-full font-bold ${step === 1 ? 'bg-fb-blue text-white' : 'bg-gray-200 dark:bg-slate-700'}`}>১. পরিচয়</span>
        <span className={`px-3 py-1 rounded-full font-bold ${step === 2 ? 'bg-fb-blue text-white' : 'bg-gray-200 dark:bg-slate-700'}`}>২. লাইভ সেলফি</span>
      </div>
      {step === 1 && (
        <div className="mt-4">
          <label className="text-sm font-medium">পুরো নাম</label>
          <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={name} onChange={e => setName(e.target.value)} placeholder="আপনার পুরো নাম" />
          <label className="text-sm font-medium mt-3 block">জন্ম তারিখ</label>
          <input type="date" max={new Date().toISOString().slice(0, 10)} className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={dob} onChange={e => setDob(e.target.value)} />
          {dob && ageFromDob(dob) !== null && <p className="text-xs text-gray-400 mt-1">বয়স: {ageFromDob(dob)} বছর</p>}
          <label className="text-sm font-medium mt-3 block">আইডির ধরন</label>
          <select className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={idType} onChange={e => setIdType(e.target.value)}>
            <option value="">— বেছে নিন —</option>
            <option value="NID">জাতীয় পরিচয়পত্র (NID)</option>
            <option value="পাসপোর্ট">পাসপোর্ট</option>
            <option value="জন্ম নিবন্ধন">জন্ম নিবন্ধন</option>
          </select>
          <label className="text-sm font-medium mt-3 block">আইডি নম্বর</label>
          <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="আইডি নম্বর লিখুন" />
          <p className="text-xs text-gray-400 mt-1">🔒 পুরো আইডি নম্বর সংরক্ষণ করা হয় না — শুধু শেষ ৪ সংখ্যা রাখা হয়।</p>
          {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
          <Btn className="w-full mt-4" onClick={submitIdentity}>পরের ধাপ →</Btn>
          <p className="text-xs text-gray-400 mt-3 text-center">ডেমো KYC — আসল যাচাইয়ের জন্য ভেরিফায়েড KYC সার্ভিস লাগবে।</p>
        </div>
      )}
      {step === 2 && (
        <div className="mt-4 text-center">
          <p className="text-sm font-medium">📸 লাইভ সেলফি তুলুন</p>
          <p className="text-xs text-gray-400 mt-1">সামনের ক্যামেরায় আপনার লাইভ ছবি তুলুন — ছবির সাথে সাথে ~৩ সেকেন্ডের একটি লাইভ ভিডিও ক্লিপও রেকর্ড হবে। ছবি ও ভিডিও শুধু অ্যাডমিন যাচাইয়ের জন্য রাখা হয় — অ্যাডমিন আপনার নাম-বয়স-আইডির সাথে ছবি ও ভিডিও মিলিয়ে দেখবেন। অন্য ব্যবহারকারীদের সাথে শেয়ার করা হয় না, কোথাও আপলোডও করা হয় না (ডেমোতে শুধু এই ডিভাইসে থাকে)।</p>
          {!captured && <video ref={videoRef} className="w-full aspect-[3/4] bg-black rounded-xl mt-3 object-cover" autoPlay playsInline muted />}
          {captured && <img src={captured} alt="লাইভ সেলফি" className="w-full aspect-[3/4] object-cover rounded-xl mt-3" />}
          {recording && <p className="text-sm text-red-500 mt-2 font-medium">🎥 লাইভ ভিডিও রেকর্ড হচ্ছে… ~৩ সেকেন্ড অপেক্ষা করুন</p>}
          {videoClip && <div className="mt-3"><p className="text-xs text-gray-400 mb-1">🎥 আপনার লাইভ ভিডিও ক্লিপ (অ্যাডমিন এটাই দেখবেন)</p><video src={videoClip} controls loop muted playsInline className="w-full aspect-[3/4] object-cover rounded-xl bg-black" /></div>}
          {videoNote && <p className="text-xs text-amber-600 mt-2">{videoNote}</p>}
          {camError && <p className="text-sm text-red-500 mt-2">{camError}</p>}
          <div className="flex gap-2 mt-3">
            {!captured && <Btn variant="green" className="flex-1" onClick={captureSelfie}>📸 ছবি তুলুন</Btn>}
            {captured && <Btn variant="ghost" className="flex-1" onClick={() => { cancelRecordRef.current = true; if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop(); setCaptured(null); setVideoClip(null); setVideoNote(''); setRecording(false); setCamKey(k => k + 1) }}>🔄 আবার তুলুন</Btn>}
            <Btn variant="ghost" onClick={() => fileRef.current?.click()}>📁 ছবি আপলোড</Btn>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} />
          <p className="text-xs text-gray-400 mt-2">ক্যামেরা না থাকলে ছবি আপলোড করেও সেলফি দেওয়া যাবে (লাইভ ক্যামেরাই ভালো)।</p>
          <Btn className="w-full mt-4" disabled={!captured || recording} onClick={submitKyc}>📤 KYC জমা দিন (অ্যাডমিন যাচাই করবেন)</Btn>
          <button className="text-sm text-gray-400 mt-3" onClick={() => setStep(1)}>← আগের ধাপে ফিরুন</button>
        </div>
      )}
    </Card></div>
  )
}

// KYC না থাকলে ডেটিংয়ের ভেতরের রুটগুলোতে (সরাসরি লিংকেও) এই স্ক্রিন দেখাবে
function DatingKycBlocked() {
  const navigate = useNavigate()
  const { kycStatus, kycRejectReason } = useStore()
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
        {kycStatus === 'pending' ? (
          <>
            <h1 className="text-xl font-bold">⏳ KYC পর্যালোচনাধীন</h1>
            <p className="text-sm text-gray-300 mt-2">আপনার KYC জমা হয়েছে — অ্যাডমিন দেখে মিলিয়ে অনুমোদন করলে ডেটিং খুলে যাবে। অনুমোদন না হওয়া পর্যন্ত ডেটিংয়ের কিছুই দেখা যাবে না।</p>
            <Btn className="mt-4" onClick={() => navigate('/dating')}>KYC অবস্থা দেখুন</Btn>
          </>
        ) : kycStatus === 'rejected' ? (
          <>
            <h1 className="text-xl font-bold">❌ KYC বাতিল হয়েছে</h1>
            <p className="text-sm text-gray-300 mt-2">অ্যাডমিন আপনার KYC বাতিল করেছেন।</p>
            <p className="text-sm mt-2 bg-red-900 rounded-lg px-3 py-2">বাতিলের কারণ: <b>{kycRejectReason || 'কারণ দেওয়া হয়নি'}</b></p>
            <Btn className="mt-4" onClick={() => navigate('/dating')}>আবার KYC জমা দিন</Btn>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">🔒 KYC ছাড়া ডেটিং ব্যবহার করা যাবে না</h1>
            <p className="text-sm text-gray-300 mt-2">ডেটিংয়ের জন্য প্রথমে একবার KYC (লাইভ পরিচয় যাচাই) করতে হবে। KYC ছাড়া ডেটিংয়ের কিছুই দেখা যাবে না।</p>
            <Btn className="mt-4" onClick={() => navigate('/dating')}>KYC করুন</Btn>
          </>
        )}
      </Card>
    </div>
  )
}

// ---------- Dating 18+ ----------
export function DatingPage() {
  const { likesUsed, useLike, premium, setPremium, coins, addCoins, datingRate, liveRate, liveEarnings, kycVerified } = useStore()
  const navigate = useNavigate()
  // KYC একবার সম্পন্ন হলে আর দেখানো হয় না; সফলতার স্ক্রিনটি দেখানোর জন্য স্থানীয় অবস্থা
  const [kycSuccess, setKycSuccess] = useState(false)
  const [matched, setMatched] = useState<string | null>(null)
  const [matchedId, setMatchedId] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({})
  const [boosted, setBoosted] = useState(false)
  // আসল লাইভ রুম (CallGuru লাইভ সার্ভার) — সার্ভার না পৌঁছালে ডেমো হোস্ট দেখাবে
  const [realRooms, setRealRooms] = useState<LiveRoom[] | null>(null)
  const [liveServerOk, setLiveServerOk] = useState(false)
  function refreshLiveRooms() {
    fetchLiveRooms().then(r => { if (r) { setRealRooms(r); setLiveServerOk(true) } else { setLiveServerOk(false) } })
  }
  useEffect(() => { refreshLiveRooms() }, [])
  // KYC ছাড়া ডেটিংয়ের কিছুই দেখা যাবে না — প্রোফাইল, লাইভ, ম্যাচ, কল — সব বন্ধ
  if (!kycVerified || kycSuccess) {
    return <KycPage onComplete={() => setKycSuccess(true)} onEnter={() => setKycSuccess(false)} />
  }
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-xl font-bold">❤️ ডেটিং ১৮+</h1>
          <span className="text-sm">আজকের ফ্রি লাইক: {premium ? 'আনলিমিটেড (প্রিমিয়াম)' : `${Math.max(0, 30 - likesUsed)}/৩০`} • কয়েন: {coins}</span>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Btn variant={premium ? 'green' : 'primary'} onClick={() => setPremium(!premium)}>{premium ? '✅ প্রিমিয়াম চালু আছে' : 'প্রিমিয়াম নিন — ৳৯৯/মাস'}</Btn>
          <Btn variant="ghost" onClick={() => { if (coins >= 10) { addCoins(-10); setBoosted(true) } else alert('কয়েন যথেষ্ট নয় — টপ-আপ করুন।') }}>🚀 Boost (~৳১০)</Btn>
        </div>
        {boosted && <p className="text-sm text-green-600 mt-2">Boost চালু — আপনার প্রোফাইল বেশি দেখাবে।</p>}
        <p className="text-xs text-gray-400 mt-2">প্রিমিয়াম: আনলিমিটেড লাইক + কে লাইক দিয়েছে দেখুন • ৩ মাস ৳২৪৯ • Super Like ১৫ কয়েন • বেশিরভাগ ফিচার বাংলাদেশি ব্যবহারকারীদের জন্য ফ্রি।</p>
      </Card>
      {/* ---------- ডেটিং লাইভ ---------- */}
      <Card>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-lg font-bold">🔴 ডেটিং লাইভ</h2>
          <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-2 py-1 rounded-full font-bold">LIVE • ১৮+</span>
        </div>
        <p className="text-sm mt-2">লাইভ দেখতে {formatBDT(liveRate)}/মিনিট (প্রিপেইড — শুধু দর্শক দেবে)। লাইভকারী পাবেন <b>৭০%</b>, অ্যাডমিন পাবেন <b>৩০%</b>। কলের রেট থেকে আলাদা — লাইভে টাকা কম কাটে।</p>
        {liveServerOk
          ? <p className="text-xs text-green-600 mt-1">🟢 লাইভ সার্ভার সংযুক্ত — আসল সম্প্রচার</p>
          : <p className="text-xs text-gray-400 mt-1">ডেমো লাইভ — লাইভ সার্ভার সংযুক্ত নয়; এখানে লাইভ ভিডিও ডেমো ডেটা ও নিজের ক্যামেরা প্রিভিউ।</p>}
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          <Btn variant="green" onClick={() => navigate('/dating-go-live')}>📹 লাইভে যান</Btn>
          <Btn variant="ghost" onClick={refreshLiveRooms}>🔄 লাইভ তালিকা রিফ্রেশ</Btn>
          <span className="text-sm">আপনার মোট লাইভ আয়: <b className="text-green-600">{formatBDT(liveEarnings)}</b> (৭০% শেয়ার)</span>
        </div>
        {realRooms && realRooms.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            {realRooms.map(r => (
              <div key={r.id} className="border-2 border-red-400 rounded-xl p-3 dark:border-red-700">
                <div className="flex gap-3 items-center">
                  <span className="w-12 h-12 rounded-full bg-fb-blue text-white text-xl flex items-center justify-center font-bold relative">{r.hostName.slice(0, 1)}
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">LIVE</span>
                  </span>
                  <div><p className="font-bold">{r.hostName}</p><p className="text-xs text-gray-500">👁️ {r.viewers} জন দেখছেন • <span className="text-green-600 font-bold">আসল লাইভ</span></p></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{r.title}</p>
                <Btn variant="green" className="mt-3 w-full" onClick={() => navigate(`/dating-live/${r.id}`)}>👁️ দেখুন (প্রিপেইড {formatBDT(liveRate)}/মিনিট)</Btn>
                <p className="text-[11px] text-gray-400 mt-1 text-center">লাইভকারী পাবেন ৭০% • অ্যাডমিন ৩০%</p>
              </div>
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          {DATING_LIVE_HOSTS.map(h => {
            const p = DATING_PROFILES.find(x => x.id === h.id)!
            return (
              <div key={h.id} className="border rounded-xl p-3 dark:border-slate-600">
                <div className="flex gap-3 items-center">
                  <span className="w-12 h-12 rounded-full text-white text-xl flex items-center justify-center font-bold relative" style={{ background: p.color }}>{p.name.slice(0, 1)}
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">LIVE</span>
                  </span>
                  <div><p className="font-bold">{p.name}, {p.age}</p><p className="text-xs text-gray-500">{p.city} • 👁️ {h.viewers} জন দেখছেন • ডেমো</p></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{p.about}</p>
                <Btn variant="green" className="mt-3 w-full" onClick={() => navigate(`/dating-live/${p.id}`)}>👁️ দেখুন (প্রিপেইড {formatBDT(liveRate)}/মিনিট)</Btn>
                <p className="text-[11px] text-gray-400 mt-1 text-center">লাইভকারী পাবেন ৭০% • অ্যাডমিন ৩০%</p>
              </div>
            )
          })}
        </div>
      </Card>
      {matched && matchedId && <Card className="!bg-pink-50 dark:!bg-pink-900 text-center"><p className="font-bold text-lg">🎉 ম্যাচ হয়েছে — {matched}!</p><p className="text-sm">এখন চ্যাট বা ভিডিও কল করতে পারেন।</p>
        <div className="flex gap-2 mt-3 justify-center flex-wrap">
          <Link to="/chat" className="text-fb-blue text-sm font-medium self-center">চ্যাট শুরু করুন →</Link>
          <Btn variant="green" onClick={() => navigate(`/call/dating/${matchedId}`)}>📹 ভিডিও কল করুন (প্রিপেইড)</Btn>
        </div>
        <p className="text-xs text-gray-500 mt-2">💳 ভিডিও কল প্রিপেইড — {formatBDT(datingRate)}/মিনিট, শুধু কলকারীর টাকা কাটবে। এই কলও অন্যান্য কলের মতো অ্যাডমিন-অনলি রেকর্ডিংয়ের আওতায় থাকে।</p>
      </Card>}
      <div className="grid sm:grid-cols-2 gap-3">
        {DATING_PROFILES.map(p => (
          <Card key={p.id}>
            <div className="flex gap-3 items-center">
              <span className="w-14 h-14 rounded-full text-white text-xl flex items-center justify-center font-bold" style={{ background: p.color }}>{p.name.slice(0, 1)}</span>
              <div><p className="font-bold">{p.name}, {p.age}</p><p className="text-sm text-gray-500">{p.city}</p></div>
            </div>
            <p className="text-sm mt-2">{p.about}</p>
            <div className="flex gap-2 mt-3">
              <Btn disabled={!!likedIds[p.id]} onClick={() => { if (!useLike()) { alert('আজকের ৩০টি ফ্রি লাইক শেষ — প্রিমিয়াম নিন।'); return } setLikedIds(v => ({ ...v, [p.id]: true })); setMatched(p.name); setMatchedId(p.id) }}>❤️ লাইক</Btn>
              <Btn variant="ghost" onClick={() => { if (coins < 15) { alert('Super Like-এর জন্য ১৫ কয়েন লাগবে।'); return } addCoins(-15); setLikedIds(v => ({ ...v, [p.id]: true })); setMatched(p.name); setMatchedId(p.id) }}>⭐ Super Like (১৫ কয়েন)</Btn>
              <Btn variant="ghost" onClick={() => alert('প্রোফাইলটি রিপোর্ট করা হয়েছে — মডারেশন দেখবে।')}>🚩 রিপোর্ট</Btn>
            </div>
            {likedIds[p.id] && <Btn variant="green" className="mt-2 w-full" onClick={() => navigate(`/call/dating/${p.id}`)}>📹 ভিডিও কল করুন (প্রিপেইড {formatBDT(datingRate)}/মিনিট)</Btn>}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ---------- ডেটিং লাইভ ----------
// ডেমো লাইভ হোস্ট — আসল সম্প্রচার নয়; দর্শক সংখ্যাও ডেমো ডেটা
const DATING_LIVE_HOSTS = [
  { id: 'dt-1', viewers: 132 },
  { id: 'dt-3', viewers: 87 },
  { id: 'dt-5', viewers: 208 },
]
const LIVE_CREATOR_SHARE = 0.7 // লাইভকারী পাবেন ৭০%, অ্যাডমিন ৩০% — নির্দিষ্ট ভাগ

function fmtLive(s: number) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

// লাইভ গিফট — শুধু CallGuru কয়েন দিয়ে কেনা যায় (১ কয়েন = ৳১); বাইরে থেকে গিফট কেনা যায় না, ফ্রি গিফট নেই
const LIVE_GIFTS = [
  { icon: '🌹', name: 'গোলাপ', price: 5 },
  { icon: '❤️', name: 'হার্ট', price: 10 },
  { icon: '🎁', name: 'গিফট বক্স', price: 20 },
  { icon: '💎', name: 'ডায়মন্ড', price: 50 },
]

// লাইভ দেখা — প্রিপেইড, প্রতি মিনিটে; শুধু দর্শক দেবে
export function DatingLivePage() {
  const { id } = useParams()
  const { balance, deduct, liveRate, user, coins, addCoins, kycVerified } = useStore()
  const navigate = useNavigate()
  const seedHost = DATING_PROFILES.find(p => p.id === id)
  const seed = DATING_LIVE_HOSTS.find(h => h.id === id)
  // আসল রুম (CallGuru লাইভ সার্ভার) — ডেমো হোস্টের id না মিললে সার্ভারে খুঁজি
  const [realRoom, setRealRoom] = useState<LiveRoom | null>(null)
  const [roomLookupDone, setRoomLookupDone] = useState(false)
  const host = seedHost ?? (realRoom ? { id: realRoom.id, name: realRoom.hostName, age: 0, city: '', about: 'লাইভে আছেন', color: '#E91E63' } : undefined)
  useEffect(() => {
    if (seedHost) { setRoomLookupDone(true); return }
    let alive = true
    fetchLiveRooms().then(rooms => { if (!alive) return; setRealRoom(rooms?.find(x => x.id === id) ?? null); setRoomLookupDone(true) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  const rate = liveRate // লাইভ রেট কলের রেট থেকে আলাদা (ডিফল্ট ৳৫/মিনিট)
  const [started, setStarted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [ended, setEnded] = useState(false)
  const [endReason, setEndReason] = useState('')
  const [chat, setChat] = useState<{ from: string; text: string }[]>([])
  const [chatDraft, setChatDraft] = useState('')
  const [banMsg, setBanMsg] = useState('')
  const [banCount, setBanCount] = useState(0)
  // লাইভ গিফট — কয়েন দিয়ে কেনা, লাইভকারীর আয়ে ৭০% / অ্যাডমিন ৩০% ভাগে যোগ হয়
  const [giftsSent, setGiftsSent] = useState<{ icon: string; name: string; price: number }[]>([])
  const [giftMsg, setGiftMsg] = useState('')
  const [giftCoinsTotal, setGiftCoinsTotal] = useState(0)
  // আসল লাইভ (WebRTC) — সার্ভার না পৌঁছালে ডেমো আচরণই থাকবে
  const remoteRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const viewerIdRef = useRef<string | null>(null)
  const [remoteReady, setRemoteReady] = useState(false)
  const [serverLive, setServerLive] = useState(false)
  const [liveViewers, setLiveViewers] = useState<number | null>(null)
  const [giftFeed, setGiftFeed] = useState<string[]>([])
  const giftCreatorTotal = Math.floor(giftCoinsTotal * LIVE_CREATOR_SHARE)
  const giftAdminTotal = giftCoinsTotal - giftCreatorTotal

  function sendGift(g: { icon: string; name: string; price: number }) {
    if (coins < g.price) { setGiftMsg('কয়েন যথেষ্ট নয় — কয়েন কিনুন'); return }
    addCoins(-g.price)
    setGiftsSent(prev => [...prev, g])
    setGiftCoinsTotal(t => t + g.price)
    setGiftMsg(`🎁 আপনি ${g.icon} ${g.name} পাঠিয়েছেন!`)
    // আসল লাইভে হোস্টকেও গিফটটা জানানো হয়; সার্ভার না থাকলে শুধু লোকালি দেখাবে
    if (realRoom) sendSignal(wsRef.current, { type: 'gift', roomId: realRoom.id, name: user?.name || 'আপনি', gift: g })
  }

  const billedMinutes = Math.ceil(seconds / 60)
  const totalPaid = billedMinutes * rate
  const creatorShare = Math.floor(totalPaid * LIVE_CREATOR_SHARE)
  const adminShare = totalPaid - creatorShare
  const talkableMinutes = Math.floor(balance / rate)
  const maxSeconds = talkableMinutes * 60
  const canStart = balance >= rate

  useEffect(() => {
    if (!started || ended) return
    const t = setInterval(() => setSeconds(s => {
      const next = s + 1
      if (next >= maxSeconds && maxSeconds > 0) { endLive('Auto-cut — ব্যালেন্স শেষ') }
      return next
    }), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, ended, maxSeconds])

  // দর্শক হিসেবে আসল লাইভে যোগ দেওয়া (শুধু আসল রুমের ক্ষেত্রে; ডেমো হোস্টে কিছুই হয় না)
  useEffect(() => {
    if (!started || ended || !realRoom) return
    let cancelled = false
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })
    pc.ontrack = (ev) => {
      const s = ev.streams[0]
      if (s) { if (remoteRef.current) remoteRef.current.srcObject = s; setRemoteReady(true) }
    }
    pc.onicecandidate = (ev) => {
      if (ev.candidate && viewerIdRef.current) {
        sendSignal(wsRef.current, { type: 'ice', roomId: realRoom.id, from: viewerIdRef.current, to: 'host', candidate: ev.candidate.toJSON() })
      }
    }
    const ws = connectLive(realRoom.id, 'viewer', user?.name || 'দর্শক', {
      onOpen: () => { if (!cancelled) setServerLive(true) },
      onClose: () => { if (!cancelled) setServerLive(false) },
      onJoined: (viewerId, viewers) => {
        if (cancelled) return
        viewerIdRef.current = viewerId
        setLiveViewers(viewers)
        pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
          sendSignal(ws, { type: 'offer', roomId: realRoom.id, from: viewerId, sdp: pc.localDescription })
        }).catch(() => { /* ignore */ })
      },
      onAnswer: (_from, sdp) => { pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(() => {}) },
      onIce: (_from, candidate) => { pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {}) },
      onViewerCount: (n) => { if (!cancelled) setLiveViewers(n) },
      onGift: (from, gift) => { if (!cancelled) setGiftFeed(f => [...f.slice(-4), `${from} পাঠিয়েছেন ${gift.icon} ${gift.name}`]) },
      onChat: (from, text) => { if (!cancelled) setChat(c => [...c, { from, text }]) },
      onHostLeft: () => { if (!cancelled) endLive('হোস্ট লাইভ শেষ করেছেন') },
    })
    wsRef.current = ws
    return () => {
      cancelled = true
      try { pc.close() } catch { /* ignore */ }
      try { ws?.close() } catch { /* ignore */ }
      pcRef.current = null; wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, ended, realRoom])

  function endLive(reason: string) {
    if (ended) return
    setEnded(true); setEndReason(reason || 'লাইভ দেখা শেষ')
    const cost = Math.ceil(seconds / 60) * rate
    if (cost > 0) deduct(cost)
  }

  function sendChat() {
    const err = contactBanCheck(chatDraft)
    if (err) { setBanMsg(err + ` (চেষ্টা ${banCount + 1} — অ্যাডমিন লগে সংরক্ষিত)`); setBanCount(c => c + 1); return }
    if (!chatDraft.trim()) return
    const text = chatDraft
    setChat(c => [...c, { from: user?.name || 'আপনি', text }]); setChatDraft(''); setBanMsg('')
    if (realRoom) sendSignal(wsRef.current, { type: 'chat', roomId: realRoom.id, name: user?.name || 'আপনি', text })
  }

  // KYC ছাড়া সরাসরি লিংকেও ডেটিং লাইভ দেখা যাবে না
  if (!kycVerified) {
    return <DatingKycBlocked />
  }

  if (!roomLookupDone) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">লাইভ খুঁজছি…</h1>
        </Card>
      </div>
    )
  }

  if (!host) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">লাইভটি পাওয়া যায়নি</h1>
          <Btn className="mt-4" onClick={() => navigate('/dating')}>ডেটিংয়ে ফিরুন</Btn>
        </Card>
      </div>
    )
  }

  if (ended) {
    const cost = Math.ceil(seconds / 60) * rate
    const creator = Math.floor(cost * LIVE_CREATOR_SHARE)
    const admin = cost - creator
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">লাইভ দেখা শেষ হয়েছে</h1>
          <p className="mt-2">{host.name} • {fmtLive(seconds)}</p>
          <div className="mt-3 space-y-1 text-sm text-left">
            <p>দেখেছেন: <b>{billedMinutes} মিনিট</b></p>
            <p>মোট দিয়েছেন: <b>{formatBDT(cost)}</b></p>
            <p>লাইভকারী পাবেন (৭০%): <b className="text-green-400">{formatBDT(creator)}</b></p>
            <p>অ্যাডমিন পাবেন (৩০%): <b>{formatBDT(admin)}</b></p>
            {giftCoinsTotal > 0 && <>
              <p>গিফট পাঠিয়েছেন: <b>{giftsSent.length}টি • {giftCoinsTotal} কয়েন</b></p>
              <p>গিফট থেকে লাইভকারী পাবেন (৭০%): <b className="text-green-400">{formatBDT(giftCreatorTotal)}</b> • অ্যাডমিন (৩০%): <b>{formatBDT(giftAdminTotal)}</b></p>
            </>}
            <p>বর্তমান ব্যালেন্স: <b>{formatBDT(balance - cost < 0 ? 0 : balance - cost)}</b></p>
          </div>
          <p className="text-sm text-gray-300 mt-2">{endReason}</p>
          <div className="flex gap-2 mt-5 justify-center">
            <Btn variant="green" onClick={() => navigate('/dating')}>ডেটিংয়ে ফিরুন</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>💰 টপ-আপ</Btn>
          </div>
        </Card>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <span className="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">🔴 LIVE</span>
          <h1 className="text-xl font-bold mt-3">{host.name} লাইভে আছেন</h1>
          <p className="text-sm text-gray-300">{realRoom ? `👁️ ${liveViewers ?? realRoom.viewers} জন দেখছেন • আসল লাইভ` : `${host.age} • ${host.city} • 👁️ ${seed?.viewers ?? 50} জন দেখছেন`}</p>
          <p className="text-sm mt-2">{host.about}</p>
          <div className="mt-4 space-y-1 text-sm text-left">
            <p>দেখার রেট: <b>{formatBDT(rate)}/মিনিট</b> (প্রিপেইড — শুধু আপনি দেবেন)</p>
            <p>লাইভকারী পাবেন <b>৭০%</b> • অ্যাডমিন পাবেন <b>৩০%</b></p>
            <p>ব্যালেন্স: <b>{formatBDT(balance)}</b> • দেখা যাবে: <b>~{talkableMinutes} মিনিট</b></p>
            <p>ব্যালেন্স শেষ হলে লাইভ নিজে থেকেই বন্ধ হবে।</p>
            <p>আপনার কয়েন: <b>🪙 {coins}</b> — লাইভে গিফট পাঠাতে CallGuru কয়েন লাগবে।</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">🔴 এই লাইভটিও অ্যাডমিন-অনলি রেকর্ডিংয়ের আওতায় থাকে — শুধু আপিল/বিরোধের ক্ষেত্রে অ্যাডমিন দেখতে পারে। {realRoom ? '🟢 লাইভ সার্ভার সংযুক্ত — আসল সম্প্রচার।' : 'ডেমো লাইভ — আসল সম্প্রচারের জন্য লাইভ সার্ভার লাগবে।'}</p>
          {!canStart && <p className="mt-3 bg-red-600 rounded-lg px-3 py-2 text-sm font-medium">⚠️ টপ-আপ ছাড়া লাইভ দেখা যাবে না। প্রিপেইড — আগে টপ-আপ করুন।</p>}
          <div className="flex gap-2 mt-5">
            <Btn variant="green" className="flex-1" disabled={!canStart} onClick={() => setStarted(true)}>▶️ লাইভ দেখা শুরু করুন</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>💰 টপ-আপ</Btn>
          </div>
          <button className="text-sm text-gray-300 mt-3" onClick={() => navigate('/dating')}>← ডেটিংয়ে ফিরুন</button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative">
      {/* small red dot only — no "Recording" text by design; recording is admin-only for appeals */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" title="Admin-only recording indicator" />
        <span className="text-xs bg-black/50 px-2 py-1 rounded-full">{fmtLive(seconds)} • {formatBDT(totalPaid)}</span>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <div className="text-center px-4 w-full max-w-lg">
          <span className="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">🔴 LIVE</span>
          <video ref={remoteRef} className={`w-full aspect-video bg-black rounded-xl mt-3 ${remoteReady ? '' : 'hidden'}`} autoPlay playsInline />
          {!remoteReady && <span className="w-28 h-28 rounded-full text-white text-4xl flex items-center justify-center font-bold mx-auto mt-3" style={{ background: host.color }}>{host.name.slice(0, 1)}</span>}
          <p className="text-xl font-bold mt-3">{host.name} লাইভে</p>
          <p className="text-gray-300 text-sm">👁️ {realRoom ? (liveViewers ?? realRoom.viewers) : (seed?.viewers ?? 50)} জন দেখছেন • {fmtLive(seconds)}</p>
          <div className="mt-3 text-sm space-y-1">
            <p>আপনি দিয়েছেন: <b>{formatBDT(totalPaid)}</b> ({billedMinutes} মিনিট)</p>
            <p>লাইভকারী পাবেন (৭০%): <b className="text-green-400">{formatBDT(creatorShare)}</b> • অ্যাডমিন (৩০%): <b>{formatBDT(adminShare)}</b></p>
          </div>
          {giftFeed.length > 0 && <p className="text-xs text-yellow-200 mt-2">{giftFeed.join(' • ')}</p>}
          <p className="text-xs text-gray-400 mt-2">{serverLive ? '🟢 লাইভ সার্ভার সংযুক্ত — আসল সম্প্রচার।' : 'ডেমো লাইভ — হোস্টের আসল ভিডিও স্ট্রিম এখানে দেখানো হচ্ছে না।'}</p>
        </div>
      </div>
      <div className="px-3 pb-3">
        <div className="max-w-md mx-auto bg-black/40 rounded-xl p-2 mb-3 max-h-32 overflow-y-auto">
          {chat.length === 0 && <p className="text-xs text-gray-300 text-center">লাইভ চ্যাট — নম্বর/লিংক/ইমেইল শেয়ার ব্লক করা আছে।</p>}
          {chat.map((m, i) => <p key={i} className="text-sm"><b>{m.from}:</b> {m.text}</p>)}
        </div>
        {banMsg && <p className="text-xs text-red-300 text-center mb-2">{banMsg}</p>}
        <div className="flex gap-2 max-w-md mx-auto mb-4">
          <input className="flex-1 rounded-full px-3 py-2 text-sm text-black" placeholder="লাইভে মেসেজ লিখুন…" value={chatDraft} onChange={e => setChatDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
          <Btn onClick={sendChat}>পাঠান</Btn>
        </div>
        <div className="max-w-md mx-auto bg-black/40 rounded-xl p-2 mb-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-bold">🎁 গিফট পাঠান</p>
            <span className="text-xs">🪙 আপনার কয়েন: <b>{coins}</b></span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">গিফট শুধু CallGuru কয়েন দিয়েই কিনতে হয় (১ কয়েন = ৳১) — বাইরে থেকে গিফট কেনা যায় না, ফ্রি গিফট নেই। গিফটের ৭০% লাইভকারী পাবেন, ৩০% অ্যাডমিন পাবে।</p>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {LIVE_GIFTS.map(g => (
              <button key={g.name} onClick={() => sendGift(g)} className="bg-slate-700 hover:bg-slate-600 rounded-lg py-2 px-1 text-center">
                <span className="text-2xl block">{g.icon}</span>
                <span className="text-xs block">{g.name}</span>
                <span className="text-[11px] text-yellow-300 font-bold">{g.price} কয়েন</span>
              </button>
            ))}
          </div>
          {giftMsg && <p className="text-xs text-yellow-200 text-center mt-2">{giftMsg}</p>}
          {giftMsg === 'কয়েন যথেষ্ট নয় — কয়েন কিনুন' && <div className="text-center mt-1"><Btn variant="green" onClick={() => navigate('/wallet')}>🪙 কয়েন কিনুন</Btn></div>}
          {giftsSent.length > 0 && <p className="text-xs text-gray-300 text-center mt-2">পাঠানো গিফট: {giftsSent.map(g => g.icon).join(' ')} • লাইভকারী গিফট থেকে পেয়েছেন {formatBDT(giftCreatorTotal)} (৭০%)</p>}
        </div>
        <div className="flex justify-center pb-2">
          <button onClick={() => endLive('আপনি লাইভ দেখা শেষ করেছেন')} className="px-6 h-14 rounded-full bg-red-600 text-lg font-bold" title="লাইভ ছাড়ুন">❌ লাইভ ছাড়ুন</button>
        </div>
        <p className="text-center text-xs text-gray-400">ব্যালেন্স শেষ হলে লাইভ অটো-বন্ধ হবে • সর্বোচ্চ {fmtLive(maxSeconds)}</p>
      </div>
    </div>
  )
}

// নিজে লাইভে যাওয়া — হোস্টের আয় প্রতি মিনিটে রেটের ৭০%
export function DatingGoLivePage() {
  const { user, liveRate, liveEarnings, addLiveEarnings, kycVerified } = useStore()
  const navigate = useNavigate()
  const rate = liveRate // লাইভ রেট কলের রেট থেকে আলাদা (ডিফল্ট ৳৫/মিনিট)
  const [started, setStarted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [viewers, setViewers] = useState(14)
  const [peakViewers, setPeakViewers] = useState(14)
  const [ended, setEnded] = useState(false)
  const [endMyShare, setEndMyShare] = useState(0)
  const [endGross, setEndGross] = useState(0)
  const [endSeconds, setEndSeconds] = useState(0)
  const [endPeak, setEndPeak] = useState(0)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [camCount, setCamCount] = useState<number | null>(null)
  const [switching, setSwitching] = useState(false)
  const [camError, setCamError] = useState('')
  const facingRef = useRef<'user' | 'environment'>('user')
  const streamRef = useRef<MediaStream | null>(null)
  const selfRef = useRef<HTMLVideoElement>(null)
  function setFacingBoth(f: 'user' | 'environment') { facingRef.current = f; setFacing(f) }
  // আসল লাইভ সার্ভার (WebRTC হোস্ট) — সার্ভার না পৌঁছালে ডেমো আচরণই থাকবে
  const wsRef = useRef<WebSocket | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const roomIdRef = useRef<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [serverLive, setServerLive] = useState(false)
  const [giftCoinsReceived, setGiftCoinsReceived] = useState(0)
  const [giftFeed, setGiftFeed] = useState<string[]>([])
  const [hostChat, setHostChat] = useState<{ from: string; text: string }[]>([])

  const billedMinutes = Math.ceil(seconds / 60)
  const gross = billedMinutes * rate
  const myShare = Math.floor(gross * LIVE_CREATOR_SHARE)
  const adminShare = gross - myShare
  const giftMyShare = Math.floor(giftCoinsReceived * LIVE_CREATOR_SHARE)

  function teardownHostLive() {
    pcsRef.current.forEach(pc => { try { pc.close() } catch { /* ignore */ } })
    pcsRef.current.clear()
    try { wsRef.current?.close() } catch { /* ignore */ }
    wsRef.current = null
    if (roomIdRef.current) { const rid = roomIdRef.current; roomIdRef.current = null; setRoomId(null); endLiveRoom(rid) }
    setServerLive(false)
  }

  // ক্যামেরা চালু হওয়ার পর লাইভ রুম খুলে সিগন্যালিংয়ে হোস্ট হিসেবে যোগ দেওয়া
  async function setupHostLive(stream: MediaStream) {
    const room = await createLiveRoom(user?.name || 'আপনি', 'ডেটিং লাইভ')
    if (!room) { setServerLive(false); return } // ডেমো ফলব্যাক — রুম ছাড়াই লাইভ চলবে
    roomIdRef.current = room.id
    setRoomId(room.id)
    const ws = connectLive(room.id, 'host', user?.name || 'আপনি', {
      onOpen: () => setServerLive(true),
      onClose: () => setServerLive(false),
      onOffer: async (from, sdp) => {
        const pc = new RTCPeerConnection(ICE_SERVERS)
        pcsRef.current.set(from, pc)
        stream.getTracks().forEach(t => pc.addTrack(t, stream))
        pc.onicecandidate = (ev) => {
          if (ev.candidate) sendSignal(ws, { type: 'ice', roomId: room.id, to: from, candidate: ev.candidate.toJSON() })
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendSignal(ws, { type: 'answer', roomId: room.id, to: from, sdp: answer })
        } catch { /* ignore */ }
      },
      onIce: (from, candidate) => { pcsRef.current.get(from)?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {}) },
      onViewerCount: (n) => { setViewers(n); setPeakViewers(p => Math.max(p, n)) },
      onGift: (from, gift) => {
        setGiftCoinsReceived(c => c + gift.price)
        setGiftFeed(f => [...f.slice(-4), `${from} পাঠিয়েছেন ${gift.icon} ${gift.name}`])
      },
      onChat: (from, text) => { setHostChat(c => [...c.slice(-19), { from, text }]) },
    })
    wsRef.current = ws
  }

  useEffect(() => {
    if (!started || ended) return
    const t = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [started, ended])

  // ডেমো দর্শক সংখ্যা — আসল দর্শক নয়; সার্ভার সংযুক্ত থাকলে আসল সংখ্যাই আসবে
  useEffect(() => {
    if (!started || ended || serverLive) return
    const t = setInterval(() => {
      setViewers(v => {
        const next = Math.max(3, v + Math.floor(Math.random() * 6) - 2)
        setPeakViewers(p => Math.max(p, next))
        return next
      })
    }, 4000)
    return () => clearInterval(t)
  }, [started, ended, serverLive])

  useEffect(() => {
    if (!started) return
    let cancelled = false
    navigator.mediaDevices?.enumerateDevices?.().then(devices => {
      if (!cancelled) setCamCount(devices.filter(d => d.kind === 'videoinput').length)
    }).catch(() => { /* ignore */ })
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: facingRef.current }, audio: true }).then(s => {
      if (cancelled) { s.getTracks().forEach(t => t.stop()); return }
      streamRef.current = s
      if (selfRef.current) selfRef.current.srcObject = s
      setupHostLive(s)
    }).catch(() => { /* camera unavailable in demo — placeholder stays */ })
    return () => { cancelled = true; teardownHostLive(); streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }, [started])

  async function switchCamera() {
    if (switching || camCount === 1) return
    const next = facingRef.current === 'user' ? 'environment' : 'user'
    setSwitching(true); setCamError('')
    let newStream: MediaStream | null = null
    try {
      newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next } }, audio: false })
    } catch {
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false })
      } catch {
        setCamError('এই ক্যামেরাটা চালু করা যায়নি — আগের ক্যামেরাতেই থাকলো।')
        setSwitching(false)
        return
      }
    }
    const oldAudio = streamRef.current?.getAudioTracks() ?? []
    streamRef.current?.getVideoTracks().forEach(t => t.stop())
    const combined = new MediaStream([...newStream.getVideoTracks(), ...oldAudio])
    streamRef.current = combined
    if (selfRef.current) selfRef.current.srcObject = combined
    // হোস্টের সব দর্শকের পিয়ার কানেকশনেও নতুন ক্যামেরা ট্র্যাক পাঠানো হয়
    const newVideo = combined.getVideoTracks()[0]
    if (newVideo) {
      pcsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(newVideo).catch(() => { /* ignore */ })
      })
    }
    setFacingBoth(next)
    navigator.mediaDevices?.enumerateDevices?.().then(devices => {
      setCamCount(devices.filter(d => d.kind === 'videoinput').length)
    }).catch(() => { /* ignore */ })
    setSwitching(false)
  }

  function endGoLive() {
    if (ended) return
    const grossFinal = Math.ceil(seconds / 60) * rate
    const myFinal = Math.floor(grossFinal * LIVE_CREATOR_SHARE) + Math.floor(giftCoinsReceived * LIVE_CREATOR_SHARE)
    if (myFinal > 0) addLiveEarnings(myFinal)
    setEndGross(grossFinal + giftCoinsReceived); setEndMyShare(myFinal); setEndSeconds(seconds); setEndPeak(peakViewers)
    setEnded(true)
    teardownHostLive()
  }

  // KYC ছাড়া সরাসরি লিংকেও লাইভে যাওয়া যাবে না
  if (!kycVerified) {
    return <DatingKycBlocked />
  }

  if (ended) {
    const adminFinal = endGross - endMyShare
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">আপনার লাইভ শেষ হয়েছে</h1>
          <p className="mt-2">{fmtLive(endSeconds)} • সর্বোচ্চ {endPeak} জন দর্শক</p>
          <div className="mt-3 space-y-1 text-sm text-left">
            <p>মোট আয় (দর্শকরা দিয়েছেন): <b>{formatBDT(endGross)}</b></p>
            <p>আপনার শেয়ার (৭০%): <b className="text-green-400">{formatBDT(endMyShare)}</b></p>
            <p>অ্যাডমিনের শেয়ার (৩০%): <b>{formatBDT(adminFinal)}</b></p>
            <p>আপনার মোট লাইভ আয় (সব লাইভ মিলিয়ে): <b>{formatBDT(liveEarnings)}</b></p>
          </div>
          <div className="flex gap-2 mt-5 justify-center">
            <Btn variant="green" onClick={() => navigate('/dating')}>ডেটিংয়ে ফিরুন</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>💰 ওয়ালেট</Btn>
          </div>
        </Card>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <span className="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">📹 লাইভে যান</span>
          <h1 className="text-xl font-bold mt-3">নিজে লাইভে যান</h1>
          <p className="text-sm text-gray-300 mt-1">{user?.name || 'আপনি'} • ডেটিং লাইভ (১৮+)</p>
          <div className="mt-4 space-y-1 text-sm text-left">
            <p>দর্শক দেবে: <b>{formatBDT(rate)}/মিনিট</b> (প্রিপেইড)</p>
            <p>আপনি পাবেন <b>৭০%</b> • অ্যাডমিন পাবেন <b>৩০%</b></p>
            <p>দর্শকরা আপনাকে কয়েন দিয়ে গিফটও পাঠাতে পারবে (গিফটেরও ৭০% আপনার)।</p>
            <p>আপনার মোট লাইভ আয় এ পর্যন্ত: <b className="text-green-400">{formatBDT(liveEarnings)}</b></p>
          </div>
          <div className="mt-4 text-left">
            <p className="text-sm text-gray-300 mb-2">📷 কোন ক্যামেরা দিয়ে শুরু করবেন?</p>
            <div className="flex gap-2">
              <button onClick={() => setFacingBoth('user')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${facing === 'user' ? 'bg-fb-blue text-white' : 'bg-slate-700 text-white'}`}>🤳 সামনের ক্যামেরা</button>
              <button onClick={() => setFacingBoth('environment')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${facing === 'environment' ? 'bg-fb-blue text-white' : 'bg-slate-700 text-white'}`}>📷 পেছনের ক্যামেরা</button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">🔴 লাইভটি অ্যাডমিন-অনলি রেকর্ডিংয়ের আওতায় থাকে — শুধু আপিল/বিরোধের ক্ষেত্রে অ্যাডমিন দেখতে পারে। লাইভ শুরু হলে CallGuru লাইভ সার্ভারে আসল সম্প্রচার হবে; সার্ভার না পৌঁছালে ডেমো লাইভ চলবে।</p>
          <div className="flex gap-2 mt-5">
            <Btn variant="green" className="flex-1" onClick={() => setStarted(true)}>🔴 লাইভ শুরু করুন</Btn>
          </div>
          <button className="text-sm text-gray-300 mt-3" onClick={() => navigate('/dating')}>← ডেটিংয়ে ফিরুন</button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative">
      {/* small red dot only — no "Recording" text by design; recording is admin-only for appeals */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" title="Admin-only recording indicator" />
        <span className="text-xs bg-black/50 px-2 py-1 rounded-full">🔴 LIVE • {fmtLive(seconds)}</span>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <video ref={selfRef} className="absolute inset-0 w-full h-full object-cover bg-slate-700" style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined} autoPlay playsInline muted />
        <div className="relative text-center px-4">
          <span className="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">🔴 LIVE</span>
          <p className="text-xl font-bold mt-3">{user?.name || 'আপনি'} লাইভে</p>
          <p className="text-gray-200 text-sm">👁️ {viewers} জন দেখছেন • {fmtLive(seconds)}</p>
          <div className="mt-3 text-sm space-y-1 bg-black/50 rounded-xl px-4 py-2">
            <p>মোট আয়: <b>{formatBDT(gross + giftCoinsReceived)}</b> ({billedMinutes} মিনিট{giftCoinsReceived > 0 ? ` + ${giftCoinsReceived} কয়েন গিফট` : ''})</p>
            <p>আপনার শেয়ার (৭০%): <b className="text-green-400">{formatBDT(myShare + giftMyShare)}</b> • অ্যাডমিন (৩০%): <b>{formatBDT(adminShare + (giftCoinsReceived - giftMyShare))}</b></p>
          </div>
          {giftFeed.length > 0 && <p className="text-xs text-yellow-200 mt-2">{giftFeed.join(' • ')}</p>}
          {hostChat.length > 0 && <div className="text-xs text-left mt-2 bg-black/50 rounded-xl px-3 py-2 max-h-20 overflow-y-auto">{hostChat.map((m, i) => <p key={i}><b>{m.from}:</b> {m.text}</p>)}</div>}
          <p className="text-xs text-gray-300 mt-2">{serverLive ? '🟢 লাইভ সার্ভার সংযুক্ত — আসল সম্প্রচার।' : 'ডেমো লাইভ — দর্শক সংখ্যা ডেমো ডেটা।'}</p>
        </div>
      </div>
      <div className="px-3 pb-4 relative">
        {camError && <p className="text-xs text-red-300 text-center mb-2">{camError}</p>}
        {camCount === 1 && <p className="text-xs text-gray-400 text-center mb-2">এই ডিভাইসে ১টি ক্যামেরা পাওয়া গেছে — ক্যামেরা বদলানো যাবে না।</p>}
        <div className="flex justify-center gap-3 pb-2">
          <button onClick={switchCamera} disabled={switching || camCount === 1} className="w-14 h-14 rounded-full bg-slate-700 text-2xl disabled:opacity-40" title="ক্যামেরা বদলান">🔄</button>
          <button onClick={endGoLive} className="px-6 h-14 rounded-full bg-red-600 text-lg font-bold" title="লাইভ শেষ করুন">❌ লাইভ শেষ করুন</button>
        </div>
        <p className="text-center text-xs text-gray-400">🔄 বোতামে সামনে ↔ পেছনে ক্যামেরা বদলানো যাবে</p>
      </div>
    </div>
  )
}

// ---------- Live TV (HLS + official link only, zero external video links) ----------
export function LiveTV() {
  const [cat, setCat] = useState('All')
  const [current, setCurrent] = useState(TV_CHANNELS[0])
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(current.streamUrl); hls.attachMedia(video)
      return () => hls.destroy()
    }
    video.src = current.streamUrl
  }, [current])
  const list = TV_CHANNELS.filter(c => cat === 'All' || c.category === cat)
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold">📺 লাইভ টিভি — বিজ্ঞাপনসহ ফ্রি</h1>
      <Card>
        <video ref={videoRef} controls autoPlay muted playsInline className="w-full aspect-video bg-black rounded-lg" />
        <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
          <div><p className="font-bold">{current.name}</p><p className="text-xs text-gray-400">{current.category} • ইন-অ্যাপ HLS প্লেয়ার</p></div>
          <a className="text-fb-blue text-sm font-medium" href={current.officialUrl} target="_blank" rel="noreferrer">অফিসিয়াল সোর্স →</a>
        </div>
        <p className="text-xs text-gray-400 mt-2">কোনো চ্যানেল না চললে শুধু অফিসিয়াল সোর্স লিংক দেখানো হয়।</p>
      </Card>
      <div className="flex gap-2 flex-wrap">{TV_CATEGORIES.map(c => <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-sm ${cat === c ? 'bg-fb-blue text-white' : 'bg-white dark:bg-fb-card'}`}>{c}</button>)}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {list.map(ch => (
          <button key={ch.id} onClick={() => setCurrent(ch)} className={`text-left rounded-xl p-4 shadow-sm ${current.id === ch.id ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-fb-blue' : 'bg-white dark:bg-fb-card'}`}>
            <p className="font-bold">📺 {ch.name}</p><p className="text-xs text-gray-400">{ch.category}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- Home services / Groups / Reels / Ads / Admin / Menu ----------
export function ServicesPage() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">🏠 হোম সার্ভিস</h1>
      {SERVICES.filter(s => s.category === 'হোম সার্ভিস').map(s => (
        <Card key={s.id}><div className="flex justify-between"><div><p className="font-bold">{s.title}</p><p className="text-sm text-gray-500">{s.provider} • ⭐ {s.rating}</p><p className="text-sm mt-1">{s.desc}</p></div><span className="font-bold text-fb-blue whitespace-nowrap">{formatBDT(s.price)}</span></div>
          <Btn className="mt-3" onClick={() => alert('ডেমো: বুকিং পেন্ডিং — টিম কল করে নিশ্চিত করবে।')}>বুক করুন</Btn></Card>
      ))}
      <Card><p className="text-sm">সার্ভিস প্রোভাইডার হতে চান? <Link className="text-fb-blue" to="/create-service">সার্ভিস তৈরি করুন</Link> — প্রতিটি বুকিংয়ে প্ল্যাটফর্ম কমিশন প্রযোজ্য।</p></Card>
    </div>
  )
}

export function GroupsPage() {
  const [joined, setJoined] = useState<Record<string, boolean>>({})
  const groups = [
    { id: 'g1', name: 'IELTS প্রস্তুতি', members: '১২,৪০০', type: 'গ্রুপ' },
    { id: 'g2', name: 'ফ্রিল্যান্সার বাংলাদেশ', members: '৮,৯০০', type: 'গ্রুপ' },
    { id: 'g3', name: 'CallGuru এক্সপার্ট', members: '৩,২০০', type: 'পেজ' },
    { id: 'g4', name: 'ঢাকা হোম সার্ভিস', members: '৫,৬০০', type: 'পেজ' }
  ]
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">👥 গ্রুপ ও পেজ</h1>
      {groups.map(g => (
        <Card key={g.id}><div className="flex justify-between items-center"><div><p className="font-bold">{g.name}</p><p className="text-sm text-gray-500">{g.type} • {g.members} সদস্য</p></div>
          <Btn variant={joined[g.id] ? 'ghost' : 'primary'} onClick={() => setJoined(v => ({ ...v, [g.id]: !v[g.id] }))}>{joined[g.id] ? 'Joined ✓' : 'Join'}</Btn></div></Card>
      ))}
    </div>
  )
}

export function ReelsPage() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">🎬 রিলস ও মনিটাইজেশন</h1>
      <div className="grid grid-cols-2 gap-3">
        {REELS.map(r => (
          <Card key={r.id}><div className="text-4xl">🎬</div><p className="font-bold mt-2">{r.title}</p><p className="text-sm text-gray-500">{r.views} ভিউ • {r.creator}</p></Card>
        ))}
      </div>
      <Card><h2 className="font-bold">ক্রিয়েটর মনিটাইজেশন</h2><p className="text-sm mt-1">রিলস, লাইভ ক্লাস ও প্রিমিয়াম কনটেন্ট থেকে আয় করুন। ভিউ, গিফট ও সাবস্ক্রিপশন থেকে ক্রিয়েটর পান শেয়ার — বিস্তারিত অ্যাডমিন রেভিনিউ প্যানেলে।</p></Card>
    </div>
  )
}

export function AdsPage() {
  const [budget, setBudget] = useState(1000)
  const [done, setDone] = useState(false)
  return (
    <div className="max-w-lg mx-auto"><Card>
      <h1 className="text-xl font-bold">📢 সেলফ-সার্ভ বিজ্ঞাপন</h1>
      <p className="text-sm text-gray-500 mt-1">নিজেই বিজ্ঞাপন তৈরি করুন — ফিড, রিলস ও লাইভ টিভিতে দেখাবে।</p>
      <label className="text-sm block mt-3">বিজ্ঞাপনের শিরোনাম</label>
      <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" placeholder="যেমন: আমার দোকানের অফার" />
      <label className="text-sm block mt-3">দৈনিক বাজেট (৳)</label>
      <input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={budget} onChange={e => setBudget(Number(e.target.value))} />
      <p className="text-sm mt-2">আনুমানিক রিচ: ~{(budget * 10).toLocaleString('en-IN')} জন/দিন</p>
      <Btn className="w-full mt-4" onClick={() => setDone(true)}>বিজ্ঞাপন জমা দিন</Btn>
      {done && <p className="text-sm text-green-600 mt-2">✅ বিজ্ঞাপনটি রিভিউয়ের জন্য জমা হয়েছে।</p>}
    </Card></div>
  )
}

export function AdminPage() {
  const { datingRate, setDatingRate, liveRate, setLiveRate, kycInfo, kycStatus, kycRejectReason, approveKyc, rejectKyc } = useStore()
  const [tab, setTab] = useState('revenue')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  // অ্যাডমিন লাইভ মনিটরিং — ডেটিং পেজের মতো একই সার্ভার থেকে (GET /api/live) চলমান লাইভের তালিকা
  const [adminRooms, setAdminRooms] = useState<LiveRoom[] | null>(null)
  const [adminLiveOk, setAdminLiveOk] = useState(false)
  function refreshAdminRooms() {
    fetchLiveRooms().then(r => { if (r) { setAdminRooms(r); setAdminLiveOk(true) } else { setAdminLiveOk(false) } })
  }
  useEffect(() => { if (tab === 'kyc') refreshAdminRooms() }, [tab])
  const [rate, setRate] = useState(20)
  const [mins, setMins] = useState(10)
  const [price, setPrice] = useState(10)
  const [datingRateInput, setDatingRateInput] = useState(String(datingRate))
  const [datingRateMsg, setDatingRateMsg] = useState('')
  const [datingRateErr, setDatingRateErr] = useState('')
  function saveDatingRate() {
    const n = Math.floor(Number(datingRateInput))
    if (!Number.isFinite(n) || n < 1) { setDatingRateErr('রেট কমপক্ষে ৳১/মিনিট হতে হবে (শুধু পূর্ণ টাকা)।'); setDatingRateMsg(''); return }
    setDatingRate(n); setDatingRateErr('')
    setDatingRateMsg(`✅ ডেটিং কল রেট ${formatBDT(n)}/মিনিট সংরক্ষিত হয়েছে।`)
  }
  // ডেটিং লাইভ রেট — কলের রেট থেকে সম্পূর্ণ আলাদা; লাইভে টাকা কম কাটবে (ডিফল্ট ৳৫/মিনিট)
  const [liveRateInput, setLiveRateInput] = useState(String(liveRate))
  const [liveRateMsg, setLiveRateMsg] = useState('')
  const [liveRateErr, setLiveRateErr] = useState('')
  function saveLiveRate() {
    const n = Math.floor(Number(liveRateInput))
    if (!Number.isFinite(n) || n < 1) { setLiveRateErr('রেট কমপক্ষে ৳১/মিনিট হতে হবে (শুধু পূর্ণ টাকা)।'); setLiveRateMsg(''); return }
    setLiveRate(n); setLiveRateErr('')
    setLiveRateMsg(`✅ ডেটিং লাইভ রেট ${formatBDT(n)}/মিনিট সংরক্ষিত হয়েছে।`)
  }
  const [tvName, setTvName] = useState('')
  const [tvUrl, setTvUrl] = useState('')
  const [tvAdded, setTvAdded] = useState(false)
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold">🛡️ অ্যাডমিন প্যানেল</h1>
      <div className="flex gap-2 flex-wrap">{['revenue', 'users', 'kyc', 'recordings', 'livetv', 'moderation'].map(t => <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-sm capitalize ${tab === t ? 'bg-fb-blue text-white' : 'bg-white dark:bg-fb-card'}`}>{t === 'kyc' ? 'KYC যাচাই' : t}</button>)}</div>
      {tab === 'revenue' && <Card>
        <h2 className="font-bold">রেভিনিউ ও ফি ক্যালকুলেটর</h2>
        <label className="text-sm block mt-3">কমিশন %</label><input type="number" className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={rate} onChange={e => setRate(Number(e.target.value))} />
        <label className="text-sm block mt-2">কল রেট (৳/মিনিট)</label><input type="number" className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={price} onChange={e => setPrice(Number(e.target.value))} />
        <label className="text-sm block mt-2">মিনিট</label><input type="number" className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={mins} onChange={e => setMins(Number(e.target.value))} />
        <p className="mt-3 text-sm">মোট: <b>{formatBDT(price * mins)}</b> • প্ল্যাটফর্ম ({rate}%): <b>{formatBDT(price * mins * rate / 100)}</b> • এক্সপার্ট পাবেন: <b>{formatBDT(price * mins * (100 - rate) / 100)}</b></p>
        <p className="text-xs text-gray-400 mt-1">উদাহরণ: ৳১০/মিনিট × ১০ মিনিট = ৳১০০, ২০% কমিশনে প্ল্যাটফর্ম পায় ৳২০, এক্সপার্ট পান ৳৮০।</p>
        <h3 className="font-bold mt-5">ডেটিং কল রেট</h3>
        <label className="text-sm block mt-2">ডেটিং কল রেট (৳/মিনিট)</label>
        <div className="flex gap-2 items-center flex-wrap mt-1">
          <input type="number" min={1} step={1} className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={datingRateInput} onChange={e => { setDatingRateInput(e.target.value); setDatingRateMsg(''); setDatingRateErr('') }} />
          <Btn onClick={saveDatingRate}>সংরক্ষণ করুন</Btn>
        </div>
        <p className="text-xs text-gray-400 mt-1">বর্তমানে সংরক্ষিত: <b>{formatBDT(datingRate)}/মিনিট</b> • সর্বনিম্ন ৳১/মিনিট, শুধু পূর্ণ টাকা। বন্ধুর কলের রেট ৳১০/মিনিট ফ্ল্যাট — এটা বদলাবে না।</p>
        {datingRateMsg && <p className="text-sm text-green-600 mt-2">{datingRateMsg}</p>}
        {datingRateErr && <p className="text-sm text-red-600 mt-2">{datingRateErr}</p>}
        <h3 className="font-bold mt-5">ডেটিং লাইভ রেট</h3>
        <p className="text-xs text-gray-500">লাইভ দেখার রেট কলের রেট থেকে আলাদা — লাইভে টাকা কম কাটবে। লাইভের ভাগ: লাইভকারী ৭০%, অ্যাডমিন ৩০% (অপরিবর্তিত)।</p>
        <label className="text-sm block mt-2">ডেটিং লাইভ রেট (৳/মিনিট)</label>
        <div className="flex gap-2 items-center flex-wrap mt-1">
          <input type="number" min={1} step={1} className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={liveRateInput} onChange={e => { setLiveRateInput(e.target.value); setLiveRateMsg(''); setLiveRateErr('') }} />
          <Btn onClick={saveLiveRate}>সংরক্ষণ করুন</Btn>
        </div>
        <p className="text-xs text-gray-400 mt-1">বর্তমানে সংরক্ষিত: <b>{formatBDT(liveRate)}/মিনিট</b> • সর্বনিম্ন ৳১/মিনিট, শুধু পূর্ণ টাকা।</p>
        {liveRateMsg && <p className="text-sm text-green-600 mt-2">{liveRateMsg}</p>}
        {liveRateErr && <p className="text-sm text-red-600 mt-2">{liveRateErr}</p>}
      </Card>}
      {tab === 'kyc' && <Card>
        <h2 className="font-bold">🛡️ ডেটিং KYC যাচাই — অ্যাডমিন</h2>
        <p className="text-xs text-gray-400 mt-1">নাম, বয়স, আইডি আর সেলফি/লাইভ ভিডিও মিলিয়ে দেখে অনুমোদন বা বাতিল করুন। অনুমোদন হলেই ওই ব্যবহারকারীর ডেটিং খুলবে। ডেমো KYC — আসল যাচাইয়ের জন্য ভেরিফায়েড KYC সার্ভিস লাগবে; এই ডেমোতে জমা শুধু এই ডিভাইসে থাকে।</p>
        {kycStatus === 'none' && <p className="text-sm mt-3">কোনো KYC জমা পড়েনি।</p>}
        {kycInfo && (<div className="mt-3">
          <div className="flex gap-4 flex-wrap items-start">
            <div>
              {kycInfo.selfie ? <img src={kycInfo.selfie} alt="KYC সেলফি" className="w-32 aspect-[3/4] object-cover rounded-xl border" /> : <p className="text-sm text-gray-400">সেলফি ছবি নেই</p>}
              <p className="text-xs text-gray-400 mt-1 w-32">📸 সেলফি ছবি</p>
            </div>
            <div>
              {kycInfo.selfieVideo ? <video src={kycInfo.selfieVideo} controls loop muted playsInline className="w-32 aspect-[3/4] object-cover rounded-xl border bg-black" /> : <p className="text-sm text-gray-400 w-32">🎥 লাইভ ভিডিও এই ডিভাইসে সংরক্ষণ করা যায়নি — শুধু সেলফি ছবি দিয়ে মিলিয়ে দেখুন।</p>}
              {kycInfo.selfieVideo && <p className="text-xs text-gray-400 mt-1 w-32">🎥 লাইভ ভিডিও (~৩ সেকেন্ড) — চালিয়ে দেখুন</p>}
            </div>
            <div className="text-sm space-y-1 flex-1 min-w-[200px]">
              <p><b>নাম:</b> {kycInfo.name}</p>
              <p><b>জন্ম তারিখ:</b> {kycInfo.dob} (বয়স: {ageFromDob(kycInfo.dob)} বছর)</p>
              <p><b>আইডির ধরন:</b> {kycInfo.idType}</p>
              <p><b>আইডির শেষ ৪:</b> {kycInfo.idLast4}</p>
              <p><b>জমার তারিখ:</b> {new Date(kycInfo.submittedAt).toLocaleString('bn-BD')}</p>
              <p><b>অবস্থা:</b> {kycStatus === 'pending' ? '⏳ পর্যালোচনাধীন' : kycStatus === 'approved' ? `✅ অনুমোদিত (${kycInfo.verifiedAt ? new Date(kycInfo.verifiedAt).toLocaleDateString('bn-BD') : ''})` : kycStatus === 'rejected' ? '❌ বাতিল' : '—'}</p>
              {kycStatus === 'rejected' && <p><b>বাতিলের কারণ:</b> {kycRejectReason || '—'}</p>}
              <p className="text-xs text-gray-400">ছবি ও ভিডিওর ব্যক্তির সাথে নাম-বয়স-আইডি মিলছে কিনা দেখুন। সেলফি ও ভিডিও শুধু অ্যাডমিন যাচাইয়ের জন্য — অন্য কারো সাথে শেয়ার করবেন না।</p>
            </div>
          </div>
          {kycStatus === 'pending' && (<>
            <div className="flex gap-2 mt-4 flex-wrap">
              <Btn variant="green" onClick={() => { approveKyc(); setShowReject(false) }}>✅ অনুমোদন করুন</Btn>
              <Btn variant="ghost" onClick={() => setShowReject(s => !s)}>❌ বাতিল করুন</Btn>
            </div>
            {showReject && (<div className="mt-3">
              <label className="text-sm font-medium">বাতিলের কারণ (আবশ্যক)</label>
              <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="যেমন: সেলফি অস্পষ্ট, নামের সাথে আইডি মিলছে না" />
              <Btn className="mt-2" disabled={!rejectReason.trim()} onClick={() => { rejectKyc(rejectReason); setRejectReason(''); setShowReject(false) }}>বাতিল নিশ্চিত করুন</Btn>
            </div>)}
          </>)}
          {kycStatus === 'approved' && <p className="text-sm text-green-600 mt-3">✅ অনুমোদিত — এই ব্যবহারকারীর ডেটিং খুলে গেছে।</p>}
          {kycStatus === 'rejected' && <p className="text-sm text-red-500 mt-3">❌ বাতিল হয়েছে — ব্যবহারকারী তথ্য ঠিক করে আবার KYC জমা দিতে পারবেন।</p>}
        </div>)}
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="font-bold">🔴 চলমান লাইভ দেখুন — অ্যাডমিন মনিটরিং</h3>
            <Btn variant="ghost" onClick={refreshAdminRooms}>🔄 রিফ্রেশ</Btn>
          </div>
          <p className="text-xs text-gray-400 mt-1">এখন যারা ডেটিং লাইভে আছেন, অ্যাডমিন এখান থেকে দেখে মনিটর করতে পারেন। লাইভে ঢুকলে দর্শকের মতোই প্রিপেইড রেট প্রযোজ্য হবে।</p>
          {!adminLiveOk && <p className="text-sm text-amber-600 mt-2">⚠️ লাইভ সার্ভারে পৌঁছানো যাচ্ছে না — ডেমো নোট: সার্ভার চালু হলে চলমান লাইভ এখানে দেখাবে।</p>}
          {adminLiveOk && adminRooms && adminRooms.length === 0 && <p className="text-sm mt-2">এখন কেউ লাইভে নেই।</p>}
          {adminLiveOk && adminRooms && adminRooms.length > 0 && (
            <div className="space-y-2 mt-3">
              {adminRooms.map(r => (
                <div key={r.id} className="flex justify-between items-center gap-2 border rounded-lg px-3 py-2 flex-wrap">
                  <div className="text-sm">
                    <p className="font-bold">🔴 {r.hostName} <span className="text-xs font-normal text-gray-400">• {r.title || 'ডেটিং লাইভ'}</span></p>
                    <p className="text-xs text-gray-500">👁️ {r.viewers} জন দেখছে • শুরু: {new Date(r.startedAt).toLocaleTimeString('bn-BD')}</p>
                  </div>
                  <Link to={`/dating-live/${r.id}`} className="bg-fb-blue text-white text-sm font-medium px-3 py-1.5 rounded-full">👁️ দেখুন</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>}
      {tab === 'users' && <Card><h2 className="font-bold">ব্যবহারকারী</h2><p className="text-sm mt-2">মোট ব্যবহারকারী (ডেমো): ১,২৪০ • এক্সপার্ট: ৮৬ • ক্রিয়েটর: ১২০ • ১৮+ ভেরিফায়েড ডেটিং প্রোফাইল: ৩৪০</p><p className="text-sm mt-2">ডেটিং KYC: {kycStatus === 'approved' ? `✅ অনুমোদিত (${kycInfo?.verifiedAt ? new Date(kycInfo.verifiedAt).toLocaleDateString('bn-BD') : ''}) — ${kycInfo?.name ?? ''} (${kycInfo?.idType ?? ''}, আইডির শেষ ৪: ${kycInfo?.idLast4 ?? ''})` : kycStatus === 'pending' ? '⏳ পর্যালোচনাধীন — অ্যাডমিন অনুমোদনের অপেক্ষায়' : kycStatus === 'rejected' ? `❌ বাতিল — ${kycRejectReason || 'কারণ দেওয়া হয়নি'}` : '⏳ এখনো হয়নি'}</p></Card>}
      {tab === 'recordings' && <Card><h2 className="font-bold">কল রেকর্ডিং — শুধু অ্যাডমিন</h2><p className="text-sm mt-2">রেকর্ডিং শুধু আপিল/বিরোধ নিষ্পত্তির জন্য অ্যাডমিন দেখতে পারেন। সাধারণ ব্যবহারকারীর কোনো রেকর্ড বোতাম নেই। সংরক্ষণ: ৩০ দিন (Cloudflare R2 ফ্রি টিয়ার)। সার্ভারে সংরক্ষিত হয়, ব্যবহারকারীর ফোনে নয়।</p><p className="text-sm mt-1">ডেমোতে কোনো আসল রেকর্ডিং নেই।</p></Card>}
      {tab === 'livetv' && <Card><h2 className="font-bold">লাইভ টিভি চ্যানেল যোগ করুন</h2>
        <label className="text-sm block mt-3">চ্যানেলের নাম</label><input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={tvName} onChange={e => setTvName(e.target.value)} />
        <label className="text-sm block mt-3">অফিসিয়াল HLS স্ট্রিম URL</label><input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={tvUrl} onChange={e => setTvUrl(e.target.value)} placeholder="https://...m3u8" />
        <label className="text-sm block mt-3">অফিসিয়াল সোর্স লিংক</label><input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" placeholder="https://..." />
        <Btn className="mt-3" disabled={!tvName || !tvUrl} onClick={() => setTvAdded(true)}>চ্যানেল যোগ করুন</Btn>
        {tvAdded && <p className="text-sm text-green-600 mt-2">✅ {tvName} ডেমোতে যোগ হয়েছে।</p>}
        <p className="text-xs text-gray-400 mt-2">শুধু অফিসিয়াল HLS স্ট্রিম ও অফিসিয়াল সোর্স লিংক ব্যবহার করুন।</p>
      </Card>}
      {tab === 'moderation' && <Card><h2 className="font-bold">মডারেশন লগ</h2><p className="text-sm mt-2">যোগাযোগ-তথ্য শেয়ার করার চেষ্টা (মাস্কড) এখানে লগ হয়; বারবার চেষ্টা করলে সতর্কবার্তা বাড়ে। ডেমোতে: ৩টি চেষ্টা লগ হয়েছে, ০টি অ্যাকাউন্ট সাসপেন্ড।</p><p className="text-sm mt-1">রিপোর্ট করা ডেটিং প্রোফাইল: ২টি (পর্যালোচনাধীন)।</p></Card>}
    </div>
  )
}

export function MenuPage() {
  const { user, balance, logout } = useStore()
  const navigate = useNavigate()
  const tiles = [
    { to: '/feed', label: 'ফিড', icon: '📰', color: '#1877F2' }, { to: '/marketplace', label: 'মার্কেটপ্লেস', icon: '🛍️', color: '#27AE60' },
    { to: '/friends', label: 'বন্ধুরা', icon: '👥', color: '#8E44AD' }, { to: '/dating', label: 'ডেটিং ১৮+', icon: '❤️', color: '#E91E63' },
    { to: '/live-tv', label: 'লাইভ টিভি', icon: '📺', color: '#C0392B' }, { to: '/services', label: 'হোম সার্ভিস', icon: '🏠', color: '#16A085' },
    { to: '/reels', label: 'রিলস', icon: '🎬', color: '#E67E22' }, { to: '/wallet', label: 'ওয়ালেট', icon: '💰', color: '#2C3E50' },
    { to: '/call-history', label: 'কল হিস্ট্রি', icon: '📞', color: '#2980B9' }, { to: '/ads', label: 'বিজ্ঞাপন', icon: '📢', color: '#D35400' },
    { to: '/groups', label: 'গ্রুপ ও পেজ', icon: '👥', color: '#7F8C8D' }, { to: '/admin', label: 'অ্যাডমিন', icon: '🛡️', color: '#34495E' }
  ]
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <div className="flex items-center gap-3">
          <span className="w-16 h-16 rounded-full bg-fb-blue text-white text-2xl flex items-center justify-center font-bold">{user ? user.name.slice(0, 1) : '👤'}</span>
          <div><p className="font-bold text-lg">{user ? user.name : 'অতিথি ব্যবহারকারী'}</p><p className="text-sm text-gray-500">{user?.email || 'লগইন করুন'}</p></div>
          <button onClick={() => navigate('/wallet')} className="ml-auto bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200 font-bold px-3 py-1.5 rounded-full text-sm">💰 {formatBDT(balance)}</button>
        </div>
        {user ? <Btn variant="ghost" className="mt-3" onClick={() => { logout(); navigate('/') }}>লগআউট</Btn>
          : <Btn className="mt-3" onClick={() => navigate('/login')}>লগইন করুন</Btn>}
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(t => (
          <button key={t.label} onClick={() => navigate(t.to)} className="bg-white dark:bg-fb-card rounded-xl p-4 shadow-sm text-left">
            <span className="w-10 h-10 rounded-lg text-white text-xl flex items-center justify-center" style={{ background: t.color }}>{t.icon}</span>
            <p className="font-bold mt-2">{t.label}</p>
          </button>
        ))}
      </div>
      <Card><p className="text-xs text-gray-400">CallGuru v6 • চ্যাট ফ্রি, কল প্রিপেইড • প্রথম কলের প্রথম ১ মিনিট ফ্রি • কল রেকর্ডিং শুধু অ্যাডমিন (আপিলের জন্য, ৩০ দিন) • শর্তাবলি ও গোপনীয়তা নীতি প্রযোজ্য।</p></Card>
    </div>
  )
}
