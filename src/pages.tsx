import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Hls from 'hls.js'
import { useStore } from './store'
import { useExperts, sendEmailOtp, verifyEmailOtp, sendSmsOtp, verifySmsOtp, saveAdminSmtp, getAdminSettingsStatus } from './api'
import { normalizeBdPhone } from './phone'
import { connectLive, createLiveRoom, endLiveRoom, fetchLiveRooms, sendSignal, ICE_SERVERS, type LiveRoom } from './live'
import { connectCall, createCallPeerConnection, fetchCallInfo, makeCallCode, callLink, sendCallSignal } from './call'
import { sendCallInvite, onInviteResponse } from './presence'
import { CALL_PRIVACY_LABELS, type CallPrivacy } from './incomingCall'
import { enableCallPush, getPushStatus } from './pushNotify'
import { BUDDIES, getBuddyByName, getBuddyReplyDetail, isBuddyId } from './buddies'
import { searchPosts, type SearchablePerson } from './friendSearch'
import { useAllUserSearch, SearchSuggestions } from './searchUI'
import { Btn, Card, ContactsCard, InstallButton, SponsoredCard } from './components'
import {
  CATEGORIES, DATING_PROFILES, FRIEND_RATE, FRIEND_SUGGESTIONS, FREE_MINUTES_NOTE,
  REELS, SERVICES, TV_CHANNELS, TOPUP_PACKS, DISTRICTS, INTERESTS,
  contactBanCheck, formatBDT, formatPi, roundPi, takaToPi,
  USDT_NETWORKS, piWithdrawFee,
  type Expert, type DatingProfile, type TvChannel
} from './data'
import { DEFAULT_TV_PLAYLIST_URL, fetchTvPlaylist, isPlaylistUrl } from './tvPlaylist'
import { DAILY_BONUS_REWARDS, INVITE_BASE_URL, REF_INVITER_PI, REF_WELCOME_PI, topUpPi } from './store'
import { isFirebaseConfigured, signInWithGoogle, sendEmailLink, completeEmailLink, isEmailLinkSignIn, getFirebaseAuth, getFirebaseApp } from './firebase'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { updateProfile } from 'firebase/auth'
import { fetchNewMembers, sendChatMessage, subscribeChatMessages, chatRoomId } from './firestore'
import { profileCompletion, type Gender } from './profile'
import { formatJoinTime, filterNewMembers, type NewMember } from './newMembers'
import { playChatSound, playRingtoneOnce, startRingtone, setInCallActive } from './sounds'

// ---------- ভাইরাল গ্রোথ: শেয়ার হেল্পার ----------
// নেটিভ শেয়ার থাকলে সেটা, না থাকলে লিংক কপি করে দেওয়া হয়
export async function shareLink(title: string, text: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share({ title, text, url }); return 'shared' }
  } catch { return 'failed' }
  try { await navigator.clipboard.writeText(`${text} ${url}`); return 'copied' } catch { return 'failed' }
}

function shortPiAddress(a: string) { return a.length > 10 ? a.slice(0, 4) + '...' + a.slice(-4) : a }

function currentWeekLabel(): string {
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // সোমবার = ০
  const mon = new Date(now); mon.setDate(now.getDate() - day)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  return `${fmt(mon)} – ${fmt(sun)}`
}

// রেফার লিংকে এসে থাকলে ফিডের উপরে ওয়েলকাম ব্যানার
export function RefWelcomeBanner() {
  const { refNotice, dismissRefNotice } = useStore()
  if (!refNotice) return null
  return (
    <Card className="!bg-green-50 dark:!bg-green-900">
      <div className="flex items-start gap-2">
        <p className="text-sm font-medium flex-1">{refNotice}</p>
        <button className="text-gray-400" onClick={dismissRefNotice}>✕</button>
      </div>
      <p className="text-xs text-gray-500 mt-1">First call's first 1 minute free — applies to new users.</p>
    </Card>
  )
}

// বন্ধুকে ডাকুন — ব্যক্তিগত ইনভাইট লিংক, কপি/শেয়ার, রেফারেল হিসাব
export function InviteCard() {
  const { referralCode, referrals, referralPiEarned } = useStore()
  const [msg, setMsg] = useState('')
  const link = `${INVITE_BASE_URL}?ref=${referralCode}`
  async function copy() {
    try { await navigator.clipboard.writeText(link); setMsg('✅ Link copied — send it to a friend!') }
    catch { setMsg('Link: ' + link) }
  }
  async function share() {
    const r = await shareLink('PiCall — Live Expert Advice', 'Join PiCall — first call\'s first 1 minute free + 1 π bonus!', link)
    setMsg(r === 'shared' ? '✅ Shared!' : r === 'copied' ? '✅ Link copied — send it to a friend!' : '')
  }
  return (
    <Card>
      <h2 className="font-bold">📣 Invite a friend — both of you get it</h2>
      <p className="text-sm mt-1">If a friend joins through your link, they will get <b>First call's first 1 minute free + {REF_WELCOME_PI} π</b>. When your friend makes their first top-up, <b>You will get {REF_INVITER_PI} π</b>।</p>
      <p className="text-sm mt-2 break-all">Your link: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{link}</code></p>
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={copy}>📋 Copy Link</Btn>
        <Btn variant="green" onClick={share}>↗️ Share</Btn>
      </div>
      <p className="text-sm mt-2">Referral: <b>{referrals} people</b> • Earnings from referrals: <b>π {referralPiEarned} Pi</b></p>
      <p className="text-xs text-amber-600 mt-1">Referral Pi is bonus Pi — it cannot be withdrawn, only used for calls/live gifts.</p>
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
      <p className="text-xs text-gray-400 mt-2">Referrals are tracked on this device.</p>
    </Card>
  )
}

