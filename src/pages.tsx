import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Hls from 'hls.js'
import { useStore } from './store'
import { useExperts } from './api'
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
  const { balance, deduct, freeFirstMinuteUsed, markFreeMinuteUsed, addCall, user } = useStore()
  const navigate = useNavigate()
  const { experts: liveExperts } = useExperts()
  const expert = type === 'expert' ? liveExperts.find(e => e.id === id) : undefined
  const friendName = type === 'friend' ? (id || 'বন্ধু') : undefined
  const rate = expert ? expert.rate : FRIEND_RATE
  const name = expert ? expert.name : decodeURIComponent(friendName || 'বন্ধু')
  const isFreeAvailable = !freeFirstMinuteUsed
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
    addCall({ name, type: expert ? 'Expert' : 'Friend', rate, durationSec: seconds, cost, freeMinute: isFreeAvailable && seconds > 0, status: reason.startsWith('Auto-cut') ? 'Auto-cut' : 'Completed' })
  }

  function sendChat() {
    const err = contactBanCheck(chatDraft)
    if (err) { setBanMsg(err + ` (চেষ্টা ${banCount + 1} — অ্যাডমিন লগে সংরক্ষিত)`); setBanCount(c => c + 1); return }
    if (!chatDraft.trim()) return
    setChat(c => [...c, { from: user?.name || 'আপনি', text: chatDraft }]); setChatDraft(''); setBanMsg('')
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
          <p className="text-sm text-gray-300">{expert ? `${expert.title} • ` : 'বন্ধু • '}{formatBDT(rate)}/মিনিট</p>
          {isFreeAvailable && <p className="mt-2 text-sm bg-green-600 rounded-lg px-3 py-2">🎉 ১ম মিনিট ফ্রি — আপনার প্রথম কলের প্রথম ১ মিনিট সম্পূর্ণ ফ্রি!</p>}
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
  const { balance, topUp, points, referrals } = useStore()
  const [amount, setAmount] = useState(500)
  const [method, setMethod] = useState('bKash')
  const [trx, setTrx] = useState('')
  const [msg, setMsg] = useState('')
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

// ---------- Dating 18+ ----------
export function DatingPage() {
  const { likesUsed, useLike, premium, setPremium, coins, addCoins } = useStore()
  const [adult, setAdult] = useState(false)
  const [matched, setMatched] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({})
  const [boosted, setBoosted] = useState(false)
  if (!adult) {
    return (
      <div className="max-w-md mx-auto"><Card className="text-center">
        <h1 className="text-xl font-bold">❤️ ডেটিং — শুধু ১৮+ দের জন্য</h1>
        <p className="text-sm text-gray-500 mt-2">ভেরিফায়েড প্রোফাইল, ম্যাচ → চ্যাট/ভিডিও কল, রিপোর্ট/ব্লক সুবিধা। অশ্লীল কনটেন্ট কঠোরভাবে নিষিদ্ধ।</p>
        <label className="flex items-center gap-2 justify-center mt-4 text-sm"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} /> আমি নিশ্চিত করছি আমার বয়স ১৮ বছর বা তার বেশি।</label>
        <Btn className="mt-4" disabled={!adult} onClick={() => setAdult(true)}>ডেটিং শুরু করুন</Btn>
      </Card></div>
    )
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
      {matched && <Card className="!bg-pink-50 dark:!bg-pink-900 text-center"><p className="font-bold text-lg">🎉 ম্যাচ হয়েছে — {matched}!</p><p className="text-sm">এখন চ্যাট বা ভিডিও কল করতে পারেন।</p><Link to="/chat" className="text-fb-blue text-sm font-medium">চ্যাট শুরু করুন →</Link></Card>}
      <div className="grid sm:grid-cols-2 gap-3">
        {DATING_PROFILES.map(p => (
          <Card key={p.id}>
            <div className="flex gap-3 items-center">
              <span className="w-14 h-14 rounded-full text-white text-xl flex items-center justify-center font-bold" style={{ background: p.color }}>{p.name.slice(0, 1)}</span>
              <div><p className="font-bold">{p.name}, {p.age}</p><p className="text-sm text-gray-500">{p.city}</p></div>
            </div>
            <p className="text-sm mt-2">{p.about}</p>
            <div className="flex gap-2 mt-3">
              <Btn disabled={!!likedIds[p.id]} onClick={() => { if (!useLike()) { alert('আজকের ৩০টি ফ্রি লাইক শেষ — প্রিমিয়াম নিন।'); return } setLikedIds(v => ({ ...v, [p.id]: true })); setMatched(p.name) }}>❤️ লাইক</Btn>
              <Btn variant="ghost" onClick={() => { if (coins < 15) { alert('Super Like-এর জন্য ১৫ কয়েন লাগবে।'); return } addCoins(-15); setMatched(p.name) }}>⭐ Super Like (১৫ কয়েন)</Btn>
              <Btn variant="ghost" onClick={() => alert('প্রোফাইলটি রিপোর্ট করা হয়েছে — মডারেশন দেখবে।')}>🚩 রিপোর্ট</Btn>
            </div>
          </Card>
        ))}
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
  const [tab, setTab] = useState('revenue')
  const [rate, setRate] = useState(20)
  const [mins, setMins] = useState(10)
  const [price, setPrice] = useState(10)
  const [tvName, setTvName] = useState('')
  const [tvUrl, setTvUrl] = useState('')
  const [tvAdded, setTvAdded] = useState(false)
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold">🛡️ অ্যাডমিন প্যানেল</h1>
      <div className="flex gap-2 flex-wrap">{['revenue', 'users', 'recordings', 'livetv', 'moderation'].map(t => <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-sm capitalize ${tab === t ? 'bg-fb-blue text-white' : 'bg-white dark:bg-fb-card'}`}>{t}</button>)}</div>
      {tab === 'revenue' && <Card>
        <h2 className="font-bold">রেভিনিউ ও ফি ক্যালকুলেটর</h2>
        <label className="text-sm block mt-3">কমিশন %</label><input type="number" className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={rate} onChange={e => setRate(Number(e.target.value))} />
        <label className="text-sm block mt-2">কল রেট (৳/মিনিট)</label><input type="number" className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={price} onChange={e => setPrice(Number(e.target.value))} />
        <label className="text-sm block mt-2">মিনিট</label><input type="number" className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={mins} onChange={e => setMins(Number(e.target.value))} />
        <p className="mt-3 text-sm">মোট: <b>{formatBDT(price * mins)}</b> • প্ল্যাটফর্ম ({rate}%): <b>{formatBDT(price * mins * rate / 100)}</b> • এক্সপার্ট পাবেন: <b>{formatBDT(price * mins * (100 - rate) / 100)}</b></p>
        <p className="text-xs text-gray-400 mt-1">উদাহরণ: ৳১০/মিনিট × ১০ মিনিট = ৳১০০, ২০% কমিশনে প্ল্যাটফর্ম পায় ৳২০, এক্সপার্ট পান ৳৮০।</p>
      </Card>}
      {tab === 'users' && <Card><h2 className="font-bold">ব্যবহারকারী</h2><p className="text-sm mt-2">মোট ব্যবহারকারী (ডেমো): ১,২৪০ • এক্সপার্ট: ৮৬ • ক্রিয়েটর: ১২০ • ১৮+ ভেরিফায়েড ডেটিং প্রোফাইল: ৩৪০</p></Card>}
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