// ডেইলি বোনাস — ৭ দিনের চক্র, একদিন মিস করলে স্ট্রিক আবার ১ম দিন থেকে
export function DailyBonusCard() {
  const { streak, dailyClaimedToday, claimDailyBonus, totalPi, giftBoxDays, giftBoxClaimed, canClaimGiftBox, claimGiftBox } = useStore()
  const [msg, setMsg] = useState('')
  function claim() {
    const r = claimDailyBonus()
    if (r) setMsg(`🎉 Day ${r.day} — you got ${r.pi} π! Total Pi: ${formatPi(totalPi + r.pi)}.`)
  }
  function claimBox() {
    const r = claimGiftBox()
    if (r) setMsg(r.jackpot ? `🎉 Congratulations! You won 1 π! Total Pi: ${formatPi(totalPi + r.pi)}.` : `🎁 You got ${r.pi} π — try again! Total Pi: ${formatPi(totalPi + r.pi)}.`)
  }
  const nextDay = ((streak % 7) + 1)
  const boxRemaining = 30 - giftBoxDays
  return (
    <Card className="!bg-amber-50 dark:!bg-amber-900/30">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="font-bold">🎁 Daily Bonus</h2>
        <span className="text-sm">🔥 Streak: <b>{streak} days</b> • Pi: <b>π {totalPi}</b></span>
      </div>
      <div className="flex gap-1.5 mt-3 flex-wrap">
        {DAILY_BONUS_REWARDS.map((c, i) => {
          const day = i + 1
          const cycleDay = streak % 7 // ০ = নতুন চক্র শুরু হয়নি বা চক্র শেষ হয়েছে
          const doneCount = dailyClaimedToday ? (cycleDay === 0 ? 7 : cycleDay) : cycleDay
          const done = day <= doneCount
          const isNext = day === nextDay && !dailyClaimedToday
          return (
            <span key={day} className={`text-xs px-2 py-1.5 rounded-lg font-bold ${done ? 'bg-green-500 text-white' : isNext ? 'bg-amber-400 text-black ring-2 ring-amber-600' : 'bg-white dark:bg-slate-700'}`}>
              Day {day}: {c} π
            </span>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">Come daily and claim the bonus — it grows day by day, 0.001 π on day 7! If you miss a day, the streak restarts from day 1.</p>
      {/* ৩০ দিনের গিফট বক্স — টানা ৩০ দিন ডেইলি বোনাস নিলে লটারি: সর্বোচ্চ ১ π, বাকিরা ছোট পুরস্কার */}
      <div className="mt-3 border-t border-amber-200 dark:border-amber-800 pt-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-bold text-sm">🎁 30-Day Gift Box — up to 1 π</h3>
          <span className="text-sm">{giftBoxDays} / 30 days</span>
        </div>
        <div className="w-full bg-white dark:bg-slate-700 rounded-full h-2.5 mt-2 overflow-hidden">
          <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${Math.min(100, (giftBoxDays / 30) * 100)}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-2">If you claim the daily bonus for 30 days in a row, you will get a gift box above. If you miss a day, the 30-day count also restarts from day 1.</p>
        {canClaimGiftBox ? (
          <Btn variant="green" className="mt-2" onClick={claimBox}>🎁 Open Gift Box</Btn>
        ) : giftBoxClaimed ? (
          <p className="text-sm text-green-600 mt-2">✅ Gift box claimed — claim the bonus for 30 days in a row again for the next box!</p>
        ) : (
          <p className="text-sm mt-2">🔒 {boxRemaining} days left — in a row {boxRemaining} days of bonus and the gift box will open.</p>
        )}
      </div>
      <Btn variant="green" className="mt-3" disabled={dailyClaimedToday} onClick={claim}>
        {dailyClaimedToday ? '✅ Today\'s bonus claimed — come back tomorrow' : `🎁 Claim today's bonus (Day ${nextDay}: ${DAILY_BONUS_REWARDS[nextDay - 1]} π)`}
      </Btn>
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
    </Card>
  )
}

// সপ্তাহের লিডারবোর্ড — লাইভ হোস্ট (গিফট) ও গিফট-দাতা; ডেমো ডেটা নেই, শুধু নিজের হিসাব
export function LeaderboardCard() {
  const { liveEarnings, giftsSentPi } = useStore()
  const hosts = liveEarnings > 0 ? [{ name: 'You', gifts: liveEarnings, mine: true }] : []
  const givers = giftsSentPi > 0 ? [{ name: 'You', gifts: giftsSentPi, mine: true }] : []
  return (
    <Card>
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="font-bold">🏆 This Week's Leaderboard</h2>
        <span className="text-xs text-gray-400">This week: {currentWeekLabel()}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-3">
        <div>
          <p className="text-sm font-bold">🎤 Best Live Host (received gifts)</p>
          {hosts.length === 0 && <p className="text-sm text-gray-500 py-1">Nobody has received a gift on live yet.</p>}
          {hosts.map((h, i) => (
            <p key={h.name} className={`text-sm py-1 flex justify-between ${h.mine ? 'font-bold text-green-600' : ''}`}>
              <span>{i + 1}. {h.name}</span>
              <span>🎁 π {h.gifts}</span>
            </p>
          ))}
        </div>
        <div>
          <p className="text-sm font-bold">💝 Best Gift Giver</p>
          {givers.length === 0 && <p className="text-sm text-gray-500 py-1">Nobody has sent a gift yet.</p>}
          {givers.map((h, i) => (
            <p key={h.name} className={`text-sm py-1 flex justify-between ${h.mine ? 'font-bold text-green-600' : ''}`}>
              <span>{i + 1}. {h.name} {h.mine && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">π Pi Gifter</span>}</span>
              <span>🎁 π {h.gifts}</span>
            </p>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">Your own Pi live earnings and sent Pi gifts are added here as "You".</p>
    </Card>
  )
}

// ---------- Landing ----------
export function Landing() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <RefWelcomeBanner />
      <Card className="text-center py-10 bg-gradient-to-br from-violet-600 to-pink-500 !text-white">
        <h1 className="text-4xl font-extrabold">PiCall</h1>
        <p className="mt-2 text-lg">Live Expert Advice • Social Community • Creator Marketplace</p>
        <p className="mt-1 text-sm opacity-90">Chat completely free • Calls prepaid • First call's first 1 minute free</p>
        <div className="mt-5 flex gap-3 justify-center">
          <Btn variant="green" onClick={() => navigate('/login')}>1-Click Login with Gmail</Btn>
          <Btn variant="ghost" className="!bg-white !text-violet-700" onClick={() => navigate('/feed')}>View Feed</Btn>
        </div>
        <div className="mt-4 max-w-xs mx-auto"><InstallButton /></div>
      </Card>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { t: '🎓 Expert Call', d: 'Doctors, lawyers, teachers — pay per minute. Top up first, call after.' },
          { t: '💬 Free Chat', d: 'Friends, experts, dating — all chats are completely free. Sharing numbers/links is blocked.' },
          { t: '📺 Live TV', d: 'Popular channels of the country — free with ads. Official streams only.' }
        ].map(f => <Card key={f.t}><h3 className="font-bold">{f.t}</h3><p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{f.d}</p></Card>)}
      </div>
      <Card>
        <h2 className="font-bold text-lg mb-2">How It Works</h2>
        <ol className="list-decimal ml-5 text-sm space-y-1">
          <li>Log in with Gmail in 1 click.</li>
          <li>Top up your wallet — bKash / Nagad / Rocket / USDT / Binance Pay.</li>
          <li>Choose an expert and call. The first call's first 1 minute is free.</li>
          <li>The call will cut itself when the balance ends — no debt.</li>
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
  const [busy, setBusy] = useState(false)
  // ইমেইল লিংক: লিংক পাঠানো হয়েছে কি না
  const [linkSent, setLinkSent] = useState(false)
  // ইমেইল OTP: কোড পাঠানো হয়েছে কি না + কোড ইনপুট
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  // SMS OTP: মোবাইল নম্বরে ৬ সংখ্যার কোড — গেটওয়ে থাকলে ব্যাকএন্ড পাঠায়,
  // না থাকলে 'not_configured' আসে আর ইমেইল লগইন ব্যবহার করতে বলা হয়
  const [phone, setPhone] = useState('')
  const [smsOtpSent, setSmsOtpSent] = useState(false)
  const [smsOtp, setSmsOtp] = useState('')
  // লিংক দিয়ে ফিরে এসে সংরক্ষিত ইমেইল না পেলে ইমেইল চাওয়া হয়
  const [linkEmailNeeded, setLinkEmailNeeded] = useState(false)
  const [completingLink, setCompletingLink] = useState(false)

  const displayName = (mail: string) => name.trim() || mail.split('@')[0] || 'PiCall User'

  // ইমেইল লিংকে ট্যাপ করে ফিরে এলে লগইন সম্পূর্ণ করা হয় (যাচাই ছাড়া কেউ ঢুকতে পারে না)
  useEffect(() => {
    if (!isEmailLinkSignIn()) return
    let stored: string | null = null
    try { stored = localStorage.getItem('callguru:emailForSignIn') } catch { stored = null }
    if (stored) {
      setCompletingLink(true)
      completeEmailLink(stored).then(u => {
        if (u) { login(u.name, u.email); navigate('/feed'); return }
        setMsg('The link has expired or is wrong — send the link again.')
      }).catch(() => setMsg('The link has expired or is wrong — send the link again.'))
        .finally(() => setCompletingLink(false))
    } else {
      setLinkEmailNeeded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishLinkWithEmail = async () => {
    const mail = email.trim().toLowerCase()
    if (!mail.includes('@')) { setMsg('Enter a valid email.'); return }
    setBusy(true); setMsg('')
    try {
      const u = await completeEmailLink(mail)
      if (u) { login(displayName(u.email), u.email); navigate('/feed'); return }
      setMsg('The link has expired or is wrong — send the link again.')
    } catch {
      setMsg('The link has expired or is wrong — send the link again.')
    } finally { setBusy(false) }
  }

  const googleLogin = async () => {
    // আসল Google Sign-In — Firebase সেটআপ না থাকলে ভুল বার্তা, ডেমো লগইন কখনো নয়
    if (!isFirebaseConfigured) {
      setMsg('Login is not set up — contact the admin.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const u = await signInWithGoogle()
      if (u) { login(u.name, u.email); navigate('/feed'); return }
      setMsg('Google login did not complete — please try again.')
    } catch {
      setMsg('Google login failed — the pop-up was closed or there is a network problem. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const sendLink = async () => {
    const mail = email.trim().toLowerCase()
    if (!mail.includes('@')) { setMsg('Enter a valid email.'); return }
    if (!isFirebaseConfigured) {
      setMsg('Email link login is not set up — contact the admin.')
      return
    }
    setBusy(true); setMsg('')
    try {
      await sendEmailLink(mail)
      setLinkSent(true)
      setMsg('Check your email — tap the link to log in.')
    } catch {
      setMsg('Could not send the link — check the email and try again.')
    } finally { setBusy(false) }
  }

  const sendOtp = async () => {
    const mail = email.trim().toLowerCase()
    if (!mail.includes('@')) { setMsg('Enter a valid email.'); return }
    setBusy(true); setMsg('')
    const r = await sendEmailOtp(mail)
    setBusy(false)
    if (!r || !r.ok) {
      if (r && r.error === 'not_configured') {
        setMsg('Email OTP is not on yet — the admin is setting it up.')
      } else if (r && r.error === 'rate_limited') {
        setMsg('Too many attempts — please try again in a little while.')
      } else if (r && r.error === 'invalid_email') {
        setMsg('Enter a valid email.')
      } else {
        setMsg('Email OTP is not on yet — the admin is setting it up.')
      }
      return
    }
    setOtpSent(true)
    setMsg('A 6-digit code has been sent to your email — valid for 10 minutes.')
  }

  const verifyOtp = async () => {
    const code = otp.trim()
    if (!/^\d{6}$/.test(code)) { setMsg('Enter the 6-digit code.'); return }
    const mail = email.trim().toLowerCase()
    setBusy(true); setMsg('')
    const r = await verifyEmailOtp(mail, code)
    setBusy(false)
    if (r && r.ok) {
      login(displayName(mail), mail)
      navigate('/feed')
      return
    }
    if (r && r.error === 'expired') setMsg('The code has expired — send OTP again.')
    else if (r && r.error === 'too_many_attempts') setMsg('Wrong code entered many times — send OTP again.')
    else if (r && r.error === 'not_configured') setMsg('Email OTP is not on yet — the admin is setting it up.')
    else setMsg('The code is wrong — check and enter it again.')
  }

  const sendSms = async () => {
    const ph = normalizeBdPhone(phone)
    if (!ph) { setMsg('Enter a valid Bangladeshi mobile number (11 digits, starting with 01).'); return }
    setBusy(true); setMsg('')
    const r = await sendSmsOtp(ph)
    setBusy(false)
    if (!r || !r.ok) {
      if (r && r.error === 'not_configured') {
        setMsg('SMS login is not set up yet — please use email login for now.')
      } else if (r && r.error === 'rate_limited') {
        setMsg('Too many attempts — please try again in a little while.')
      } else if (r && (r.error === 'invalid_phone' || r.error === 'invalid_email')) {
        setMsg('Enter a valid Bangladeshi mobile number (11 digits, starting with 01).')
      } else if (!r) {
        setMsg('Could not reach the server — check your connection and try again.')
      } else {
        setMsg('Could not send the code — please try again.')
      }
      return
    }
    setSmsOtpSent(true)
    setMsg('A 6-digit code has been sent to your mobile — valid for 10 minutes.')
  }

  const verifySms = async () => {
    const code = smsOtp.trim()
    if (!/^\d{6}$/.test(code)) { setMsg('Enter the 6-digit code.'); return }
    const ph = normalizeBdPhone(phone)
    if (!ph) { setMsg('Enter a valid Bangladeshi mobile number (11 digits, starting with 01).'); return }
    setBusy(true); setMsg('')
    const r = await verifySmsOtp(ph, code)
    setBusy(false)
    if (r && r.ok) {
      // SMS লগইন — Firebase সেশন নেই (ইমেইল OTP-র মতোই লোকাল-অনলি); ফোন নম্বরই
      // লগইন শনাক্তকারী হিসেবে থাকে (ইমেইলের ঘরে — user {name, email} আকারে থাকে)
      login(name.trim() || 'PiCall User', ph)
      navigate('/feed')
      return
    }
    if (r && r.error === 'expired') setMsg('The code has expired — send OTP again.')
    else if (r && r.error === 'too_many_attempts') setMsg('Wrong code entered many times — send OTP again.')
    else if (r && r.error === 'not_configured') setMsg('SMS login is not set up yet — please use email login for now.')
    else setMsg('The code is wrong — check and enter it again.')
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <h1 className="text-2xl font-bold text-center">Welcome to PiCall</h1>
        <p className="text-center text-sm text-gray-500 mt-1">Gmail 1-Click Login • Email Link • Email OTP • Mobile OTP</p>
        <button disabled={busy || completingLink} onClick={googleLogin} className="w-full mt-5 py-3 rounded-lg border font-medium flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-800 disabled:opacity-60">
          <span className="font-extrabold text-lg"><span className="text-blue-500">G</span><span className="text-red-500">o</span><span className="text-yellow-500">o</span><span className="text-blue-500">g</span><span className="text-green-500">l</span><span className="text-red-500">e</span></span>
          {busy ? 'Logging in…' : '1-Click Login with Gmail'}
        </button>
        <p className="text-xs text-center text-gray-400 mt-1">Real Gmail login is on — log in with your Google account.</p>
        <div className="my-4 border-t" />
        {completingLink && <p className="text-sm text-center text-gray-600 dark:text-gray-300">Verifying link…</p>}
        {linkEmailNeeded && (
          <div className="mb-4">
            <p className="text-sm text-center mb-2">Enter your email to complete login — it must be the email the link was sent to.</p>
            <input className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-600" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" />
            <Btn className="w-full mt-2" disabled={busy} onClick={finishLinkWithEmail}>Complete Login</Btn>
          </div>
        )}
        <label className="text-sm font-medium">Name <span className="text-gray-400 font-normal">(will be shown after verification)</span></label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" />
        <label className="text-sm font-medium mt-3 block">Email</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" />
        <Btn className="w-full mt-4" disabled={busy} onClick={sendLink}>Send Login Link by Email</Btn>
        {linkSent && <p className="text-sm text-center mt-2 text-green-700 dark:text-green-400">Check your email — tap the link to log in.</p>}
        <div className="my-4 border-t" />
        <p className="text-sm font-medium text-center">Or log in with email OTP</p>
        <Btn variant="ghost" className="w-full mt-2" disabled={busy} onClick={sendOtp}>{otpSent ? 'Send OTP again' : 'Send OTP'}</Btn>
        {otpSent && (
          <div className="mt-3">
            <label className="text-sm font-medium">6-digit code</label>
            <input className="w-full border rounded-lg px-3 py-2 mt-1 text-center tracking-[0.5em] dark:bg-slate-800 dark:border-slate-600" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" />
            <p className="text-xs text-center text-gray-400 mt-1">The code is valid for 10 minutes.</p>
            <Btn className="w-full mt-2" disabled={busy} onClick={verifyOtp}>Verify the code to log in</Btn>
          </div>
        )}
        <div className="my-4 border-t" />
        <p className="text-sm font-medium text-center">Or log in with mobile number</p>
        <label className="text-sm font-medium mt-3 block">Mobile Number</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
        <Btn variant="ghost" className="w-full mt-2" disabled={busy} onClick={sendSms}>{smsOtpSent ? 'Send OTP again' : 'Send OTP by SMS'}</Btn>
        {smsOtpSent && (
          <div className="mt-3">
            <label className="text-sm font-medium">6-digit code</label>
            <input className="w-full border rounded-lg px-3 py-2 mt-1 text-center tracking-[0.5em] dark:bg-slate-800 dark:border-slate-600" value={smsOtp} onChange={e => setSmsOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" />
            <p className="text-xs text-center text-gray-400 mt-1">The code is valid for 10 minutes.</p>
            <Btn className="w-full mt-2" disabled={busy} onClick={verifySms}>Verify the code to log in</Btn>
          </div>
        )}
        {msg && <p className="text-sm text-center mt-2 text-gray-600 dark:text-gray-300">{msg}</p>}
        <p className="text-xs text-gray-400 mt-4 text-center">By logging in, you agree to the Terms and Privacy Policy. Only the admin can view call recordings (for appeals/disputes, stored 30 days).</p>
      </Card>
    </div>
  )
}

// ফিডের স্টোরি ক্যাপশন — ডেমো লাইন (বন্ধু/পারসোনাদের জন্য আগাম লেখা)
const STORY_CAPTIONS: Record<string, string> = {
  'Rima': 'Something fun is going to happen today! 😄',
  'Shakil': 'Take care, everyone ❤️',
  'Fahim': 'Learned something new today! 😊',
  'Mim': 'Heard today\'s song? 🎵',
  'Asha': 'A dreamy day today! ✨',
}
const STORY_CAPTION_FALLBACK = 'Have a beautiful day today! 😊'

// ---------- নতুন সদস্য ----------
// আসল নতুন ব্যবহারকারী (Firestore publicProfiles থেকে, নতুন থেকে পুরনো) —
// কোনো ডেমো/ভুয়া ব্যবহারকারী নয়। চ্যাট পারসোনারা এখানে আসে না (তারা লোকাল
// বন্ধু, কোনো অ্যাকাউন্ট নয়), অ্যাডমিনও আসে না (তার পাবলিক প্রোফাইল লেখা হয় না)।
// Firestore/নিয়ম না থাকলে খালি অবস্থা দেখায় — ভুয়া কাউকে দেখায় না।
function NewMembersSection() {
  const { uid, friends, addFriend, referralCode } = useStore()
  const [members, setMembers] = useState<NewMember[]>([])
  const [loaded, setLoaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const link = `${INVITE_BASE_URL}?ref=${referralCode}`
  useEffect(() => {
    let cancelled = false
    fetchNewMembers(10).then(list => {
      if (cancelled) return
      setMembers(filterNewMembers(list, uid))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [uid])
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* কপি না হলে লিংকটা দেখেই নেওয়া যাবে */ }
  }
  return (
    <Card>
      <h2 className="font-bold">🆕 New Members</h2>
      {!loaded && <p className="text-sm text-gray-400 mt-1">Searching…</p>}
      {loaded && members.length === 0 && (
        <>
          <p className="text-sm text-gray-500 mt-1">Nobody new has joined yet — invite your friend!</p>
          <p className="text-sm mt-1 break-all">Your link: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{link}</code> <Btn variant="ghost" onClick={copyLink}>{copied ? '✅ Copied!' : '📋 Copy'}</Btn></p>
        </>
      )}
      {members.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 mt-2">
          {members.map(m => {
            const isFriend = friends.some(f => f.id === m.id)
            return (
              <div key={m.id} className="shrink-0 w-28 text-center border rounded-xl p-3 dark:border-slate-700">
                <span className="mx-auto w-14 h-14 rounded-full text-white flex items-center justify-center font-bold text-xl" style={{ background: m.colour }}>{m.displayName.slice(0, 1)}</span>
                <p className="text-sm font-medium mt-1 truncate">{m.displayName}</p>
                <p className="text-xs text-gray-400">{formatJoinTime(m.createdAtMs)}</p>
                <div className="mt-2">
                  {isFriend
                    ? <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: m.displayName } })}>💬 Chat</Btn>
                    : <Btn onClick={() => addFriend({ id: m.id, name: m.displayName, color: m.colour, online: true })}>Add Friend</Btn>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ---------- Feed ----------
export function Feed() {
  const { friends, user, addFriend, installBonusClaimed, posts, setPosts, feedQuery: query, setFeedQuery: setQuery, totalPi, addPi, uid, profilePhoto, updateProfile } = useStore()
  const [text, setText] = useState('')
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [postTitle, setPostTitle] = useState('')
  const [postLocation, setPostLocation] = useState('')
  const [postAudience, setPostAudience] = useState<'Public' | 'Friends'>('Public')
  const [boostPost, setBoostPost] = useState(false)
  const [feedFilter, setFeedFilter] = useState<'All' | 'Liked' | 'Mine'>('All')
  const visiblePosts = posts.filter(p => feedFilter === 'All' ? true : feedFilter === 'Liked' ? !!liked[p.id] : p.author === 'You')
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [composerOpen, setComposerOpen] = useState(false)
  const [storyIdx, setStoryIdx] = useState<number | null>(null)
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const [tvShareMsg, setTvShareMsg] = useState('')
  // কম্পোজার মিডিয়া — একই জায়গায় ছবি + ভিডিও (ভিডিও পোস্ট রিলও হয়) + প্রোফাইল ছবি
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const profilePhotoInputRef = useRef<HTMLInputElement>(null)
  const [composerPhoto, setComposerPhoto] = useState<string | null>(null)
  const [composerVideoUrl, setComposerVideoUrl] = useState<string | null>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [composerErr, setComposerErr] = useState('')
  const [profilePhotoMsg, setProfilePhotoMsg] = useState('')
  function onComposerPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => { const d = downscaleImage(img, img.width, img.height, 800); if (d) { setComposerPhoto(d); setComposerErr('') } }
      img.src = String(r.result)
    }
    r.readAsDataURL(f)
  }
  async function onComposerVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 50 * 1024 * 1024) { setComposerErr('Video is too big — maximum 50 MB.'); return }
    const app = getFirebaseApp()
    if (!app || !uid) { setComposerErr('Video upload needs login — please log in again.'); return }
    setUploadingVideo(true); setComposerErr('')
    try {
      const storage = getStorage(app)
      const path = `uploads/${uid}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const snap = await uploadBytes(storageRef(storage, path), f)
      const url = await getDownloadURL(snap.ref)
      setComposerVideoUrl(url)
    } catch {
      setComposerErr('Video upload failed — check your connection and try again.')
    } finally { setUploadingVideo(false) }
  }
  function onComposerProfilePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => { const d = downscaleImage(img, img.width, img.height, 400); if (d) { updateProfile({ profilePhoto: d }); setProfilePhotoMsg('✅ Profile photo updated.') } }
      img.src = String(r.result)
    }
    r.readAsDataURL(f)
  }
  function resetComposer() {
    setComposerOpen(false); setText(''); setPostTitle(''); setPostLocation(''); setPostAudience('Public'); setBoostPost(false)
    setComposerPhoto(null); setComposerVideoUrl(null); setComposerErr('')
  }
  const navigate = useNavigate()
  const locState = useLocation().state as { postId?: string } | null
  // হেডার সার্চে পোস্টের সাজেশনে ট্যাপ করলে সরাসরি সেই পোস্টে যাওয়া
  useEffect(() => {
    if (locState?.postId) {
      jumpToPost(locState.postId)
      navigate('/feed', { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const searching = query.trim() !== ''
  // বন্ধু খোঁজা — হেডার সার্চের কোয়েরি দিয়ে: বন্ধু + People You May Know + চ্যাট পারসোনা + সব আসল ব্যবহারকারী
  const { results } = useAllUserSearch(friends, query)
  // পোস্ট খোঁজা — ফিডের আসল পোস্ট (সিড + নিজের বানানো), লেখা বা লেখকের নামে
  const postResults = useMemo(() => searchPosts(posts, query), [posts, query])
  function jumpToPost(postId: string) {
    setQuery('')
    requestAnimationFrame(() => {
      document.getElementById('post-' + postId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {installBonusClaimed ? (
        <p className="text-sm text-green-600">✅ Install bonus received — 5 π gift Pi added</p>
      ) : (
        <div className="rounded-xl p-4 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>
          <p className="text-lg font-extrabold">🎁 Install the app and get 5 π free!</p>
          <p className="text-sm mt-1">Install and get a 5 π bonus — gifts only.</p>
          <div className="mt-3 max-w-xs"><InstallButton showOffer={false} /></div>
        </div>
      )}
      <div className="rounded-xl p-4 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)' }}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">📺</span>
          <div className="flex-1">
            <p className="text-lg font-extrabold">Live TV — Free!</p>
            <p className="text-sm mt-0.5 text-white/85">Jamuna, Ekattor, NTV, Channel 24, Zee Bangla, Star Jalsha — watch free, no payment.</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => navigate('/live-tv')} className="px-4 py-2 rounded-full bg-white text-slate-900 font-bold text-sm">▶ Watch Now</button>
          <button onClick={async () => { const r = await shareLink('PiCall Live TV', 'Watch free Live TV on PiCall — Jamuna, Ekattor, NTV, Zee Bangla, Star Jalsha and more!', INVITE_BASE_URL); setTvShareMsg(r === 'shared' ? '✅ Shared!' : r === 'copied' ? '✅ TV link copied — send it to friends!' : 'Share failed — copy the link from the address bar.') }} className="px-4 py-2 rounded-full bg-white/20 text-white font-medium text-sm">↗ Share TV</button>
        </div>
        {tvShareMsg && <p className="text-sm text-green-200 mt-2">{tvShareMsg}</p>}
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => setComposerOpen(true)} className="shrink-0 flex flex-col items-center gap-1 w-[68px]">
          <span className="story-ring w-[68px] h-[68px] rounded-full p-[3px] flex items-center justify-center">
            <span className="w-full h-full rounded-full bg-white dark:bg-fb-card flex items-center justify-center text-2xl relative">➕<span className="absolute bottom-0 right-0 w-5 h-5 rounded-full pb-gradient text-white flex items-center justify-center text-sm border-2 border-white dark:border-fb-card">+</span></span>
          </span>
          <span className="text-[11px] font-medium text-center leading-tight">Your Story</span>
        </button>
        {friends.map((f, i) => (
          <button key={f.id} onClick={() => setStoryIdx(i)} className="shrink-0 flex flex-col items-center gap-1 w-[68px]">
            <span className="story-ring w-[68px] h-[68px] rounded-full p-[3px]">
              <span className="w-full h-full rounded-full flex items-center justify-center font-bold text-xl text-white border-[3px] border-white dark:border-black" style={{ background: f.color }}>{f.name.slice(0, 1)}</span>
            </span>
            <span className="text-[11px] font-medium text-center leading-tight truncate w-full">{f.name}</span>
          </button>
        ))}
      </div>
      {storyIdx !== null && friends[storyIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 text-white flex flex-col items-center justify-center p-6" onClick={() => setStoryIdx(null)}>
          <button className="absolute top-4 right-4 text-2xl px-3 py-1" onClick={() => setStoryIdx(null)}>✕</button>
          <span className="w-24 h-24 rounded-full text-white flex items-center justify-center text-4xl font-bold" style={{ background: friends[storyIdx].color }}>{friends[storyIdx].name.slice(0, 1)}</span>
          <p className="font-bold text-lg mt-4">{friends[storyIdx].name}</p>
          <p className="text-sm text-gray-300 mt-2 text-center">{STORY_CAPTIONS[friends[storyIdx].name] ?? STORY_CAPTION_FALLBACK}</p>
          <div className="flex gap-3 mt-6">
            <button className="px-4 py-2 rounded-full bg-white/20 disabled:opacity-40" disabled={storyIdx === 0} onClick={e => { e.stopPropagation(); setStoryIdx(storyIdx - 1) }}>‹ Previous</button>
            <button className="px-4 py-2 rounded-full bg-white/20 disabled:opacity-40" disabled={storyIdx === friends.length - 1} onClick={e => { e.stopPropagation(); setStoryIdx(storyIdx + 1) }}>Next ›</button>
          </div>
        </div>
      )}
      <Card>
        {composerOpen ? (
          <>
            <div className="flex items-center gap-2">
              <button onClick={() => profilePhotoInputRef.current?.click()} title="Set profile photo">
                {profilePhoto
                  ? <img src={profilePhoto} alt="Profile photo" className="w-10 h-10 rounded-full object-cover" />
                  : <span className="w-10 h-10 rounded-full pb-gradient text-white flex items-center justify-center font-bold">{(user?.name || 'Y').slice(0, 1)}</span>}
              </button>
              <p className="font-medium">{user?.name || 'You'}</p>
            </div>
            <input className="w-full border rounded-lg p-2 mt-2 dark:bg-slate-800 dark:border-slate-600" value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Title (optional)" />
            <textarea className="w-full border rounded-lg p-2 mt-2 dark:bg-slate-800 dark:border-slate-600" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Write something…" />
            <input className="w-full border rounded-lg p-2 mt-2 dark:bg-slate-800 dark:border-slate-600" value={postLocation} onChange={e => setPostLocation(e.target.value)} placeholder="Add location (optional)" />
            {composerPhoto && <div className="relative mt-2">
              <img src={composerPhoto} alt="Photo to post" className="rounded-xl w-full max-h-80 object-cover" />
              <button onClick={() => setComposerPhoto(null)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full px-2 py-1 text-xs">✕ Remove</button>
            </div>}
            {uploadingVideo && <p className="text-sm text-gray-500 mt-2">Uploading video…</p>}
            {composerVideoUrl && <div className="relative mt-2">
              <video src={composerVideoUrl} controls playsInline className="rounded-xl w-full max-h-80 bg-black" />
              <button onClick={() => setComposerVideoUrl(null)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full px-2 py-1 text-xs">✕ Remove</button>
            </div>}
            <div className="flex gap-2 mt-2 flex-wrap">
              <button onClick={() => photoInputRef.current?.click()} className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700">📷 Photo</button>
              <button onClick={() => videoInputRef.current?.click()} className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700">🎥 Video (max 50 MB)</button>
              <button onClick={() => profilePhotoInputRef.current?.click()} className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700">🖼️ Set profile photo</button>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onComposerPhoto} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={onComposerVideo} />
            <input ref={profilePhotoInputRef} type="file" accept="image/*" className="hidden" onChange={onComposerProfilePhoto} />
            {composerErr && <p className="text-sm text-red-500 mt-2">{composerErr}</p>}
            {profilePhotoMsg && <p className="text-sm text-green-600 mt-2">{profilePhotoMsg}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-gray-400">Share to</span>
              {(['Public', 'Friends'] as const).map(a => (
                <button key={a} onClick={() => setPostAudience(a)} className={`px-3 py-1 rounded-full text-xs font-medium ${postAudience === a ? 'pb-gradient text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>{a === 'Public' ? '🌐 Public' : '👥 Friends'}</button>
              ))}
              <button onClick={() => setBoostPost(b => !b)} className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${boostPost ? 'pb-gradient text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>🚀 Boost Post (0.1 π)</button>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Btn variant="ghost" onClick={resetComposer}>Cancel</Btn>
              <Btn disabled={(!text.trim() && !composerPhoto && !composerVideoUrl) || uploadingVideo} onClick={() => {
                let boosted = false
                if (boostPost) {
                  if (totalPi < 0.1) { alert('Not enough Pi balance — buy Pi.'); return }
                  addPi(-0.1, 'Boost', 'Post Boost'); boosted = true
                }
                setPosts([{ id: 'p' + Date.now(), author: 'You', time: 'Now', text, title: postTitle.trim() || undefined, location: postLocation.trim() || undefined, audience: postAudience, boosted, likes: 0, comments: 0, shares: 0, color: '#7C3AED', imageUrl: composerPhoto ?? undefined, videoUrl: composerVideoUrl ?? undefined }, ...posts])
                resetComposer()
              }}>Post</Btn>
            </div>
          </>
        ) : (
          <button onClick={() => setComposerOpen(true)} className="flex items-center gap-3 w-full text-left">
            {profilePhoto
              ? <img src={profilePhoto} alt="Profile photo" className="w-10 h-10 rounded-full object-cover shrink-0" />
              : <span className="w-10 h-10 rounded-full pb-gradient text-white flex items-center justify-center font-bold shrink-0">{(user?.name || 'Y').slice(0, 1)}</span>}
            <span className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-full px-4 py-2.5 text-sm text-gray-500">What's on your mind?</span>
          </button>
        )}
      </Card>
      {searching && (
        <Card>
          <h2 className="font-bold">👥 Friends ({results.length} people)</h2>
          {results.length === 0 && <p className="text-sm text-gray-500 mt-1">Nobody found — check whether the name or ID is correct.</p>}
          {results.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ background: p.color }}>{p.name.slice(0, 1)}</span>
              <span className="flex-1"><span className="font-medium">{p.name}</span><span className="block text-xs text-gray-400">ID: {p.referralCode ?? p.id}{p.mutual ? ` • ${p.mutual} mutual friends` : ''}{p.online ? ' • ● Online' : ' • ○ Offline'}</span></span>
              {p.isFriend
                ? <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: p.name } })}>💬 Chat</Btn>
                : sent[p.id]
                  ? <Btn variant="ghost" onClick={() => setSent(v => ({ ...v, [p.id]: false }))}>Remove</Btn>
                  : <Btn onClick={() => { setSent(v => ({ ...v, [p.id]: true })); addFriend({ id: p.id, name: p.name, color: p.color, online: true }) }}>Add Friend</Btn>}
            </div>
          ))}
          <h2 className="font-bold mt-4">📝 Posts ({postResults.length})</h2>
          {postResults.length === 0 && <p className="text-sm text-gray-500 mt-1">No posts found.</p>}
          {postResults.map(p => (
            <button key={p.id} onClick={() => jumpToPost(p.id)} className="block w-full text-left py-2">
              <span className="font-medium text-sm">{p.author}{p.time ? <span className="text-xs text-gray-400 font-normal"> • {p.time}</span> : null}</span>
              <span className="block text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{p.text}</span>
            </button>
          ))}
        </Card>
      )}
      <NewMembersSection />
      <RefWelcomeBanner />
      {REELS.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {REELS.map(r => (
            <div key={r.id} onClick={() => navigate('/reels')} className="shrink-0 w-36 rounded-xl bg-slate-900 text-white p-3 cursor-pointer">
              <div className="text-2xl">🎬</div><p className="text-sm font-medium mt-2">{r.title}</p><p className="text-xs opacity-70">{r.views} Views • {r.creator}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No reels yet.</p>
      )}
      <div className="flex gap-2">
        {(['All', 'Liked', 'Mine'] as const).map(f => (
          <button key={f} onClick={() => setFeedFilter(f)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${feedFilter === f ? 'pb-gradient text-white shadow-sm' : 'bg-white dark:bg-fb-card border border-gray-100 dark:border-white/10'}`}>{f === 'All' ? 'All posts' : f === 'Liked' ? '❤️ Liked' : 'My posts'}</button>
        ))}
      </div>
      {visiblePosts.length === 0 && <Card><p className="text-sm text-gray-500 text-center">{feedFilter === 'All' ? 'No posts yet — write the first post.' : 'No posts in this filter.'}</p></Card>}
      {visiblePosts.map(p => (
        <div key={p.id} id={'post-' + p.id}>
        <Card>
          <div className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ background: p.color }}>{p.author.slice(0, 1)}</span>
            <div><p className="font-bold text-sm">{p.author}</p><p className="text-xs text-gray-400">{p.time}{p.location ? ` • 📍 ${p.location}` : ''}{p.audience ? ` • ${p.audience === 'Public' ? '🌐 Public' : '👥 Friends'}` : ''}</p></div>
            {p.boosted && <span className="ml-auto text-xs font-bold text-white px-2 py-1 rounded-full pb-gradient">🚀 Boosted</span>}
          </div>
          {p.title && <p className="mt-3 font-bold">{p.title}</p>}
          <p className={`text-sm ${p.title ? 'mt-1' : 'mt-3'}`}>{p.text}</p>
          {p.imageUrl && <img src={p.imageUrl} alt="Post photo" className="rounded-xl mt-3 w-full max-h-96 object-cover" />}
          {p.videoUrl && <video src={p.videoUrl} controls playsInline className="rounded-xl mt-3 w-full max-h-96 bg-black" />}
          <div className="flex mt-3 pt-1 border-t text-sm text-gray-500 dark:text-gray-300">
            <button className={`flex-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 font-medium ${liked[p.id] ? 'text-pink-600 font-bold' : ''}`} onClick={() => setLiked(l => ({ ...l, [p.id]: !l[p.id] }))}>{liked[p.id] ? '❤️' : '👍'} Likes ({p.likes + (liked[p.id] ? 1 : 0)})</button>
            <button className="flex-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 font-medium">💬 Comments ({p.comments})</button>
            <button className="flex-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 font-medium" onClick={() => setPosts(ps => ps.map(x => x.id === p.id ? { ...x, shares: x.shares + 1 } : x))}>↗️ Share ({p.shares})</button>
          </div>
          <div className="flex gap-2 mt-3">
            <input className="flex-1 border rounded-full px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" placeholder="Write a comment…" value={commentDraft[p.id] || ''} onChange={e => setCommentDraft(d => ({ ...d, [p.id]: e.target.value }))} />
            <Btn variant="ghost" onClick={() => setCommentDraft(d => ({ ...d, [p.id]: '' }))}>Send</Btn>
          </div>
        </Card>
        </div>
      ))}
      {/* মোবাইলে ডান সাইডবারের কার্ড দুটো ফিডের নিচে আসে — একই কম্পোনেন্ট, একই আচরণ */}
      <div className="lg:hidden space-y-4">
        <ContactsCard />
        <SponsoredCard />
      </div>
    </div>
  )
}

// ---------- Marketplace / Discover / Experts ----------
export function Marketplace() {
  const [cat, setCat] = useState('All')
  const [services, setServices] = useState(SERVICES)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const { experts: liveExperts, source } = useExperts()
  const filteredExperts = liveExperts.filter(e => (cat === 'All' || e.category === cat) && (e.name + e.title).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <h1 className="text-xl font-bold flex-1">Marketplace — Experts & Services</h1>
        <Btn variant="green" onClick={() => navigate('/create-service')}>+ Create Service</Btn>
      </div>
      <input className="w-full border rounded-lg px-3 py-2 dark:bg-fb-card dark:border-slate-600" placeholder="Search — doctor, teacher, lawyer…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="flex gap-2 flex-wrap">{CATEGORIES.map(c => <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-sm ${cat === c ? 'bg-fb-blue text-white' : 'bg-white dark:bg-fb-card'}`}>{c}</button>)}</div>
      <h2 className="font-bold flex items-center gap-2 flex-wrap">Expert — call per minute
        {source === 'live' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">● Live — Railway Backend</span>}
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {filteredExperts.map(e => <ExpertCard key={e.id} expert={e} />)}
        {filteredExperts.length === 0 && <p className="text-sm text-gray-500">There is no expert yet.</p>}
      </div>
      <h2 className="font-bold pt-2">Service Marketplace</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {services.length === 0 && <p className="text-sm text-gray-500">No services yet.</p>}
        {services.map(s => (
          <Card key={s.id}>
            <p className="font-bold">{s.title}</p>
            <p className="text-sm text-gray-500">{s.provider} • ⭐ {s.rating} • {s.category}</p>
            <p className="text-sm mt-1">{s.desc}</p>
            <div className="flex justify-between items-center mt-3"><span className="font-bold text-fb-blue">{formatBDT(s.price)}</span><Btn onClick={() => alert('The order will stay pending for call confirmation. The team will call to confirm.')}>Order Now</Btn></div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-gray-400">A new service you create will show here (saved locally on this device).</p>
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
          <p className="text-xs text-gray-400">⭐ {expert.rating} • {expert.calls} Call • {expert.langs.join(', ')}</p>
        </div>
        <span className={`ml-auto text-xs font-bold ${expert.online ? 'text-green-600' : 'text-gray-400'}`}>{expert.online ? '● Online' : '○ Offline'}</span>
      </div>
      <p className="text-sm mt-2">{expert.about}</p>
      <div className="flex justify-between items-center mt-3">
        <span className="font-bold text-fb-blue">{formatPi(takaToPi(expert.rate))}/ minute</span>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => navigate(`/expert/${expert.id}`)}>Profile</Btn>
          <Btn variant="green" onClick={() => navigate(`/call/expert/${expert.id}`)}>📞 Call</Btn>
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
  if (!expert) return <Card>No expert found. <Link className="text-fb-blue" to="/marketplace">Go Back</Link></Card>
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <div className="flex gap-4 items-center">
          <span className="w-20 h-20 rounded-full text-white text-3xl flex items-center justify-center font-bold" style={{ background: expert.avatarColor }}>{expert.name.slice(0, 1)}</span>
          <div><h1 className="text-xl font-bold">{expert.name}</h1><p className="text-gray-500">{expert.title}</p><p className="text-sm">⭐ {expert.rating} • {expert.calls} Call • {expert.online ? 'Online' : 'Offline'}</p></div>
        </div>
        <p className="mt-3 text-sm">{expert.about}</p>
        <p className="mt-2 font-bold text-fb-blue text-lg">{formatPi(takaToPi(expert.rate))} / minute</p>
        <p className="text-xs text-gray-500">{FREE_MINUTES_NOTE}</p>
        <div className="flex gap-2 mt-4">
          <Btn variant="green" className="flex-1" onClick={() => navigate(`/call/expert/${expert.id}`)}>📞 Call Now</Btn>
          <Btn variant="ghost" onClick={() => navigate('/chat')}>💬 Free Chat</Btn>
        </div>
      </Card>
      <Card><h2 className="font-bold mb-2">Reviews</h2><p className="text-sm text-gray-500">No reviews yet.</p></Card>
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
      <h1 className="text-xl font-bold">Create Service</h1>
      <label className="text-sm font-medium block mt-3">Service Name</label>
      <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={title} onChange={e => setTitle(e.target.value)} />
      <label className="text-sm font-medium block mt-3">Price (Tk)</label>
      <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" type="number" value={price} onChange={e => setPrice(e.target.value)} />
      <label className="text-sm font-medium block mt-3">Description</label>
      <textarea className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" rows={3} value={desc} onChange={e => setDesc(e.target.value)} />
      <Btn className="w-full mt-4" disabled={!title || !price} onClick={() => setDone(true)}>Publish</Btn>
      {done && <p className="text-sm text-green-600 mt-3">✅ Service published. <button className="text-fb-blue" onClick={() => navigate('/marketplace')}>View Marketplace</button></p>}
    </Card></div>
  )
}

// ---------- Call (WhatsApp-style, prepaid) ----------
export function CallPage() {
  const { type, id, code: linkCode } = useParams()
  // লিংক-কল: /call/<কোড> খুলে ঢুকলে এই ব্যবহারকারী callee (কল গ্রহণকারী,
  // তিনি দেন না); /call/<type>/<id> থেকে শুরু করলে caller (কলকারী, তিনিই দেবেন)।
  const isLinkCall = !type && !!linkCode
  // আসল 1-to-1 কল (WebRTC + Railway সিগন্যালিং) — কল-বাই-লিংক; রেফ দিয়ে
  // স্টেট পড়া হয়, কারণ সিগন্যালিং হ্যান্ডলারগুলো পুরোনো রেন্ডারের ক্লোজার ধরে
  const [callCode, setCallCode] = useState<string | null>(linkCode || null)
  const [connected, setConnected] = useState(false)
  const [remoteReady, setRemoteReady] = useState(false)
  const [peerName, setPeerName] = useState('')
  const [callError, setCallError] = useState('')
  const [linkInfo, setLinkInfo] = useState<{ callerName: string } | null>(null)
  const [linkState, setLinkState] = useState<'loading' | 'ready' | 'not-found'>(isLinkCall ? 'loading' : 'ready')
  const [copied, setCopied] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const callCodeRef = useRef<string | null>(linkCode || null)
  const peerPeerIdRef = useRef<string | null>(null)
  const peerNameRef = useRef('')
  const offerSentRef = useRef(false)
  const tracksAddedRef = useRef(false)
  const pendingOfferRef = useRef<{ from: string; sdp: RTCSessionDescriptionInit } | null>(null)
  const endedRef = useRef(false)
  const secondsRef = useRef(0)
  const connectedRef = useRef(false)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const { totalPi, addPi, freeFirstMinuteUsed, markFreeMinuteUsed, addCall, user, datingRate, kycVerified, soundSettings, friends, uid, referralCode } = useStore()
  const navigate = useNavigate()
  const { experts: liveExperts } = useExperts()
  const expert = type === 'expert' ? liveExperts.find(e => e.id === id) : undefined
  const isDating = type === 'dating'
  const datingProfile = isDating ? DATING_PROFILES.find(p => p.id === id) : undefined
  const friendName = type === 'friend' ? (id || 'Friend') : undefined
  const rate = expert ? takaToPi(expert.rate) : isDating ? datingRate : FRIEND_RATE // সব কল Pi-তে — এক্সপার্টের টাকার রেট ÷১০০, ডেটিং রেট অ্যাডমিন থেকে (ডিফল্ট π ০.১), বন্ধুর কল π ০.১ ফ্ল্যাট
  const name = isLinkCall ? (linkInfo?.callerName || 'Caller') : expert ? expert.name : isDating ? (datingProfile?.name || decodeURIComponent(id || 'Dating')) : decodeURIComponent(friendName || 'Friend')
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
  const liveCost = isLinkCall ? 0 : billedMinutes * rate // লিংক-কলে গ্রহণকারী দেন না
  const maxPaidMinutes = Math.floor(totalPi / rate)
  // লিংক-কলে গ্রহণকারীর অটো-কাট সীমা নেই (0 = সীমা নেই); কলকারী আগের মতোই প্রিপেইড সীমায় চলবেন
  const maxSeconds = isLinkCall ? 0 : freeSeconds + maxPaidMinutes * 60
  const talkableMinutes = freeSeconds / 60 + maxPaidMinutes
  const canStart = isFreeAvailable || totalPi >= rate

  // টাইমার (আর বিলিং) শুধু পিয়ার সংযুক্ত হলেই চলে — অপেক্ষার সময় টাকা কাটবে না
  useEffect(() => {
    if (!connected || ended) return
    const t = setInterval(() => setSeconds(s => {
      const next = s + 1
      secondsRef.current = next
      if (next >= maxSeconds && maxSeconds > 0) { hangUp('Auto-cut — out of balance') }
      return next
    }), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, ended, maxSeconds])

  // লিংক-কল: লিংক খুলেই কে কল করছেন তা জানা — সার্ভারে রুম না থাকলে "পাওয়া যায়নি"
  function loadLinkInfo() {
    if (!linkCode) return
    setLinkState('loading')
    fetchCallInfo(linkCode).then(info => {
      if (info) { setLinkInfo({ callerName: info.callerName }); setLinkState('ready') }
      else setLinkState('not-found')
    })
  }
  useEffect(() => {
    if (!isLinkCall) return
    loadLinkInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinkCall, linkCode])

  // চলমান কলে রিংটোন বাজবে না — ইনকামিং কলের রিংটোন এই ফ্ল্যাগ দেখে থামে
  useEffect(() => { setInCallActive(connected); return () => setInCallActive(false) }, [connected])

  // ইনকামিং লিংক-কল: ধরার আগের পর্দায় (লিংক খুলে কে কল করছেন দেখালে) রিংটোন
  // বাজে — ধরলে/কাটলে/আনমাউন্ট হলে থামে, ৬০ সেকেন্ডে নিজে থামে। মোবাইলে
  // প্রথম ট্যাপের আগে অডিও সাসপেন্ডেড থাকলে ট্যাপেই শুরু হয় (ব্রাউজার নিয়ম)।
  useEffect(() => {
    if (!isLinkCall || started || ended || linkState !== 'ready') return
    const stop = startRingtone(soundSettings)
    return stop
  }, [isLinkCall, started, ended, linkState, soundSettings])

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
      maybeCreateOffer()
      maybeAnswerOffer()
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
        setCamError('This camera could not be started — staying on the previous camera.')
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
    // আসল কলে পিয়ারকেও নতুন ভিডিও ট্র্যাক পাঠাতে হয়
    const sender = pcRef.current?.getSenders().find(s => s.track && s.track.kind === 'video')
    const newVideo = combined.getVideoTracks()[0]
    if (sender && newVideo) sender.replaceTrack(newVideo).catch(() => {})
    setFacingBoth(next)
    // ক্যামেরা গোনা আবার আপডেট করা (কিছু ডিভাইসে অনুমতির পরেই সঠিক সংখ্যা আসে)
    navigator.mediaDevices?.enumerateDevices?.().then(devices => {
      setCamCount(devices.filter(d => d.kind === 'videoinput').length)
    }).catch(() => { /* ignore */ })
    setSwitching(false)
  }

  // ---------- আসল 1-to-1 কল: সিগন্যালিং + WebRTC (কল-বাই-লিংক) ----------
  function closeCallResources() {
    try { pcRef.current?.close() } catch { /* ignore */ }
    pcRef.current = null
    try { wsRef.current?.close() } catch { /* ignore */ }
    wsRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function ensurePc() {
    if (pcRef.current) return pcRef.current
    const pc = createCallPeerConnection((stream) => {
      remoteStreamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setRemoteReady(true)
      setConnected(true)
      connectedRef.current = true
    })
    pc.onicecandidate = (ev) => {
      if (ev.candidate && peerPeerIdRef.current) {
        sendCallSignal(wsRef.current, { type: 'call-ice', roomId: `call-${callCodeRef.current}`, to: peerPeerIdRef.current, candidate: ev.candidate.toJSON() })
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setCallError('Could not connect — check your network and try again.')
      }
    }
    pcRef.current = pc
    return pc
  }

  function addLocalTracks() {
    const pc = pcRef.current
    const stream = streamRef.current
    if (!pc || !stream || tracksAddedRef.current) return
    stream.getTracks().forEach(t => { try { pc.addTrack(t, stream) } catch { /* ignore */ } })
    tracksAddedRef.current = true
  }

  // কলকারী: পিয়ার ঢুকেছে + নিজের ক্যামেরা চালু — তবেই অফার পাঠানো হয়
  function maybeCreateOffer() {
    if (isLinkCall || offerSentRef.current || !peerPeerIdRef.current || !streamRef.current || !pcRef.current) return
    addLocalTracks()
    const pc = pcRef.current
    pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
      sendCallSignal(wsRef.current, { type: 'call-offer', roomId: `call-${callCodeRef.current}`, to: peerPeerIdRef.current, sdp: pc.localDescription })
      offerSentRef.current = true
    }).catch(() => { setCallError('Could not start the call — please try again.') })
  }

  // গ্রহণকারী: অফার এসেছে + নিজের ক্যামেরা চালু — তবেই উত্তর পাঠানো হয়
  async function maybeAnswerOffer() {
    const pending = pendingOfferRef.current
    if (!isLinkCall || !pending || !streamRef.current) return
    pendingOfferRef.current = null
    const pc = ensurePc()
    addLocalTracks()
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(pending.sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendCallSignal(wsRef.current, { type: 'call-answer', roomId: `call-${callCodeRef.current}`, to: pending.from, sdp: pc.localDescription })
    } catch {
      setCallError('Could not answer the call — please try again.')
    }
  }

  function joinCallRoom(code: string, role: 'caller' | 'callee') {
    callCodeRef.current = code
    const ws = connectCall(code, role, user?.name || 'You', {
      onJoined: (_peerId, peers) => {
        if (peers.length > 0) {
          peerPeerIdRef.current = peers[0].peerId
          peerNameRef.current = peers[0].name
          setPeerName(peers[0].name)
          maybeCreateOffer()
        }
      },
      onPeerJoined: (peer) => {
        peerPeerIdRef.current = peer.peerId
        peerNameRef.current = peer.name
        setPeerName(peer.name)
        maybeCreateOffer()
      },
      onOffer: (from, sdp) => {
        peerPeerIdRef.current = from
        pendingOfferRef.current = { from, sdp }
        maybeAnswerOffer()
      },
      onAnswer: (_from, sdp) => {
        pcRef.current?.setRemoteDescription(new RTCSessionDescription(sdp)).catch(() => {})
      },
      onIce: (_from, candidate) => {
        pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      },
      onChat: (_from, text) => { setChat(c => [...c, { from: peerNameRef.current || 'The other person', text }]); playChatSound(soundSettings) },
      onPeerLeft: () => { endCallLocal('The other person got disconnected') },
      onCallEnded: () => { endCallLocal('The other person ended the call') },
      onCallDeclined: () => { if (!endedRef.current && !connectedRef.current) setCallError('The call was declined — please try again.') },
      onError: (err) => {
        setCallError(err === 'call-not-found' ? 'The call was not found or has ended.' : err === 'room-full' ? 'There are already 2 people on this call.' : 'Could not connect to the server — please try again.')
      },
      onClose: () => { if (!endedRef.current && !connectedRef.current) setCallError('Could not connect to the server — please try again.') },
    })
    wsRef.current = ws
    if (!ws) setCallError('Could not connect to the server — please try again.')
  }

  // গ্রহণকারী কলটি কাটলে কলকারীকে জানানো — অপেক্ষার স্ক্রিনেই দেখাবে
  useEffect(() => {
    const off = onInviteResponse((res) => {
      if (res.code === callCodeRef.current && !res.accepted && !endedRef.current) {
        setCallError('The call was declined — please try again.')
      }
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // কলকারী শুরু করলেন: কোড বানিয়ে রুমে ঢুকলেন, লিংক শেয়ার করবেন
  function startCall() {
    if (!canStart) return
    const code = makeCallCode()
    setCallCode(code)
    callCodeRef.current = code
    setStarted(true)
    ensurePc()
    joinCallRoom(code, 'caller')
    // বন্ধুর কল: বন্ধু অনলাইনে থাকলে তার হোম পেজে ইনকামিং-কল ওভারলে যাবে
    // (presence ইনভাইট); না পৌঁছালেও শেয়ার লিংক আগের মতোই কাজ করে
    if (type === 'friend') {
      const target = friends.find((f) => f.name === name)
      if (target) {
        sendCallInvite(target.id, { code, fromId: uid ?? referralCode, fromName: user?.name || 'You', kind: 'friend' })
      }
    }
  }

  // গ্রহণকারী কল ধরলেন: রুমে ঢুকলেন, অফারের অপেক্ষা করবেন
  function acceptCall() {
    if (!linkCode) return
    setCallCode(linkCode)
    callCodeRef.current = linkCode
    setStarted(true)
    joinCallRoom(linkCode, 'callee')
  }

  async function copyCallLink() {
    if (!callCode) return
    const res = await shareLink('PiCall Video Call', `${name} is calling you on PiCall — open the link to answer`, callLink(callCode))
    if (res === 'copied' || res === 'shared') setCopied(true)
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next })
  }

  function toggleCam() {
    const next = !camOff
    setCamOff(next)
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next })
  }

  // নিজে থেকে কাটা (বোতাম / অটো-কাট): অপর পক্ষকে জানিয়ে তারপর স্থানীয়ভাবে শেষ
  function hangUp(reason: string) {
    if (wsRef.current && callCodeRef.current) {
      sendCallSignal(wsRef.current, { type: 'call-end', roomId: `call-${callCodeRef.current}` })
    }
    endCallLocal(reason)
  }

  function endCallLocal(reason: string) {
    if (endedRef.current) return
    endedRef.current = true
    closeCallResources()
    setEnded(true); setEndReason(reason || 'Call ended')
    // লিংক-কলে গ্রহণকারী দেন না — খরচ ০, ফ্রি মিনিটও খরচ হয় না; কলকারী আগের মতোই দেবেন
    const cost = isLinkCall ? 0 : roundPi(Math.ceil(Math.max(0, secondsRef.current - freeSeconds) / 60) * rate)
    if (cost > 0) addPi(-cost, 'Call Cost', `Call — ${name}`)
    if (!isLinkCall && isFreeAvailable && secondsRef.current > 0) markFreeMinuteUsed()
    addCall({ name, type: expert ? 'Expert' : isDating ? 'Dating' : 'Friend', rate, durationSec: secondsRef.current, cost, freeMinute: !isLinkCall && isFreeAvailable && secondsRef.current > 0, status: reason.startsWith('Auto-cut') ? 'Auto-cut' : 'Completed' })
  }

  function fmt(s: number) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

  function sendChat() {
    const err = contactBanCheck(chatDraft)
    if (err) { setBanMsg(err + ` (attempt ${banCount + 1} — saved in admin log)`); setBanCount(c => c + 1); return }
    if (!chatDraft.trim()) return
    const text = chatDraft
    setChat(c => [...c, { from: user?.name || 'You', text }]); setChatDraft(''); setBanMsg('')
    if (connected && callCodeRef.current) {
      sendCallSignal(wsRef.current, { type: 'call-chat', roomId: `call-${callCodeRef.current}`, text })
    }
  }

  // KYC ছাড়া ডেটিং কল শুরু করা যাবে না — কল শুরু হলে টাকাও কাটবে না
  if (isDating && !kycVerified) {
    return <DatingKycBlocked />
  }

  if (ended) {
    const cost = isLinkCall ? 0 : Math.ceil(Math.max(0, seconds - freeSeconds) / 60) * rate
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">Call ended</h1>
          <p className="mt-2">{name} • {fmt(seconds)}</p>
          <p className="mt-1 text-sm">Cost: {formatPi(cost)}{isFreeAvailable && seconds > 0 ? ' (first 1 minute free applied)' : ''}</p>
          <p className="text-sm text-gray-300">{endReason}</p>
          <p className="text-sm mt-1">Current Pi Balance: {formatPi(totalPi)}</p>
          <div className="flex gap-2 mt-5 justify-center">
            <Btn variant="green" onClick={() => navigate('/call-history')}>Call History</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/feed')}>Back to Feed</Btn>
          </div>
        </Card>
      </div>
    )
  }

  // লিংক-কল: ধরার আগের পর্দা — কে কল করছেন, ধরবেন না কাটবেন (WhatsApp-স্টাইল)
  if (isLinkCall && !started) {
    if (linkState === 'loading') {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
            <h1 className="text-xl font-bold">Finding a call…</h1>
          </Card>
        </div>
      )
    }
    if (linkState === 'not-found') {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
            <h1 className="text-xl font-bold">Call not found</h1>
            <p className="text-sm text-gray-300 mt-2">The link may be wrong, or the call may have ended. Ask the caller to send the link again.</p>
            <div className="flex gap-2 mt-5 justify-center">
              <Btn variant="green" onClick={loadLinkInfo}>↻ Try Again</Btn>
              <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/feed')}>Back to Feed</Btn>
            </div>
          </Card>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <span className="w-24 h-24 rounded-full bg-fb-blue text-4xl flex items-center justify-center font-bold mx-auto">{name.slice(0, 1)}</span>
          <h1 className="text-xl font-bold mt-3">📞 {name} is calling you</h1>
          <p className="text-sm text-gray-300 mt-1">PiCall video call • The caller pays for this call, your Pi will not be cut.</p>
          <p className="text-xs text-gray-400 mt-2">Your camera and mic will turn on when you answer the call.</p>
          <div className="flex gap-3 mt-6 justify-center">
            <button onClick={acceptCall} className="px-6 py-3 rounded-full bg-green-600 text-white font-bold text-lg">✅ Answer</button>
            <button onClick={() => navigate('/feed')} className="px-6 py-3 rounded-full bg-red-600 text-white font-bold text-lg">❌ Decline</button>
          </div>
        </Card>
      </div>
    )
  }

  // কল শুরু হয়েছে কিন্তু পিয়ার এখনো সংযুক্ত হননি — অপেক্ষার পর্দা (লিংকসহ)
  if (started && !connected && !ended) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <span className="w-24 h-24 rounded-full bg-fb-blue text-4xl flex items-center justify-center font-bold mx-auto">{name.slice(0, 1)}</span>
          <h1 className="text-xl font-bold mt-3">📞 {name}</h1>
          {callError
            ? <p className="mt-3 bg-red-600 rounded-lg px-3 py-2 text-sm font-medium">{callError}</p>
            : <p className="text-sm text-gray-300 mt-2">{isLinkCall ? 'Connecting…' : 'Waiting for the other person…'}</p>}
          {!isLinkCall && callCode && (
            <div className="mt-4 text-left">
              <p className="text-sm text-gray-300">Call link — send it to the person you are calling, the call will connect as soon as they open the link:</p>
              <p className="text-sm mt-2 break-all bg-slate-700 rounded-lg px-3 py-2">{callLink(callCode)}</p>
              <div className="flex gap-2 mt-3">
                <Btn className="flex-1" onClick={copyCallLink}>{copied ? '✅ Copied!' : '🔗 Copy Link'}</Btn>
              </div>
              <p className="text-xs text-gray-400 mt-2">No money will be cut while waiting — the timer and billing start only after connecting.</p>
            </div>
          )}
          <button onClick={() => hangUp('Call cancelled')} className="mt-5 px-6 py-2 rounded-full bg-red-600 text-white font-bold">❌ Reject</button>
        </Card>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full">
          <h1 className="text-xl font-bold">📞 {name}</h1>
          <p className="text-sm text-gray-300">{expert ? `${expert.title} • ` : isDating ? 'Dating • ' : 'Friend • '}{formatPi(rate)}/ minute</p>
          {isFreeAvailable && <p className="mt-2 text-sm bg-green-600 rounded-lg px-3 py-2">🎉 1st minute free — your first call's first 1 minute is completely free!</p>}
          {isDating && <div className="mt-2 space-y-2">
            <p className="text-sm bg-pink-600 rounded-lg px-3 py-2">💳 Prepaid video call — {formatPi(rate)}/minute. Only you (the caller) will pay; the person you are calling will not be charged. The free minute does not apply to this call.</p>
            <p className="text-xs text-gray-300">🔴 This call, like other calls, is covered by admin-only recording — only the admin can view it for appeals/disputes.</p>
          </div>}
          <div className="mt-4 space-y-1 text-sm">
            <p>Pi Balance: <b>{formatPi(totalPi)}</b></p>
            <p>You can talk: <b>~{talkableMinutes} Minutes</b>{isFreeAvailable ? ' (with 1 minute free)' : ''}</p>
            <p>Per minute: <b>{formatPi(rate)}</b> • The call will cut itself when the Pi balance ends.</p>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-300 mb-2">📷 Which camera will you start with?</p>
            <div className="flex gap-2">
              <button onClick={() => setFacingBoth('user')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${facing === 'user' ? 'bg-fb-blue text-white' : 'bg-slate-700 text-white'}`}>🤳 Front Camera</button>
              <button onClick={() => setFacingBoth('environment')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${facing === 'environment' ? 'bg-fb-blue text-white' : 'bg-slate-700 text-white'}`}>📷 Back Camera</button>
            </div>
            <p className="text-xs text-gray-400 mt-1">You can switch cameras with the 🔄 button below even during a call.</p>
          </div>
          {!canStart && <p className="mt-3 bg-red-600 rounded-lg px-3 py-2 text-sm font-medium">⚠️ You cannot call without a Pi balance. Prepaid calls — buy Pi first.</p>}
          <p className="text-xs text-gray-400 mt-3">Once the call starts you will get a link — send it to the person you are calling, the call will connect as soon as they open the link.</p>
          <div className="flex gap-2 mt-5">
            <Btn variant="green" className="flex-1" disabled={!canStart} onClick={startCall}>▶️ Start Call</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>Buy π Pi</Btn>
          </div>
          <button className="text-sm text-gray-300 mt-3" onClick={() => navigate(-1)}>← Go Back</button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative">
      {/* small red dot only — no "Recording" text by design; recording is admin-only for appeals */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" title="Admin-only recording indicator" />
        <span className="text-xs glass px-2 py-1 rounded-full">{fmt(seconds)} • {liveCost === 0 ? 'Free' : formatPi(liveCost)}</span>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <video ref={(el) => { videoRef.current = el; if (el && remoteStreamRef.current) el.srcObject = remoteStreamRef.current }} className={`absolute inset-0 w-full h-full object-cover ${remoteReady ? 'opacity-100' : 'opacity-0'}`} autoPlay playsInline />
        {!remoteReady && (
          <div className="text-center">
            <span className="w-28 h-28 rounded-full bg-fb-blue text-4xl flex items-center justify-center font-bold mx-auto">{name.slice(0, 1)}</span>
            <p className="text-xl font-bold mt-3">{name}</p>
            <p className="text-gray-300 text-sm">{fmt(seconds)} • {isFreeAvailable && seconds < 60 ? '1st minute free' : `${formatPi(liveCost)}`}</p>
            {sharing && <p className="text-xs mt-2 pb-gradient inline-block px-2 py-1 rounded">🖥️ Screen Sharing</p>}
            {camOff && <p className="text-xs mt-2">📷 Camera Off</p>}
          </div>
        )}
        {/* সামনের ক্যামেরায় সেলফ-ভিউ আয়নার মতো (mirror), পেছনের ক্যামেরায় নয় */}
        <video ref={(el) => { selfRef.current = el; if (el && streamRef.current) el.srcObject = streamRef.current }} style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }} className="absolute bottom-24 right-4 w-28 h-36 rounded-xl object-cover border-2 border-white bg-slate-700" autoPlay playsInline muted />
      </div>
      <div className="px-3 pb-3">
        <div className="max-w-md mx-auto glass rounded-xl p-2 mb-3 max-h-32 overflow-y-auto">
          {chat.length === 0 && <p className="text-xs text-gray-300 text-center">In-call chat — sharing numbers/links/emails is blocked.</p>}
          {chat.map((m, i) => <p key={i} className="text-sm"><b>{m.from}:</b> {m.text}</p>)}
        </div>
        {banMsg && <p className="text-xs text-red-300 text-center mb-2">{banMsg}</p>}
        <div className="flex gap-2 max-w-md mx-auto mb-4">
          <input className="flex-1 rounded-full px-3 py-2 text-sm text-black" placeholder="Write a message…" value={chatDraft} onChange={e => setChatDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
          <Btn onClick={sendChat}>Send</Btn>
        </div>
        <div className="flex justify-center gap-3 pb-2">
          <button onClick={toggleMute} className="w-14 h-14 rounded-full glass text-2xl" title="Mic">{muted ? '🔇' : '🎤'}</button>
          <button onClick={toggleCam} className="w-14 h-14 rounded-full glass text-2xl" title="Camera">{camOff ? '📷' : '📹'}</button>
          <button onClick={() => setSharing(s => !s)} className={`w-14 h-14 rounded-full text-2xl ${sharing ? 'pb-gradient' : 'glass'}`} title="Screen Share">🖥️</button>
          <button onClick={switchCamera} disabled={switching || camCount === 1} className="h-14 px-3 rounded-full glass text-sm font-bold disabled:opacity-50" title="Switch camera — front ↔ back">🔄 {switching ? 'Changing…' : `Camera: ${facing === 'user' ? 'Front' : 'Back'}`}</button>
          <button onClick={() => hangUp('You ended the call')} className="w-16 h-16 rounded-full bg-red-600 text-3xl" title="Call ended">📞</button>
        </div>
        {camCount === 1 && <p className="text-center text-xs text-yellow-300 mb-1">This device has 1 camera — you cannot switch cameras.</p>}
        {camError && <p className="text-center text-xs text-red-300 mb-1">{camError}</p>}
        {callError && <p className="text-center text-xs text-red-300 mb-1">{callError}</p>}
        <p className="text-center text-xs text-gray-400">{isLinkCall ? 'The caller will pay for this call' : `Call will auto-cut when balance ends${maxSeconds > 0 ? ` • Max ${fmt(maxSeconds)}` : ''}`}</p>
      </div>
    </div>
  )
}

// ---------- Call history ----------
export function CallHistory() {
  const { calls } = useStore()
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">📞 Call History</h1>
      {calls.length === 0 && <Card><p className="text-sm text-gray-500">No call yet. The first call's first 1 minute is free!</p></Card>}
      {calls.map(c => (
        <Card key={c.id}>
          <div className="flex justify-between"><b>{c.name}</b><span className="text-xs text-gray-400">{c.time}</span></div>
          <p className="text-sm text-gray-500">{c.type} • {formatPi(c.rate)}/minute • {Math.floor(c.durationSec / 60)} min {c.durationSec % 60} sec • {c.status}</p>
          <p className="text-sm font-bold">Cost: {formatPi(c.cost)}{c.freeMinute ? ' (with 1st minute free)' : ''}</p>
        </Card>
      ))}
    </div>
  )
}

// ---------- π Pi রিপোর্ট ----------
// ওয়ালেটে Pi-র পুরো হিসাব — খতিয়ান (piLedger) থেকে যোগফল; চলমান ব্যালেন্স বর্তমান ব্যালেন্স থেকে পেছনে গুনে বের করা হয়,
// তাই খতিয়ানের সব লাইনের যোগফল সবসময় বর্তমান ব্যালেন্সের সঙ্গে মেলে।
const TYPE_LABELS: Record<string, string> = {
  'জমা': 'Deposit', 'তোলা': 'Withdraw', 'ডেইলি বোনাস': 'Daily Bonus',
  'রেফারেল': 'Referral', 'লাইভ আয়': 'Live Earnings', 'গিফট বক্স': 'Gift Box',
  'ইন্সটল বোনাস': 'Install Bonus', 'কল খরচ': 'Call Cost', 'লাইভ দেখা': 'Watching Live',
  'গিফট দেওয়া': 'Gifts Sent', 'বুস্ট': 'Boost', 'সুপার লাইক': 'Super Like',
  'সমন্বয়': 'Adjustment',
}
// Old rows stored before the English switch keep Bengali types — TYPE_LABELS
// shows them in English; sum() below also counts both spellings.
function PiReportCard() {
  const { piLedger, piBalance, bonusPi, totalPi } = useStore()
  const sum = (types: string[]) => roundPi(piLedger.filter(r => types.includes(r.type)).reduce((s, r) => s + r.amount, 0))
  const totalDeposit = sum(['Deposit', 'জমা'])
  const totalWithdraw = roundPi(-sum(['Withdraw', 'তোলা']))
  const totalIncome = sum(['Daily Bonus', 'ডেইলি বোনাস', 'Referral', 'রেফারেল', 'Live Earnings', 'লাইভ আয়', 'Gift Box', 'গিফট বক্স', 'Install Bonus', 'ইন্সটল বোনাস'])
  const totalExpense = roundPi(-sum(['Call Cost', 'কল খরচ', 'Watching Live', 'লাইভ দেখা', 'Gifts Sent', 'গিফট দেওয়া', 'Boost', 'বুস্ট', 'Super Like', 'সুপার লাইক']))
  let run = totalPi
  const rows = piLedger.map(r => { const after = run; run = roundPi(run - r.amount); return { ...r, after } })
  return (
    <Card>
      <h2 className="font-bold">📊 π Pi Report</h2>
      <div className="grid grid-cols-2 gap-2 mt-3 text-center">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2"><p className="text-xs text-gray-500">Total Deposited</p><p className="font-bold text-green-600">{formatPi(totalDeposit)}</p></div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2"><p className="text-xs text-gray-500">Total Withdrawn</p><p className="font-bold text-red-600">{formatPi(totalWithdraw)}</p></div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2"><p className="text-xs text-gray-500">Total earnings (bonus+referral+live+gift box)</p><p className="font-bold text-green-600">{formatPi(totalIncome)}</p></div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2"><p className="text-xs text-gray-500">Total spent (calls+live+gifts)</p><p className="font-bold text-red-600">{formatPi(totalExpense)}</p></div>
      </div>
      <p className="text-center text-sm mt-1">Withdrawable: <b>{formatPi(piBalance)}</b> • Bonus Pi: <b>{formatPi(bonusPi)}</b> <span className="text-gray-500">(usable only for calls/live gifts, cannot be withdrawn)</span></p>
      <p className="text-xs text-gray-400 mt-1">Buying Pi is outside income-expense — it is on a separate ledger line.</p>
      {rows.length === 0
        ? <p className="text-sm text-gray-500 mt-3">No transactions yet.</p>
        : <div className="mt-3 space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-start justify-between gap-2 border-b pb-2 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-bold"><span className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs mr-1">{TYPE_LABELS[r.type] ?? r.type}</span>{r.label}</p>
                <p className="text-xs text-gray-400">{r.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${r.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.amount >= 0 ? '+' : '−'}{formatPi(Math.abs(r.amount))}</p>
                <p className="text-xs text-gray-400">Balance: {formatPi(r.after)}</p>
              </div>
            </div>
          ))}
        </div>}
    </Card>
  )
}

// ---------- Wallet ----------
export function WalletPage() {
  const { points, referrals, referralCode, piBalance, bonusPi, totalPi, addPi, piDeposits, piWithdrawals, depositPi, withdrawPi, piRateBDT, usdtRateBDT, piWithdrawFeePct, piMinWithdraw, pendingTopUps, submitManualTopUp, adminSettings } = useStore()
  const [amount, setAmount] = useState(500)
  const [method, setMethod] = useState('bKash')
  const [trx, setTrx] = useState('')
  const [msg, setMsg] = useState('')
  const [usdtNetwork, setUsdtNetwork] = useState('BEP20')
  const [depAmount, setDepAmount] = useState('')
  const [depRef, setDepRef] = useState('')
  const [depMsg, setDepMsg] = useState('')
  const [wdAddress, setWdAddress] = useState('')
  const [wdAmount, setWdAmount] = useState('')
  const [wdMsg, setWdMsg] = useState('')
  const [copied, setCopied] = useState('')
  const [affiliateOn, setAffiliateOn] = useState(false)
  const [depChain, setDepChain] = useState('Pi Mainnet')
  const [wdChain, setWdChain] = useState('Pi Mainnet')
  const isUsdt = method === 'USDT'
  const isBinance = method === 'Binance Pay'
  const isUsdtAmount = isUsdt || isBinance
  // ব্যাংক বাদ — সব টপ-আপ এখন ম্যানুয়াল (অ্যাডমিন অনুমোদন), তাৎক্ষণিক টপ-আপ আর নেই
  const net = USDT_NETWORKS.find(n => n.id === usdtNetwork) || USDT_NETWORKS[1]
  // টপ-আপের অটো Pi রূপান্তর — ফর্মেই দেখা যায় কত Pi পাওয়া যাবে (টাকা ÷ Pi দর; USDT × USDT দর ÷ Pi দর)
  const previewPi = topUpPi(Number(amount) || 0, isUsdtAmount ? 'USDT' : 'BDT', piRateBDT, usdtRateBDT)
  // অ্যাডমিন সেটিংসে আসল নম্বর/ঠিকানা বসানো থাকলে সেটাই দেখাবে; না থাকলে
  // "Not set up yet — ask the admin" দেখাবে — কোনো ডেমো নম্বর/ঠিকানা দেখানো হয় না
  const savedPayNumber = method === 'bKash' ? adminSettings.payments.bkash : method === 'Nagad' ? adminSettings.payments.nagad : method === 'Rocket' ? adminSettings.payments.rocket : ''
  const savedUsdtAddress = usdtNetwork === 'BEP20' ? adminSettings.payments.usdtBep20 : adminSettings.payments.usdtErc20
  const savedBinanceId = adminSettings.payments.binancePayId
  const savedPiAddress = adminSettings.payments.piDepositAddress
  const savedPiTestnetAddress = adminSettings.payments.piTestnetAddress || ''
  function copyText(t: string, label: string) { navigator.clipboard?.writeText(t).then(() => setCopied(label)).catch(() => setCopied('')) }
  function doTopUp() {
    // সব টপ-আপ ম্যানুয়াল — আবেদন জমা হয়, অ্যাডমিন অনুমোদন দিলে Pi যোগ হয়
    const err = submitManualTopUp(isUsdt ? `USDT (${usdtNetwork})` : method, Number(amount), trx, isUsdtAmount ? 'USDT' : 'BDT', isUsdt ? usdtNetwork : undefined)
    setMsg(err || `✅ ${method} request submitted — ${formatPi(previewPi)} Pi will be added after admin approval.`)
    if (!err) setTrx('')
  }
  function doDeposit() {
    const m = Number(depAmount)
    if (!Number.isFinite(m) || m <= 0) { setDepMsg('Enter a valid amount.'); return }
    if (!depRef.trim()) { setDepMsg('Enter the Transaction / Memo reference.'); return }
    depositPi(m, depRef, depChain)
    setDepMsg(`✅ ${formatPi(m)} deposit recorded (${depChain}).`)
    setDepAmount(''); setDepRef('')
  }
  function doWithdraw() {
    const m = Number(wdAmount)
    const a = wdAddress.trim()
    if (a.length !== 56 || !a.startsWith('G')) { setWdMsg('Invalid address — a Pi address starts with G and is 56 characters.'); return }
    if (!Number.isFinite(m) || m < piMinWithdraw) { setWdMsg(`Minimum withdraw: Pi equal to 10 USDT (${formatPi(piMinWithdraw)}).`); return }
    if (m > totalPi) { setWdMsg('Not enough Pi balance.'); return }
    if (m > piBalance) { setWdMsg('Bonus Pi cannot be withdrawn — it can only be used for calls/live gifts.'); return }
    if (!withdrawPi(m, a, wdChain)) { setWdMsg('Could not withdraw — check the amount and address again.'); return }
    setWdMsg('✅ Withdraw request submitted — ⏳ Processing.')
    setWdAddress(''); setWdAmount('')
  }
  const wdAmt = Number(wdAmount) || 0
  const wdFee = wdAmt >= piMinWithdraw ? piWithdrawFee(wdAmt, piWithdrawFeePct) : 0
  const wdReceive = roundPi(wdAmt - wdFee)
  const pendingList = pendingTopUps.filter(t => t.status === 'pending')
  const doneList = pendingTopUps.filter(t => t.status !== 'pending')
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card className="text-center">
        <p className="text-gray-500 text-sm">Wallet Balance</p>
        <p className="text-4xl font-extrabold text-purple-600">π {formatPi(totalPi)}</p>
        <p className="text-sm text-gray-500 mt-1">Withdrawable: <b>{formatPi(piBalance)}</b> • Bonus Pi: <b>{formatPi(bonusPi)}</b></p>
        <p className="text-xs text-amber-600 mt-1">Bonus Pi cannot be withdrawn — it can only be used for calls/live gifts.</p>
        <p className="text-sm text-gray-500 mt-1">Reward Points: {points} • Referral: {referrals} people</p>
        <p className="text-xs text-gray-400 mt-1">Calls and live are prepaid — they will not work without a Pi balance. Whatever money or USDT you put in will auto-convert to Pi.</p>
      </Card>
      <Card>
        <h2 className="font-bold">π Pi Wallet</h2>
        <p className="text-xs text-gray-500 mt-1">Rate: 1 Pi = {formatBDT(piRateBDT)} • 1 USDT = {formatBDT(usdtRateBDT)} (set by admin)</p>
        <div className="mt-4 border-t pt-3">
          <p className="text-sm font-bold">π Pi Deposit</p>
          <label className="text-sm block mt-2">Pi Chain</label>
          <div className="flex gap-2 flex-wrap mt-1">{(['Pi Mainnet', 'Pi Testnet'] as const).map(c => (
            <button key={c} onClick={() => setDepChain(c)} className={`px-3 py-1.5 rounded-full text-sm border ${depChain === c ? 'bg-fb-blue text-white' : ''}`}>{c === 'Pi Mainnet' ? 'Pi Mainnet (real Pi)' : 'Pi Testnet (test Pi, no value)'}</button>
          ))}</div>
          {depChain === 'Pi Mainnet'
            ? savedPiAddress
              ? <><p className="text-sm mt-2">PiCall Pi address (Pi Mainnet): <code className="break-all">{savedPiAddress}</code></p>
                <Btn variant="ghost" className="mt-1" onClick={() => copyText(savedPiAddress, 'Pi Deposit Address')}>📋 Copy Address</Btn></>
              : <p className="text-sm mt-2">PiCall Pi address (Pi Mainnet): <b className="text-gray-400">Not set up yet — ask the admin</b></p>
            : savedPiTestnetAddress
              ? <><p className="text-sm mt-2">PiCall Pi address (Pi Testnet): <code className="break-all">{savedPiTestnetAddress}</code></p>
                <Btn variant="ghost" className="mt-1" onClick={() => copyText(savedPiTestnetAddress, 'Pi Testnet Address')}>📋 Copy Address</Btn></>
              : <p className="text-sm mt-2">PiCall Pi address (Pi Testnet): <b className="text-gray-400">Not set up yet — ask the admin</b></p>}
          {depChain === 'Pi Testnet' && <p className="text-xs text-amber-600 mt-1">Test Pi has no value — for testing only.</p>}
          <label className="text-sm block mt-2">Amount of Pi Sent</label>
          <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={depAmount} onChange={e => setDepAmount(e.target.value)} placeholder="e.g. 5" />
          <label className="text-sm block mt-2">Transaction / Memo Reference</label>
          <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={depRef} onChange={e => setDepRef(e.target.value)} placeholder="e.g. PI-TX-..." />
          <Btn variant="green" className="w-full mt-3" onClick={doDeposit}>Confirm Deposit</Btn>
          {depMsg && <p className="text-sm mt-2">{depMsg}</p>}
          {piDeposits.length > 0 && <div className="mt-2">{piDeposits.map(d => <p key={d.id} className="text-sm text-gray-500">{formatPi(d.amount)} • {d.ref}{d.chain ? ` • ${d.chain}` : ''} • {d.date} • {d.status}</p>)}</div>}
        </div>
        <div className="mt-4 border-t pt-3">
          <p className="text-sm font-bold">π Pi Withdraw</p>
          <label className="text-sm block mt-2">Pi Chain</label>
          <div className="flex gap-2 flex-wrap mt-1">{(['Pi Mainnet', 'Pi Testnet'] as const).map(c => (
            <button key={c} onClick={() => setWdChain(c)} className={`px-3 py-1.5 rounded-full text-sm border ${wdChain === c ? 'bg-fb-blue text-white' : ''}`}>{c === 'Pi Mainnet' ? 'Pi Mainnet (real Pi)' : 'Pi Testnet (test Pi, no value)'}</button>
          ))}</div>
          {wdChain === 'Pi Testnet' && <p className="text-xs text-amber-600 mt-1">Test Pi has no value — for testing only.</p>}
          <p className="text-sm mt-1">Withdrawable: <b>{formatPi(piBalance)}</b> • Minimum withdraw: Pi equal to 10 USDT ({formatPi(piMinWithdraw)}) • Rate: 1 Pi = {formatBDT(piRateBDT)} • 1 USDT = {formatBDT(usdtRateBDT)}</p>
          <label className="text-sm block mt-2">Your Pi address (starts with G, 56 characters)</label>
          <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={wdAddress} onChange={e => setWdAddress(e.target.value)} placeholder="G..." />
          <label className="text-sm block mt-2">Amount (Pi)</label>
          <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={wdAmount} onChange={e => setWdAmount(e.target.value)} placeholder={`Minimum ${formatPi(piMinWithdraw)}`} />
          {wdAmt >= piMinWithdraw && <p className="text-sm mt-2">Withdraw amount: {formatPi(wdAmt)} • Fee ({piWithdrawFeePct}%): {formatPi(wdFee)} • You will get: {formatPi(wdReceive)}</p>}
          <Btn variant="green" className="w-full mt-3" onClick={doWithdraw}>Withdraw Pi</Btn>
          {wdMsg && <p className="text-sm mt-2">{wdMsg}</p>}
          {piWithdrawals.length > 0 && <div className="mt-2">{piWithdrawals.map(w => <p key={w.id} className="text-sm text-gray-500">{formatPi(w.amount)} • Fee {formatPi(w.fee)} • Will get {formatPi(w.received)}{w.chain ? ` • ${w.chain}` : ''} • {shortPiAddress(w.address)} • {w.date} • {w.status}</p>)}</div>}
        </div>
        <p className="text-xs text-gray-400 mt-3">Real Pi payments need the official Pi SDK + Pi app approval; no real blockchain transaction happens here, and no seed/private key is asked for or stored.</p>
      </Card>
            <Card>
        <h2 className="font-bold">💰 Top Up</h2>
        {!isUsdtAmount && <div className="flex gap-2 flex-wrap mt-3">{TOPUP_PACKS.map(p => <button key={p} onClick={() => setAmount(p)} className={`px-4 py-2 rounded-lg border font-bold ${amount === p ? 'bg-fb-blue text-white' : 'bg-gray-50 dark:bg-slate-800'}`}>{formatBDT(p)}</button>)}</div>}
        <label className="text-sm block mt-3">Amount ({isUsdtAmount ? 'USDT' : 'Tk'})</label>
        <input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={amount} onChange={e => setAmount(Number(e.target.value))} />
        {previewPi > 0 && <p className="text-sm mt-1 text-green-600 font-bold">≈ {formatPi(previewPi)} will get (auto){isUsdtAmount ? ` — Rate: 1 USDT = ${formatBDT(usdtRateBDT)}` : ` — Rate: 1 Pi = ${formatBDT(piRateBDT)}`}।</p>}
        <label className="text-sm block mt-3">Payment Method</label>
        <div className="flex gap-2 flex-wrap mt-1">{['bKash', 'Nagad', 'Rocket', 'USDT', 'Binance Pay'].map(m => <button key={m} onClick={() => setMethod(m)} className={`px-3 py-1.5 rounded-full text-sm border ${method === m ? 'bg-fb-blue text-white' : ''}`}>{m}</button>)}</div>
        <div className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-3">
          <p className="font-bold">Manual Payment — Steps:</p>
          <p>1. To the address below {isUsdtAmount ? `${amount || 0} USDT` : `${formatBDT(Number(amount) || 0)}`} Send.</p>
          <p>2. Below {isUsdt ? 'Transaction Hash' : isBinance ? 'Binance Pay reference' : 'TrxID'} Write and submit the request. Pi will be added after admin approval.</p>
        </div>
        {(method === 'bKash' || method === 'Nagad' || method === 'Rocket') && <div className="text-sm mt-3">
          {savedPayNumber
            ? <><p>{method} Number: <b>{savedPayNumber}</b></p>
              <Btn variant="ghost" className="mt-1" onClick={() => copyText(savedPayNumber, method)}>📋 Copy Number</Btn></>
            : <p>{method} Number: <b className="text-gray-400">Not set up yet — ask the admin</b></p>}
        </div>}
        {isUsdt && <div className="mt-3">
          <label className="text-sm block">Choose Network</label>
          <div className="flex gap-2 flex-wrap mt-1">{USDT_NETWORKS.map(n => <button key={n.id} onClick={() => setUsdtNetwork(n.id)} className={`px-3 py-2 rounded-lg border text-sm text-left ${usdtNetwork === n.id ? 'bg-fb-blue text-white border-fb-blue' : 'bg-gray-50 dark:bg-slate-800'}`}>
            <span className="font-bold block">{n.name}{n.cheapest ? ' • Cheapest' : ''}</span>
            <span className="text-xs opacity-80">{n.feeHint}</span>
          </button>)}</div>
          {savedUsdtAddress
            ? <><p className="text-sm mt-2">Address ({net.id}): <code className="break-all">{savedUsdtAddress}</code></p>
              <Btn variant="ghost" className="mt-1" onClick={() => copyText(savedUsdtAddress, 'USDT')}>📋 Copy Address</Btn></>
            : <p className="text-sm mt-2">Address ({net.id}): <b className="text-gray-400">Not set up yet — ask the admin</b></p>}
          <p className="text-xs text-red-600 mt-2">⚠️ You must send on the network you chose — sending on the wrong network will lose the money.</p>
          <p className="text-xs text-gray-400 mt-1">Fee is approximate and may change.</p>
        </div>}
        {isBinance && <div className="text-sm mt-3">
          {savedBinanceId
            ? <><p>Binance Pay ID: <b>{savedBinanceId}</b></p>
              <Btn variant="ghost" className="mt-1" onClick={() => copyText(savedBinanceId, 'Binance Pay')}>📋 Copy ID</Btn></>
            : <p>Binance Pay ID: <b className="text-gray-400">Not set up yet — ask the admin</b></p>}
        </div>}
        {copied && <p className="text-xs text-green-600 mt-1">✅ {copied} Copied.</p>}
        <><label className="text-sm block mt-3">{isUsdt ? 'Transaction Hash' : isBinance ? 'Binance Pay reference' : 'TrxID'}</label><input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={trx} onChange={e => setTrx(e.target.value)} placeholder={isUsdt ? 'e.g. 0x...' : isBinance ? 'e.g. BP-...' : 'e.g. 9HX7...'} /><p className="text-xs text-gray-400 mt-1">The same reference cannot be used twice.</p></>
        <Btn variant="green" className="w-full mt-4" onClick={doTopUp}>Submit Request</Btn>
        {msg && <p className="text-sm mt-2">{msg}</p>}
        {pendingList.length > 0 && <div className="mt-4">
          <p className="text-sm font-bold">⏳ Top-up under review — Pi will be added after admin approval.</p>
          {pendingList.map(t => <p key={t.id} className="text-sm mt-1">{t.method}{t.network ? ` (${t.network})` : ''} — {t.currency === 'USDT' ? `${t.amount} USDT → ${formatPi(topUpPi(t.amount, 'USDT', piRateBDT, usdtRateBDT))}` : `${formatBDT(t.amount)} → ${formatPi(topUpPi(t.amount, 'BDT', piRateBDT, usdtRateBDT))}`} • {t.trxId} • {t.date}</p>)}
        </div>}
        {doneList.length > 0 && <div className="mt-3">
          <p className="text-sm font-bold">Earlier Requests</p>
          {doneList.map(t => <p key={t.id} className="text-sm mt-1 text-gray-500">{t.method} — {t.currency === 'USDT' ? `${t.amount} USDT` : formatBDT(t.amount)} • {t.status === 'approved' ? '✅ Approved' : '❌ Rejected'} • {t.date}</p>)}
        </div>}
      </Card>
            <PiReportCard />
      <DailyBonusCard />
      <InviteCard />
      <Card>
        <h2 className="font-bold">🔗 Affiliate & Referral</h2>
        <p className="text-sm mt-1 break-all">Your link: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{`${INVITE_BASE_URL}?ref=${referralCode}`}</code></p>
        <p className="text-sm mt-1">Commission <b>10%</b> — only for the referred user <b>First deposit + first purchase (call/service/premium)</b> You get it only when it is complete. No commission for just signup or clicks.</p>
        <p className="text-sm mt-1">Referral 2-tier: Level-1 = 1.0 points, Level-2 = 0.5 points • 1 point = Tk 50.</p>
        <Btn variant="ghost" className="mt-3" onClick={() => setAffiliateOn(a => !a)}>{affiliateOn ? 'Hide Dashboard' : 'View Affiliate Dashboard'}</Btn>
        {affiliateOn && <p className="text-sm mt-2">Earnings so far: Tk 0 • Eligible referrals: 0 people (first deposit + purchase pending).</p>}
      </Card>
    </div>
  )
}

// ---------- Friends ----------
export function FriendsPage() {
  const { friends, requests, acceptRequest, removeFriend, addFriend, referralCode } = useStore()
  const navigate = useNavigate()
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [showSugg, setShowSugg] = useState(false)
  const [copied, setCopied] = useState(false)
  const searching = query.trim() !== ''
  // খোঁজার তালিকা: বন্ধু + People You May Know + চ্যাট পারসোনা + সব আসল ব্যবহারকারী
  // (নাম/আইডি দিয়ে ডুপ্লিকেট বাদ, নিজেকে বাদ)
  const { results, suggestions } = useAllUserSearch(friends, query)
  async function copyId() {
    try { await navigator.clipboard.writeText(referralCode); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* কপি না হলে আইডিটা দেখেই নেওয়া যাবে */ }
  }
  function addFromSearch(p: SearchablePerson) {
    setSent(v => ({ ...v, [p.id]: true }))
    addFriend({ id: p.id, name: p.name, color: p.color, online: true })
  }
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">👥 Friends</h1>
      <Card>
        <p className="text-sm">🪪 Your ID: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{referralCode}</code> <Btn variant="ghost" onClick={copyId}>{copied ? '✅ Copied!' : '📋 Copy'}</Btn></p>
        <p className="text-xs text-gray-400 mt-1">Give this ID to friends — they can find you by this ID or your name.</p>
      </Card>
      <Card>
        <h2 className="font-bold">🔍 Find Friends</h2>
        <div className="relative">
          <input className="w-full border rounded-full px-3 py-2 text-sm mt-2 dark:bg-slate-800 dark:border-slate-600" value={query} onChange={e => { setQuery(e.target.value); setShowSugg(true) }} onFocus={() => { if (query.trim()) setShowSugg(true) }} placeholder="Enter name or ID…" />
          {searching && showSugg && <SearchSuggestions suggestions={suggestions} onPick={p => { setQuery(p.name); setShowSugg(false) }} />}
        </div>
        <p className="text-xs text-gray-400 mt-1">Type a name to search by name, an ID to search by ID — all real users.</p>
      </Card>
      {searching ? (
        <Card>
          <h2 className="font-bold">🔍 {results.length} people found</h2>
          {results.length === 0 && <p className="text-sm text-gray-500 mt-1">Nobody found — check whether the name or ID is correct.</p>}
          {results.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ background: p.color }}>{p.name.slice(0, 1)}</span>
              <span className="flex-1"><span className="font-medium">{p.name}</span><span className="block text-xs text-gray-400">ID: {p.referralCode ?? p.id}{p.mutual ? ` • ${p.mutual} mutual friends` : ''}{p.online ? ' • ● Online' : ' • ○ Offline'}</span></span>
              {p.isFriend
                ? <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: p.name } })}>💬 Chat</Btn>
                : sent[p.id]
                  ? <Btn variant="ghost" onClick={() => setSent(v => ({ ...v, [p.id]: false }))}>Remove</Btn>
                  : <Btn onClick={() => addFromSearch(p)}>Add Friend</Btn>}
            </div>
          ))}
        </Card>
      ) : (
        <>
      <Card>
        <h2 className="font-bold">Friend Requests ({requests.length})</h2>
        {requests.length === 0 && <p className="text-sm text-gray-500 mt-1">No new requests.</p>}
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
        <h2 className="font-bold">My Friends ({friends.length}) — Chat free, calls prepaid π 0.1/minute</h2>
        {friends.length === 0 && <p className="text-sm text-gray-500 mt-1">No friends yet — find and add friends.</p>}
        {friends.map(f => (
          <div key={f.id} className="flex items-center gap-3 py-2">
            <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ background: f.color }}>{f.name.slice(0, 1)}</span>
            <span className="flex-1 font-medium">{f.name} <span className="text-xs text-gray-400">{f.online ? '● Online' : '○ Offline'}</span></span>
            <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: f.name } })}>💬 Chat</Btn>
            <Btn variant="green" onClick={() => navigate(`/call/friend/${encodeURIComponent(f.name)}`)}>📞 Call</Btn>
            <Btn variant="ghost" onClick={() => removeFriend(f.id)}>Unfriend</Btn>
          </div>
        ))}
      </Card>
      <Card>
        <h2 className="font-bold">People You May Know</h2>
        {FRIEND_SUGGESTIONS.length === 0 && <p className="text-sm text-gray-500 mt-1">Nobody is known yet.</p>}
        {FRIEND_SUGGESTIONS.map(s => (
          <div key={s.id} className="flex items-center gap-3 py-2">
            <span className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold" style={{ background: s.color }}>{s.name.slice(0, 1)}</span>
            <span className="flex-1"><span className="font-medium">{s.name}</span><span className="block text-xs text-gray-400">{s.mutual} mutual friends</span></span>
            {sent[s.id] ? <Btn variant="ghost" onClick={() => setSent(v => ({ ...v, [s.id]: false }))}>Remove</Btn>
              : <Btn onClick={() => { setSent(v => ({ ...v, [s.id]: true })); addFriend({ id: s.id, name: s.name, color: s.color, online: true }) }}>Add Friend</Btn>}
          </div>
        ))}
      </Card>
        </>
      )}
    </div>
  )
}

// ---------- Chat (free, contact-ban) ----------
export function ChatPage() {
  const { user, friends, soundSettings, setSoundSettings, uid } = useStore()
  const location = useLocation()
  // ডিফল্ট চ্যাট: প্রথম বন্ধু (সাধারণত রিমা) — সরানো ডেমো নাম কখনো ডিফল্ট হবে না
  const [active, setActive] = useState(() => friends[0]?.name ?? 'Rima')
  // চ্যাট localStorage-এ থাকে — বন্ধুদের সাথে কথোপকথন রিফ্রেশের পরেও থাকে
  // বন্ধুরা নিজে থেকে প্রথমে লেখে না — চ্যাট খালি দিয়ে শুরু, ব্যবহারকারী লিখলেই উত্তর আসে
  const [msgs, setMsgs] = useState<Record<string, { from: string; text: string; fsId?: string }[]>>(() => {
    const seed: Record<string, { from: string; text: string }[]> = {}
    try {
      const raw = localStorage.getItem('callguru:chatMsgs')
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, { from: string; text: string }[]>
        // শুধু বর্তমান বন্ধুদের চ্যাটই থাকে — সরানো ডেমো চ্যাট আর দেখাবে না
        const friendNames = new Set(friends.map(f => f.name))
        for (const k of Object.keys(parsed)) {
          if (!friendNames.has(k)) continue
          seed[k] = parsed[k]
        }
      }
    } catch { /* পুরোনো চ্যাট না থাকলে খালি দিয়ে শুরু */ }
    return seed
  })
  const [draft, setDraft] = useState('')
  const [ban, setBan] = useState('')
  const [warn, setWarn] = useState(0)
  // কে লিখছে (প্রতি বন্ধুর জন্য আলাদা) — উত্তর আসার ১–৩ সেকেন্ড আগে "লিখছে…" দেখায়
  const [typing, setTyping] = useState<Record<string, boolean>>({})
  const typingTimersRef = useRef<number[]>([])
  const lastReplyRef = useRef<Record<string, string>>({})
  const lastFunRef = useRef<Record<string, boolean>>({})
  // Friends পেজ থেকে কোনো বন্ধুর চ্যাটে এলে সেই চ্যাটটাই খুলে যায় (শুধু আসল বন্ধুর নামে)
  useEffect(() => {
    const st = location.state as { with?: string; draft?: string } | null
    if (st?.with && friends.some(f => f.name === st.with)) setActive(st.with)
    if (st?.draft) setDraft(st.draft)
  }, [location.state])
  useEffect(() => {
    try { localStorage.setItem('callguru:chatMsgs', JSON.stringify(msgs)) } catch { /* সংরক্ষণ না হলেও চ্যাট চলবে */ }
  }, [msgs])
  useEffect(() => () => { typingTimersRef.current.forEach(t => window.clearTimeout(t)) }, [])
  const activeFriend = friends.find(f => f.name === active)
  const isRealUser = !!activeFriend && !!uid && !isBuddyId(activeFriend.id) && activeFriend.id !== uid
  const roomId = isRealUser && uid && activeFriend ? chatRoomId(uid, activeFriend.id) : null
  const knownFsIdsRef = useRef<Set<string>>(new Set())
  const subscribedRoomsRef = useRef<Set<string>>(new Set())
  // আসল বন্ধুর চ্যাট Firestore-এ যায় — অন্য অ্যাকাউন্টে খুললেই মেসেজ পৌঁছায়।
  // ৫ জন চ্যাট পারসোনা আগের মতোই লোকাল থাকে। OTP লগইন (Firebase সেশন নেই)
  // থাকলে Firestore লেখা যায় না — তখন মেসেজ শুধু এই ডিভাইসেই থাকে।
  useEffect(() => {
    if (!roomId || !uid || !activeFriend) return
    const fromName = activeFriend.name
    const first = !subscribedRoomsRef.current.has(roomId)
    if (first) subscribedRoomsRef.current.add(roomId)
    const unsub = subscribeChatMessages(roomId, (list) => {
      const fresh = list.filter(m => !knownFsIdsRef.current.has(m.id))
      fresh.forEach(m => knownFsIdsRef.current.add(m.id))
      if (fresh.length === 0) return
      setMsgs(prev => {
        const cur = prev[fromName] || []
        const have = new Set(cur.map(m => m.fsId).filter(Boolean))
        const add = fresh.filter(m => !have.has(m.id)).map(m => ({ from: m.fromUid === uid ? (user?.name || 'You') : m.fromName, text: m.text, fsId: m.id }))
        return add.length === 0 ? prev : { ...prev, [fromName]: [...cur, ...add] }
      })
      if (!first && fresh.some(m => m.fromUid !== uid)) playChatSound(soundSettings)
    })
    return () => { if (unsub) unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])
  function send() {
    const err = contactBanCheck(draft)
    if (err) { setBan(err + ' Repeated attempts will raise more warnings.'); setWarn(w => w + 1); return }
    if (!draft.trim()) return
    const text = draft
    const to = active
    setDraft(''); setBan('')
    // আসল বন্ধু — Firestore-এ লিখি; সাবস্ক্রিপশন থেকেই মেসেজ ফিরে এসে দেখাবে।
    // সার্ভারে না পৌঁছালে মেসেজ শুধু এই ডিভাইসে থাকে।
    if (isRealUser && roomId && uid) {
      sendChatMessage(roomId, uid, user?.name || 'You', text).then(id => {
        if (!id) setMsgs(m => ({ ...m, [to]: [...(m[to] || []), { from: user?.name || 'You', text }] }))
      })
      return
    }
    setMsgs(m => ({ ...m, [to]: [...(m[to] || []), { from: user?.name || 'You', text }] }))
    const buddy = getBuddyByName(to)
    if (buddy) {
      setTyping(t => ({ ...t, [to]: true }))
      typingTimersRef.current.push(window.setTimeout(() => {
        const reply = getBuddyReplyDetail(buddy.id, text, lastReplyRef.current[buddy.id], { lastWasFun: lastFunRef.current[buddy.id] })
        lastReplyRef.current[buddy.id] = reply.text
        lastFunRef.current[buddy.id] = reply.fun
        setMsgs(m => ({ ...m, [to]: [...(m[to] || []), { from: buddy.name, text: reply.text }] }))
        playChatSound(soundSettings)
        setTyping(t => ({ ...t, [to]: false }))
      }, 1000 + Math.random() * 2000))
    }
  }
  const contacts = friends.map(f => f.name)
  return (
    <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
      <Card className="md:col-span-1">
        <h2 className="font-bold mb-2">Chat — completely free</h2>
        {/* চ্যাট সাউন্ড চালু/বন্ধ — একই টগল মোবাইল ও কম্পিউটারে, মেনুর সেটিংসের সাথে এক */}
        <button onClick={() => setSoundSettings({ chatSound: !soundSettings.chatSound })} className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-700 font-medium mb-2">{soundSettings.chatSound ? '🔔 Sound on — tap to turn off' : '🔕 Sound off — tap to turn on'}</button>
        {contacts.length === 0 && <p className="text-sm text-gray-500">No friends yet — add friends.</p>}
        {contacts.map(n => (
          <button key={n} onClick={() => setActive(n)} className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${active === n ? 'bg-violet-50 dark:bg-slate-700 font-bold' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}>{n}</button>
        ))}
        <p className="text-xs text-gray-400 mt-3">Phone numbers, WhatsApp/Facebook/Telegram links or emails cannot be shared — they will be blocked automatically.</p>
        {warn > 0 && <p className="text-xs text-red-500 mt-1">Warning: {warn} times the rules were tried to be broken.</p>}
      </Card>
      <Card className="md:col-span-2">
        <h2 className="font-bold">{active}</h2>
        <div className="h-64 overflow-y-auto space-y-2 mt-3">
          {(msgs[active] || []).map((m, i) => <p key={i} className={`text-sm px-3 py-2 rounded-xl max-w-[80%] ${m.from === (user?.name || 'You') ? 'bg-violet-100 dark:bg-violet-900 ml-auto' : 'bg-gray-100 dark:bg-slate-700'}`}><b>{m.from}:</b> {m.text}</p>)}
          {(msgs[active] || []).length === 0 && !typing[active] && <p className="text-sm text-gray-400 px-3 py-2">No messages yet — write the first message.</p>}
          {typing[active] && <p className="text-sm text-gray-400 italic px-3 py-2">{active} typing…</p>}
        </div>
        {ban && <p className="text-sm text-red-500 mt-2">{ban}</p>}
        <div className="flex gap-2 mt-3">
          <input className="flex-1 border rounded-full px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Write a message… (chat is free)" />
          <Btn onClick={send}>Send</Btn>
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
function downscaleImage(source: HTMLVideoElement | HTMLImageElement, w: number, h: number, maxPx = 320): string {
  const scale = Math.min(1, maxPx / Math.max(w, h))
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
    }).catch(() => setCamError('Camera could not be started — upload a photo below for your selfie.'))
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
    if (!v || !v.videoWidth) { setCamError('Could not take a photo from the camera — try again or upload a photo.'); return }
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
              setVideoNote('The live video could not be saved on this device — verification will use only the selfie photo.')
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
        setVideoNote('Live video could not be recorded — verification will use only the selfie photo.')
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    } else {
      setVideoNote('Live video could not be recorded — verification will use only the selfie photo.')
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
    setVideoNote('An uploaded photo has no live video — verification will use only the selfie photo.')
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }
  function submitIdentity() {
    const age = ageFromDob(dob)
    const num = idNumber.trim()
    if (!name.trim() || !dob || !idType || !num) { setErr('Fill in all fields.'); return }
    if (age === null) { setErr('Enter your date of birth correctly.'); return }
    if (age < 18) { setErr('You must be at least 18 years old for Dating.'); return }
    // NID: বাংলাদেশের ফরম্যাট — ১০ বা ১৭ সংখ্যা; পাসপোর্ট/জন্ম নিবন্ধন: কমপক্ষে ৬ অক্ষর
    if (idType === 'NID') {
      const digits = num.replace(/[\s-]/g, '')
      if (!/^\d+$/.test(digits) || (digits.length !== 10 && digits.length !== 17)) { setErr('Enter a valid NID number — it must be 10 or 17 digits.'); return }
    } else if (num.length < 6) { setErr('Enter a valid ID number — it must be at least 6 characters.'); return }
    setErr('')
    setStep(2)
  }
  function submitKyc() {
    if (!captured) return
    // পুরো NID নম্বর প্রথম ধাপ থেকেই সংরক্ষণ করা হয়, যাতে অ্যাডমিন নম্বর মিলিয়ে যাচাই করতে পারেন; সেলফি ও লাইভ ভিডিও ক্লিপ শুধু অ্যাডমিন যাচাইয়ের জন্য রাখা হয়
    submitKycToStore({ name: name.trim(), dob, idType, idNumber: idNumber.trim(), idLast4: idNumber.trim().slice(-4), selfie: captured, selfieVideo: videoClip ?? undefined })
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
        <h1 className="text-xl font-bold">✅ KYC approved</h1>
        <p className="text-sm text-gray-500 mt-2">{kycInfo?.name ?? name} • Approval date: {kycInfo?.verifiedAt ? new Date(kycInfo.verifiedAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</p>
        <p className="text-sm text-green-600 mt-2 font-medium">You never need to do KYC again — once is enough.</p>
        <Btn className="mt-4 w-full" onClick={onEnter}>❤️ Go to Dating</Btn>
      </Card></div>
    )
  }
  // জমা দেওয়ার পর অ্যাডমিনের অনুমোদনের অপেক্ষা — ডেটিং এখনো বন্ধ
  if (kycStatus === 'pending') {
    return (
      <div className="max-w-md mx-auto"><Card className="text-center">
        <h1 className="text-xl font-bold">⏳ KYC Under Review</h1>
        <p className="text-sm text-gray-500 mt-2">Your KYC has been submitted ({kycInfo?.name ?? name} • {kycInfo ? new Date(kycInfo.submittedAt).toLocaleDateString('en-GB') : ''}). Once approved, Dating will open.</p>
        <p className="text-sm text-gray-400 mt-2">Until approval, nothing in Dating will be visible.</p>
      </Card></div>
    )
  }
  // বাতিল হলে কারণ দেখিয়ে আবার জমা দেওয়ার সুযোগ
  if (kycStatus === 'rejected' && !resubmit) {
    return (
      <div className="max-w-md mx-auto"><Card className="text-center">
        <h1 className="text-xl font-bold">❌ KYC rejected</h1>
        <p className="text-sm text-gray-500 mt-2">Your KYC has been rejected.</p>
        <p className="text-sm mt-2 bg-red-50 dark:bg-red-900 rounded-lg px-3 py-2">Reason for Rejection: <b>{kycRejectReason || 'No reason given'}</b></p>
        <p className="text-sm text-gray-400 mt-2">You can fix the info and submit KYC again.</p>
        <Btn className="mt-4 w-full" onClick={startResubmit}>🔄 Submit KYC Again</Btn>
      </Card></div>
    )
  }

  return (
    <div className="max-w-md mx-auto"><Card>
      <h1 className="text-xl font-bold text-center">🛡️ Dating KYC — Do It Once Only</h1>
      <p className="text-sm text-gray-500 mt-2 text-center">To see anything in Dating, you must first complete live KYC. Without KYC, you will see no Dating profiles, lives or calls.</p>
      <div className="flex gap-2 mt-4 justify-center text-sm">
        <span className={`px-3 py-1 rounded-full font-bold ${step === 1 ? 'bg-fb-blue text-white' : 'bg-gray-200 dark:bg-slate-700'}`}>1. Identity</span>
        <span className={`px-3 py-1 rounded-full font-bold ${step === 2 ? 'bg-fb-blue text-white' : 'bg-gray-200 dark:bg-slate-700'}`}>2. Live Selfie</span>
      </div>
      {step === 1 && (
        <div className="mt-4">
          <label className="text-sm font-medium">Full Name</label>
          <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={name} onChange={e => setName(e.target.value)} placeholder="Your Full Name" />
          <label className="text-sm font-medium mt-3 block">Date of Birth</label>
          <input type="date" max={new Date().toISOString().slice(0, 10)} className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={dob} onChange={e => setDob(e.target.value)} />
          {dob && ageFromDob(dob) !== null && <p className="text-xs text-gray-400 mt-1">Age: {ageFromDob(dob)} years</p>}
          <label className="text-sm font-medium mt-3 block">ID Type</label>
          <select className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={idType} onChange={e => setIdType(e.target.value)}>
            <option value="">— Choose —</option>
            <option value="NID">National Identity Card (NID)</option>
            <option value="Passport">Passport</option>
            <option value="Birth Registration">Birth Registration</option>
          </select>
          <label className="text-sm font-medium mt-3 block">ID Number</label>
          <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder={idType === 'NID' ? 'NID Number — 10 or 17 digits' : 'Enter ID number'} />
          <p className="text-xs text-gray-400 mt-1">🔒 The full NID number is stored — it is not shared with other users and is not uploaded anywhere (it stays only on this device).</p>
          <p className="text-xs text-amber-600 mt-1">⚠️ A full NID is extremely sensitive information — in real production it cannot be kept in plain text; it must be encrypted and handled through a verified KYC service.</p>
          {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
          <Btn className="w-full mt-4" onClick={submitIdentity}>Next Step →</Btn>
          <p className="text-xs text-gray-400 mt-3 text-center">Your submission is reviewed by the admin. Real verification needs a verified KYC service.</p>
        </div>
      )}
      {step === 2 && (
        <div className="mt-4 text-center">
          <p className="text-sm font-medium">📸 Take Live Selfie</p>
          <p className="text-xs text-gray-400 mt-1">Take your live photo with the front camera — a ~3-second live video clip will also be recorded with the photo. Photo and video are kept for verification only. They are not shared with other users and are not uploaded anywhere (they stay only on this device).</p>
          {!captured && <video ref={videoRef} className="w-full aspect-[3/4] bg-black rounded-xl mt-3 object-cover" autoPlay playsInline muted />}
          {captured && <img src={captured} alt="Live Selfie" className="w-full aspect-[3/4] object-cover rounded-xl mt-3" />}
          {recording && <p className="text-sm text-red-500 mt-2 font-medium">🎥 Recording live video… wait ~3 seconds</p>}
          {videoClip && <div className="mt-3"><p className="text-xs text-gray-400 mb-1">🎥 Your Live Video Clip</p><video src={videoClip} controls loop muted playsInline className="w-full aspect-[3/4] object-cover rounded-xl bg-black" /></div>}
          {videoNote && <p className="text-xs text-amber-600 mt-2">{videoNote}</p>}
          {camError && <p className="text-sm text-red-500 mt-2">{camError}</p>}
          <div className="flex gap-2 mt-3">
            {!captured && <Btn variant="green" className="flex-1" onClick={captureSelfie}>📸 Take Photo</Btn>}
            {captured && <Btn variant="ghost" className="flex-1" onClick={() => { cancelRecordRef.current = true; if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop(); setCaptured(null); setVideoClip(null); setVideoNote(''); setRecording(false); setCamKey(k => k + 1) }}>🔄 Take Again</Btn>}
            <Btn variant="ghost" onClick={() => fileRef.current?.click()}>📁 Upload Photo</Btn>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} />
          <p className="text-xs text-gray-400 mt-2">If there is no camera, you can still give a selfie by uploading a photo (live camera is better).</p>
          <Btn className="w-full mt-4" disabled={!captured || recording} onClick={submitKyc}>📤 Submit KYC</Btn>
          <button className="text-sm text-gray-400 mt-3" onClick={() => setStep(1)}>← Back to previous step</button>
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
            <h1 className="text-xl font-bold">⏳ KYC Under Review</h1>
            <p className="text-sm text-gray-300 mt-2">Your KYC has been submitted — once approved, Dating will open. Until approval, nothing in Dating will be visible.</p>
            <Btn className="mt-4" onClick={() => navigate('/dating')}>View KYC Status</Btn>
          </>
        ) : kycStatus === 'rejected' ? (
          <>
            <h1 className="text-xl font-bold">❌ KYC rejected</h1>
            <p className="text-sm text-gray-300 mt-2">Your KYC has been rejected.</p>
            <p className="text-sm mt-2 bg-red-900 rounded-lg px-3 py-2">Reason for Rejection: <b>{kycRejectReason || 'No reason given'}</b></p>
            <Btn className="mt-4" onClick={() => navigate('/dating')}>Submit KYC Again</Btn>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">🔒 Dating cannot be used without KYC</h1>
            <p className="text-sm text-gray-300 mt-2">For Dating, you must first do KYC once (live identity verification). Without KYC, nothing in Dating will be visible.</p>
            <Btn className="mt-4" onClick={() => navigate('/dating')}>Do KYC</Btn>
          </>
        )}
      </Card>
    </div>
  )
}

// ---------- Dating 18+ ----------
function compatFor(p: DatingProfile) { return p.compat ?? 86 }

export function DatingPage() {
  const { likesUsed, useLike, premium, setPremium, totalPi, addPi, datingRate, liveRate, liveEarnings, kycVerified, district: myDistrict, interests: myInterests, uid } = useStore()
  const navigate = useNavigate()
  // KYC একবার সম্পন্ন হলে আর দেখানো হয় না; সফলতার স্ক্রিনটি দেখানোর জন্য স্থানীয় অবস্থা
  const [kycSuccess, setKycSuccess] = useState(false)
  const [matched, setMatched] = useState<string | null>(null)
  const [matchedId, setMatchedId] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({})
  const [boosted, setBoosted] = useState(false)
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  const [matchMsg, setMatchMsg] = useState('')
  // আসল লাইভ রুম (PiCall লাইভ সার্ভার) — সার্ভার না পৌঁছালে লাইভ তালিকা খালি দেখাবে
  const [realRooms, setRealRooms] = useState<LiveRoom[] | null>(null)
  const [liveServerOk, setLiveServerOk] = useState(false)
  function refreshLiveRooms() {
    fetchLiveRooms().then(r => { if (r) { setRealRooms(r); setLiveServerOk(true) } else { setLiveServerOk(false) } })
  }
  useEffect(() => { refreshLiveRooms() }, [])
  // আসল ডেটিং প্রার্থী — publicProfiles থেকে (নিজেকে বাদ); একই জেলা আগে, তারপর
  // মিলে যাওয়া ইন্টারেস্ট বেশি যার সে আগে
  const [candidates, setCandidates] = useState<NewMember[]>([])
  useEffect(() => {
    let on = true
    fetchNewMembers().then(list => { if (on) setCandidates(list) }).catch(() => { /* খালি থাকবে */ })
    return () => { on = false }
  }, [])
  const myInterestSet = useMemo(() => new Set(myInterests), [myInterests])
  const sharedCount = (c: NewMember) => (c.interests ?? []).filter(i => myInterestSet.has(i)).length
  const sortedCandidates = useMemo(() => {
    const list = candidates.filter(c => c.id !== uid)
    return [...list].sort((a, b) => {
      const aSame = myDistrict && a.district === myDistrict ? 1 : 0
      const bSame = myDistrict && b.district === myDistrict ? 1 : 0
      if (aSame !== bSame) return bSame - aSame
      return sharedCount(b) - sharedCount(a)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, uid, myDistrict, myInterests])
  // KYC ছাড়া ডেটিংয়ের কিছুই দেখা যাবে না — প্রোফাইল, লাইভ, ম্যাচ, কল — সব বন্ধ
  if (!kycVerified || kycSuccess) {
    return <KycPage onComplete={() => setKycSuccess(true)} onEnter={() => setKycSuccess(false)} />
  }
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-xl font-bold">❤️ Dating 18+</h1>
          <span className="text-sm">Today's free likes: {premium ? 'Unlimited (Premium)' : `${Math.max(0, 30 - likesUsed)}/30`} • Pi: {formatPi(totalPi)}</span>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Btn variant={premium ? 'green' : 'primary'} onClick={() => setPremium(!premium)}>{premium ? '✅ Premium is on' : 'Get Premium — Tk 99/month'}</Btn>
          <Btn variant="ghost" onClick={() => { if (totalPi >= 0.1) { addPi(-0.1, 'Boost', 'Profile Boost'); setBoosted(true) } else alert('Not enough Pi balance — buy Pi.') }}>🚀 Boost (~0.1 π)</Btn>
        </div>
        {boosted && <p className="text-sm text-green-600 mt-2">Boost on — your profile will show more.</p>}
        <p className="text-xs text-gray-400 mt-2">Premium: unlimited likes + see who liked you • 3 months Tk 249 • Super Like 0.15 π • Most features are free for Bangladeshi users.</p>
      </Card>
      {/* ---------- ডেটিং লাইভ ---------- */}
      <Card>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-lg font-bold">🔴 Dating Live</h2>
          <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-2 py-1 rounded-full font-bold">LIVE • 18+</span>
        </div>
        <p className="text-sm mt-2">To watch live {formatPi(liveRate)}/minute (prepaid — viewers only pay). Host will get <b>70%</b>, admin will get <b>30%</b>. Different from the call rate — live uses less Pi.</p>
        {liveServerOk
          ? <p className="text-xs text-green-600 mt-1">🟢 Live server connected — real broadcast</p>
          : <p className="text-xs text-gray-400 mt-1">Live server is not connected — running lives will show here once connected.</p>}
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          <Btn variant="green" onClick={() => navigate('/dating-go-live')}>📹 Go Live</Btn>
          <Btn variant="ghost" onClick={refreshLiveRooms}>🔄 Refresh Live List</Btn>
          <span className="text-sm">Your total live earnings: <b className="text-green-600">{formatPi(liveEarnings)}</b> (70% share)</span>
        </div>
        {realRooms && realRooms.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            {realRooms.map(r => (
              <div key={r.id} className="border-2 border-red-400 rounded-xl p-3 dark:border-red-700">
                <div className="flex gap-3 items-center">
                  <span className="w-12 h-12 rounded-full bg-fb-blue text-white text-xl flex items-center justify-center font-bold relative">{r.hostName.slice(0, 1)}
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">LIVE</span>
                  </span>
                  <div><p className="font-bold">{r.hostName}</p><p className="text-xs text-gray-500">👁️ {r.viewers} watching • <span className="text-green-600 font-bold">Real Live</span></p></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{r.title}</p>
                <Btn variant="green" className="mt-3 w-full" onClick={() => navigate(`/dating-live/${r.id}`)}>👁️ Watch (prepaid {formatPi(liveRate)}/minute)</Btn>
                <p className="text-[11px] text-gray-400 mt-1 text-center">Host gets 70% • Admin 30%</p>
              </div>
            ))}
          </div>
        )}
        {(!realRooms || realRooms.length === 0) && DATING_LIVE_HOSTS.length === 0 && (
          <p className="text-sm text-gray-500 mt-4">Nobody is live right now.</p>
        )}
      </Card>
      <LeaderboardCard />
      {matched && matchedId && <Card className="!pb-match !text-white text-center !border-0 shadow-lg"><p className="font-extrabold text-2xl">🎉 It's a Match!</p><p className="text-sm mt-1 opacity-90">You and {matched} liked each other — say something nice!</p>
        <input className="w-full rounded-full px-4 py-2.5 mt-3 text-sm text-gray-900 placeholder-gray-400" value={matchMsg} onChange={e => setMatchMsg(e.target.value)} placeholder="Say something nice" />
        <div className="flex gap-2 mt-2 justify-center">
          {['👋', '😊', '❤️'].map(r => (
            <button key={r} onClick={() => setMatchMsg(m => m ? m + ' ' + r : r)} className="w-10 h-10 rounded-full glass text-xl flex items-center justify-center">{r}</button>
          ))}
        </div>
        <div className="flex gap-2 mt-3 justify-center flex-wrap">
          <Btn className="!bg-white !text-pink-600 font-bold" onClick={() => navigate('/chat', { state: { with: matched, draft: matchMsg } })}>💬 Send message</Btn>
          <Btn variant="green" onClick={() => navigate(`/call/dating/${matchedId}`)}>📹 Video Call (Prepaid)</Btn>
        </div>
        <p className="text-xs mt-2 opacity-80">💳 Video call prepaid — {formatPi(datingRate)}/minute, only the caller's Pi will be cut. This call, like other calls, is covered by admin-only recording.</p>
      </Card>}
      <div className="grid sm:grid-cols-2 gap-3">
        {sortedCandidates.filter(p => !dismissed[p.id]).length === 0 && <p className="text-sm text-gray-500 col-span-2">No profiles yet — check back later.</p>}
        {sortedCandidates.filter(p => !dismissed[p.id]).map(p => {
          const sameDistrict = !!myDistrict && p.district === myDistrict
          const shared = (p.interests ?? []).filter(i => myInterestSet.has(i))
          return (
          <div key={p.id} className="rounded-2xl overflow-hidden shadow-sm relative" style={{ background: p.colour ?? '#7C3AED' }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="relative p-4 pt-24 text-white">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="font-extrabold text-xl">{p.displayName}</p>
                  {p.district && <p className="text-sm opacity-80">📍 {p.district}</p>}
                  {sameDistrict && <span className="inline-block mt-1 text-[11px] font-bold bg-white text-pink-600 px-2 py-0.5 rounded-full">Same district</span>}
                  {shared.length > 0 && <div className="flex gap-1 flex-wrap mt-2">{shared.map(i => <span key={i} className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full">{i}</span>)}</div>}
                  {shared.length === 0 && p.interests && p.interests.length > 0 && <div className="flex gap-1 flex-wrap mt-2">{p.interests.slice(0, 4).map(i => <span key={i} className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full">{i}</span>)}</div>}
                </div>
                {p.photo
                  ? <img src={p.photo} alt={p.displayName} className="shrink-0 w-14 h-14 rounded-full object-cover border-2 border-white/60" />
                  : <span className="shrink-0 w-14 h-14 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-xl font-bold">{p.displayName.slice(0, 1)}</span>}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setDismissed(v => ({ ...v, [p.id]: true }))} className="flex-1 py-2.5 rounded-full bg-white/20 backdrop-blur font-bold text-lg" aria-label="Pass">✕</button>
                <Btn disabled={!!likedIds[p.id]} className="!bg-white !text-pink-600 font-bold flex-1 !py-2.5 !rounded-full" onClick={() => { if (!useLike()) { alert('Today\'s 30 free likes are over — get Premium.'); return } setLikedIds(v => ({ ...v, [p.id]: true })); setMatched(p.displayName); setMatchedId(p.id) }}>❤️ Like</Btn>
                <button onClick={() => { if (totalPi < 0.15) { alert('Super Like needs 0.15 π.'); return } addPi(-0.15, 'Super Like', `Super Like — ${p.displayName}`); setLikedIds(v => ({ ...v, [p.id]: true })); setMatched(p.displayName); setMatchedId(p.id) }} className="flex-1 py-2.5 rounded-full pb-gradient font-bold text-sm">⭐ Super Like (0.15 π)</button>
              </div>
              <button onClick={() => alert('This profile has been reported — moderation will review it.')} className="text-xs opacity-70 mt-2 underline">🚩 Report</button>
              {likedIds[p.id] && <Btn variant="green" className="mt-2 w-full" onClick={() => navigate(`/call/dating/${p.id}`)}>📹 Video Call (prepaid {formatPi(datingRate)}/minute)</Btn>}
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
// ---------- ডেটিং লাইভ ----------
// ডেমো লাইভ হোস্ট সরানো হয়েছে — শুধু আসল লাইভ রুম দেখাবে
const DATING_LIVE_HOSTS: { id: string; viewers: number }[] = []
const LIVE_CREATOR_SHARE = 0.7 // লাইভকারী পাবেন ৭০%, অ্যাডমিন ৩০% — নির্দিষ্ট ভাগ

function fmtLive(s: number) { return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

// লাইভ গিফট — শুধু Pi দিয়ে কেনা যায়; বাইরে থেকে গিফট কেনা যায় না, ফ্রি গিফট নেই
const LIVE_GIFTS = [
  { icon: '🌹', name: 'Rose', pi: 0.1 },
  { icon: '❤️', name: 'Heart', pi: 0.25 },
  { icon: '🎁', name: 'Gift Box', pi: 0.5 },
  { icon: '💎', name: 'Diamond', pi: 1 },
]

// লাইভ দেখা — প্রিপেইড, প্রতি মিনিটে; শুধু দর্শক দেবে
export function DatingLivePage() {
  const { id } = useParams()
  const { totalPi, addPi, liveRate, user, kycVerified, recordShare, addGiftsSent, spendGiftPi, soundSettings } = useStore()
  const navigate = useNavigate()
  // ডেমো হোস্ট সরানো — শুধু আসল রুম (PiCall লাইভ সার্ভার) দেখাবে
  const [realRoom, setRealRoom] = useState<LiveRoom | null>(null)
  const [roomLookupDone, setRoomLookupDone] = useState(false)
  const host = realRoom ? { id: realRoom.id, name: realRoom.hostName, age: 0, city: '', about: 'Live now', color: '#E91E63' } : undefined
  useEffect(() => {
    let alive = true
    fetchLiveRooms().then(rooms => { if (!alive) return; setRealRoom(rooms?.find(x => x.id === id) ?? null); setRoomLookupDone(true) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  const rate = liveRate // লাইভ রেট কলের রেট থেকে আলাদা (ডিফল্ট π ০.০৫/মিনিট)
  const [started, setStarted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [ended, setEnded] = useState(false)
  const [endReason, setEndReason] = useState('')
  const [chat, setChat] = useState<{ from: string; text: string }[]>([])
  const [chatDraft, setChatDraft] = useState('')
  const [banMsg, setBanMsg] = useState('')
  const [banCount, setBanCount] = useState(0)
  // লাইভ গিফট — Pi দিয়ে কেনা, লাইভকারীর আয়ে ৭০% / অ্যাডমিন ৩০% ভাগে যোগ হয়
  const [giftsSent, setGiftsSent] = useState<{ icon: string; name: string; pi: number }[]>([])
  const [giftMsg, setGiftMsg] = useState('')
  const [giftPiTotal, setGiftPiTotal] = useState(0)
  const [shareMsg, setShareMsg] = useState('')
  async function shareLive() {
    const res = await shareLink('PiCall Live', 'I was live on PiCall — watch', `${INVITE_BASE_URL}dating`)
    if (res === 'shared' || res === 'copied') { recordShare(); setShareMsg(res === 'shared' ? '✅ Shared!' : '✅ Live link copied!') }
  }
  // আসল লাইভ (WebRTC) — সার্ভার না পৌঁছালে ডেমো আচরণই থাকবে
  const remoteRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const viewerIdRef = useRef<string | null>(null)
  const [remoteReady, setRemoteReady] = useState(false)
  const [serverLive, setServerLive] = useState(false)
  const [liveViewers, setLiveViewers] = useState<number | null>(null)
  const [giftFeed, setGiftFeed] = useState<string[]>([])
  const giftCreatorTotal = roundPi(giftPiTotal * LIVE_CREATOR_SHARE)
  const giftAdminTotal = roundPi(giftPiTotal - giftCreatorTotal)

  function sendGift(g: { icon: string; name: string; pi: number }) {
    if (totalPi < g.pi) { setGiftMsg('Not enough Pi balance — add Pi to your Pi wallet'); return }
    // গিফটের খরচ গিফট Pi থেকে আগে কাটে (ইন্সটল বোনাসের ৫ π শুধু গিফটেই চলে)
    if (!spendGiftPi(g.pi, 'Gifts Sent', `Live gift — ${g.icon} ${g.name}`)) { setGiftMsg('Not enough Pi balance — add Pi to your Pi wallet'); return }
    addGiftsSent(g.pi)
    setGiftsSent(prev => [...prev, g])
    setGiftPiTotal(t => roundPi(t + g.pi))
    setGiftMsg(`🎁 You sent ${g.icon} ${g.name}!`)
    // আসল লাইভে হোস্টকেও গিফটটা জানানো হয়; সার্ভার না থাকলে শুধু লোকালি দেখাবে
    if (realRoom) sendSignal(wsRef.current, { type: 'gift', roomId: realRoom.id, name: user?.name || 'You', gift: g })
  }

  const billedMinutes = Math.ceil(seconds / 60)
  const totalPaid = billedMinutes * rate
  const creatorShare = roundPi(totalPaid * LIVE_CREATOR_SHARE)
  const adminShare = roundPi(totalPaid - creatorShare)
  const talkableMinutes = Math.floor(totalPi / rate)
  const maxSeconds = talkableMinutes * 60
  const canStart = totalPi >= rate

  useEffect(() => {
    if (!started || ended) return
    const t = setInterval(() => setSeconds(s => {
      const next = s + 1
      if (next >= maxSeconds && maxSeconds > 0) { endLive('Auto-cut — out of balance') }
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
    const ws = connectLive(realRoom.id, 'viewer', user?.name || 'Viewers', {
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
      onGift: (from, gift) => { if (!cancelled) setGiftFeed(f => [...f.slice(-4), `${from} sent ${gift.icon} ${gift.name}`]) },
      onChat: (from, text) => { if (!cancelled) { setChat(c => [...c, { from, text }]); playChatSound(soundSettings) } },
      onHostLeft: () => { if (!cancelled) endLive('The host ended the live') },
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
    setEnded(true); setEndReason(reason || 'Finished watching live')
    const cost = roundPi(Math.ceil(seconds / 60) * rate)
    if (cost > 0) addPi(-cost, 'Watching Live', `Watching live — ${host?.name ?? 'Live'}`)
  }

  function sendChat() {
    const err = contactBanCheck(chatDraft)
    if (err) { setBanMsg(err + ` (attempt ${banCount + 1} — saved in admin log)`); setBanCount(c => c + 1); return }
    if (!chatDraft.trim()) return
    const text = chatDraft
    setChat(c => [...c, { from: user?.name || 'You', text }]); setChatDraft(''); setBanMsg('')
    if (realRoom) sendSignal(wsRef.current, { type: 'chat', roomId: realRoom.id, name: user?.name || 'You', text })
  }

  // KYC ছাড়া সরাসরি লিংকেও ডেটিং লাইভ দেখা যাবে না
  if (!kycVerified) {
    return <DatingKycBlocked />
  }

  if (!roomLookupDone) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">Looking for live…</h1>
        </Card>
      </div>
    )
  }

  if (!host) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">Live not found</h1>
          <Btn className="mt-4" onClick={() => navigate('/dating')}>Back to Dating</Btn>
        </Card>
      </div>
    )
  }

  if (ended) {
    const cost = roundPi(Math.ceil(seconds / 60) * rate)
    const creator = roundPi(cost * LIVE_CREATOR_SHARE)
    const admin = roundPi(cost - creator)
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">Finished watching live</h1>
          <p className="mt-2">{host.name} • {fmtLive(seconds)}</p>
          <div className="mt-3 space-y-1 text-sm text-left">
            <p>Seen by: <b>{billedMinutes} Minutes</b></p>
            <p>Total given: <b>{formatPi(cost)}</b></p>
            <p>Host will get (70%): <b className="text-green-400">{formatPi(creator)}</b></p>
            <p>Admin will get (30%): <b>{formatPi(admin)}</b></p>
            {giftPiTotal > 0 && <>
              <p>Sent gifts: <b>{giftsSent.length} • {formatPi(giftPiTotal)}</b></p>
              <p>From gifts, the host will get (70%): <b className="text-green-400">{formatPi(giftCreatorTotal)}</b> • Admin (30%): <b>{formatPi(giftAdminTotal)}</b></p>
            </>}
            <p>Current Pi Balance: <b>{formatPi(totalPi)}</b></p>
          </div>
          <p className="text-sm text-gray-300 mt-2">{endReason}</p>
          <div className="flex gap-2 mt-5 justify-center flex-wrap">
            <Btn variant="green" onClick={() => navigate('/dating')}>Back to Dating</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>Buy π Pi</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={shareLive}>📤 Share</Btn>
          </div>
          {shareMsg && <p className="text-sm text-green-400 mt-2">{shareMsg}</p>}
        </Card>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <span className="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">🔴 LIVE</span>
          <h1 className="text-xl font-bold mt-3">{host.name} is live</h1>
          <p className="text-sm text-gray-300">👁️ {liveViewers ?? realRoom?.viewers ?? 0} watching • real live</p>
          <p className="text-sm mt-2">{host.about}</p>
          <div className="mt-4 space-y-1 text-sm text-left">
            <p>Watch rate: <b>{formatPi(rate)}/ minute</b> (Prepaid — only you pay)</p>
            <p>Host will get <b>70%</b> • Admin will get <b>30%</b></p>
            <p>Pi Balance: <b>{formatPi(totalPi)}</b> • Will show: <b>~{talkableMinutes} Minutes</b></p>
            <p>The live will stop itself when the Pi balance ends.</p>
            <p>Your Pi: <b>π {formatPi(totalPi)}</b> — you need Pi to send gifts on live.</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">🔴 This live too is covered by admin-only recording — only the admin can view it for appeals/disputes. {realRoom ? '🟢 Live server connected — real broadcast.' : 'Live server not connected — check your connection and try again.'}</p>
          {!canStart && <p className="mt-3 bg-red-600 rounded-lg px-3 py-2 text-sm font-medium">⚠️ You cannot watch live without a Pi balance. Prepaid — buy Pi first.</p>}
          <div className="flex gap-2 mt-5">
            <Btn variant="green" className="flex-1" disabled={!canStart} onClick={() => setStarted(true)}>▶️ Start Watching Live</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>Buy π Pi</Btn>
          </div>
          <button className="text-sm text-gray-300 mt-3" onClick={() => navigate('/dating')}>← Back to Dating</button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative">
      {/* small red dot only — no "Recording" text by design; recording is admin-only for appeals */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" title="Admin-only recording indicator" />
        <span className="text-xs glass px-2 py-1 rounded-full">{fmtLive(seconds)} • {formatPi(totalPaid)}</span>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <div className="text-center px-4 w-full max-w-lg">
          <span className="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">🔴 LIVE</span>
          <video ref={remoteRef} className={`w-full aspect-video bg-black rounded-xl mt-3 ${remoteReady ? '' : 'hidden'}`} autoPlay playsInline />
          {!remoteReady && <span className="w-28 h-28 rounded-full text-white text-4xl flex items-center justify-center font-bold mx-auto mt-3" style={{ background: host.color }}>{host.name.slice(0, 1)}</span>}
          <p className="text-xl font-bold mt-3">{host.name} is live</p>
          <p className="text-gray-300 text-sm">👁️ {liveViewers ?? realRoom?.viewers ?? 0} watching • {fmtLive(seconds)}</p>
          <div className="mt-3 text-sm space-y-1">
            <p>You gave: <b>{formatPi(totalPaid)}</b> ({billedMinutes} minutes)</p>
            <p>Host will get (70%): <b className="text-green-400">{formatPi(creatorShare)}</b> • Admin (30%): <b>{formatPi(adminShare)}</b></p>
          </div>
          {giftFeed.length > 0 && <p className="text-xs text-yellow-200 mt-2">{giftFeed.join(' • ')}</p>}
          <p className="text-xs text-gray-400 mt-2">{serverLive ? '🟢 Live server connected — real broadcast.' : 'Live server is not connected — the host video has not arrived yet.'}</p>
        </div>
      </div>
      <div className="px-3 pb-3">
        <div className="max-w-md mx-auto glass rounded-xl p-2 mb-3 max-h-32 overflow-y-auto">
          {chat.length === 0 && <p className="text-xs text-gray-300 text-center">Live chat — sharing numbers/links/emails is blocked.</p>}
          {chat.map((m, i) => <p key={i} className="text-sm"><b>{m.from}:</b> {m.text}</p>)}
        </div>
        {banMsg && <p className="text-xs text-red-300 text-center mb-2">{banMsg}</p>}
        <div className="flex gap-2 max-w-md mx-auto mb-4">
          <input className="flex-1 rounded-full px-3 py-2 text-sm text-black" placeholder="Write a message on live…" value={chatDraft} onChange={e => setChatDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
          <Btn onClick={sendChat}>Send</Btn>
        </div>
        <div className="max-w-md mx-auto glass rounded-xl p-2 mb-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-bold">🎁 Send Gift</p>
            <span className="text-xs">π Your Pi: <b>{formatPi(totalPi)}</b></span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Gifts can only be bought with Pi — you cannot buy gifts from outside, and there are no free gifts. The host gets 70% of a gift, the admin gets 30%.</p>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {LIVE_GIFTS.map(g => (
              <button key={g.name} onClick={() => sendGift(g)} className="glass hover:bg-white/25 rounded-lg py-2 px-1 text-center">
                <span className="text-2xl block">{g.icon}</span>
                <span className="text-xs block">{g.name}</span>
                <span className="text-[11px] text-yellow-300 font-bold">{formatPi(g.pi)}</span>
              </button>
            ))}
          </div>
          {giftMsg && <p className="text-xs text-yellow-200 text-center mt-2">{giftMsg}</p>}
          {giftMsg === 'Not enough Pi balance — add Pi to your Pi wallet' && <div className="text-center mt-1"><Btn variant="green" onClick={() => navigate('/wallet')}>Buy π Pi</Btn></div>}
          {giftsSent.length > 0 && <p className="text-xs text-gray-300 text-center mt-2">Gifts sent: {giftsSent.map(g => g.icon).join(' ')} • Host received from gifts {formatPi(giftCreatorTotal)} (70%)</p>}
        </div>
        <div className="flex justify-center pb-2">
          <button onClick={() => endLive('You finished watching the live')} className="px-6 h-14 rounded-full bg-red-600 text-lg font-bold" title="Leave Live">❌ Leave Live</button>
        </div>
        <p className="text-center text-xs text-gray-400">Live will auto-stop when balance ends • Max {fmtLive(maxSeconds)}</p>
      </div>
    </div>
  )
}

// নিজে লাইভে যাওয়া — হোস্টের আয় প্রতি মিনিটে রেটের ৭০%
export function DatingGoLivePage() {
  const { user, liveRate, liveEarnings, addLiveEarnings, kycVerified, recordShare, soundSettings } = useStore()
  const navigate = useNavigate()
  const rate = liveRate // লাইভ রেট কলের রেট থেকে আলাদা (ডিফল্ট π ০.০৫/মিনিট)
  const [started, setStarted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [viewers, setViewers] = useState(0)
  const [peakViewers, setPeakViewers] = useState(0)
  const [ended, setEnded] = useState(false)
  const [endMyShare, setEndMyShare] = useState(0)
  const [endGross, setEndGross] = useState(0)
  const [endSeconds, setEndSeconds] = useState(0)
  const [shareMsg, setShareMsg] = useState('')
  async function shareLive() {
    const res = await shareLink('PiCall Live', 'I was live on PiCall — watch', `${INVITE_BASE_URL}dating`)
    if (res === 'shared' || res === 'copied') { recordShare(); setShareMsg(res === 'shared' ? '✅ Shared!' : '✅ Live link copied!') }
  }
  const [endPeak, setEndPeak] = useState(0)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [camCount, setCamCount] = useState<number | null>(null)
  const [switching, setSwitching] = useState(false)
  const [camError, setCamError] = useState('')
  const facingRef = useRef<'user' | 'environment'>('user')
  const streamRef = useRef<MediaStream | null>(null)
  const selfRef = useRef<HTMLVideoElement>(null)
  function setFacingBoth(f: 'user' | 'environment') { facingRef.current = f; setFacing(f) }
  // আসল লাইভ সার্ভার (WebRTC হোস্ট) — সার্ভার না পৌঁছালে রুম ছাড়াই লাইভ চলবে, কেউ দেখতে পাবে না
  const wsRef = useRef<WebSocket | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const roomIdRef = useRef<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [serverLive, setServerLive] = useState(false)
  const [giftPiReceived, setGiftPiReceived] = useState(0)
  const [giftFeed, setGiftFeed] = useState<string[]>([])
  const [hostChat, setHostChat] = useState<{ from: string; text: string }[]>([])

  const billedMinutes = Math.ceil(seconds / 60)
  const gross = billedMinutes * rate
  const myShare = roundPi(gross * LIVE_CREATOR_SHARE)
  const adminShare = roundPi(gross - myShare)
  const giftMyShare = roundPi(giftPiReceived * LIVE_CREATOR_SHARE)

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
    const room = await createLiveRoom(user?.name || 'You', 'Dating Live')
    if (!room) { setServerLive(false); return } // রুম ছাড়াই লাইভ চলবে — সার্ভার ছাড়া কেউ দেখতে পাবে না
    roomIdRef.current = room.id
    setRoomId(room.id)
    const ws = connectLive(room.id, 'host', user?.name || 'You', {
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
        setGiftPiReceived(c => roundPi(c + gift.pi))
        setGiftFeed(f => [...f.slice(-4), `${from} sent ${gift.icon} ${gift.name}`])
      },
      onChat: (from, text) => { setHostChat(c => [...c.slice(-19), { from, text }]); playChatSound(soundSettings) },
    })
    wsRef.current = ws
  }

  useEffect(() => {
    if (!started || ended) return
    const t = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [started, ended])

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
        setCamError('This camera could not be started — staying on the previous camera.')
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
    const myFinal = roundPi(grossFinal * LIVE_CREATOR_SHARE) + roundPi(giftPiReceived * LIVE_CREATOR_SHARE)
    if (myFinal > 0) addLiveEarnings(myFinal)
    setEndGross(grossFinal + giftPiReceived); setEndMyShare(myFinal); setEndSeconds(seconds); setEndPeak(peakViewers)
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
          <h1 className="text-xl font-bold">Your live has ended</h1>
          <p className="mt-2">{fmtLive(endSeconds)} • Max {endPeak} viewers</p>
          <div className="mt-3 space-y-1 text-sm text-left">
            <p>Total earnings (viewers gave): <b>{formatPi(endGross)}</b></p>
            <p>Your share (70%): <b className="text-green-400">{formatPi(endMyShare)}</b></p>
            <p>Admin's share (30%): <b>{formatPi(adminFinal)}</b></p>
            <p>Your total live earnings (all lives together): <b>{formatPi(liveEarnings)}</b></p>
          </div>
          <div className="flex gap-2 mt-5 justify-center flex-wrap">
            <Btn variant="green" onClick={() => navigate('/dating')}>Back to Dating</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>💰 Wallet</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={shareLive}>📤 Share</Btn>
          </div>
          {shareMsg && <p className="text-sm text-green-400 mt-2">{shareMsg}</p>}
        </Card>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <span className="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">📹 Go Live</span>
          <h1 className="text-xl font-bold mt-3">Go Live Yourself</h1>
          <p className="text-sm text-gray-300 mt-1">{user?.name || 'You'} • Dating Live (18+)</p>
          <div className="mt-4 space-y-1 text-sm text-left">
            <p>Viewers will pay: <b>{formatPi(rate)}/ minute</b> (Prepaid)</p>
            <p>You will get <b>70%</b> • Admin will get <b>30%</b></p>
            <p>Viewers can also send you gifts with Pi (70% of gifts is yours too).</p>
            <p>Your total live earnings so far: <b className="text-green-400">{formatPi(liveEarnings)}</b></p>
          </div>
          <div className="mt-4 text-left">
            <p className="text-sm text-gray-300 mb-2">📷 Which camera will you start with?</p>
            <div className="flex gap-2">
              <button onClick={() => setFacingBoth('user')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${facing === 'user' ? 'bg-fb-blue text-white' : 'bg-slate-700 text-white'}`}>🤳 Front Camera</button>
              <button onClick={() => setFacingBoth('environment')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${facing === 'environment' ? 'bg-fb-blue text-white' : 'bg-slate-700 text-white'}`}>📷 Back Camera</button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">🔴 This live is covered by admin-only recording — only the admin can view it for appeals/disputes. When the live starts, PiCall live server will broadcast for real; if the server is unreachable, nobody can watch yet.</p>
          <div className="flex gap-2 mt-5">
            <Btn variant="green" className="flex-1" onClick={() => setStarted(true)}>🔴 Start Live</Btn>
          </div>
          <button className="text-sm text-gray-300 mt-3" onClick={() => navigate('/dating')}>← Back to Dating</button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative">
      {/* small red dot only — no "Recording" text by design; recording is admin-only for appeals */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" title="Admin-only recording indicator" />
        <span className="text-xs glass px-2 py-1 rounded-full">🔴 LIVE • {fmtLive(seconds)}</span>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <video ref={selfRef} className="absolute inset-0 w-full h-full object-cover bg-slate-700" style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined} autoPlay playsInline muted />
        <div className="relative text-center px-4">
          <span className="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold">🔴 LIVE</span>
          <p className="text-xl font-bold mt-3">{user?.name || 'You'} is live</p>
          <p className="text-gray-200 text-sm">👁️ {viewers} watching • {fmtLive(seconds)}</p>
          <div className="mt-3 text-sm space-y-1 glass rounded-xl px-4 py-2">
            <p>Total earnings: <b>{formatPi(gross + giftPiReceived)}</b> ({billedMinutes} Minutes{giftPiReceived > 0 ? ` + ${formatPi(giftPiReceived)} gift` : ''})</p>
            <p>Your share (70%): <b className="text-green-400">{formatPi(myShare + giftMyShare)}</b> • Admin (30%): <b>{formatPi(adminShare + (giftPiReceived - giftMyShare))}</b></p>
          </div>
          {giftFeed.length > 0 && <p className="text-xs text-yellow-200 mt-2">{giftFeed.join(' • ')}</p>}
          {hostChat.length > 0 && <div className="text-xs text-left mt-2 glass rounded-xl px-3 py-2 max-h-20 overflow-y-auto">{hostChat.map((m, i) => <p key={i}><b>{m.from}:</b> {m.text}</p>)}</div>}
          <p className="text-xs text-gray-300 mt-2">{serverLive ? '🟢 Live server connected — real broadcast.' : 'Live server is not connected — nobody can watch yet.'}</p>
        </div>
      </div>
      <div className="px-3 pb-4 relative">
        {camError && <p className="text-xs text-red-300 text-center mb-2">{camError}</p>}
        {camCount === 1 && <p className="text-xs text-gray-400 text-center mb-2">This device has 1 camera — you cannot switch cameras.</p>}
        <div className="flex justify-center gap-3 pb-2">
          <button onClick={switchCamera} disabled={switching || camCount === 1} className="w-14 h-14 rounded-full bg-slate-700 text-2xl disabled:opacity-40" title="Switch Camera">🔄</button>
          <button onClick={endGoLive} className="px-6 h-14 rounded-full bg-red-600 text-lg font-bold" title="End Live">❌ End Live</button>
        </div>
        <p className="text-center text-xs text-gray-400">🔄 You can switch front ↔ back camera with the button</p>
      </div>
    </div>
  )
}

// ---------- Live TV (HLS + official link only, zero external video links) ----------
// ---------- Live TV ----------
// ONE playlist link drives the channel list: the app fetches the admin's M3U
// playlist (config/public → tvPlaylistUrl, default = Eamin Tv) and shows every
// channel inside it. If the playlist cannot be loaded, the built-in verified
// list (TV_CHANNELS) is shown instead. Tap a channel to watch it.
export function LiveTV() {
  const { tvPlaylistUrl } = useStore()
  const [channels, setChannels] = useState<TvChannel[]>(TV_CHANNELS)
  const [fromPlaylist, setFromPlaylist] = useState(false)
  const [cat, setCat] = useState('All')
  const [current, setCurrent] = useState<TvChannel>(TV_CHANNELS[0])
  const [playError, setPlayError] = useState('')
  const [shareMsg, setShareMsg] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onFsChange = () => {
      const on = Boolean(document.fullscreenElement)
      setIsFullscreen(on)
      if (!on) { try { screen.orientation.unlock() } catch { /* best-effort */ } }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) { void document.exitFullscreen().catch(() => undefined); return }
    const player = playerRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    const p = player?.requestFullscreen ? player.requestFullscreen() : player?.webkitRequestFullscreen ? (player.webkitRequestFullscreen(), Promise.resolve()) : null
    if (p) p.catch(() => { video?.webkitEnterFullscreen?.() })
    else video?.webkitEnterFullscreen?.()
    try { void (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')?.catch(() => undefined) } catch { /* orientation lock is best-effort */ }
  }
  useEffect(() => {
    let cancelled = false
    fetchTvPlaylist(tvPlaylistUrl || DEFAULT_TV_PLAYLIST_URL)
      .then(list => {
        if (cancelled) return
        const mapped: TvChannel[] = list.map(c => ({ ...c, officialUrl: '' }))
        setChannels(mapped)
        setFromPlaylist(true)
        setCurrent(mapped[0])
        setCat('All')
        setPlayError('')
      })
      .catch(() => {
        if (cancelled) return
        setChannels(TV_CHANNELS)
        setFromPlaylist(false)
        setCurrent(TV_CHANNELS[0])
      })
    return () => { cancelled = true }
  }, [tvPlaylistUrl])
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    setPlayError('')
    if (!current.streamUrl) return
    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(current.streamUrl); hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setPlayError('This stream is not playing right now — try another channel.')
      })
      return () => hls.destroy()
    }
    video.src = current.streamUrl
  }, [current])
  const groups = ['All', ...Array.from(new Set(channels.map(c => c.group)))]
  const list = channels.filter(c => cat === 'All' || c.group === cat)
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold">📺 Live TV — Free with Ads</h1>
      <Card>
        <div ref={playerRef} className="tv-player w-full aspect-video bg-black rounded-lg overflow-hidden">
          {current.streamUrl ? (
            <video ref={videoRef} controls autoPlay muted playsInline onError={() => setPlayError('This stream is not playing right now — try another channel.')} className="w-full h-full object-contain bg-black" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-center px-4">
              <p className="text-white text-sm">This channel has no playable stream in the app yet.<br />Watch it on the official site below.</p>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
          <div><p className="font-bold">{current.name}</p><p className="text-xs text-gray-400">{current.group} • In-app HLS player</p></div>
          <div className="flex gap-2 items-center">
            <button onClick={toggleFullscreen} className="px-3 py-1.5 rounded-full bg-white dark:bg-fb-card text-sm font-medium shadow-sm">{isFullscreen ? '⤢ Exit Full Screen' : '⛶ Full Screen'}</button>
            <button onClick={async () => { const r = await shareLink('PiCall Live TV', `Watch ${current.name} free on PiCall Live TV!`, INVITE_BASE_URL); setShareMsg(r === 'shared' ? '✅ Shared!' : r === 'copied' ? '✅ TV link copied — send it to friends!' : 'Share failed — copy the link from the address bar.') }} className="px-3 py-1.5 rounded-full bg-white dark:bg-fb-card text-sm font-medium shadow-sm">↗ Share TV</button>
            {current.officialUrl && <a className="text-fb-blue text-sm font-medium" href={current.officialUrl} target="_blank" rel="noreferrer">Official Source →</a>}
          </div>
        </div>
        {shareMsg && <p className="text-sm text-green-600 mt-2">{shareMsg}</p>}
        {playError && <p className="text-sm text-red-600 mt-2">{playError}</p>}
        <p className="text-xs text-gray-400 mt-2">{fromPlaylist ? `${channels.length} channels from the admin playlist.` : 'Playlist could not be loaded — showing saved channels.'} If a channel does not play, try another one.</p>
      </Card>
      <div className="flex gap-2 flex-wrap">{groups.map(c => <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-sm ${cat === c ? 'bg-fb-blue text-white' : 'bg-white dark:bg-fb-card'}`}>{c}</button>)}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {list.map(ch => (
          <button key={ch.id} onClick={() => { setCurrent(ch); setPlayError('') }} className={`text-left rounded-xl p-4 shadow-sm ${current.id === ch.id ? 'bg-violet-100 dark:bg-violet-900 ring-2 ring-violet-500' : 'bg-white dark:bg-fb-card'}`}>
            <p className="font-bold flex items-center gap-2">{ch.logo ? <img src={ch.logo} alt="" className="w-6 h-6 rounded object-contain bg-white" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} /> : '📺'} {ch.name}</p><p className="text-xs text-gray-400">{ch.group}{ch.streamUrl ? '' : ' • Link only'}</p>
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
      <h1 className="text-xl font-bold">🏠 Home Service</h1>
      {SERVICES.filter(s => s.category === 'Home Service').length === 0 && <p className="text-sm text-gray-500">No home services yet.</p>}
      {SERVICES.filter(s => s.category === 'Home Service').map(s => (
        <Card key={s.id}><div className="flex justify-between"><div><p className="font-bold">{s.title}</p><p className="text-sm text-gray-500">{s.provider} • ⭐ {s.rating}</p><p className="text-sm mt-1">{s.desc}</p></div><span className="font-bold text-fb-blue whitespace-nowrap">{formatBDT(s.price)}</span></div>
          <Btn className="mt-3" onClick={() => alert('Booking pending — the team will call to confirm.')}>Book</Btn></Card>
      ))}
      <Card><p className="text-sm">Want to become a service provider? <Link className="text-fb-blue" to="/create-service">Create Service</Link> — platform commission applies on every booking.</p></Card>
    </div>
  )
}

export function GroupsPage() {
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">👥 Groups & Pages</h1>
      <p className="text-sm text-gray-500">No groups or pages yet.</p>
    </div>
  )
}

export function ReelsPage() {
  const { reelShares, totalShares, recordShare, posts } = useStore()
  const [shareMsg, setShareMsg] = useState('')
  async function shareReel(r: { id: string; title: string; creator: string }) {
    const url = `${INVITE_BASE_URL}reels?reel=${r.id}`
    const res = await shareLink(`PiCall Reels — ${r.title}`, `Watch: “${r.title}” (${r.creator}) — PiCall Reels!`, url)
    if (res === 'shared' || res === 'copied') {
      recordShare(r.id)
      setShareMsg(res === 'shared' ? '✅ Reel shared!' : '✅ Reel link copied — send it!')
    }
  }
  // ভিডিও পোস্টও রিল — ফিডে ভিডিও দিলে সেটা এখানেও চালানো যায়
  const videoReels = posts.filter(p => p.videoUrl).map(p => ({ id: 'post-' + p.id, title: (p.title || p.text || 'Video').slice(0, 60), creator: p.author, videoUrl: p.videoUrl as string }))
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">🎬 Reels & Monetization</h1>
      <p className="text-sm text-gray-500">Total share: <b>↗️ {totalShares}</b> • If you like it, share — friends will join PiCall!</p>
      {shareMsg && <p className="text-sm text-green-600">{shareMsg}</p>}
      <div className="grid grid-cols-2 gap-3">
        {REELS.length === 0 && videoReels.length === 0 && <p className="text-sm text-gray-500 col-span-2">No reels yet.</p>}
        {REELS.map(r => (
          <Card key={r.id}>
            <div className="text-4xl">🎬</div>
            <p className="font-bold mt-2">{r.title}</p>
            <p className="text-sm text-gray-500">{r.views} Views • {r.creator}</p>
            <div className="flex gap-2 mt-3 items-center">
              <Btn variant="ghost" onClick={() => shareReel(r)}>↗️ Share</Btn>
              <span className="text-sm text-gray-500">↗️ {reelShares[r.id] ?? 0} shares</span>
            </div>
          </Card>
        ))}
        {videoReels.map(r => (
          <Card key={r.id}>
            <video src={r.videoUrl} controls playsInline className="w-full aspect-[9/16] object-cover rounded-xl bg-black" />
            <p className="font-bold mt-2">{r.title}</p>
            <p className="text-sm text-gray-500">{r.creator}</p>
            <div className="flex gap-2 mt-3 items-center">
              <Btn variant="ghost" onClick={() => shareReel(r)}>↗️ Share</Btn>
              <span className="text-sm text-gray-500">↗️ {reelShares[r.id] ?? 0} shares</span>
            </div>
          </Card>
        ))}
      </div>
      <Card><h2 className="font-bold">Creator Monetization</h2><p className="text-sm mt-1">Earn from Reels, live classes and premium content. Creators get a share from views, gifts and subscriptions — details in the admin revenue panel.</p></Card>
    </div>
  )
}

export function AdsPage() {
  const [budget, setBudget] = useState(1000)
  const [done, setDone] = useState(false)
  return (
    <div className="max-w-lg mx-auto"><Card>
      <h1 className="text-xl font-bold">📢 Self-Serve Ads</h1>
      <p className="text-sm text-gray-500 mt-1">Create your own ad — it will show on the Feed, Reels and Live TV.</p>
      <label className="text-sm block mt-3">Ad Title</label>
      <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" placeholder="e.g. my shop offer" />
      <label className="text-sm block mt-3">Daily Budget (Tk)</label>
      <input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={budget} onChange={e => setBudget(Number(e.target.value))} />
      <p className="text-sm mt-2">Estimated reach: ~{(budget * 10).toLocaleString('en-IN')} people/day</p>
      <Btn className="w-full mt-4" onClick={() => setDone(true)}>Submit Ad</Btn>
      {done && <p className="text-sm text-green-600 mt-2">✅ Ad submitted for review.</p>}
    </Card></div>
  )
}

// ---------- অ্যাডমিন সেটিংস ----------
// আসল তথ্য (SMS গেটওয়ে, ইমেইল SMTP, পেমেন্টের নম্বর/ঠিকানা) অ্যাডমিন প্যানেল থেকেই
// বসানো যায় — কোথাও hard-code করা নেই। গোপন মান (API key, App Password) password
// ইনপুটে থাকে, পুরো দেখানো হয় না, খতিয়ানে/শেয়ারে লেখা হয় না।
function AdminSettingsTab() {
  const { adminSettings, setAdminSettings } = useStore()
  const [sms, setSms] = useState(adminSettings.sms)
  const [smtp, setSmtp] = useState(adminSettings.smtp)
  const [pay, setPay] = useState(adminSettings.payments)
  const [smsMsg, setSmsMsg] = useState('')
  const [smtpMsg, setSmtpMsg] = useState('')
  const [payMsg, setPayMsg] = useState('')
  const [serverStatus, setServerStatus] = useState<{ smtpConfigured: boolean; smsConfigured: boolean } | null>(null)
  useEffect(() => { getAdminSettingsStatus().then(s => { if (s) setServerStatus(s) }) }, [])

  function saveSms() {
    setAdminSettings({ ...adminSettings, sms })
    setSmsMsg('✅ SMS gateway info saved.')
  }
  function clearSms() {
    const cleared = { provider: 'BulkSMSBD', apiKey: '', senderId: '' }
    setSms(cleared)
    setAdminSettings({ ...adminSettings, sms: cleared })
    setSmsMsg('SMS gateway info deleted.')
  }
  async function saveSmtp() {
    const user = smtp.user.trim()
    const pass = smtp.pass
    if (!user || !pass) { setSmtpMsg('Give both your Gmail address and App Password.'); return }
    const cleaned = { host: smtp.host.trim() || 'smtp.gmail.com', port: Number(smtp.port) || 587, user, pass, from: smtp.from.trim() }
    setSmtp(cleaned)
    setAdminSettings({ ...adminSettings, smtp: cleaned })
    setSmtpMsg('Saving…')
    const ok = await saveAdminSmtp(cleaned)
    const st = await getAdminSettingsStatus()
    if (st) setServerStatus(st)
    setSmtpMsg(ok
      ? '✅ SMTP saved — also sent to the server, OTP mail will now go through this SMTP.'
      : '✅ SMTP saved on this device — it did not reach the server (backend not reachable), save again later.')
  }
  async function clearSmtp() {
    const cleared = { host: 'smtp.gmail.com', port: 587, user: '', pass: '', from: '' }
    setSmtp(cleared)
    setAdminSettings({ ...adminSettings, smtp: cleared })
    await saveAdminSmtp(cleared)
    const st = await getAdminSettingsStatus()
    if (st) setServerStatus(st)
    setSmtpMsg('SMTP info deleted.')
  }
  function savePay() {
    const cleaned = {
      bkash: pay.bkash.trim(), nagad: pay.nagad.trim(), rocket: pay.rocket.trim(),
      usdtBep20: pay.usdtBep20.trim(), usdtErc20: pay.usdtErc20.trim(),
      binancePayId: pay.binancePayId.trim(), piDepositAddress: pay.piDepositAddress.trim(), piTestnetAddress: (pay.piTestnetAddress || '').trim(),
    }
    setPay(cleaned)
    setAdminSettings({ ...adminSettings, payments: cleaned })
    setPayMsg('✅ Payment details saved — the wallet top-up and Pi deposit cards will now show the real numbers/addresses.')
  }
  function clearPay() {
    const cleared = { bkash: '', nagad: '', rocket: '', usdtBep20: '', usdtErc20: '', binancePayId: '', piDepositAddress: '', piTestnetAddress: '' }
    setPay(cleared)
    setAdminSettings({ ...adminSettings, payments: cleared })
    setPayMsg('Payment details deleted — the wallet will show "Not set up yet" until you set them again.')
  }
  const inputCls = 'w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600'
  return (
    <Card>
      <h2 className="font-bold">⚙️ Settings — Put Real Info Here</h2>
      <p className="text-xs text-gray-500 mt-1">The numbers/addresses/keys set here will be used in the app — do not send them in chat or code. Secret values (API key, App Password) are never shown in full.</p>

      <h3 className="font-bold mt-5">📩 SMS Gateway</h3>
      <label className="text-sm block mt-2">Provider</label>
      <select className={inputCls} value={sms.provider} onChange={e => { setSms({ ...sms, provider: e.target.value }); setSmsMsg('') }}>
        <option value="BulkSMSBD">BulkSMSBD</option>
        <option value="SSL Wireless">SSL Wireless</option>
      </select>
      <label className="text-sm block mt-2">API Key</label>
      <input type="password" className={inputCls} value={sms.apiKey} onChange={e => { setSms({ ...sms, apiKey: e.target.value }); setSmsMsg('') }} placeholder="Gateway API Key" autoComplete="off" />
      {sms.apiKey && <p className="text-xs text-green-600 mt-1">✅ API Key saved</p>}
      <label className="text-sm block mt-2">Sender ID</label>
      <input className={inputCls} value={sms.senderId} onChange={e => { setSms({ ...sms, senderId: e.target.value }); setSmsMsg('') }} placeholder="e.g. PiCall" />
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={saveSms}>Save</Btn>
        <Btn variant="ghost" onClick={clearSms}>Delete</Btn>
      </div>
      {smsMsg && <p className="text-sm text-green-600 mt-2">{smsMsg}</p>}
      <p className="text-xs text-amber-600 mt-2">Sending SMS is not on yet — the gateway account info will be saved here.</p>

      <h3 className="font-bold mt-6 pt-4 border-t">✉️ Email SMTP (for OTP mail)</h3>
      <p className="text-xs text-gray-500 mt-1">Server Status: {serverStatus ? (serverStatus.smtpConfigured ? 'SMTP on ✅ — OTP mail will be sent' : 'SMTP off — OTP mail will not be sent') : 'Unknown (could not reach the backend)'}</p>
      <label className="text-sm block mt-2">SMTP Host</label>
      <input className={inputCls} value={smtp.host} onChange={e => { setSmtp({ ...smtp, host: e.target.value }); setSmtpMsg('') }} placeholder="smtp.gmail.com" />
      <label className="text-sm block mt-2">SMTP Port</label>
      <input type="number" className={inputCls} value={smtp.port} onChange={e => { setSmtp({ ...smtp, port: Number(e.target.value) }); setSmtpMsg('') }} placeholder="587" />
      <label className="text-sm block mt-2">Gmail Address</label>
      <input className={inputCls} value={smtp.user} onChange={e => { setSmtp({ ...smtp, user: e.target.value }); setSmtpMsg('') }} placeholder="you@gmail.com" inputMode="email" />
      <label className="text-sm block mt-2">App Password</label>
      <input type="password" className={inputCls} value={smtp.pass} onChange={e => { setSmtp({ ...smtp, pass: e.target.value }); setSmtpMsg('') }} placeholder="Gmail App Password (16 characters)" autoComplete="off" />
      {smtp.pass && <p className="text-xs text-green-600 mt-1">✅ App Password saved</p>}
      <label className="text-sm block mt-2">Sender's Email Address (From)</label>
      <input className={inputCls} value={smtp.from} onChange={e => { setSmtp({ ...smtp, from: e.target.value }); setSmtpMsg('') }} placeholder="e.g. noreply@your-domain.com" inputMode="email" />
      <p className="text-xs text-gray-400 mt-1">If empty, your Gmail address will be the sender. After buying your own domain, put noreply@yourdomain here — then that domain's SMTP must also be set here.</p>
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={saveSmtp}>Save</Btn>
        <Btn variant="ghost" onClick={clearSmtp}>Delete</Btn>
      </div>
      {smtpMsg && <p className="text-sm text-green-600 mt-2">{smtpMsg}</p>}
      <p className="text-xs text-amber-600 mt-2">The server copy will be deleted on a Railway restart — then you must save again. Permanent way: set SMTP_* env vars in Railway.</p>

      <h3 className="font-bold mt-6 pt-4 border-t">💰 Real Payment Details</h3>
      <p className="text-xs text-gray-500 mt-1">The numbers/addresses set here will show on the wallet top-up and Pi deposit cards. If empty, the wallet shows “Not set up yet — ask the admin”.</p>
      <label className="text-sm block mt-2">bKash Number</label>
      <input className={inputCls} value={pay.bkash} onChange={e => { setPay({ ...pay, bkash: e.target.value }); setPayMsg('') }} placeholder="01XXXXXXXXX" inputMode="tel" />
      <label className="text-sm block mt-2">Nagad Number</label>
      <input className={inputCls} value={pay.nagad} onChange={e => { setPay({ ...pay, nagad: e.target.value }); setPayMsg('') }} placeholder="01XXXXXXXXX" inputMode="tel" />
      <label className="text-sm block mt-2">Rocket Number</label>
      <input className={inputCls} value={pay.rocket} onChange={e => { setPay({ ...pay, rocket: e.target.value }); setPayMsg('') }} placeholder="01XXXXXXXXX" inputMode="tel" />
      <label className="text-sm block mt-2">USDT BEP20 Address</label>
      <input className={inputCls} value={pay.usdtBep20} onChange={e => { setPay({ ...pay, usdtBep20: e.target.value }); setPayMsg('') }} placeholder="0x..." />
      <label className="text-sm block mt-2">USDT ERC20 Address</label>
      <input className={inputCls} value={pay.usdtErc20} onChange={e => { setPay({ ...pay, usdtErc20: e.target.value }); setPayMsg('') }} placeholder="0x..." />
      <label className="text-sm block mt-2">Binance Pay ID</label>
      <input className={inputCls} value={pay.binancePayId} onChange={e => { setPay({ ...pay, binancePayId: e.target.value }); setPayMsg('') }} placeholder="Binance Pay ID" />
      <label className="text-sm block mt-2">Pi Deposit Address</label>
      <input className={inputCls} value={pay.piDepositAddress} onChange={e => { setPay({ ...pay, piDepositAddress: e.target.value }); setPayMsg('') }} placeholder="G..." />
      <label className="text-sm block mt-2">Pi Testnet Address (test Pi only — no value)</label>
      <input className={inputCls} value={pay.piTestnetAddress || ''} onChange={e => { setPay({ ...pay, piTestnetAddress: e.target.value }); setPayMsg('') }} placeholder="G..." />
      <p className="text-xs text-gray-400 mt-1">Only set this if you have a separate test Pi address. If empty, Testnet shows “Not set up yet”.</p>
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={savePay}>Save</Btn>
        <Btn variant="ghost" onClick={clearPay}>Delete</Btn>
      </div>
      {payMsg && <p className="text-sm text-green-600 mt-2">{payMsg}</p>}
    </Card>
  )
}

export function AdminPage() {
  const { datingRate, setDatingRate, liveRate, setLiveRate, kycInfo, kycStatus, kycRejectReason, approveKyc, rejectKyc, piRateBDT, setPiRateBDT, usdtRateBDT, setUsdtRateBDT, piWithdrawFeePct, setPiWithdrawFeePct, piMinWithdraw, pendingTopUps, approveTopUp, rejectTopUp, adminSettings, tvPlaylistUrl, setTvPlaylistUrl } = useStore()
  // টপ-আপ আবেদনের গন্তব্য — গ্রাহককে যে নম্বর/ঠিকানা দেখানো হয়েছিল (অ্যাডমিন সেটিংসে বসানো থাকলে আসলটা)
  function topUpDestination(t: { method: string; network?: string }): string {
    if (t.method === 'bKash') return adminSettings.payments.bkash
    if (t.method === 'Nagad') return adminSettings.payments.nagad
    if (t.method === 'Rocket') return adminSettings.payments.rocket
    if (t.method.startsWith('USDT')) return t.network === 'ERC20' ? adminSettings.payments.usdtErc20 : adminSettings.payments.usdtBep20
    if (t.method === 'Binance Pay') return adminSettings.payments.binancePayId
    return ''
  }
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
    const n = Math.round(Number(datingRateInput) * 100) / 100
    if (!Number.isFinite(n) || n < 0.01) { setDatingRateErr('Rate must be at least π 0.01/minute.'); setDatingRateMsg(''); return }
    setDatingRate(n); setDatingRateErr('')
    setDatingRateMsg(`✅ Dating call rate ${formatPi(n)}/minute saved.`)
  }
  // ডেটিং লাইভ রেট — কলের রেট থেকে সম্পূর্ণ আলাদা; লাইভে Pi কম কাটবে (ডিফল্ট π ০.০৫/মিনিট)
  const [liveRateInput, setLiveRateInput] = useState(String(liveRate))
  const [liveRateMsg, setLiveRateMsg] = useState('')
  const [liveRateErr, setLiveRateErr] = useState('')
  function saveLiveRate() {
    const n = Math.round(Number(liveRateInput) * 100) / 100
    if (!Number.isFinite(n) || n < 0.01) { setLiveRateErr('Rate must be at least π 0.01/minute.'); setLiveRateMsg(''); return }
    setLiveRate(n); setLiveRateErr('')
    setLiveRateMsg(`✅ Dating live rate ${formatPi(n)}/minute saved.`)
  }
  // π Pi দর + USDT দর + তোলার ফি — অ্যাডমিন নির্ধারিত (ওয়ালেটে সাথে সাথে বদলায়)
  const [piRateInput, setPiRateInput] = useState('')
  const [piRateMsg, setPiRateMsg] = useState('')
  const [usdtRateInput, setUsdtRateInput] = useState('')
  const [usdtRateMsg, setUsdtRateMsg] = useState('')
  const [feeInput, setFeeInput] = useState('')
  const [feeMsg, setFeeMsg] = useState('')
  function savePiRate() {
    const v = Math.round(Number(piRateInput) * 100) / 100
    if (!Number.isFinite(v) || v < 1) { setPiRateMsg('Rate must be at least Tk 1/Pi.'); return }
    setPiRateBDT(v); setPiRateMsg(`✅ Pi rate saved: 1 Pi = ${formatBDT(v)}.`)
  }
  function saveUsdtRate() {
    const v = Math.round(Number(usdtRateInput) * 100) / 100
    if (!Number.isFinite(v) || v < 1) { setUsdtRateMsg('Rate must be at least Tk 1/USDT.'); return }
    setUsdtRateBDT(v); setUsdtRateMsg(`✅ USDT rate saved: 1 USDT = ${formatBDT(v)}.`)
  }
  function saveFee() {
    const v = Math.round(Number(feeInput) * 10) / 10
    if (!Number.isFinite(v) || v < 0 || v > 10) { setFeeMsg('Fee must be between 0–10%.'); return }
    setPiWithdrawFeePct(v); setFeeMsg(`✅ Withdraw fee saved: ${v}%.`)
  }
  // Live TV — ONE playlist link (M3U) drives the whole channel list; the app
  // fetches it and shows every channel inside it. Saving here writes
  // config/public (tvPlaylistUrl) — no code change needed to change channels.
  const [tvPlaylistInput, setTvPlaylistInput] = useState(tvPlaylistUrl)
  const [tvPlaylistMsg, setTvPlaylistMsg] = useState('')
  const [tvPlaylistErr, setTvPlaylistErr] = useState('')
  async function saveTvPlaylist() {
    const u = tvPlaylistInput.trim()
    if (!isPlaylistUrl(u)) { setTvPlaylistErr('Paste a valid playlist link starting with http:// or https://.'); setTvPlaylistMsg(''); return }
    setTvPlaylistUrl(u)
    setTvPlaylistErr('')
    try {
      const list = await fetchTvPlaylist(u)
      setTvPlaylistMsg(`✅ Playlist saved — ${list.length} channels found.`)
    } catch {
      setTvPlaylistMsg('✅ Playlist saved — could not load it right now, check the link. Users will see the saved channels until it loads.')
    }
  }
  function resetTvPlaylist() {
    setTvPlaylistInput(DEFAULT_TV_PLAYLIST_URL)
    setTvPlaylistUrl(DEFAULT_TV_PLAYLIST_URL)
    setTvPlaylistErr('')
    setTvPlaylistMsg('✅ Playlist reset to the default.')
  }
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold">🛡️ Admin Panel</h1>
      <div className="flex gap-2 flex-wrap">{['revenue', 'users', 'kyc', 'recordings', 'livetv', 'moderation', 'settings'].map(t => <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-sm capitalize ${tab === t ? 'bg-fb-blue text-white' : 'bg-white dark:bg-fb-card'}`}>{t === 'kyc' ? 'KYC Verification' : t === 'settings' ? '⚙️ Settings' : t}</button>)}</div>
      {tab === 'revenue' && <Card>
        <h2 className="font-bold">Revenue & Fee Calculator</h2>
        <label className="text-sm block mt-3">Commission %</label><input type="number" className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={rate} onChange={e => setRate(Number(e.target.value))} />
        <label className="text-sm block mt-2">Call Rate (Tk/minute)</label><input type="number" className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={price} onChange={e => setPrice(Number(e.target.value))} />
        <label className="text-sm block mt-2">Minutes</label><input type="number" className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={mins} onChange={e => setMins(Number(e.target.value))} />
        <p className="mt-3 text-sm">Total: <b>{formatBDT(price * mins)}</b> • Platform ({rate}%): <b>{formatBDT(price * mins * rate / 100)}</b> • Expert will get: <b>{formatBDT(price * mins * (100 - rate) / 100)}</b></p>
        <p className="text-xs text-gray-400 mt-1">Example: Tk 10/minute × 10 minutes = Tk 100, at 20% commission the platform gets Tk 20, the expert gets Tk 80.</p>
        <h3 className="font-bold mt-5">Dating Call Rate</h3>
        <label className="text-sm block mt-2">Dating Call Rate (π/minute)</label>
        <div className="flex gap-2 items-center flex-wrap mt-1">
          <input type="number" min={0.01} step={0.01} className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={datingRateInput} onChange={e => { setDatingRateInput(e.target.value); setDatingRateMsg(''); setDatingRateErr('') }} />
          <Btn onClick={saveDatingRate}>Save</Btn>
        </div>
        <p className="text-xs text-gray-400 mt-1">Currently saved: <b>{formatPi(datingRate)}/ minute</b> • Minimum π 0.01/minute. Friend call rate is π 0.1/minute flat — this will not change.</p>
        {datingRateMsg && <p className="text-sm text-green-600 mt-2">{datingRateMsg}</p>}
        {datingRateErr && <p className="text-sm text-red-600 mt-2">{datingRateErr}</p>}
        <h3 className="font-bold mt-5">Dating Live Rate</h3>
        <p className="text-xs text-gray-500">The live watch rate is different from the call rate — live uses less Pi. Live split: host 70%, admin 30% (unchanged).</p>
        <label className="text-sm block mt-2">Dating Live Rate (π/minute)</label>
        <div className="flex gap-2 items-center flex-wrap mt-1">
          <input type="number" min={0.01} step={0.01} className="border rounded-lg px-3 py-2 w-32 dark:bg-slate-800" value={liveRateInput} onChange={e => { setLiveRateInput(e.target.value); setLiveRateMsg(''); setLiveRateErr('') }} />
          <Btn onClick={saveLiveRate}>Save</Btn>
        </div>
        <p className="text-xs text-gray-400 mt-1">Currently saved: <b>{formatPi(liveRate)}/ minute</b> • Minimum π 0.01/minute.</p>
        {liveRateMsg && <p className="text-sm text-green-600 mt-2">{liveRateMsg}</p>}
        {liveRateErr && <p className="text-sm text-red-600 mt-2">{liveRateErr}</p>}
        <h3 className="font-bold mt-5">π Pi Rate (set by admin)</h3>
        <p className="text-xs text-gray-500">Top-up conversion, deposit/withdraw and USDT exchange rates can be changed here — the wallet will show the new rate as soon as you change it.</p>
        <div className="grid sm:grid-cols-3 gap-3 mt-2">
          <div>
            <label className="text-sm block">Pi Rate (Tk/Pi)</label>
            <input type="number" min={1} step={0.01} className="border rounded-lg px-3 py-2 w-full dark:bg-slate-800 mt-1" value={piRateInput} onChange={e => { setPiRateInput(e.target.value); setPiRateMsg('') }} placeholder={`Current: Tk ${piRateBDT}`} />
            <Btn className="mt-1" onClick={savePiRate}>Save</Btn>
            {piRateMsg && <p className="text-xs text-green-600 mt-1">{piRateMsg}</p>}
          </div>
          <div>
            <label className="text-sm block">USDT Rate (Tk/USDT)</label>
            <input type="number" min={1} step={0.01} className="border rounded-lg px-3 py-2 w-full dark:bg-slate-800 mt-1" value={usdtRateInput} onChange={e => { setUsdtRateInput(e.target.value); setUsdtRateMsg('') }} placeholder={`Current: Tk ${usdtRateBDT}`} />
            <Btn className="mt-1" onClick={saveUsdtRate}>Save</Btn>
            {usdtRateMsg && <p className="text-xs text-green-600 mt-1">{usdtRateMsg}</p>}
          </div>
          <div>
            <label className="text-sm block">Pi Withdraw Fee (%)</label>
            <input type="number" min={0} max={10} step={0.1} className="border rounded-lg px-3 py-2 w-full dark:bg-slate-800 mt-1" value={feeInput} onChange={e => { setFeeInput(e.target.value); setFeeMsg('') }} placeholder={`Current: ${piWithdrawFeePct}%`} />
            <Btn className="mt-1" onClick={saveFee}>Save</Btn>
            {feeMsg && <p className="text-xs text-green-600 mt-1">{feeMsg}</p>}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Current rate: 1 Pi = {formatBDT(piRateBDT)} • 1 USDT = {formatBDT(usdtRateBDT)} • Withdraw fee {piWithdrawFeePct}% (minimum 0.1 π) • Minimum withdraw 10 USDT = {formatPi(piMinWithdraw)}।</p>
        <h3 className="font-bold mt-5">Top-up Approval</h3>
        <p className="text-xs text-gray-500">Manual top-up requests — approval adds to the Pi balance (Taka ÷ Pi rate; USDT × USDT rate ÷ Pi rate, at admin-set rates).</p>
        {pendingTopUps.length === 0 && <p className="text-sm text-gray-500 mt-2">No requests.</p>}
        {pendingTopUps.map(t => (
          <div key={t.id} className="border rounded-lg p-3 mt-2 flex justify-between gap-2 flex-wrap">
            <div className="text-sm">
              <p className="font-bold">{t.method}{t.network ? ` (${t.network})` : ''} — {t.currency === 'USDT' ? `${t.amount} USDT → ${formatBDT(Math.round(t.amount * usdtRateBDT))}` : formatBDT(t.amount)}</p>
              <p className="text-green-600 font-bold">→ {formatPi(topUpPi(t.amount, t.currency, piRateBDT, usdtRateBDT))} Pi will be added</p>
              <p className="text-gray-500">Reference: {t.trxId}</p>
              {topUpDestination(t) && <p className="text-gray-500">Destination (given to the customer): {topUpDestination(t)}</p>}
              <p className="text-gray-500">{t.date} • {t.status === 'pending' ? '⏳ Under review' : t.status === 'approved' ? '✅ Approved' : '❌ Rejected'}</p>
            </div>
            {t.status === 'pending' && (
              <div className="flex gap-2 items-start">
                <Btn variant="green" onClick={() => approveTopUp(t.id)}>✅ Approve</Btn>
                <Btn variant="ghost" onClick={() => rejectTopUp(t.id)}>❌ Reject</Btn>
              </div>
            )}
          </div>
        ))}
      </Card>}
      {tab === 'kyc' && <Card>
        <h2 className="font-bold">🛡️ Dating KYC Verification — Admin</h2>
        <p className="text-xs text-gray-400 mt-1">Match the name, age, ID (with full number) and selfie/live video, then approve or reject. Approval opens Dating for that user. Your submission is reviewed by the admin. Real verification needs a verified KYC service; submissions stay only on this device.</p>
        <p className="text-xs text-amber-600 mt-1">⚠️ A full NID number is extremely sensitive personal information — view it only for admin verification, do not share it with anyone. In real production, a full NID cannot be stored in plain text; it must be encrypted and handled through a verified KYC service.</p>
        {kycStatus === 'none' && <p className="text-sm mt-3">No KYC submitted.</p>}
        {kycInfo && (<div className="mt-3">
          <div className="flex gap-4 flex-wrap items-start">
            <div>
              {kycInfo.selfie ? <img src={kycInfo.selfie} alt="KYC Selfie" className="w-32 aspect-[3/4] object-cover rounded-xl border" /> : <p className="text-sm text-gray-400">No selfie photo</p>}
              <p className="text-xs text-gray-400 mt-1 w-32">📸 Selfie Photo</p>
            </div>
            <div>
              {kycInfo.selfieVideo ? <video src={kycInfo.selfieVideo} controls loop muted playsInline className="w-32 aspect-[3/4] object-cover rounded-xl border bg-black" /> : <p className="text-sm text-gray-400 w-32">🎥 Live video could not be saved on this device — match it with the selfie photo only.</p>}
              {kycInfo.selfieVideo && <p className="text-xs text-gray-400 mt-1 w-32">🎥 Live Video (~3 seconds) — play it</p>}
            </div>
            <div className="text-sm space-y-1 flex-1 min-w-[200px]">
              <p><b>Name:</b> {kycInfo.name}</p>
              <p><b>Date of Birth:</b> {kycInfo.dob} (Age: {ageFromDob(kycInfo.dob)} years)</p>
              <p><b>ID Type:</b> {kycInfo.idType}</p>
              <p><b>ID Number (full):</b> {kycInfo.idNumber ? kycInfo.idNumber : 'Full number is not saved (earlier submission) — submit KYC again and the full number will be saved'}</p>
              <p><b>Last 4 of ID:</b> {kycInfo.idLast4}</p>
              <p><b>Deposit Date:</b> {new Date(kycInfo.submittedAt).toLocaleString('en-GB')}</p>
              <p><b>Status:</b> {kycStatus === 'pending' ? '⏳ Under review' : kycStatus === 'approved' ? `✅ Approved (${kycInfo.verifiedAt ? new Date(kycInfo.verifiedAt).toLocaleDateString('en-GB') : ''})` : kycStatus === 'rejected' ? '❌ Rejected' : '—'}</p>
              {kycStatus === 'rejected' && <p><b>Reason for Rejection:</b> {kycRejectReason || '—'}</p>}
              <p className="text-xs text-gray-400">Check whether the name, age and ID match the person in the photo and video. Selfie and video are for admin verification only — do not share them with anyone else.</p>
            </div>
          </div>
          {kycStatus === 'pending' && (<>
            <div className="flex gap-2 mt-4 flex-wrap">
              <Btn variant="green" onClick={() => { approveKyc(); setShowReject(false) }}>✅ Approve</Btn>
              <Btn variant="ghost" onClick={() => setShowReject(s => !s)}>❌ Reject</Btn>
            </div>
            {showReject && (<div className="mt-3">
              <label className="text-sm font-medium">Reason for Rejection (required)</label>
              <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. selfie unclear, name does not match ID" />
              <Btn className="mt-2" disabled={!rejectReason.trim()} onClick={() => { rejectKyc(rejectReason); setRejectReason(''); setShowReject(false) }}>Confirm Cancellation</Btn>
            </div>)}
          </>)}
          {kycStatus === 'approved' && <p className="text-sm text-green-600 mt-3">✅ Approved — Dating is now open for this user.</p>}
          {kycStatus === 'rejected' && <p className="text-sm text-red-500 mt-3">❌ Rejected — the user can fix the info and submit KYC again.</p>}
        </div>)}
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="font-bold">🔴 Watch Running Live — Admin Monitoring</h3>
            <Btn variant="ghost" onClick={refreshAdminRooms}>🔄 Refresh</Btn>
          </div>
          <p className="text-xs text-gray-400 mt-1">The admin can monitor from here who is on Dating Live right now. Entering a live applies the same prepaid rate as a viewer.</p>
          {!adminLiveOk && <p className="text-sm text-amber-600 mt-2">⚠️ Cannot reach the live server — running lives will show here once the server is up.</p>}
          {adminLiveOk && adminRooms && adminRooms.length === 0 && <p className="text-sm mt-2">Nobody is live right now.</p>}
          {adminLiveOk && adminRooms && adminRooms.length > 0 && (
            <div className="space-y-2 mt-3">
              {adminRooms.map(r => (
                <div key={r.id} className="flex justify-between items-center gap-2 border rounded-lg px-3 py-2 flex-wrap">
                  <div className="text-sm">
                    <p className="font-bold">🔴 {r.hostName} <span className="text-xs font-normal text-gray-400">• {r.title || 'Dating Live'}</span></p>
                    <p className="text-xs text-gray-500">👁️ {r.viewers} watching • started: {new Date(r.startedAt).toLocaleTimeString('en-GB')}</p>
                  </div>
                  <Link to={`/dating-live/${r.id}`} className="bg-fb-blue text-white text-sm font-medium px-3 py-1.5 rounded-full">👁️ View</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>}
      {tab === 'users' && <Card><h2 className="font-bold">Users</h2><p className="text-sm text-gray-500 mt-2">No user totals yet — live user counts are not tracked.</p><p className="text-sm mt-2">Dating KYC: {kycStatus === 'approved' ? `✅ Approved (${kycInfo?.verifiedAt ? new Date(kycInfo.verifiedAt).toLocaleDateString('en-GB') : ''}) — ${kycInfo?.name ?? ''} (${kycInfo?.idType ?? ''}, last 4 of ID: ${kycInfo?.idLast4 ?? ''})` : kycStatus === 'pending' ? '⏳ Under review — waiting for admin approval' : kycStatus === 'rejected' ? `❌ Rejected — ${kycRejectReason || 'No reason given'}` : '⏳ Not yet'}</p></Card>}
      {tab === 'recordings' && <Card><h2 className="font-bold">Call Recording — Admin Only</h2><p className="text-sm mt-2">Only the admin can view recordings, for appeal/dispute resolution. Regular users have no record button. Stored: 30 days (Cloudflare R2 free tier). Stored on the server, not on the user's phone.</p><p className="text-sm text-gray-500 mt-1">No recordings yet.</p></Card>}
      {tab === 'livetv' && <Card><h2 className="font-bold">Live TV — IPTV Playlist</h2>
        <p className="text-xs text-gray-500 mt-1">Paste ONE playlist link (M3U). The app loads it and shows every channel inside it in Live TV — no code change needed to change channels.</p>
        <label className="text-sm block mt-3">Playlist URL (M3U link)</label><input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={tvPlaylistInput} onChange={e => { setTvPlaylistInput(e.target.value); setTvPlaylistMsg(''); setTvPlaylistErr('') }} placeholder="https://...m3u" />
        <div className="flex gap-2 mt-3 flex-wrap">
          <Btn onClick={saveTvPlaylist}>Save Playlist</Btn>
          <Btn variant="ghost" onClick={resetTvPlaylist}>Reset to Default</Btn>
        </div>
        {tvPlaylistMsg && <p className="text-sm text-green-600 mt-2">{tvPlaylistMsg}</p>}
        {tvPlaylistErr && <p className="text-sm text-red-600 mt-2">{tvPlaylistErr}</p>}
        <p className="text-xs text-gray-400 mt-2">Currently saved: <b>{tvPlaylistUrl || 'Default playlist (Eamin Tv)'}</b></p>
        <p className="text-xs text-gray-400 mt-1">Use only playlists you have the right to show. Streams from a third-party playlist can break or change — if a channel stops playing, replace the playlist link.</p>
      </Card>}
      {tab === 'moderation' && <Card><h2 className="font-bold">Moderation Log</h2><p className="text-sm text-gray-500 mt-2">No attempts logged yet.</p><p className="text-sm text-gray-500 mt-1">No reported profiles.</p></Card>}
      {tab === 'settings' && <AdminSettingsTab />}
    </div>
  )
}


// ---------- প্রোফাইল সেটিংস ----------
// অ্যাকাউন্ট করার পর ব্যবহারকারী নিজের প্রোফাইল সাজায় — নাম, জন্মতারিখ, লিঙ্গ,
// জেলা, থানা, ঠিকানা (+ লুকানোর অপশন), প্রোফাইল ছবি, গ্যালারি ছবি (সর্বোচ্চ ৮),
// ইন্টারেস্ট। সম্পূর্ণতার হিসাব: নাম ১৫%, ছবি ১৫%, জন্মতারিখ ১০%, লিঙ্গ ১০%,
// জেলা ১০%, থানা+ঠিকানা ১০%, গ্যালারি ১৫% (৬+ ছবিতে পুরো), ইন্টারেস্ট ১৫%।
// ঠিকানা + জন্মতারিখ শুধু users/{uid} ডকে থাকে — publicProfiles-এ যায় না।
function ProfileSettingsForm({ onClose }: { onClose: () => void }) {
  const { user, login, profileDob, gender, district, thana, address, hideAddress, profilePhoto, galleryPhotos, interests, updateProfile: saveProfile, kycInfo } = useStore()
  const [name, setName] = useState(user?.name ?? '')
  const [dob, setDob] = useState(profileDob || kycInfo?.dob || '')
  const [gen, setGen] = useState<Gender>(gender)
  const [dist, setDist] = useState(district)
  const [th, setTh] = useState(thana)
  const [addr, setAddr] = useState(address)
  const [hide, setHide] = useState(hideAddress)
  const [photo, setPhoto] = useState(profilePhoto)
  const [gallery, setGallery] = useState<string[]>(galleryPhotos)
  const [ints, setInts] = useState<string[]>(interests)
  const [saved, setSaved] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const pct = profileCompletion(name, { profileDob: dob, gender: gen, district: dist, thana: th, address: addr, hideAddress: hide, profilePhoto: photo, galleryPhotos: gallery, interests: ints })
  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => { const d = downscaleImage(img, img.width, img.height, 400); if (d) setPhoto(d) }
      img.src = String(r.result)
    }
    r.readAsDataURL(f)
  }
  function pickGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    for (const f of files) {
      const r = new FileReader()
      r.onload = () => {
        const img = new Image()
        img.onload = () => { const d = downscaleImage(img, img.width, img.height, 400); if (d) setGallery(g => [...g, d].slice(0, 8)) }
        img.src = String(r.result)
      }
      r.readAsDataURL(f)
    }
  }
  async function save() {
    const n = name.trim()
    if (n && user && n !== user.name) {
      try { const a = getFirebaseAuth(); if (a?.currentUser) await updateProfile(a.currentUser, { displayName: n }) } catch { /* Firebase নাম না বদলালেও লোকাল নাম বদলাবে */ }
      login(n, user.email)
    }
    saveProfile({ profileDob: dob, gender: gen, district: dist, thana: th, address: addr, hideAddress: hide, profilePhoto: photo, galleryPhotos: gallery, interests: ints })
    setSaved('✅ Profile saved.')
  }
  const inputCls = 'w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600'
  return (
    <Card>
      <div className="flex justify-between items-center">
        <h2 className="font-bold">⚙️ Profile Settings</h2>
        <button onClick={onClose} className="text-gray-400 px-2">✕</button>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-sm"><span>Profile {pct}% complete</span><span>{pct}%</span></div>
        <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full mt-1"><div className="h-2 rounded-full pb-gradient" style={{ width: pct + '%' }} /></div>
      </div>
      <label className="text-sm font-medium mt-4 block">Display Name</label>
      <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={40} />
      <label className="text-sm font-medium mt-3 block">Date of Birth</label>
      <input type="date" max={new Date().toISOString().slice(0, 10)} className={inputCls} value={dob} onChange={e => setDob(e.target.value)} />
      <label className="text-sm font-medium mt-3 block">Gender</label>
      <div className="flex gap-2 mt-1">{(['Male', 'Female'] as const).map(g => (
        <button key={g} onClick={() => setGen(g)} className={`px-4 py-2 rounded-full text-sm font-medium ${gen === g ? 'pb-gradient text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>{g}</button>
      ))}</div>
      <label className="text-sm font-medium mt-3 block">District</label>
      <select className={inputCls} value={dist} onChange={e => setDist(e.target.value)}>
        <option value="">— Choose district —</option>
        {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <label className="text-sm font-medium mt-3 block">Thana</label>
      <input className={inputCls} value={th} onChange={e => setTh(e.target.value)} placeholder="Your thana" />
      <label className="text-sm font-medium mt-3 block">Full Address</label>
      <input className={inputCls} value={addr} onChange={e => setAddr(e.target.value)} placeholder="House, road, area" />
      <div className="flex items-center justify-between gap-2 mt-3 text-sm">
        <span>Hide my address from other users</span>
        <button onClick={() => setHide(h => !h)} className={`px-3 py-1.5 rounded-full font-bold ${hide ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>{hide ? 'Hidden' : 'Visible'}</button>
      </div>
      <p className="text-xs text-gray-400 mt-1">When hidden, your thana and address are not shown to others. Your district is still used for matching.</p>
      <label className="text-sm font-medium mt-4 block">Profile Photo</label>
      <div className="flex items-center gap-3 mt-1">
        {photo
          ? <img src={photo} alt="Profile photo" className="w-16 h-16 rounded-full object-cover" />
          : <span className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-2xl">👤</span>}
        <div className="flex gap-2 flex-wrap">
          <Btn variant="ghost" onClick={() => photoRef.current?.click()}>📷 {photo ? 'Change Photo' : 'Upload Photo'}</Btn>
          {photo && <Btn variant="ghost" onClick={() => setPhoto('')}>Remove</Btn>}
        </div>
      </div>
      <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
      <label className="text-sm font-medium mt-4 block">Gallery Photos ({gallery.length}/8)</label>
      <p className="text-xs text-gray-400 mt-1">Add up to 8 photos — 6 or more completes this part of your profile.</p>
      <div className="flex gap-2 flex-wrap mt-2">
        {gallery.map((g, i) => (
          <div key={i} className="relative">
            <img src={g} alt={`Gallery ${i + 1}`} className="w-16 h-16 rounded-lg object-cover" />
            <button onClick={() => setGallery(gg => gg.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs">✕</button>
          </div>
        ))}
        {gallery.length < 8 && <button onClick={() => galleryRef.current?.click()} className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-slate-700 text-2xl">+</button>}
      </div>
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={pickGallery} />
      <label className="text-sm font-medium mt-4 block">Interests</label>
      <div className="flex gap-2 flex-wrap mt-2">{INTERESTS.map(i => (
        <button key={i} onClick={() => setInts(v => v.includes(i) ? v.filter(x => x !== i) : [...v, i])} className={`px-3 py-1.5 rounded-full text-xs font-medium ${ints.includes(i) ? 'pb-gradient text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>{i}</button>
      ))}</div>
      <Btn className="w-full mt-5" onClick={save}>Save Profile</Btn>
      {saved && <p className="text-sm text-green-600 mt-2">{saved}</p>}
    </Card>
  )
}

export function MenuPage() {
  const { user, totalPi, logout, isAdmin, soundSettings, setSoundSettings, callPrivacy, setCallPrivacy, uid, referralCode, friends, posts, profilePhoto } = useStore()
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const myPosts = posts.filter(p => p.author === 'You').slice(0, 3)
  const navigate = useNavigate()
  const [pushMsg, setPushMsg] = useState('')
  const [pushBusy, setPushBusy] = useState(false)
  const pushStatus = getPushStatus()
  async function enablePush() {
    setPushBusy(true); setPushMsg('')
    const res = await enableCallPush(uid ?? referralCode)
    setPushBusy(false)
    setPushMsg(res.ok ? '✅ Call notifications are on — you will know when a call comes, even if the app is closed.'
      : res.reason === 'denied' ? '❌ Permission not given — turn on notifications from browser settings.'
      : res.reason === 'not-configured' ? '⚠️ Push key is not set on the server — the admin is setting it up. The in-app call card will still work.'
      : res.reason === 'unsupported' ? '❌ Push notifications do not work on this browser/device.'
      : '❌ Could not turn it on — please try again.')
  }
  const tiles = [
    { to: '/feed', label: 'Feed', icon: '📰', color: '#7C3AED' }, { to: '/marketplace', label: 'Marketplace', icon: '🛍️', color: '#27AE60' },
    { to: '/friends', label: 'Friends', icon: '👥', color: '#8E44AD' }, { to: '/dating', label: 'Dating 18+', icon: '❤️', color: '#E91E63' },
    { to: '/live-tv', label: 'Live TV', icon: '📺', color: '#C0392B' }, { to: '/services', label: 'Home Service', icon: '🏠', color: '#16A085' },
    { to: '/reels', label: 'Reels', icon: '🎬', color: '#E67E22' }, { to: '/wallet', label: 'Wallet', icon: '💰', color: '#2C3E50' },
    { to: '/call-history', label: 'Call History', icon: '📞', color: '#2980B9' }, { to: '/ads', label: 'Ads', icon: '📢', color: '#D35400' },
    { to: '/groups', label: 'Groups & Pages', icon: '👥', color: '#7F8C8D' },
    // অ্যাডমিন টাইল শুধু অ্যাডমিনের মেনুতে দেখায় — সাধারণ ব্যবহারকারীর মেনুতে অ্যাডমিন থাকে না
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: '🛡️', color: '#34495E' }] : [])
  ]
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <div className="flex items-center gap-3">
          {profilePhoto
            ? <img src={profilePhoto} alt="Profile photo" className="w-16 h-16 rounded-full object-cover" />
            : <span className="w-16 h-16 rounded-full pb-gradient text-white text-2xl flex items-center justify-center font-bold">{user ? user.name.slice(0, 1) : '👤'}</span>}
          <div><p className="font-bold text-lg">{user ? user.name : 'Guest user'}</p><p className="text-sm text-gray-500">{user?.email || 'Log in'}</p></div>
          <button onClick={() => navigate('/wallet')} className="ml-auto bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-200 border border-violet-200 dark:border-violet-700 font-bold px-3 py-1.5 rounded-full text-sm">π {formatPi(totalPi)}</button>
        </div>
        {user && <div className="flex gap-2 mt-3">
          <Btn variant="ghost" onClick={() => setShowProfileSettings(s => !s)}>⚙️ Profile Settings</Btn>
          <Btn variant="ghost" onClick={() => { logout(); navigate('/') }}>Log out</Btn>
        </div>}
        {!user && <Btn className="mt-3" onClick={() => navigate('/login')}>Log in</Btn>}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center bg-gray-50 dark:bg-slate-800 rounded-xl py-2"><p className="font-extrabold text-lg">{friends.length}</p><p className="text-xs text-gray-400">Friends</p></div>
          <div className="text-center bg-gray-50 dark:bg-slate-800 rounded-xl py-2"><p className="font-extrabold text-lg">{posts.length}</p><p className="text-xs text-gray-400">Posts</p></div>
          <div className="text-center bg-gray-50 dark:bg-slate-800 rounded-xl py-2"><p className="font-extrabold text-lg">{formatPi(totalPi)}</p><p className="text-xs text-gray-400">Pi balance</p></div>
        </div>
      </Card>
      {showProfileSettings && <ProfileSettingsForm onClose={() => setShowProfileSettings(false)} />}
      <Card>
        <div className="flex justify-between items-center">
          <h2 className="font-bold">Activity</h2>
          <button onClick={() => navigate('/feed')} className="text-sm font-medium text-violet-600">View all →</button>
        </div>
        {myPosts.length === 0
          ? <p className="text-sm text-gray-500 mt-2">No activity yet — write your first post.</p>
          : myPosts.map(p => (
            <div key={p.id} className="py-2 border-b border-gray-100 dark:border-white/10 last:border-0">
              <p className="text-sm font-medium">{p.title ?? p.text}</p>
              <p className="text-xs text-gray-400">{p.time} • ❤️ {p.likes} • 💬 {p.comments}</p>
            </div>
          ))}
      </Card>
      <InstallButton />
      <Card>
        <h2 className="font-bold">📞 Call Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Choose who can call you. For friend calls, an Answer/Decline card appears on the home page.</p>
        <div className="flex gap-2 flex-wrap mt-3">
          {(['everyone', 'friends', 'nobody'] as CallPrivacy[]).map(p => (
            <button key={p} onClick={() => setCallPrivacy(p)} className={`px-3 py-2 rounded-full text-sm font-medium ${callPrivacy === p ? 'bg-fb-blue text-white' : 'bg-gray-100 dark:bg-slate-800'}`}>{CALL_PRIVACY_LABELS[p]}</button>
          ))}
        </div>
        <div className="mt-4 border-t pt-3">
          <p className="font-medium text-sm">🔔 Call Notifications</p>
          <p className="text-sm text-gray-500 mt-1">When on, a call will show a notification on the lock screen even if the app is closed — with Answer/Decline buttons. Tapping Answer opens the app straight into the call.</p>
          <p className="text-xs text-gray-400 mt-1">Honest note: a web app cannot wake a locked screen and come forward by itself — that needs a native app (coming later). Notifications are the way for now.</p>
          {pushStatus.status === 'unsupported' ? (
            <p className="text-sm text-gray-500 mt-2">❌ Push notifications do not work on this browser/device.</p>
          ) : (
            <div className="mt-2">
              <Btn disabled={pushBusy || pushStatus.status === 'granted'} onClick={enablePush}>{pushBusy ? 'Starting…' : pushStatus.status === 'granted' ? '✅ Notifications are on' : '🔔 Turn on call notifications'}</Btn>
              {pushMsg && <p className="text-sm mt-2">{pushMsg}</p>}
            </div>
          )}
        </div>
      </Card>
      {/* সাউন্ড সেটিংস — একটাই জায়গা, মোবাইল আর কম্পিউটারে একই; চ্যাট টগলের সাথে এক */}
      <Card>
        <h2 className="font-bold">🔔 Sound Settings</h2>
        <p className="text-xs text-gray-500 mt-1">Same settings on mobile and computer.</p>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>💬 Chat message sound</span>
            <button onClick={() => setSoundSettings({ chatSound: !soundSettings.chatSound })} className={`px-3 py-1.5 rounded-full font-bold ${soundSettings.chatSound ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>{soundSettings.chatSound ? 'On' : 'Off'}</button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>📞 Incoming call ringtone</span>
            <button onClick={() => setSoundSettings({ ringtone: !soundSettings.ringtone })} className={`px-3 py-1.5 rounded-full font-bold ${soundSettings.ringtone ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>{soundSettings.ringtone ? 'On' : 'Off'}</button>
          </div>
          {soundSettings.ringtone && (
            <label className="block">
              <span>🔊 Ringtone volume — {Math.round(soundSettings.ringtoneVolume * 100)}%</span>
              <input type="range" min={0} max={100} value={Math.round(soundSettings.ringtoneVolume * 100)} onChange={e => setSoundSettings({ ringtoneVolume: Number(e.target.value) / 100 })} className="w-full" />
            </label>
          )}
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => playChatSound(soundSettings)}>🔊 Hear chat sound</Btn>
            <Btn variant="ghost" onClick={() => playRingtoneOnce(soundSettings)}>📞 Hear ringtone</Btn>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(t => (
          <button key={t.label} onClick={() => navigate(t.to)} className="bg-white dark:bg-fb-card rounded-xl border border-gray-100 dark:border-white/10 p-4 shadow-sm text-left">
            <span className="w-10 h-10 rounded-lg text-white text-xl flex items-center justify-center" style={{ background: t.color }}>{t.icon}</span>
            <p className="font-bold mt-2">{t.label}</p>
          </button>
        ))}
      </div>
      <Card><p className="text-xs text-gray-400">PiCall v6 • Chat free, calls prepaid • First call's first 1 minute free • Call recording admin-only (for appeals, 30 days) • Terms and Privacy Policy apply.</p></Card>
    </div>
  )
}
