import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Hls from 'hls.js'
import { useStore, type CallRecord, type Friend } from './store'
import { useExperts, sendEmailOtp, verifyEmailOtp, saveAdminSmtp, saveAdminSms, getAdminSettingsStatus, triggerCallInvitePush, triggerMessagePush, ADMIN_TIMEOUT_MS } from './api'
import { normalizeBdPhone } from './phone'
import { connectLive, createLiveRoom, endLiveRoom, fetchLiveRooms, sendSignal, ICE_SERVERS, type LiveRoom } from './live'
import { connectCall, createCallPeerConnection, fetchCallInfo, makeCallCode, sendCallSignal } from './call'
import { callFailureMessage, callErrorToFailureReason, parseFailureReason, closeWhileWaitingToFailureReason, NO_ANSWER_TIMEOUT_MS, type CallFailureReason } from './callFailure'
import { CALL_PRIVACY_LABELS, type CallPrivacy } from './incomingCall'
import { buildCallInvitePayload, callInviteStatusToFailureReason, isCallableInviteTarget } from './callInvites'
import { enableCallPush, getPushStatus } from './pushNotify'
import { startRingback, stopRingback } from './sounds'
import { pickCameraDevice, cameraConstraintAttempts, countCameras, isSameCameraDevice, getScreenShareSupport } from './cameraSwitch'
import { BUDDIES, getBuddy, getBuddyByName, getBuddyReplyDetail, isBuddyId } from './buddies'
import { IconCall, IconChat, IconExpand, IconFriends, IconImage, IconLiveTV, IconLock, IconMail, IconMoon, IconPhoto, IconPlus, IconReels, IconSearch, IconSend, IconSettings, IconShare, IconShield, IconSparkle, IconSun, IconUser, IconVideo, IconWallet } from './icons'
import { searchPosts, type SearchablePerson } from './friendSearch'
import { useAllUserSearch, useCommunitySearch, SearchSuggestions } from './searchUI'
import { Btn, Card, ContactsCard, InstallButton, SponsoredCard } from './components'
import { Avatar } from './avatar'
import {
  CATEGORIES, DATING_PROFILES, FRIEND_RATE, FRIEND_SUGGESTIONS, FREE_MINUTES_NOTE,
  REELS, TV_CHANNELS, TOPUP_PACKS, DISTRICTS, INTERESTS,
  contactBanCheck, formatBDT, formatPi, roundPi, takaToPi,
  USDT_NETWORKS, piWithdrawFee,
  type Expert, type DatingProfile, type TvChannel
} from './data'
import { DEFAULT_TV_PLAYLIST_URL, fetchTvPlaylist, isPlaylistUrl } from './tvPlaylist'
import { DAILY_BONUS_REWARDS, INVITE_BASE_URL, REF_INVITER_PI, REF_WELCOME_PI, topUpPi } from './store'
import { PAYMENTS_ALL_DISABLED_MESSAGE, PI_DEPOSIT_DISABLED_MESSAGE, PAYMENT_METHODS, enabledTopUpMethods, isPaymentMethodEnabled, normalizePaymentEnabled, resolveTopUpMethod, type PaymentMethodId } from './paymentMethods'
import { computeTransfer } from './piTransfer'
import { pendingIncomingCount, paymentRequestStatusLabel } from './paymentRequest'
import { DATING_KYC_CHAT_LIMIT } from './firestoreMapping'
import { isFirebaseConfigured, signInWithGoogle, getFirebaseAuth, signUpWithPassword, signInWithPassword, requestPasswordReset, ensureAnonymousSession, PASSWORD_MIN_LENGTH } from './firebase'
import { VIDEO_UPLOAD_MAX_BYTES, VIDEO_UPLOAD_NETWORK_MESSAGE, uploadVideoFile } from './videoUpload'
import { updateProfile } from 'firebase/auth'
import { fetchNewMembers, fetchAllPublicProfiles, fetchChatRoomDoc, sendChatMessage, subscribeChatMessages, subscribeMyChatRooms, chatRoomId, otherRoomMember, type ChatRoomSummary, updatePublicProfileName, backfillNumericUids, fetchServices, fetchService, createServiceDoc, fetchServiceReviews, submitServiceReview, subscribeServices, subscribeServiceReviews, fetchAds, fetchApprovedAds, createAdDoc, subscribeApprovedAds, updateAdStatus, recordAdView, recordAdClick, fetchGroups, fetchGroup, subscribeGroups, createGroupDoc, joinGroup, leaveGroup, addGroupMember, removeGroupMember, fetchGroupPosts, subscribeGroupPosts, createGroupPostDoc, fetchPages, fetchPage, subscribePages, createPageDoc, followPage, unfollowPage, fetchPagePosts, subscribePagePosts, createPagePostDoc, createCallInvite, deleteCallInvite, subscribeCallInviteDoc, updateCallInviteStatus } from './firestore'
import { filterBlockedMessages, filterBlockedRooms } from './blocking'
import { probeChannels, sortChannelsByPlayability, getCachedProbe, clearProbeCache, type ProbeStatus } from './tvProbe'
import { averageRating, canStartServiceCall, isOwnService, loadLocalServices, mergeServiceLists, ratingSummary, saveLocalServices, serviceRateLabel, validateReviewInput, validateServiceInput, type ServiceListing, type ServiceReview } from './services'
import { adAmountDue, adPriceLabel, adRatesSet, adStatusLabel, loadLocalAds, mergeAdLists, saveLocalAds, validateAdInput, type UserAd } from './ads'
import { followerCount, isFollower, isMember, loadLocalGroups, loadLocalPages, memberCount, mergeGroupLists, mergePageLists, saveLocalGroups, saveLocalPages, validateGroupInput, validatePageInput, validateGroupPost, validatePagePost, loadLocalGroupPosts, saveLocalGroupPosts, mergeGroupPostLists, loadLocalPagePosts, saveLocalPagePosts, mergePagePostLists, type GroupItem, type GroupPost, type PageItem, type PagePost } from './groups'
import { profileCompletion, type Gender } from './profile'
import { mergeFeedPosts, splitFeedPosts } from './feedCache'
import { buildPostShareUrl, isOwnPost, parsePostDeepLink } from './feedPosts'
import { missedCallsOf } from './missedCall'
import { inviteQrUrl, shareErrorToResult, type ShareResult } from './share'
import type { Post } from './data'
import { colourForUid, formatJoinTime, filterNewMembers, filterAdminUsers, type NewMember } from './newMembers'
import { playChatSound, playRingtoneOnce, startRingtone, setInCallActive } from './sounds'
import { EMPTY_ANALYTICS_IDS, envAnalyticsIds, initAnalytics, resolveAnalyticsIds, sanitizeAnalyticsId, trackSignup, type AnalyticsIds, type SignupMethod } from './analytics'

// ---------- ভাইরাল গ্রোথ: শেয়ার হেল্পার ----------
// নেটিভ শেয়ার থাকলে সেটা, না থাকলে লিংক কপি করে দেওয়া হয়; শেয়ার শিট
// বন্ধ করা (cancel) ব্যর্থতা নয় — চুপচাপ থাকে, কোনো ভুল বার্তা নয়
export async function shareLink(title: string, text: string, url: string): Promise<ShareResult> {
  try {
    if (navigator.share) { await navigator.share({ title, text, url }); return 'shared' }
  } catch (err) { return shareErrorToResult(err) }
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

// রেফার লিংকে এসে থাকলে ফিডের উপরে ওয়েলকাম ব্যানার — KYC না থাকলে বোনাস
// আটকে থাকে, KYC হলে এখান থেকেই দাবি করা যায়।
export function RefWelcomeBanner() {
  const { refNotice, dismissRefNotice, referrer, refWelcomeClaimed, claimReferralBonus } = useStore()
  const [claimMsg, setClaimMsg] = useState('')
  if (!refNotice) return null
  const heldBonus = !!referrer && !refWelcomeClaimed
  function claim() {
    if (claimReferralBonus()) setClaimMsg('🎉 Referral bonus claimed!')
    else setClaimMsg('Complete KYC once to claim your referral bonus.')
  }
  return (
    <Card className="!bg-green-50 dark:!bg-green-900">
      <div className="flex items-start gap-2">
        <p className="text-sm font-medium flex-1">{refNotice}</p>
        <button className="text-gray-400" onClick={dismissRefNotice}>✕</button>
      </div>
      {heldBonus && <Btn className="mt-2" onClick={claim}>Claim referral bonus</Btn>}
      {claimMsg && <p className="text-sm text-green-600 mt-2">{claimMsg}</p>}
      <p className="text-xs text-gray-500 mt-1">First call's first 1 minute free — applies to new users.</p>
    </Card>
  )
}

// বন্ধুকে ডাকুন — ব্যক্তিগত ইনভাইট লিংক, কপি/শেয়ার, রেফারেল হিসাব
export function InviteCard() {
  const { referralCode, referrals, referralPiEarned } = useStore()
  const [msg, setMsg] = useState('')
  const [qrHidden, setQrHidden] = useState(false)
  const link = `${INVITE_BASE_URL}?ref=${referralCode}`
  async function copy() {
    try { await navigator.clipboard.writeText(link); setMsg('✅ Link copied — send it to a friend!') }
    catch { setMsg('Link: ' + link) }
  }
  async function share() {
    const r = await shareLink('PiCall — Live Expert Advice', 'Join PiCall — first call\'s first 1 minute free + 1 π bonus!', link)
    setMsg(r === 'shared' ? '✅ Shared!' : r === 'copied' ? '✅ Link copied — send it to a friend!' : r === 'failed' ? 'Sharing is not supported here — tap Copy Link.' : '')
  }
  return (
    <Card>
      <h2 className="font-bold">📣 Invite a friend — both of you get it</h2>
      <p className="text-sm mt-1">If a friend joins through your link, they will get <b>First call's first 1 minute free + {REF_WELCOME_PI} π</b>. When your friend makes their first top-up, <b>You will get {REF_INVITER_PI} π</b>।</p>
      {/* লিংক নিজেই ট্যাপ করা যায় — ট্যাপ করলেই শেয়ার শিট ওঠে (না থাকলে কপি);
          আগে এটা শুধু লেখা ছিল, ট্যাপে কিছুই হতো না */}
      <button onClick={share} className="text-sm mt-2 break-all text-left w-full" title="Tap to share your link">
        Your link: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{link}</code> <span className="text-violet-600 font-medium">↗️ Share</span>
      </button>
      {!qrHidden && (
        <button onClick={share} className="mt-3 block" title="Tap the QR code to share">
          <img src={inviteQrUrl(link)} alt="Invite QR code — tap to share" className="w-[180px] h-[180px] rounded-xl bg-white p-1" onError={() => setQrHidden(true)} />
          <span className="block text-xs text-gray-400 mt-1">Scan or tap the QR code to share your invite link</span>
        </button>
      )}
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={copy}>📋 Copy Link</Btn>
        <Btn variant="green" onClick={share}>↗️ Share</Btn>
      </div>
      <p className="text-sm mt-2">Referral: <b>{referrals} people</b> • Earnings from referrals: <b>{formatPi(referralPiEarned)}</b></p>
      <p className="text-xs text-amber-600 mt-1">Referral Pi is bonus Pi — it cannot be withdrawn, only used for calls/live gifts.</p>
      {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
      <p className="text-xs text-gray-400 mt-2">Referrals are tracked on this device.</p>
    </Card>
  )
}

// ডেইলি বোনাস — ৭ দিনের চক্র, একদিন মিস করলে স্ট্রিক আবার ১ম দিন থেকে
export function DailyBonusCard() {
  const { streak, dailyClaimedToday, claimDailyBonus, totalPi, giftBoxDays, giftBoxClaimed, canClaimGiftBox, claimGiftBox, kycVerified } = useStore()
  const [msg, setMsg] = useState('')
  function claim() {
    const r = claimDailyBonus()
    if (r) setMsg(`🎉 Day ${r.day} — you got ${r.pi} π! Total Pi: ${formatPi(totalPi + r.pi)}.`)
  }
  function claimBox() {
    // গিফট বক্সের পুরস্কার তোলা যায় এমন Pi — অনুমোদিত KYC ছাড়া দাবি করা যায় না
    if (!kycVerified) { setMsg('Gift box needs approved KYC — complete Dating KYC first.'); return }
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
              <span>{i + 1}. {h.name} {h.mine && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">Pi Gifter</span>}</span>
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
          { t: '📺 Live TV', d: 'Popular channels of the country. Official streams only.' }
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
  const { login, loginOtp, dark, toggleDark, adminSettings } = useStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [msgIsError, setMsgIsError] = useState(false)
  const [busy, setBusy] = useState(false)
  // অমিল পাসওয়ার্ডের ইনলাইন ভুল — Confirm password ঘরের ঠিক নিচে, লাল
  // লেখায়। লাইভে দেখায় (দুটো ঘর ভরা ও অমিল হলেই) + সাবমিটেও; ট্যাব বদলে
  // মুছে না, পাসওয়ার্ড ঘর সম্পাদনা করলেই মুছে।
  const [signupMismatch, setSignupMismatch] = useState(false)
  const setErrorMsg = (t: string) => { setMsg(t); setMsgIsError(true) }
  const setInfoMsg = (t: string) => { setMsg(t); setMsgIsError(false) }
  const clearMsg = () => { setMsg(''); setMsgIsError(false) }
  // ইমেইল + পাসওয়ার্ড লগইন / অ্যাকাউন্ট তৈরি — Google 1-ক্লিক লগইনের
  // পাশাপাশি থাকে, ব্যবহারকারী নিজে বেছে নেন। SMS OTP বন্ধ (মালিকের
  // সিদ্ধান্ত ২০২৬-১১-২৪) — লগইন পেজে মোবাইল/SMS ট্যাব নেই।
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // ইমেইল-কোড (OTP) লগইন — পাসওয়ার্ড ছাড়া, ৬ অঙ্কের কোড ইমেইলে আসে।
  // কোড ঠিক হলে বেনামি Firebase সেশন (শুধু টোকেনের জন্য) + loginOtp —
  // uid ছোঁয়া হয় না, ডিভাইসের আগের পরিচয়ই থাকে। SMTP না বসানো
  // থাকলে সার্ভার not_configured ফেরে — সৎ বার্তা দেখানো হয়।
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpBusy, setOtpBusy] = useState(false)
  const otpMessage = (error: string | null | undefined, sending: boolean): string => {
    switch (error) {
      case 'not_configured': return 'Email OTP is not on yet — the admin is setting it up.'
      case 'expired': return 'The code has expired — send OTP again.'
      case 'rate_limited':
      case 'too_many_attempts': return 'Too many attempts — please try again in a little while.'
      case 'invalid_code': return 'The code is wrong — check and enter it again.'
      default: return sending ? 'Could not send the code — please try again.' : 'The code is wrong — check and enter it again.'
    }
  }
  const sendOtpLoginCode = async () => {
    const mail = email.trim().toLowerCase()
    if (!mail.includes('@')) { setErrorMsg('Enter a valid email.'); return }
    setOtpBusy(true); clearMsg()
    try {
      const r = await sendEmailOtp(mail)
      if (!r) { setErrorMsg('Could not reach the server — check your connection and try again.'); return }
      if (!r.ok) { setErrorMsg(otpMessage(r.error, true)); return }
      setOtpSent(true)
      setInfoMsg('Code sent to your email — enter the 6-digit code.')
    } finally {
      setOtpBusy(false)
    }
  }
  const verifyOtpLogin = async () => {
    const mail = email.trim().toLowerCase()
    if (otpCode.length !== 6) { setErrorMsg('Enter the 6-digit code from your email.'); return }
    setOtpBusy(true); clearMsg()
    try {
      const r = await verifyEmailOtp(mail, otpCode)
      if (!r) { setErrorMsg('Could not reach the server — check your connection and try again.'); return }
      if (!r.ok) { setErrorMsg(otpMessage(r.error, false)); return }
      // টোকেনের জন্য বেনামি সেশন (সেরা চেষ্টা — না হলে লগইন তবু হয়,
      // কল ইনভাইট তখন যাবে না, লিংক-পথ থাকে)।
      await ensureAnonymousSession()
      const otpName = mail.split('@')[0] || 'PiCall'
      loginOtp(otpName, mail)
      navigate('/feed')
    } finally {
      setOtpBusy(false)
    }
  }
  // সাইন-আপে দুই পাসওয়ার্ড অমিল — টাইপ করার সময়ই (দুটো ঘর ভরা থাকলে)
  // অথবা Create account চাপার পর; ট্যাব বদলে মুছে না।
  const passwordsMismatch = authMode === 'signup' && ((password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword) || signupMismatch)

  // সাইন-আপ সম্পূর্ণ হলে (প্রথমবারই শুধু — বারবার লগইনে নয়) Pixel-এ
  // CompleteRegistration + GA4-এ sign_up যায়। Google-এ Firebase-র isNewUser
  // দেখা হয়। key = সাইন-আপ করা অ্যাকাউন্টের পরিচয় — একই সাইন-আপ দুবার
  // ট্রিগার হলেও (ডাবল ট্যাপ/ডাবল ইফেক্ট) ইভেন্ট একবারই যায় (trackSignup-এর
  // idempotency key); অন্য অ্যাকাউন্টের সাইন-আপে আলাদা key যায়।
  const noteSignup = (method: SignupMethod, key: string) => {
    initAnalytics(resolveAnalyticsIds(envAnalyticsIds(), adminSettings.analytics))
    trackSignup(method, undefined, key)
  }
  // লগইন ইনপুটের একই চেহারা — আইকনসহ, গোল কোণা, ফোকাসে Pi purple রিং (দুই থিমেই)
  const inputCls = 'w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500'
  const inputIconCls = 'w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none'

  const googleLogin = async () => {
    // আসল Google Sign-In — Firebase সেটআপ না থাকলে ভুল বার্তা, ডেমো লগইন কখনো নয়
    if (!isFirebaseConfigured) {
      setErrorMsg('Login is not set up — contact the admin.')
      return
    }
    setBusy(true)
    clearMsg()
    try {
      const u = await signInWithGoogle()
      if (u) { if (u.isNewUser) noteSignup('google', 'google:' + u.email.toLowerCase()); login(u.name, u.email); navigate('/feed'); return }
      setErrorMsg('Google login did not complete — please try again.')
    } catch {
      setErrorMsg('Google login failed — the pop-up was closed or there is a network problem. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // পাসওয়ার্ড লগইনের ভুল কোড -> পরিষ্কার বার্তা (Firebase-র কোড কখনো সরাসরি দেখানো হয় না)।
  const passwordAuthMessage = (code: string): string => {
    switch (code) {
      case 'invalid_email': return 'Enter a valid email.'
      case 'password_too_short': return 'Password must be at least 6 characters.'
      case 'password_mismatch': return 'Passwords do not match.'
      case 'email_already_registered': return 'This email is already registered — log in instead.'
      case 'wrong_password': return 'Email or password is wrong — check and try again.'
      case 'account_not_found': return 'No account found for this email — create an account instead.'
      case 'too_many_attempts': return 'Too many attempts — please try again in a little while.'
      case 'firebase_not_configured': return 'Login is not set up — contact the admin.'
      case 'network_error': return 'Could not reach the server — check your connection and try again.'
      default: return 'Could not log in — please try again.'
    }
  }


  // পাসওয়ার্ড ভুলে গেলে — Firebase-র রিসেট মেইল (ইমেইলে লিংক আসে, SMS নয়)।
  const sendPasswordReset = async () => {
    const mail = email.trim().toLowerCase()
    if (!mail.includes('@')) { setErrorMsg('Enter a valid email.'); return }
    if (!isFirebaseConfigured) {
      setErrorMsg('Login is not set up — contact the admin.')
      return
    }
    setBusy(true); clearMsg()
    try {
      await requestPasswordReset(mail)
      setInfoMsg('Password reset link sent to your email — check your inbox.')
    } catch (err) {
      setErrorMsg(passwordAuthMessage(err instanceof Error ? err.message : ''))
    } finally {
      setBusy(false)
    }
  }

  // ইমেইল + পাসওয়ার্ডে লগইন — ফিরে আসা ব্যবহারকারীর জন্য, OTP লাগে না।
  const passwordLogin = async () => {
    const mail = email.trim().toLowerCase()
    if (!mail.includes('@')) { setErrorMsg('Enter a valid email.'); return }
    if (password.length < PASSWORD_MIN_LENGTH) { setErrorMsg('Enter your password (at least 6 characters).'); return }
    if (!isFirebaseConfigured) {
      setErrorMsg('Login is not set up — contact the admin.')
      return
    }
    setBusy(true); clearMsg()
    try {
      const u = await signInWithPassword(mail, password)
      login(u.name, u.email)
      navigate('/feed')
    } catch (err) {
      setErrorMsg(passwordAuthMessage(err instanceof Error ? err.message : ''))
    } finally {
      setBusy(false)
    }
  }

  // ইমেইল + পাসওয়ার্ডে অ্যাকাউন্ট তৈরি — OTP লাগে না; তৈরি হলেই ব্যবহারকারী
  // তখনই লগইন হয়ে যান (সাধারণ প্রথম-লগইন Firestore সিঙ্ক চলে)।
  const createPasswordAccount = async () => {
    const mail = email.trim().toLowerCase()
    if (!mail.includes('@')) { setErrorMsg('Enter a valid email.'); return }
    if (password.length < PASSWORD_MIN_LENGTH) { setErrorMsg('Password must be at least 6 characters.'); return }
    // অমিল হলে নিচের ধূসর বাক্সে নয় — Confirm password ঘরের ঠিক নিচে লাল
    // লেখায় দেখায় (passwordsMismatch), যাতে ফোনে চোখে পড়ে।
    if (password !== confirmPassword) { setSignupMismatch(true); return }
    if (!isFirebaseConfigured) {
      setErrorMsg('Login is not set up — contact the admin.')
      return
    }
    setBusy(true); clearMsg()
    try {
      const u = await signUpWithPassword(mail, password, name.trim() || undefined)
      if (u.isNewUser) noteSignup('password', 'password:' + u.email.toLowerCase())
      login(u.name, u.email)
      navigate('/feed')
    } catch (err) {
      setErrorMsg(passwordAuthMessage(err instanceof Error ? err.message : ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8fc] dark:bg-[#16121f] flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full h-1.5 pb-gradient rounded-full max-w-md" />
      <div className="w-full max-w-md">
        <div className="flex justify-end mt-3">
          <button onClick={toggleDark} title="Dark mode" className="w-[42px] h-[42px] rounded-[14px] bg-[#f1ecf9] dark:bg-[#2b2142] flex items-center justify-center text-gray-600 dark:text-gray-200">{dark ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}</button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-[38px] h-[38px] rounded-[12px] pb-gradient text-white text-xl font-extrabold flex items-center justify-center">π</span>
          <p className="text-3xl font-extrabold font-display pb-gradient-text leading-none">PiCall</p>
        </div>
        <Card className="mt-5 !p-5 sm:!p-6 !shadow-md">
          <h1 className="text-2xl font-bold text-center">Welcome to PiCall</h1>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">Email + Password • Email Code • Gmail 1-Click Login</p>
          <p className="text-xs text-center text-gray-400 mt-1">Email sign up only, mobile sign up is off for now.</p>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1 mt-4" role="tablist" aria-label="Log in or create account">
          <button type="button" role="tab" aria-selected={authMode === 'login'} onClick={() => { setAuthMode('login'); clearMsg() }} className={`py-2 rounded-lg text-sm font-semibold ${authMode === 'login' ? 'bg-white dark:bg-slate-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Log in</button>
          <button type="button" role="tab" aria-selected={authMode === 'signup'} onClick={() => { setAuthMode('signup'); clearMsg() }} className={`py-2 rounded-lg text-sm font-semibold ${authMode === 'signup' ? 'bg-white dark:bg-slate-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Create account</button>
        </div>
        {authMode === 'login' ? (
          <>
            <p className="text-sm font-semibold text-center flex items-center justify-center gap-2 mt-4"><IconLock className="w-4 h-4 text-violet-500" />Log in with email + password</p>
            <label className="text-sm font-medium mt-3 block">Email</label>
            <div className="relative mt-1">
              <IconMail className={inputIconCls} />
              <input className={inputCls + ' pl-10'} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" />
            </div>
            <label className="text-sm font-medium mt-3 block">Password</label>
            <div className="relative mt-1">
              <IconLock className={inputIconCls} />
              <input className={inputCls + ' pl-10'} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
            </div>
            <Btn className="w-full mt-4 !py-3 !rounded-xl" disabled={busy} onClick={passwordLogin}>Log in</Btn>
            <p className="text-xs text-center text-gray-400 mt-2">No code needed — just the password you chose when you created your account.</p>
            <button type="button" className="w-full text-center text-sm text-fb-blue font-medium mt-3" disabled={busy} onClick={sendPasswordReset}>Forgot password?</button>
            <div className="my-4 border-t border-gray-100 dark:border-white/10" />
            <p className="text-sm font-semibold text-center flex items-center justify-center gap-2"><IconMail className="w-4 h-4 text-violet-500" />Log in with email code</p>
            <p className="text-xs text-center text-gray-400 mt-1">No password needed — a 6-digit code is sent to your email.</p>
            {!otpSent ? (
              <Btn className="w-full mt-3 !py-3 !rounded-xl" disabled={busy || otpBusy} onClick={sendOtpLoginCode}>Send code</Btn>
            ) : (
              <>
                <label className="text-sm font-medium mt-3 block">6-digit code</label>
                <div className="relative mt-1">
                  <IconLock className={inputIconCls} />
                  <input className={inputCls + ' pl-10'} value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" maxLength={6} />
                </div>
                <Btn className="w-full mt-4 !py-3 !rounded-xl" disabled={busy || otpBusy} onClick={verifyOtpLogin}>Verify & log in</Btn>
                <button type="button" className="w-full text-center text-sm text-fb-blue font-medium mt-3" disabled={busy || otpBusy} onClick={sendOtpLoginCode}>Send the code again</button>
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-center mt-4">Create your account</h2>
            <p className="text-sm font-semibold text-center flex items-center justify-center gap-2 mt-4"><IconUser className="w-4 h-4 text-violet-500" />Create account with email + password</p>
            <label className="text-sm font-medium mt-3 block">Name</label>
            <div className="relative mt-1">
              <IconUser className={inputIconCls} />
              <input className={inputCls + ' pl-10'} value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" />
            </div>
            <label className="text-sm font-medium mt-3 block">Email</label>
            <div className="relative mt-1">
              <IconMail className={inputIconCls} />
              <input className={inputCls + ' pl-10'} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" />
            </div>
            <label className="text-sm font-medium mt-3 block">Password</label>
            <div className="relative mt-1">
              <IconLock className={inputIconCls} />
              <input className={inputCls + ' pl-10'} type="password" value={password} onChange={e => { setPassword(e.target.value); setSignupMismatch(false) }} placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
            <label className="text-sm font-medium mt-3 block">Confirm password</label>
            <div className="relative mt-1">
              <IconLock className={inputIconCls} />
              <input className={inputCls + ' pl-10' + (passwordsMismatch ? ' !border-red-400 dark:!border-red-500 focus:!ring-red-500 focus:!border-red-500' : '')} type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setSignupMismatch(false) }} placeholder="Type the password again" autoComplete="new-password" />
            </div>
            {passwordsMismatch && <p className="text-sm text-red-600 dark:text-red-400 mt-1">Passwords do not match.</p>}
            <Btn className="w-full mt-4 !py-3 !rounded-xl" disabled={busy} onClick={createPasswordAccount}>Create account</Btn>
            <p className="text-xs text-center text-gray-400 mt-2">Your account is created right away — no code needed.</p>
          </>
        )}
        <div className="my-5 border-t border-gray-100 dark:border-white/10" />
        <p className="text-sm font-semibold text-center">1-Click Login with Gmail</p>
        <button disabled={busy} onClick={googleLogin} className="w-full mt-3 py-3 rounded-xl border border-gray-200 dark:border-slate-600 font-semibold flex items-center justify-center gap-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-100 disabled:opacity-60 shadow-sm transition">
          <span className="font-extrabold text-lg"><span className="text-blue-500">G</span><span className="text-red-500">o</span><span className="text-yellow-500">o</span><span className="text-blue-500">g</span><span className="text-green-500">l</span><span className="text-red-500">e</span></span>
          {busy ? 'Logging in…' : 'Continue with Google'}
        </button>
        <p className="text-xs text-center text-gray-400 mt-2">Real Gmail login is on — log in with your Google account.</p>
        {msg && <p className={`text-sm text-center mt-3 px-3 py-2 rounded-xl ${msgIsError ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300' : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300'}`}>{msg}</p>}
        <p className="text-xs text-gray-400 mt-4 text-center">By logging in, you agree to the Terms and Privacy Policy.</p>
        </Card>
      </div>
    </div>
  )
}

// ---------- Services (virtual, video-call only) ----------
// Home-এ New Members-এর উপরে: আসল ব্যবহারকারীদের ভিডিও-কল সার্ভিস —
// প্রিপেইড Pi/মিনিট, ব্যালেন্স শেষে অটো-কাট, ব্যালেন্স না থাকলে কল নয়।
// সব সার্ভিস ভার্চুয়াল — সামনাসামনি/লোকেশন কিছু নেই। ডেমো প্রোভাইডার/
// রিভিউ নেই — খালি থাকলে "No services yet. Offer the first one!" দেখায়।
export function ServicesSection() {
  const { uid, totalPi, freeFirstMinuteUsed } = useStore()
  const [services, setServices] = useState<ServiceListing[]>(() => loadLocalServices())
  const [loaded, setLoaded] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    let cancelled = false
    fetchServices(50).then(list => {
      if (cancelled) return
      if (list.length > 0) {
        const merged = mergeServiceLists(loadLocalServices(), list)
        setServices(merged)
        saveLocalServices(merged)
      }
      setLoaded(true)
    })
    const unsub = subscribeServices(list => {
      if (cancelled) return
      if (list.length > 0) {
        const merged = mergeServiceLists(loadLocalServices(), list)
        setServices(merged)
        saveLocalServices(merged)
      }
      setLoaded(true)
    })
    return () => { cancelled = true; unsub?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const freeMinuteAvailable = !freeFirstMinuteUsed
  return (
    <div id="services-section">
      <Card>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-bold flex items-center gap-2 flex-1"><IconVideo className="w-5 h-5 text-pi-gold" /> Services</h2>
          <Btn variant="green" onClick={() => navigate('/create-service')}>+ Offer a service</Btn>
        </div>
        <p className="text-sm text-gray-500 mt-1">Video-call services offered by people on PiCall — prepaid per minute in Pi. All services are virtual, by video call only.</p>
        {!loaded && <p className="text-sm text-gray-400 mt-2">Loading services…</p>}
        {loaded && services.length === 0 && <p className="text-sm text-gray-500 mt-2">No services yet. Offer the first one!</p>}
        {services.map(s => (
          <ServiceCard key={s.id} service={s} uid={uid} totalPi={totalPi} freeMinuteAvailable={freeMinuteAvailable} />
        ))}
      </Card>
    </div>
  )
}

function ServiceCard({ service, uid, totalPi, freeMinuteAvailable }: { service: ServiceListing; uid: string | null; totalPi: number; freeMinuteAvailable: boolean }) {
  const navigate = useNavigate()
  const { ringingCall } = useStore()
  const [reviews, setReviews] = useState<ServiceReview[]>([])
  const [reviewsLoaded, setReviewsLoaded] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchServiceReviews(service.id, 50).then(list => { if (!cancelled) { setReviews(list); setReviewsLoaded(true) } })
    const unsub = subscribeServiceReviews(service.id, list => { if (!cancelled) { setReviews(list); setReviewsLoaded(true) } })
    return () => { cancelled = true; unsub?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id])
  const { avg, count } = averageRating(reviews)
  const own = isOwnService(service, uid)
  const canCall = canStartServiceCall(totalPi, service.ratePiPerMin, freeMinuteAvailable)
  return (
    <div className="border-t border-gray-100 dark:border-white/10 mt-3 pt-3">
      <div className="flex gap-3">
        <Avatar photo={service.providerPhoto} name={service.providerName} color="#7C3AED" className="w-12 h-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate">{service.title}</p>
          <p className="text-sm text-gray-500 truncate">{service.providerName}</p>
          <p className="text-xs text-gray-400">{reviewsLoaded ? ratingSummary(avg, count) : 'Loading reviews…'}</p>
        </div>
        <span className="font-bold text-fb-blue whitespace-nowrap">{serviceRateLabel(service.ratePiPerMin)}</span>
      </div>
      <p className="text-sm mt-2">{service.description}</p>
      <p className="text-xs text-gray-400 mt-1">Virtual video call only — no in-person meeting.</p>
      <div className="flex gap-2 mt-3 flex-wrap items-center">
        {own ? (
          <span className="text-sm font-medium text-gray-500">This is your service</span>
        ) : (
          <>
            <Btn variant="green" disabled={!canCall} onClick={() => navigate(`/call/service/${service.id}`)}>💼 Service — {serviceRateLabel(service.ratePiPerMin)}</Btn>
            <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: service.providerName, peerId: service.providerUid } })}>💬 Chat</Btn>
            {!canCall && <button className="text-sm text-fb-blue font-medium" onClick={() => navigate('/wallet')}>Top up Pi to call</button>}
          </>
        )}
        <Btn variant="ghost" onClick={() => setShowReviews(v => !v)}>Reviews ({count})</Btn>
      </div>
      {ringingCall?.kind === 'Service' && ringingCall.peerId === service.providerUid && (
        <p className="text-sm font-medium text-violet-600 mt-2">📞 Calling {service.providerName}… waiting for an answer</p>
      )}
      {showReviews && (
        <div className="mt-3 space-y-2">
          {reviews.length === 0 && <p className="text-sm text-gray-500">No reviews yet.</p>}
          {reviews.map(r => (
            <div key={r.id} className="bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              <p className="text-sm"><b>{r.reviewerName}</b> <span className="text-amber-500">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span></p>
              {r.text && <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{r.text}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// সার্ভিস কল শেষে কলকারী রিভিউ দেন — তারকা ১–৫ + ছোট লেখা; রিভিউয়ারের
// নামসহ সবার কাছে দেখায় (মালিকের শর্ত)।
function ServiceReviewForm({ serviceId, reviewerUid, reviewerName }: { serviceId: string; reviewerUid: string; reviewerName: string }) {
  const [stars, setStars] = useState(0)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  async function submit() {
    const err = validateReviewInput(stars, text)
    if (err) { setMsg(err); return }
    setBusy(true); setMsg('')
    const ok = await submitServiceReview(serviceId, { reviewerUid, reviewerName, stars, text })
    setBusy(false)
    if (ok) setSubmitted(true)
    else setMsg('Could not save the review — check your connection and try again.')
  }
  if (submitted) return <p className="text-sm text-green-400 mt-3">✅ Thanks — your review is now visible on the service, with your name.</p>
  return (
    <div className="mt-4 text-left bg-slate-700 rounded-xl p-3">
      <p className="font-bold text-sm">Rate this service</p>
      <p className="text-xs text-gray-300 mt-0.5">Your review — with your name — will be visible to everyone on the service.</p>
      <div className="flex gap-1 mt-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setStars(n)} className={`text-2xl ${stars >= n ? 'text-amber-400' : 'text-gray-500'}`}>★</button>
        ))}
      </div>
      <textarea className="w-full border rounded-lg p-2 mt-2 text-sm text-gray-900 dark:bg-slate-800 dark:text-white dark:border-slate-600" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Short review (optional)…" />
      {msg && <p className="text-sm text-amber-300 mt-2">{msg}</p>}
      <Btn variant="green" className="w-full mt-2" disabled={busy || stars === 0} onClick={submit}>Submit Review</Btn>
    </div>
  )
}

// ---------- নতুন সদস্য ----------
// আসল নতুন ব্যবহারকারী (Firestore publicProfiles থেকে, নতুন থেকে পুরনো) —
// কোনো ডেমো/ভুয়া ব্যবহারকারী নয়। চ্যাট পারসোনারা এখানে আসে না (তারা লোকাল
// বন্ধু, কোনো অ্যাকাউন্ট নয়), অ্যাডমিনও আসে না (তার পাবলিক প্রোফাইল লেখা হয় না)।
// Firestore/নিয়ম না থাকলে খালি অবস্থা দেখায় — ভুয়া কাউকে দেখায় না।
function NewMembersSection() {
  const { uid, friends, sendFriendRequest, cancelFriendRequest, sentRequests } = useStore()
  const [members, setMembers] = useState<NewMember[]>([])
  const [loaded, setLoaded] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    let cancelled = false
    fetchNewMembers(10).then(list => {
      if (cancelled) return
      setMembers(filterNewMembers(list, uid))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [uid])
  return (
    <Card>
      <h2 className="font-bold flex items-center gap-2"><IconSparkle className="w-5 h-5 text-pi-gold" /> New Members</h2>
      {!loaded && <p className="text-sm text-gray-400 mt-1">Searching…</p>}
      {loaded && members.length === 0 && (
        <>
          <p className="text-sm text-gray-500 mt-1">Nobody new has joined yet — invite your friend!</p>
        </>
      )}
      {members.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 mt-2">
          {members.map(m => {
            const isFriend = friends.some(f => f.id === m.id)
            return (
              <div key={m.id} className="shrink-0 w-28 text-center border rounded-xl p-3 dark:border-slate-700">
                <Avatar photo={m.photo} name={m.displayName} color={m.colour} className="mx-auto w-14 h-14 text-xl" />
                <p className="text-sm font-medium mt-1 truncate">{m.displayName}</p>
                <p className="text-xs text-gray-400">{formatJoinTime(m.createdAtMs)}</p>
                <div className="mt-2">
                  {isFriend
                    ? <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: m.displayName } })}>💬 Chat</Btn>
                    : sentRequests.some(s => s.toUid === m.id)
                      ? <Btn variant="ghost" onClick={() => cancelFriendRequest(m.id)}>Request Sent</Btn>
                      : <Btn onClick={() => sendFriendRequest({ id: m.id, name: m.displayName, color: m.colour, online: true, ...(m.photo ? { photo: m.photo } : {}) })}>+ Add Friend</Btn>}
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
// Home-এ মাঝখানে Live TV প্রিভিউ — ডেমোর মতো। চলে এমন চ্যানেল উপরে
// (এই সেশনে যাচাই হয়ে থাকলে ক্যাশে থাকা ফল দিয়ে সাজানো), ট্যাপ করলে
// /live-tv খোলে যেখানে পুরো তালিকা + চালানো হয়।
function HomeTvSection() {
  const navigate = useNavigate()
  const status: Record<string, ProbeStatus> = {}
  for (const c of TV_CHANNELS) {
    if (!c.streamUrl) continue
    const s = getCachedProbe(c.streamUrl)
    if (s !== undefined) status[c.streamUrl] = s
  }
  const preview = sortChannelsByPlayability(TV_CHANNELS, status).slice(0, 4)
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="font-bold">📺 Live TV</p>
        <button onClick={() => navigate('/live-tv')} className="text-sm font-bold text-fb-blue">Watch all →</button>
      </div>
      <div className="flex gap-3 mt-3 overflow-x-auto">
        {preview.map(ch => {
          const st = ch.streamUrl ? getCachedProbe(ch.streamUrl) : false
          return (
            <button key={ch.id} onClick={() => navigate('/live-tv')} className="shrink-0 w-20 text-center">
              {ch.logo ? <img src={ch.logo} alt={ch.name} className="w-12 h-12 rounded-full object-cover mx-auto" /> : <span className="w-12 h-12 rounded-full pb-gradient text-white font-bold flex items-center justify-center mx-auto">{ch.name.charAt(0)}</span>}
              <span className="block text-xs font-medium mt-1 line-clamp-2">{ch.name}</span>
              <span className={`inline-block w-2 h-2 rounded-full mt-1 ${st === true ? 'bg-green-500' : st === false ? 'bg-red-400' : 'bg-gray-300'}`} />
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 mt-2">Free live TV — tap a channel to watch.</p>
    </Card>
  )
}

// কল নোটিফিকেশন চালুর ব্যানার — অ্যাপ বন্ধ থাকলেও কল পৌঁছাতে অনুমতি
// লাগে; অনুমতি এখনো চাওয়া হয়নি ('default') এমন ডিভাইসেই শুধু দেখায়।
// এক ট্যাপে enableCallPush (ব্যবহারকারীর জেসচার) — অ্যাপ খোলায় নিজে
// থেকে অনুমতি চাওয়া হয় না। একবার বন্ধ করলে আর দেখায় না।
function PushEnableBanner() {
  const { uid, referralCode } = useStore()
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('callguru:pushBannerDismissed') === '1' } catch { return false }
  })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [msg, setMsg] = useState('')
  const status = getPushStatus()
  if (dismissed || done || status.status !== 'default') return null
  const dismiss = () => {
    try { localStorage.setItem('callguru:pushBannerDismissed', '1') } catch { /* ignore */ }
    setDismissed(true)
  }
  const enable = async () => {
    setBusy(true); setMsg('')
    const res = await enableCallPush(uid ?? referralCode)
    setBusy(false)
    if (res.ok) setDone(true)
    else setMsg(res.reason === 'denied' ? 'Permission not given — turn on notifications from browser settings.' : 'Could not turn it on — try again from Menu → Sound Settings.')
  }
  return (
    <div className="rounded-xl p-4 bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800">
      <p className="font-bold text-sm">📞 Never miss a call — turn on call notifications</p>
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">When the app is closed, a call reaches you as a notification — tap it to answer straight into the call.</p>
      <div className="flex gap-2 mt-3">
        <Btn variant="green" disabled={busy} onClick={enable}>{busy ? 'Turning on…' : '🔔 Turn on notifications'}</Btn>
        <Btn variant="ghost" onClick={dismiss}>Not now</Btn>
      </div>
      {msg && <p className="text-xs text-amber-600 mt-2">{msg}</p>}
    </div>
  )
}

export function Feed() {
  const { friends, user, sendFriendRequest, cancelFriendRequest, sentRequests, installBonusClaimed, posts, setPosts, addPost, togglePostLike, addPostComment, deletePost, updatePost, likedPostIds, freshPostIds, feedQuery: query, setFeedQuery: setQuery, totalPi, addPi, uid, profilePhoto, updateProfile } = useStore()
  const [text, setText] = useState('')
  const [postTitle, setPostTitle] = useState('')
  const [postLocation, setPostLocation] = useState('')
  const [postAudience, setPostAudience] = useState<'Public' | 'Friends'>('Public')
  const [boostPost, setBoostPost] = useState(false)
  const [feedFilter, setFeedFilter] = useState<'All' | 'Liked' | 'Mine'>('All')
  // ফিডের সাজানো — নতুন (এই সেশনে তৈরি) পোস্ট উপরে, ক্যাশ করা (আগে দেখা/
  // পুরোনো) পোস্ট নিচে; একই পোস্ট দুই জায়গায় থাকলে নতুনের জায়গায়
  // একবারই আসে। নিচের দিকে স্ক্রল করলে এই ক্যাশ করা তালিকা থেকেই আসে —
  // একই আইটেমের জন্য সার্ভারে আবার চাওয়া হয় না।
  const { fresh: freshPosts, cached: cachedPosts } = splitFeedPosts(posts, freshPostIds)
  const visiblePosts = mergeFeedPosts(freshPosts, cachedPosts).filter(p => feedFilter === 'All' ? true : feedFilter === 'Liked' ? likedPostIds.includes(p.id) : isOwnPost(p))
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({})
  const [composerOpen, setComposerOpen] = useState(false)
  // সম্পাদনা — কোন পোস্ট সম্পাদনা হচ্ছে (null = নতুন পোস্ট); কমেন্ট খোলা আছে কি না;
  // ⋯ মেনু; মুছে ফেলার নিশ্চিতকরণ; শেয়ারের বার্তা (Link copied)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [showComments, setShowComments] = useState<Record<string, boolean>>({})
  const [menuPostId, setMenuPostId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [shareMsg, setShareMsg] = useState<Record<string, string>>({})
  const [showLocationInput, setShowLocationInput] = useState(false)
  const [showTitleInput, setShowTitleInput] = useState(false)
  const composerTextRef = useRef<HTMLTextAreaElement>(null)
  const [storyIdx, setStoryIdx] = useState<number | null>(null)
  // কম্পোজার মিডিয়া — একই জায়গায় ছবি + ভিডিও (ভিডিও পোস্ট রিলও হয়) + প্রোফাইল ছবি
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const profilePhotoInputRef = useRef<HTMLInputElement>(null)
  const [composerPhoto, setComposerPhoto] = useState<string | null>(null)
  const [composerVideoUrl, setComposerVideoUrl] = useState<string | null>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [composerErr, setComposerErr] = useState('')
  const [profilePhotoMsg, setProfilePhotoMsg] = useState('')
  // Approved user product ads — show in the Feed as Sponsored cards. Views
  // count once per ad per device session (CPM billing); clicks count per tap.
  const [approvedAds, setApprovedAds] = useState<UserAd[]>(() => loadLocalAds().filter(a => a.status === 'approved'))
  useEffect(() => {
    let cancelled = false
    fetchApprovedAds(20).then(list => {
      if (cancelled) return
      if (list.length > 0) {
        setApprovedAds(list)
        saveLocalAds(mergeAdLists(loadLocalAds(), list))
      }
    })
    const unsub = subscribeApprovedAds(list => {
      if (cancelled) return
      setApprovedAds(list)
      if (list.length > 0) saveLocalAds(mergeAdLists(loadLocalAds(), list))
    })
    return () => { cancelled = true; unsub?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    for (const ad of approvedAds) {
      try {
        const key = 'callguru:adview:' + ad.id
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          recordAdView(ad.id)
        }
      } catch { /* session storage blocked — view just isn't counted */ }
    }
  }, [approvedAds])
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
    if (f.size > VIDEO_UPLOAD_MAX_BYTES) { setComposerErr('Video is too big — maximum 50 MB.'); return }
    setUploadingVideo(true); setComposerErr('')
    try {
      const url = await uploadVideoFile(f, uid)
      setComposerVideoUrl(url)
    } catch (err) {
      // uploadVideoFile already maps the failure to the honest message:
      // Storage-off says storage is off, a network failure says connection.
      setComposerErr(err instanceof Error ? err.message : VIDEO_UPLOAD_NETWORK_MESSAGE)
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
    setComposerOpen(false); setEditingPost(null); setText(''); setPostTitle(''); setPostLocation(''); setPostAudience('Public'); setBoostPost(false)
    setComposerPhoto(null); setComposerVideoUrl(null); setComposerErr(''); setShowLocationInput(false); setShowTitleInput(false)
  }
  // কম্পোজার খোলা — নতুন পোস্টে খালি, সম্পাদনায় ওই পোস্টের লেখা/ছবি/অডিয়েন্স ভরা
  function openComposer(post?: Post) {
    if (post) {
      setEditingPost(post)
      setText(post.text); setPostTitle(post.title ?? ''); setPostLocation(post.location ?? ''); setPostAudience(post.audience ?? 'Public'); setBoostPost(false)
      setComposerPhoto(post.imageUrl ?? null); setComposerVideoUrl(post.videoUrl ?? null); setShowLocationInput(!!post.location); setShowTitleInput(!!post.title)
    } else {
      setEditingPost(null)
    }
    setComposerErr(''); setComposerOpen(true)
  }
  // কম্পোজার জমা — নতুন হলে addPost (ফিডের একদম উপরে), সম্পাদনা হলে updatePost
  function submitComposer() {
    if (editingPost) {
      updatePost(editingPost.id, { text, location: postLocation.trim() || undefined, audience: postAudience, imageUrl: composerPhoto ?? undefined, videoUrl: composerVideoUrl ?? undefined })
      resetComposer()
      return
    }
    let boosted = false
    if (boostPost) {
      if (totalPi < 0.1) { alert('Not enough Pi balance — buy Pi.'); return }
      addPi(-0.1, 'Boost', 'Post Boost'); boosted = true
    }
    addPost({ id: 'p' + Date.now(), author: user?.name || 'You', time: 'Now', text, title: postTitle.trim() || undefined, location: postLocation.trim() || undefined, audience: postAudience, boosted, likes: 0, comments: 0, shares: 0, color: '#7C3AED', mine: true, authorPhoto: profilePhoto || undefined, imageUrl: composerPhoto ?? undefined, videoUrl: composerVideoUrl ?? undefined })
    resetComposer()
  }
  // পোস্ট শেয়ার — নেটিভ শেয়ার শিট থাকলে সেটা, না থাকলে লিংক কপি + বার্তা;
  // শেয়ার সফল হলেই সংখ্যা +১; শিট বন্ধ করলে কিছুই বদলায় না
  async function sharePost(p: Post) {
    const url = buildPostShareUrl(window.location.origin, p.id)
    const result = await shareLink('PiCall', `${p.author}: ${p.text.slice(0, 120)}`, url)
    if (result === 'cancelled') return
    if (result === 'shared' || result === 'copied') {
      setPosts(ps => ps.map(x => x.id === p.id ? { ...x, shares: x.shares + 1 } : x))
      if (result === 'copied') setShareMsg(m => ({ ...m, [p.id]: 'Link copied — share it anywhere.' }))
    } else {
      setShareMsg(m => ({ ...m, [p.id]: 'Sharing failed — try again.' }))
    }
  }
  // কমেন্ট পাঠানো — খালি লেখা যায় না; পাঠালেই পোস্টের নিচে দেখায়, সংখ্যা বাড়ে
  function sendComment(p: Post) {
    const t = (commentDraft[p.id] || '').trim()
    if (!t) return
    addPostComment(p.id, t)
    setCommentDraft(d => ({ ...d, [p.id]: '' }))
    setShowComments(s => ({ ...s, [p.id]: true }))
  }
  const navigate = useNavigate()
  const locState = useLocation().state as { postId?: string; scrollTo?: string } | null
  // হেডার সার্চে পোস্টের সাজেশনে ট্যাপ করলে সরাসরি সেই পোস্টে যাওয়া
  // মেনু থেকে Services-এ এলে Services সেকশনে স্ক্রল করা
  useEffect(() => {
    // শেয়ার লিংকের ?post=<id> — খুললে সরাসরি ওই পোস্টে স্ক্রল, তারপর লিংক পরিষ্কার
    const deepPostId = parsePostDeepLink(window.location.search)
    if (deepPostId) {
      jumpToPost(deepPostId)
    } else if (locState?.postId) {
      jumpToPost(locState.postId)
    }
    if (locState?.scrollTo === 'services') {
      requestAnimationFrame(() => { document.getElementById('services-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
    }
    if (deepPostId || locState?.postId || locState?.scrollTo) {
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
      <PushEnableBanner />
      {installBonusClaimed ? (
        <p className="text-sm text-green-600">✅ Install bonus received — 5 π gift Pi added</p>
      ) : (
        <div className="rounded-xl p-4 text-white shadow-sm pb-gradient">
          <p className="text-lg font-extrabold">🎁 Install the app and get 5 π free!</p>
          <p className="text-sm mt-1">Install and get a 5 π bonus — gifts only.</p>
          <div className="mt-3 max-w-xs"><InstallButton showOffer={false} /></div>
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <Btn onClick={() => navigate('/friends')}>👥 Find friends</Btn>
        <p className="text-xs text-gray-500">To add a friend, tap + Add Friend on any New Member card below — or search by name or ID in Friends.</p>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => openComposer()} className="shrink-0 flex flex-col items-center gap-1 w-[68px]">
          <span className="story-ring w-[68px] h-[68px] rounded-full p-[3px] flex items-center justify-center">
            <span className="w-full h-full rounded-full bg-white dark:bg-fb-card flex items-center justify-center text-2xl relative"><IconPlus className="w-6 h-6 text-gray-400" /><span className="absolute bottom-0 right-0 w-5 h-5 rounded-full pb-gradient text-white flex items-center justify-center text-sm border-2 border-white dark:border-fb-card">+</span></span>
          </span>
          <span className="text-[11px] font-medium text-center leading-tight">Add your story</span>
        </button>
        {friends.map((f, i) => (
          <button key={f.id} onClick={() => setStoryIdx(i)} className="shrink-0 flex flex-col items-center gap-1 w-[68px]">
            <span className="story-ring w-[68px] h-[68px] rounded-full p-[3px]">
              <Avatar photo={f.photo} name={f.name} color={f.color} className="w-full h-full border-[3px] border-white dark:border-black text-xl" />
            </span>
            <span className="text-[11px] font-medium text-center leading-tight truncate w-full">{f.name}</span>
          </button>
        ))}
      </div>
      {storyIdx !== null && friends[storyIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 text-white flex flex-col items-center justify-center p-6" onClick={() => setStoryIdx(null)}>
          <button className="absolute top-4 right-4 text-2xl px-3 py-1" onClick={() => setStoryIdx(null)}>✕</button>
          <Avatar photo={friends[storyIdx].photo} name={friends[storyIdx].name} color={friends[storyIdx].color} className="w-24 h-24 text-4xl" />
          <p className="font-bold text-lg mt-4">{friends[storyIdx].name}</p>
          <div className="flex gap-3 mt-6">
            <button className="px-4 py-2 rounded-full bg-white/20 disabled:opacity-40" disabled={storyIdx === 0} onClick={e => { e.stopPropagation(); setStoryIdx(storyIdx - 1) }}>‹ Previous</button>
            <button className="px-4 py-2 rounded-full bg-white/20 disabled:opacity-40" disabled={storyIdx === friends.length - 1} onClick={e => { e.stopPropagation(); setStoryIdx(storyIdx + 1) }}>Next ›</button>
          </div>
        </div>
      )}
      <Card>
        <button onClick={() => openComposer()} className="flex items-center gap-3 w-full text-left">
          {profilePhoto
            ? <img src={profilePhoto} alt="Profile photo" className="w-10 h-10 rounded-full object-cover shrink-0" />
            : <span className="w-10 h-10 rounded-full pb-gradient text-white flex items-center justify-center font-bold shrink-0">{(user?.name || 'Y').slice(0, 1)}</span>}
          <span className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-full px-4 py-2.5 text-sm text-gray-500">What's on your mind?</span>
        </button>
      </Card>
      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={editingPost ? 'Edit post' : 'Create post'}>
          <div className="absolute inset-0 bg-black/60" onClick={resetComposer} />
          <div className="relative w-full sm:max-w-lg bg-white dark:bg-fb-card sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white dark:bg-fb-card border-b border-gray-100 dark:border-white/10 px-4 py-3 flex items-center">
              <h2 className="flex-1 text-center font-bold text-lg">{editingPost ? 'Edit post' : 'Create post'}</h2>
              <button onClick={resetComposer} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-lg leading-none" aria-label="Close">✕</button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <button onClick={() => profilePhotoInputRef.current?.click()} title="Set profile photo">
                  {profilePhoto
                    ? <img src={profilePhoto} alt="Profile photo" className="w-10 h-10 rounded-full object-cover" />
                    : <span className="w-10 h-10 rounded-full pb-gradient text-white flex items-center justify-center font-bold">{(user?.name || 'Y').slice(0, 1)}</span>}
                </button>
                <div>
                  <p className="font-medium leading-tight">{user?.name || 'You'}</p>
                  <select value={postAudience} onChange={e => setPostAudience(e.target.value as 'Public' | 'Friends')} className="text-xs bg-gray-100 dark:bg-slate-700 rounded-md px-1.5 py-0.5 mt-0.5" aria-label="Post audience">
                    <option value="Public">🌐 Public</option>
                    <option value="Friends">👥 Friends</option>
                  </select>
                </div>
              </div>
              <textarea
                ref={composerTextRef}
                className="w-full bg-transparent outline-none resize-none text-lg mt-3 min-h-[96px] placeholder:text-gray-400"
                value={text}
                onChange={e => setText(e.target.value)}
                onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 320) + 'px' }}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitComposer() }}
                placeholder={`What's on your mind, ${(user?.name || 'You').split(' ')[0]}?`}
                autoFocus
              />
              {showTitleInput && (
                <input className="w-full border rounded-lg p-2 mt-2 dark:bg-slate-800 dark:border-slate-600" value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Title (optional)" />
              )}
              {showLocationInput && (
                <input className="w-full border rounded-lg p-2 mt-2 dark:bg-slate-800 dark:border-slate-600" value={postLocation} onChange={e => setPostLocation(e.target.value)} placeholder="Add location (optional)" />
              )}
              {composerPhoto && <div className="relative mt-2">
                <img src={composerPhoto} alt="Photo to post" className="rounded-xl w-full max-h-80 object-cover" />
                <button onClick={() => setComposerPhoto(null)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full px-2 py-1 text-xs">✕ Remove</button>
              </div>}
              {uploadingVideo && <p className="text-sm text-gray-500 mt-2">Uploading video…</p>}
              {composerVideoUrl && <div className="relative mt-2">
                <video src={composerVideoUrl} controls playsInline className="rounded-xl w-full max-h-80 bg-black" />
                <button onClick={() => setComposerVideoUrl(null)} className="absolute top-2 right-2 bg-black/60 text-white rounded-full px-2 py-1 text-xs">✕ Remove</button>
              </div>}
              <div className="flex items-center justify-between gap-2 mt-3 border rounded-xl px-3 py-2">
                <span className="text-sm font-medium">Add to your post</span>
                <div className="flex gap-1">
                  <button onClick={() => photoInputRef.current?.click()} className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 flex items-center gap-1" title="Add a photo"><IconPhoto className="w-4 h-4" /> Photo</button>
                  <button disabled className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 flex items-center gap-1 opacity-50" title="Video upload is coming soon"><IconVideo className="w-4 h-4" /> Video (max 50 MB) — coming soon</button>
                  <button onClick={() => profilePhotoInputRef.current?.click()} className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 flex items-center gap-1" title="Set profile photo"><IconImage className="w-4 h-4" /> Profile photo</button>
                </div>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onComposerPhoto} />
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={onComposerVideo} />
              <input ref={profilePhotoInputRef} type="file" accept="image/*" className="hidden" onChange={onComposerProfilePhoto} />
              {composerErr && <p className="text-sm text-red-500 mt-2">{composerErr}</p>}
              {profilePhotoMsg && <p className="text-sm text-green-600 mt-2">{profilePhotoMsg}</p>}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={() => setShowTitleInput(v => !v)} className={`px-3 py-1 rounded-full text-xs font-medium ${showTitleInput ? 'pb-gradient text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>✏️ Add title</button>
                <button onClick={() => setShowLocationInput(v => !v)} className={`px-3 py-1 rounded-full text-xs font-medium ${showLocationInput ? 'pb-gradient text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>📍 Add location</button>
                <button onClick={() => setBoostPost(b => !b)} className={`px-3 py-1 rounded-full text-xs font-medium ${boostPost ? 'pb-gradient text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>🚀 Boost Post (0.1 π)</button>
              </div>
              <div className="flex gap-2 mt-4">
                <Btn variant="ghost" className="flex-1" onClick={resetComposer}>Cancel</Btn>
                <Btn className="flex-1" disabled={(!text.trim() && !composerPhoto && !composerVideoUrl) || uploadingVideo} onClick={submitComposer}>{editingPost ? 'Save' : 'Post'}</Btn>
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-2">Ctrl + Enter to post</p>
            </div>
          </div>
        </div>
      )}
      <Card className="pb-gradient text-white">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-white/20 grid place-items-center shrink-0"><IconCall className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <p className="font-bold">📞 Video call a friend</p>
            <p className="text-sm text-white/80">Prepaid {formatPi(FRIEND_RATE)}/min • First call's first 1 minute free</p>
          </div>
          <button onClick={() => navigate('/friends')} className="shrink-0 px-4 py-2 rounded-full bg-white text-pi-purple font-bold text-sm">Call</button>
        </div>
      </Card>
      {searching && (
        <Card>
          <h2 className="font-bold flex items-center gap-2"><IconFriends className="w-5 h-5" /> Friends ({results.length} people)</h2>
          {results.length === 0 && <p className="text-sm text-gray-500 mt-1">Nobody found — check whether the name or ID is correct.</p>}
          {results.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <Avatar photo={p.photo} name={p.name} color={p.color} className="w-10 h-10" />
              <span className="flex-1"><span className="font-medium">{p.name}</span><span className="block text-xs text-gray-400">ID: {p.numericUid ?? p.referralCode ?? '—'}{p.mutual ? ` • ${p.mutual} mutual friends` : ''}{p.online ? ' • ● Online' : ' • ○ Offline'}</span></span>
              {p.isFriend
                ? <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: p.name } })}><span className="flex items-center gap-1"><IconChat className="w-4 h-4" /> Chat</span></Btn>
                : sentRequests.some(s => s.toUid === p.id)
                  ? <Btn variant="ghost" onClick={() => cancelFriendRequest(p.id)}>Request Sent</Btn>
                  : <Btn onClick={() => sendFriendRequest({ id: p.id, name: p.name, color: p.color, online: true, ...(p.photo ? { photo: p.photo } : {}) })}>Add Friend</Btn>}
            </div>
          ))}
          <h2 className="font-bold mt-4">Posts ({postResults.length})</h2>
          {postResults.length === 0 && <p className="text-sm text-gray-500 mt-1">No posts found.</p>}
          {postResults.map(p => (
            <button key={p.id} onClick={() => jumpToPost(p.id)} className="block w-full text-left py-2">
              <span className="font-medium text-sm">{p.author}{p.time ? <span className="text-xs text-gray-400 font-normal"> • {p.time}</span> : null}</span>
              <span className="block text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{p.text}</span>
            </button>
          ))}
        </Card>
      )}
      <ServicesSection />
      <NewMembersSection />
      <HomeTvSection />
      <RefWelcomeBanner />
      <div className="flex gap-2">
        {(['All', 'Liked', 'Mine'] as const).map(f => (
          <button key={f} onClick={() => setFeedFilter(f)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${feedFilter === f ? 'pb-gradient text-white shadow-sm' : 'bg-white dark:bg-fb-card border border-gray-100 dark:border-white/10'}`}>{f === 'All' ? 'All posts' : f === 'Liked' ? '❤️ Liked' : 'My posts'}</button>
        ))}
      </div>
      {approvedAds.map(ad => (
        <Card key={ad.id}>
          <p className="text-xs font-bold text-gray-400">Sponsored</p>
          {ad.photo && <img src={ad.photo} alt={ad.title} className="rounded-xl mt-2 w-full max-h-96 object-cover" />}
          <p className="font-bold mt-2">{ad.title}</p>
          {ad.description && <p className="text-sm text-gray-500 mt-1">{ad.description}</p>}
          <p className="text-sm font-bold mt-1">{adPriceLabel(ad.priceBDT)}</p>
          <p className="text-xs text-gray-400">by {ad.ownerName}</p>
          <a href={ad.link} target="_blank" rel="noopener noreferrer" onClick={() => recordAdClick(ad.id)} className="inline-block mt-2 px-4 py-2 rounded-full text-sm font-bold text-white pb-gradient">Visit website →</a>
        </Card>
      ))}
      {visiblePosts.length === 0 && <Card><p className="text-sm text-gray-500 text-center">{feedFilter === 'All' ? 'No posts yet — write the first post.' : 'No posts in this filter.'}</p></Card>}
      {visiblePosts.map(p => {
        const own = isOwnPost(p)
        const authorName = own ? (user?.name || 'You') : p.author
        const authorPhoto = p.authorPhoto ?? (own ? profilePhoto : friends.find(f => f.name === p.author)?.photo)
        const likedByMe = likedPostIds.includes(p.id)
        return (
        <div key={p.id} id={'post-' + p.id}>
        <Card>
          <div className="flex items-center gap-2">
            <Avatar photo={authorPhoto} name={authorName} color={p.color} className="w-10 h-10" />
            <div className="flex-1 min-w-0"><p className="font-bold text-sm">{authorName}</p><p className="text-xs text-gray-400">{p.time}{p.location ? ` • 📍 ${p.location}` : ''}{p.audience ? ` • ${p.audience === 'Public' ? '🌐 Public' : '👥 Friends'}` : ''}</p></div>
            {p.boosted && <span className="text-xs font-bold text-white px-2 py-1 rounded-full pb-gradient">🚀 Boosted</span>}
            {own && (
              <div className="relative">
                <button onClick={() => setMenuPostId(menuPostId === p.id ? null : p.id)} className="px-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-lg leading-none" aria-label="Post options">⋯</button>
                {menuPostId === p.id && (
                  <div className="absolute right-0 top-8 z-20 w-44 bg-white dark:bg-slate-800 border border-gray-100 dark:border-white/10 rounded-xl shadow-lg py-1 text-sm">
                    <button className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setMenuPostId(null); openComposer(p) }}>✏️ Edit post</button>
                    <button className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-red-600" onClick={() => { setMenuPostId(null); setDeleteConfirmId(p.id) }}>🗑️ Delete post</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {deleteConfirmId === p.id && (
            <div className="mt-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-sm flex items-center gap-2 flex-wrap">
              <span className="flex-1">Delete this post?</span>
              <button className="px-3 py-1 rounded-full bg-red-600 text-white font-medium" onClick={() => { deletePost(p.id); setDeleteConfirmId(null) }}>Delete</button>
              <button className="px-3 py-1 rounded-full bg-gray-200 dark:bg-slate-700" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
            </div>
          )}
          {p.title && <p className="mt-3 font-bold">{p.title}</p>}
          <p className={`text-sm ${p.title ? 'mt-1' : 'mt-3'}`}>{p.text}</p>
          {p.imageUrl && <img src={p.imageUrl} alt="Post photo" className="rounded-xl mt-3 w-full max-h-96 object-cover" />}
          {p.videoUrl && <video src={p.videoUrl} controls playsInline className="rounded-xl mt-3 w-full max-h-96 bg-black" />}
          <div className="flex mt-3 pt-1 border-t text-sm text-gray-500 dark:text-gray-300">
            <button className={`flex-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 font-medium ${likedByMe ? 'text-pink-600 font-bold' : ''}`} onClick={() => togglePostLike(p.id)}>{likedByMe ? '❤️ Liked' : '👍 Like'} ({p.likes})</button>
            <button className="flex-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 font-medium flex items-center justify-center gap-1.5" onClick={() => setShowComments(s => ({ ...s, [p.id]: !s[p.id] }))}><IconChat className="w-4 h-4" /> Comments ({p.comments})</button>
            <button className="flex-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 font-medium flex items-center justify-center gap-1.5" onClick={() => sharePost(p)}><IconShare className="w-4 h-4" /> Share ({p.shares})</button>
          </div>
          {shareMsg[p.id] && <p className="text-xs text-green-600 mt-2">{shareMsg[p.id]}</p>}
          {showComments[p.id] && (p.commentsList?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t space-y-2">
              {(p.commentsList ?? []).map(c => (
                <div key={c.id} className="flex gap-2 text-sm">
                  <Avatar name={c.author} color="#7C3AED" className="w-8 h-8 shrink-0" />
                  <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl px-3 py-2 flex-1 min-w-0">
                    <p className="font-bold text-xs">{c.author}</p>
                    <p className="break-words">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <input className="flex-1 border rounded-full px-3 py-1.5 text-sm dark:bg-slate-800 dark:border-slate-600" placeholder="Write a comment…" value={commentDraft[p.id] || ''} onChange={e => setCommentDraft(d => ({ ...d, [p.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') sendComment(p) }} />
            <Btn variant="ghost" onClick={() => sendComment(p)}>Send</Btn>
          </div>
        </Card>
        </div>
        )
      })}
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
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const { experts: liveExperts, source } = useExperts()
  const filteredExperts = liveExperts.filter(e => (cat === 'All' || e.category === cat) && (e.name + e.title).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <h1 className="text-xl font-bold flex-1">Marketplace — Experts</h1>
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
      <Card><p className="text-sm">Looking for services? <Link className="text-fb-blue" to="/services">See Services</Link> — video-call services offered by people, prepaid per minute in Pi.</p></Card>
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
  if (!expert) return <Card>No expert found. <Link className="text-fb-blue" to="/services">Go Back</Link></Card>
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
  const { user, uid, profilePhoto } = useStore()
  const [title, setTitle] = useState('')
  const [rate, setRate] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [deviceOnly, setDeviceOnly] = useState(false)
  async function publish() {
    const input = { title, description: desc, ratePiPerMin: Number(rate) }
    const vErr = validateServiceInput(input)
    if (vErr) { setErr(vErr); return }
    if (!uid || !user) { setErr('Log in first to offer a service.'); return }
    setBusy(true); setErr('')
    const doc = {
      providerUid: uid,
      providerName: user.name,
      ...(profilePhoto ? { providerPhoto: profilePhoto } : {}),
      title: title.trim(),
      description: desc.trim(),
      ratePiPerMin: roundPi(Number(rate)),
    }
    const id = await createServiceDoc(doc)
    if (id) {
      saveLocalServices(mergeServiceLists(loadLocalServices(), [{ id, ...doc, createdAtMs: Date.now() }]))
      setDone(true)
    } else {
      // Firestore unreachable — keep it on this device only, honestly labelled.
      saveLocalServices(mergeServiceLists(loadLocalServices(), [{ id: 'local-' + Date.now(), ...doc, createdAtMs: Date.now() }]))
      setDeviceOnly(true)
      setDone(true)
    }
    setBusy(false)
  }
  return (
    <div className="max-w-lg mx-auto"><Card>
      <h1 className="text-xl font-bold">Offer a service</h1>
      <p className="text-sm text-gray-500 mt-1">Offer a service by video call — prepaid per minute in Pi. All services are virtual: video call only, no in-person meeting, no location needed.</p>
      <p className="text-sm text-gray-500 mt-1">Listed as: <b>{user?.name || 'You'}</b></p>
      <label className="text-sm font-medium block mt-3">Service title</label>
      <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. English speaking practice" />
      <label className="text-sm font-medium block mt-3">Rate (Pi per minute)</label>
      <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" type="number" min="0.01" max="100" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 0.15" />
      <label className="text-sm font-medium block mt-3">Short description</label>
      <textarea className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What will the caller get on the video call?" />
      {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
      <Btn className="w-full mt-4" disabled={busy || !title.trim() || !rate} onClick={publish}>{busy ? 'Publishing…' : 'Publish Service'}</Btn>
      {done && <p className="text-sm text-green-600 mt-3">✅ Service published.{deviceOnly ? ' Saved on this device only — others cannot see it yet. Try publishing again when you are back online.' : ''} <button className="text-fb-blue" onClick={() => navigate('/services')}>View Services</button></p>}
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
  // কল-ব্যর্থতার কারণ — একবার দেখানো হলে আর বদলানো হয় না (পরে আসা
  // জেনেরিক সার্ভার-ভুল ঠিক কারণটা মুছে দেবে না); উত্তর না এলে
  // NO_ANSWER_TIMEOUT_MS পরে "No answer" দেখানো হয়।
  const noAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failureShownRef = useRef(false)
  // পুশ পৌঁছাল কি না (null = অজানা/অপেক্ষায়) — না পৌঁছালে অপেক্ষার
  // পর্দায় সৎ ইঙ্গিত দেখায় (নোটিফিকেশন বন্ধ থাকলে কলটা তখনই যাবে না)
  const [pushDelivered, setPushDelivered] = useState<boolean | null>(null)
  // এই কলের ইনভাইট ডকের শেষ জানা স্ট্যাটাস — ডক মোছা/রাখার সিদ্ধান্তে লাগে
  const inviteStatusRef = useRef<string | null>(null)
  // ডিরেক্ট বন্ধু-কল: /call/friend/<নাম> খুললেই একবারই auto-start হবে
  const autoStartRef = useRef(false)
  function clearNoAnswerTimer() {
    if (noAnswerTimerRef.current !== null) { clearTimeout(noAnswerTimerRef.current); noAnswerTimerRef.current = null }
  }
  /** কলকারীকে ঠিক কারণটা দেখানো — কল স্ক্রিনের লাল বাক্সে। */
  function showCallFailure(reason: CallFailureReason) {
    if (endedRef.current || connectedRef.current || failureShownRef.current) return
    failureShownRef.current = true
    clearNoAnswerTimer()
    stopRingback()
    setRingingCall(null)
    setCallError(callFailureMessage(reason, name))
  }
  function armNoAnswerTimer() {
    clearNoAnswerTimer()
    noAnswerTimerRef.current = setTimeout(() => {
      noAnswerTimerRef.current = null
      // উত্তর এলো না — ইনভাইট 'cancelled' চিহ্নিত করা হয়, যাতে অ্যাপ বন্ধ
      // থাকা গ্রহণকারীর লগইন-সিঙ্ক এটা মিসড কল হিসেবে তুলে নেয়
      if (inviteDocRef.current) { const id = inviteDocRef.current; inviteStatusRef.current = 'cancelled'; void updateCallInviteStatus(id, 'cancelled') }
      showCallFailure('no-answer')
    }, NO_ANSWER_TIMEOUT_MS)
  }
  // পেজ ছাড়লে উত্তর-অপেক্ষার টাইমারও থামে — আনমাউন্টের পর setState নয়
  useEffect(() => () => { clearNoAnswerTimer(); stopRingback(); setRingingCall(null); clearCallInvite() }, [])
  // Firestore কল ইনভাইট — এই কলের ইনভাইট ডক + তার সাবস্ক্রিপশন; কল
  // শেষে/বাতিলে ডক মোছা হয় (গ্রহণকারীর ওভারলেও সরে যায়)।
  const inviteDocRef = useRef<string | null>(null)
  const inviteUnsubRef = useRef<(() => void) | null>(null)
  function clearCallInvite() {
    if (inviteUnsubRef.current) { inviteUnsubRef.current(); inviteUnsubRef.current = null }
    if (inviteDocRef.current) {
      const id = inviteDocRef.current
      inviteDocRef.current = null
      const st = inviteStatusRef.current
      if (st === 'accepted' || st === 'busy' || st === 'not-friend' || st === 'not-accepting') {
        // ধরেছেন/গেটে আটকেছে — মিসড নয়, ডক মুছে পরিষ্কার করা যায়
        void deleteCallInvite(id)
      } else if (st === 'declined' || st === 'cancelled') {
        // ইতিমধ্যে মিসড হিসেবে চিহ্নিত — গ্রহণকারীর সিঙ্কের জন্য ডক থাকে
      } else {
        // এখনো বাজছে (কলকারী কাটলেন/পেজ ছাড়লেন) — মুছে ফেলা নয়, বরং
        // 'cancelled' চিহ্নিত করা হয়, যাতে গ্রহণকারী মিসড কল দেখতে পান
        void updateCallInviteStatus(id, 'cancelled')
      }
    }
  }
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const { totalPi, addPi, freeFirstMinuteUsed, markFreeMinuteUsed, addCall, user, datingRate, datingKycRequired, soundSettings, friends, uid, referralCode, blockedUids, isBanned, profilePhoto, numericUid, setRingingCall } = useStore()
  const navigate = useNavigate()
  const { experts: liveExperts } = useExperts()
  const expert = type === 'expert' ? liveExperts.find(e => e.id === id) : undefined
  const isDating = type === 'dating'
  const isService = type === 'service'
  const datingProfile = isDating ? DATING_PROFILES.find(p => p.id === id) : undefined
  const friendName = type === 'friend' ? (id || 'Friend') : undefined
  // সার্ভিস কল: দর সার্ভিসের নিজের Pi/মিনিট রেট (টাকায় নয়) — লোকাল ক্যাশ
  // থেকে আগে, তারপর Firestore থেকে আসল দর; না পেলে কল শুরু হয় না।
  const [service, setService] = useState<ServiceListing | null>(null)
  const [serviceLoading, setServiceLoading] = useState(isService)
  useEffect(() => {
    if (!isService || !id) return
    let alive = true
    const cached = loadLocalServices().find(s => s.id === id)
    if (cached) { setService(cached); setServiceLoading(false) }
    fetchService(id).then(s => {
      if (!alive) return
      if (s) { setService(s); setServiceLoading(false) }
      else if (!cached) setServiceLoading(false)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isService, id])
  const rate = isService ? (service?.ratePiPerMin ?? 0) : expert ? takaToPi(expert.rate) : isDating ? datingRate : FRIEND_RATE // সব কল Pi-তে — সার্ভিসের নিজের Pi দর, এক্সপার্টের টাকার রেট ÷১০০, ডেটিং রেট অ্যাডমিন থেকে (ডিফল্ট π ০.১), বন্ধুর কল π ০.১ ফ্ল্যাট
  const name = isLinkCall ? (linkInfo?.callerName || 'Caller') : isService ? (service?.providerName ?? 'Service') : expert ? expert.name : isDating ? (datingProfile?.name || decodeURIComponent(id || 'Dating')) : decodeURIComponent(friendName || 'Friend')
  // Peer photo — friend calls resolve from the friends list; dating calls
  // resolve from publicProfiles by uid. Experts have no photo in the backend
  // (/api/experts returns id/name/rate/online only), so they keep initials.
  // Link calls know the caller by name only, so they keep initials too.
  const peerFriend = type === 'friend' ? friends.find(f => f.name === name) : undefined
  const [datingPeerPhoto, setDatingPeerPhoto] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!isDating || !id) return
    let alive = true
    fetchAllPublicProfiles(100).then(list => { if (alive) setDatingPeerPhoto(list.find(m => m.id === id)?.photo) }).catch(() => { /* initials */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDating, id])
  const peerPhoto = peerFriend?.photo ?? datingPeerPhoto
  // ডেটিং কল সম্পূর্ণ প্রিপেইড — গ্লোবাল প্রথম-১-মিনিট-ফ্রি এখানে প্রযোজ্য নয়, ফ্রি মিনিট খরচও হবে না
  const isFreeAvailable = !isDating && !freeFirstMinuteUsed
  const [started, setStarted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  // স্ক্রিন শেয়ার — ক্যামেরার ভিডিও ট্র্যাকের বদলে স্ক্রিনের ট্র্যাক পিয়ারে
  // যায় (replaceTrack — নতুন করে সংযোগ নয়); থামালে ক্যামেরা ফেরে।
  const screenStreamRef = useRef<MediaStream | null>(null)
  const cameraVideoRef = useRef<MediaStreamTrack | null>(null)
  const sharingRef = useRef(false)
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
  const maxPaidMinutes = rate > 0 ? Math.floor(totalPi / rate) : 0
  // লিংক-কলে গ্রহণকারীর অটো-কাট সীমা নেই (0 = সীমা নেই); কলকারী আগের মতোই প্রিপেইড সীমায় চলবেন
  const maxSeconds = isLinkCall ? 0 : freeSeconds + maxPaidMinutes * 60
  const talkableMinutes = freeSeconds / 60 + maxPaidMinutes
  // সার্ভিস কল প্রিপেইড: সার্ভিস না পেলে / নিজের সার্ভিস হলে / ব্যালেন্সে
  // ১ মিনিটের দর না থাকলে (ফ্রি মিনিট না থাকলে) শুরু হয় না।
  const isOwnServiceCall = !!isService && !!service && service.providerUid === uid
  const canStart = isService
    ? (!serviceLoading && !!service && !isOwnServiceCall && (isFreeAvailable || totalPi >= rate))
    : (isFreeAvailable || totalPi >= rate)

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
  useEffect(() => {
    setInCallActive(connected)
    if (connected) { stopRingback(); setRingingCall(null) }
    return () => setInCallActive(false)
  }, [connected])

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
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: facingRef.current }, audio: true }).then(async s => {
      if (cancelled) { s.getTracks().forEach(t => t.stop()); return }
      // অনুমতির পরেই ক্যামেরা গোনা যায় (আগে গুনলে Android-এ ১/০ আসে,
      // বোতাম ভুল করে বন্ধ হয়ে যেত); লেবেলও তখনই পাওয়া যায়
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices?.()
        if (!cancelled && devices) setCamCount(countCameras(devices))
      } catch { /* গোনা না গেলেও কল চলবে */ }
      let stream = s
      // আগে থেকে পেছনের ক্যামেরা বাছা থাকলে (সেটআপ পর্দা) ideal মোড
      // সামনের ক্যামেরা ফিরিয়ে দিলে আসল পেছনের ক্যামেরায় নেওয়া হয়
      if (facingRef.current === 'environment') {
        try {
          const devices = await navigator.mediaDevices?.enumerateDevices?.()
          const currentTrack = s.getVideoTracks()[0]
          const currentDeviceId = currentTrack?.getSettings?.().deviceId ?? null
          const currentFacing = currentTrack?.getSettings?.().facingMode
          const target = devices ? pickCameraDevice(devices, currentDeviceId, 'environment') : null
          if (!cancelled && target && currentFacing !== 'environment') {
            const back = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: target.deviceId } }, audio: false })
            if (cancelled) { back.getTracks().forEach(t => t.stop()); s.getTracks().forEach(t => t.stop()); return }
            const backVideo = back.getVideoTracks()[0]
            if (backVideo && !isSameCameraDevice(currentDeviceId, backVideo.getSettings?.().deviceId)) {
              s.getVideoTracks().forEach(t => t.stop())
              stream = new MediaStream([...back.getVideoTracks(), ...s.getAudioTracks()])
            } else {
              back.getTracks().forEach(t => t.stop())
            }
          }
        } catch { /* পেছনের ক্যামেরা না মিললে সামনের ক্যামেরাতেই কল চলবে */ }
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (selfRef.current) selfRef.current.srcObject = stream
      maybeCreateOffer()
      maybeAnswerOffer()
    }).catch(() => { /* camera unavailable in demo — placeholder stays */ })
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }, [started])

  // সামনের ↔ পেছনের ক্যামেরা বদলান — কল, টাইমার বা বিলিং থামবে না; অডিও ট্র্যাক চালু থাকবে
  // স্ক্রিন শেয়ার চলাকালীন ক্যামেরা বদলানো যায় না — পিয়ারে তখন স্ক্রিনের
  // ট্র্যাক যাচ্ছে, ক্যামেরা বদলালে শেয়ার ভেঙে যেত।
  // ঠিক করা (২০২৬-১১-২৬): আগে অনুমতির আগেই গোনা camCount ১ দেখিয়ে
  // বোতাম বন্ধ করে দিত, আর {facingMode: ideal} চুপচাপ সামনের ক্যামেরাই
  // ফিরিয়ে দিত — তাই ট্যাপে কিছুই বদলাত না। এখন deviceId দিয়ে বেছে
  // নেওয়া হয়, আর নতুন ট্র্যাক আসলেই অন্য ক্যামেরা কি না যাচাই করা হয়।
  async function switchCamera() {
    if (switching || sharing) return
    // ক্যামেরার সংখ্যা শুধু অনুমতির পরের গোনায় ১ প্রমাণিত হলেই বোতাম বন্ধ
    // (null = এখনো গোনা হয়নি — তখন চেষ্টা করতে দেওয়া হয়)
    if (camCount !== null && camCount <= 1) return
    const next = facingRef.current === 'user' ? 'environment' : 'user'
    setSwitching(true); setCamError('')
    const oldTrack = streamRef.current?.getVideoTracks()[0] ?? null
    const oldDeviceId = oldTrack?.getSettings?.().deviceId ?? null
    let devices: MediaDeviceInfo[] = []
    try { devices = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [] } catch { /* লেবেল ছাড়াই চেষ্টা চলবে */ }
    const target = pickCameraDevice(devices, oldDeviceId, next)
    let newStream: MediaStream | null = null
    for (const constraints of cameraConstraintAttempts(target?.deviceId ?? null, next)) {
      try { newStream = await navigator.mediaDevices.getUserMedia({ ...constraints, audio: false }); break } catch { /* পরের চেষ্টা */ }
    }
    if (!newStream) {
      setCamError('This camera could not be started — staying on the previous camera.')
      setSwitching(false)
      return
    }
    const newVideo = newStream.getVideoTracks()[0]
    const newDeviceId = newVideo?.getSettings?.().deviceId ?? null
    // ideal ফলব্যাকে একই ক্যামেরা ফিরে এলে "বদল হয়েছে" বলে মিথ্যা বলা হয় না
    if (newVideo && isSameCameraDevice(oldDeviceId, newDeviceId)) {
      newStream.getTracks().forEach(t => t.stop())
      const total = countCameras(devices)
      if (total <= 1) {
        setCamCount(total)
        setCamError('This device has only one camera — you cannot switch cameras.')
      } else {
        setCamError(`Could not switch to the ${next === 'environment' ? 'back' : 'front'} camera on this phone — it kept the previous camera. Try again.`)
      }
      setSwitching(false)
      return
    }
    // পুরোনো ভিডিও ট্র্যাকই শুধু বন্ধ করা — অডিও ট্র্যাক চালু থাকবে, কল চলতেই থাকবে
    const oldAudio = streamRef.current?.getAudioTracks() ?? []
    streamRef.current?.getVideoTracks().forEach(t => t.stop())
    const combined = new MediaStream([...newStream.getVideoTracks(), ...oldAudio])
    streamRef.current = combined
    if (selfRef.current) selfRef.current.srcObject = combined
    // আসল কলে পিয়ারকেও নতুন ভিডিও ট্র্যাক পাঠাতে হয়
    const sender = pcRef.current?.getSenders().find(s => s.track && s.track.kind === 'video')
    if (sender && newVideo) sender.replaceTrack(newVideo).catch(() => {})
    // ট্র্যাকের আসল facing-ই সত্য (চাওয়া facing নয়) — আয়না সেটাই মেনে চলে
    const actualFacing = newVideo?.getSettings?.().facingMode
    setFacingBoth(actualFacing === 'environment' ? 'environment' : actualFacing === 'user' ? 'user' : next)
    // ক্যামেরা গোনা আবার আপডেট করা (কিছু ডিভাইসে অনুমতির পরেই সঠিক সংখ্যা আসে)
    try {
      const fresh = await navigator.mediaDevices?.enumerateDevices?.()
      if (fresh) setCamCount(countCameras(fresh))
    } catch { /* ignore */ }
    setSwitching(false)
  }

  // স্ক্রিন শেয়ার চালু/বন্ধ — ১-টু-১ কলে পিয়ার স্ক্রিন দেখে; থামালে ক্যামেরা ফেরে।
  // অনুমতি না দিলে (বা পিকার বাতিল করলে) চুপচাপ বন্ধ থাকে — ক্র্যাশ নয়, বোতাম অফই থাকে।
  // ঠিক করা (২০২৬-১১-২৬): Android-এ (Chrome/PWA/WebView — সবখানেই)
  // getDisplayMedia() আদৌ নেই, ডেস্কটপ-অনলি API; আগের "browser not
  // supported" বার্তাটা শেষ-মাথা ছিল (ফোনের Chrome-এও হবে না)। এখন সৎ
  // বার্তা দেয় — স্ক্রিন শেয়ার করতে কম্পিউটার ব্রাউজার লাগবে।
  async function toggleShare() {
    if (sharingRef.current) { stopShare(); return }
    const support = getScreenShareSupport({
      hasGetDisplayMedia: typeof navigator.mediaDevices?.getDisplayMedia === 'function',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      coarsePointer: typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false,
    })
    if (!support.supported) {
      setShareError(support.message)
      return
    }
    let screen: MediaStream
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    } catch {
      // Denied or cancelled — graceful: button stays off, no crash, no error shown.
      return
    }
    const screenTrack = screen.getVideoTracks()[0]
    if (!screenTrack) { screen.getTracks().forEach(t => t.stop()); return }
    // ক্যামেরার ভিডিও ট্র্যাক মনে রাখা — শেয়ার থামালে এটাই ফেরানো হয়
    cameraVideoRef.current = streamRef.current?.getVideoTracks()[0] ?? null
    screenStreamRef.current = screen
    sharingRef.current = true
    setSharing(true)
    setShareError('')
    // পিয়ারে স্ক্রিনের ট্র্যাক — সংযোগ নতুন করে নয়, শুধু ট্র্যাক বদল
    const sender = pcRef.current?.getSenders().find(s => s.track && s.track.kind === 'video')
    if (sender) { try { await sender.replaceTrack(screenTrack) } catch { /* keep camera on the peer side */ } }
    // নিজের ছোট ভিউয়ে স্ক্রিন দেখা যায় (আয়না নয় — স্ক্রিন উল্টানো যাবে না)
    if (selfRef.current) selfRef.current.srcObject = screen
    // ব্রাউজারের নিজের Stop বোতামে (বা OS পিকারে) ট্র্যাক শেষ হলে ক্যামেরায় ফেরা
    screenTrack.onended = () => { stopShare() }
  }

  function stopShare() {
    if (!sharingRef.current && !screenStreamRef.current) return
    sharingRef.current = false
    setSharing(false)
    const screen = screenStreamRef.current
    screenStreamRef.current = null
    screen?.getTracks().forEach(t => t.stop())
    const camTrack = cameraVideoRef.current
    cameraVideoRef.current = null
    if (camTrack) {
      const sender = pcRef.current?.getSenders().find(s => s.track && s.track.kind === 'video')
      if (sender) sender.replaceTrack(camTrack).catch(() => {})
      if (selfRef.current && streamRef.current) selfRef.current.srcObject = streamRef.current
    }
  }

  // ---------- আসল 1-to-1 কল: সিগন্যালিং + WebRTC (কল-বাই-লিংক) ----------
  function closeCallResources() {
    try { pcRef.current?.close() } catch { /* ignore */ }
    pcRef.current = null
    try { wsRef.current?.close() } catch { /* ignore */ }
    wsRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    // স্ক্রিন শেয়ার চলতে থাকলে তার ট্র্যাকও বন্ধ — নইলে ব্রাউজারে শেয়ার আইকন থেকে যেত
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
    cameraVideoRef.current = null
    sharingRef.current = false
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
    stream.getTracks().forEach(t => {
      // শেয়ার চালু থাকলে পিয়ারে ক্যামেরার বদলে স্ক্রিনের ভিডিও ট্র্যাক যায়
      // (শেয়ার বোতাম সংযোগের আগেই চাপা থাকলে এটাই পথ)
      if (t.kind === 'video' && sharingRef.current && screenStreamRef.current) {
        const st = screenStreamRef.current.getVideoTracks()[0]
        if (st) { try { pc.addTrack(st, screenStreamRef.current) } catch { /* ignore */ } return }
      }
      try { pc.addTrack(t, stream) } catch { /* ignore */ }
    })
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
          clearNoAnswerTimer()
          // পিয়ার রুমে ঢুকেছেন — কলটা ধরেছেন (পুশ-লিংক দিয়ে ঢুকলেও);
          // ইনভাইট 'accepted' চিহ্নিত করা হয়, নইলে পরে ভুল করে মিসড হতো
          if (inviteDocRef.current) { inviteStatusRef.current = 'accepted'; void updateCallInviteStatus(inviteDocRef.current, 'accepted') }
          peerPeerIdRef.current = peers[0].peerId
          peerNameRef.current = peers[0].name
          setPeerName(peers[0].name)
          maybeCreateOffer()
        }
      },
      onPeerJoined: (peer) => {
        clearNoAnswerTimer()
        if (inviteDocRef.current) { inviteStatusRef.current = 'accepted'; void updateCallInviteStatus(inviteDocRef.current, 'accepted') }
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
      onCallDeclined: (reason) => { showCallFailure(parseFailureReason(reason) ?? 'declined') },
      onError: (err) => {
        showCallFailure(callErrorToFailureReason(err))
      },
      // সকেট বন্ধ হলে — উত্তর-অপেক্ষার টাইমার চলতে থাকলে আসল পরিস্থিতি
      // "কেউ ধরেনি" (মোবাইল/NAT বা Railway নিষ্ক্রিয় সকেট কেটে দেয়);
      // ইনভাইট যাওয়ার আগেই সকেট মরলে তবেই সার্ভার-ভুল।
      onClose: () => { showCallFailure(closeWhileWaitingToFailureReason(noAnswerTimerRef.current !== null)) },
    })
    wsRef.current = ws
    if (!ws) showCallFailure('server')
  }

  // কলকারী শুরু করলেন: কোড বানিয়ে রুমে ঢুকলেন, লিংক শেয়ার করবেন
  async function startCall() {
    if (!canStart) return
    // ব্যান হওয়া অ্যাকাউন্টে কল শুরু হয় না (অ্যাপ-স্তরের ব্যান-স্ক্রিনের পাশাপাশি এখানেও গেট)
    if (isBanned) { setCallError('Your account is banned — calls are blocked.'); return }
    // ব্লক চেক (কলকারী দিক) — ওই ব্যবহারকারী আমাকে ব্লক করলে কল শুরু হয়
    // না; শেয়ার করা রুম ডকের blockedBy থেকে দেখা হয়, ১.৫ সেকেন্ডে উত্তর
    // না এলে কল আগের মতোই চলবে (অফলাইনে/ধীর নেটে কল আটকে যাবে না)।
    if ((type === 'friend' || type === 'dating') && uid) {
      const peerUid = type === 'friend' ? friends.find((f) => f.name === name)?.id : id
      if (peerUid) {
        // আমি ওই ব্যবহারকারীকে ব্লক করে থাকলে আমিও তাকে কল করতে পারব না —
        // ব্লক মানে দুই দিকেই যোগাযোগ বন্ধ।
        if (blockedUids.includes(peerUid)) {
          setCallError('You have blocked this user — unblock them to call.')
          return
        }
        const room = await Promise.race([
          fetchChatRoomDoc(chatRoomId(uid, peerUid)),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ])
        if (room?.blockedBy?.includes(peerUid)) {
          setCallError('This user is not accepting calls from you right now.')
          return
        }
      }
    }
    const code = makeCallCode()
    setCallCode(code)
    callCodeRef.current = code
    setStarted(true)
    ensurePc()
    joinCallRoom(code, 'caller')
    // কলকারী অপেক্ষা করছেন — রিংব্যাক বাজে + যেখান থেকে কল শুরু হলো
    // (সার্ভিস কার্ড/চ্যাট থ্রেড) সেখানেও "অপেক্ষা" দেখায়; লিংক-কলে
    // গ্রহণকারী ঢুকছেন — তাঁর জন্য রিংব্যাক নয় (রিংটোন আগেই বাজছিল)
    if (!isLinkCall) {
      setRingingCall({
        kind: expert ? 'Expert' : isService ? 'Service' : isDating ? 'Dating' : 'Friend',
        peerId: type === 'friend' ? (friends.find((f) => f.name === name)?.id ?? '') : type === 'service' ? (service?.providerUid ?? '') : expert ? expert.id : isDating ? (id ?? '') : '',
        peerName: name,
        startedAtMs: Date.now(),
      })
      try { startRingback(soundSettings) } catch { /* রিংব্যাক ছাড়াও কল চলবে */ }
    }
    // নতুন ইনভাইট পথ (Firestore callInvites): কলকারী একটা ringing ডক
    // লেখে — গ্রহণকারীর অ্যাপ সেটা শুনে ওভারলে দেখায়; ধরলে/কাটলে/
    // গেটে আটকালে স্ট্যাটাস বদলায় আর এই ডকের সাবস্ক্রিপশনে কারণ এসে
    // পৌঁছায়। presence সকেট নেই, টোকেন-গেটেড ইনভাইট পথ নেই। ডেটিং
    // কলেও এখন ইনভাইট যায় (আগে যেত না)। না লিখতে পারলে (Firestore
    // নেই/অফলাইন) শেয়ার লিংক আগের মতোই কাজ করে। ইনভাইটের উত্তর না
    // এলে ৬৫ সেকেন্ডে "No answer" দেখাবে (টাইমার)।
    if (type === 'friend' || type === 'service' || isDating) {
      const inviteTarget = type === 'friend'
        ? friends.find((f) => f.name === name)?.id
        : type === 'service' ? service?.providerUid
        : id
      if (inviteTarget && isCallableInviteTarget(inviteTarget)) {
        const payload = buildCallInvitePayload({
          fromUid: uid ?? referralCode,
          toUid: inviteTarget,
          fromName: (user?.name || '').trim() || 'You',
          fromColour: colourForUid(uid ?? referralCode),
          fromPhoto: profilePhoto || undefined,
          fromNumericUid: numericUid ?? undefined,
          kind: type === 'service' ? 'service' : isDating ? 'dating' : 'friend',
          code,
        })
        if (payload) {
          createCallInvite(payload).then((inviteId) => {
            if (!inviteId || endedRef.current) return
            inviteDocRef.current = inviteId
            inviteStatusRef.current = 'ringing'
            // পুশ গেল কি না মনে রাখা হয় — না গেলে (সাবস্ক্রিপশন নেই/OTP)
            // অপেক্ষার পর্দায় সৎ ইঙ্গিত দেখায়
            void triggerCallInvitePush({ toUid: inviteTarget, inviteId, code, fromName: (user?.name || '').trim() || 'You' }).then(r => { if (!endedRef.current) setPushDelivered(r.pushed) }).catch(() => {})
            const unsub = subscribeCallInviteDoc(inviteId, (doc) => {
              if (!doc) return
              inviteStatusRef.current = doc.status
              const reason = callInviteStatusToFailureReason(doc.status)
              if (reason) showCallFailure(reason)
              // accepted: ধরেছেন — পিয়ার জয়েনের অপেক্ষায় থাকি
            })
            if (unsub) inviteUnsubRef.current = unsub
          })
        }
      }
      armNoAnswerTimer()
    }
  }

  // বন্ধুর কল ডিরেক্ট (Messenger-স্টাইল): /call/friend/<নাম> খুললেই কল
  // শুরু হয় — সেটআপ পর্দা নেই, সামনের ক্যামেরা ডিফল্ট (facing 'user')।
  // ক্রেডিট না থাকলে কল শুরু হয় না, ছোট বার্তা দেখায় (সেটআপ পর্দার
  // সেই লেখাটাই); ব্যান/ব্লক-এ আটকালে startCall নিজেই বার্তা দেয়।
  useEffect(() => {
    if (type !== 'friend' || isLinkCall || started || ended || autoStartRef.current) return
    autoStartRef.current = true
    if (!canStart) {
      setCallError('You cannot call without a Pi balance. Prepaid calls — buy Pi first.')
      return
    }
    void startCall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, isLinkCall])

  // গ্রহণকারী কল ধরলেন: রুমে ঢুকলেন, অফারের অপেক্ষা করবেন
  function acceptCall() {
    if (!linkCode) return
    setCallCode(linkCode)
    callCodeRef.current = linkCode
    setStarted(true)
    joinCallRoom(linkCode, 'callee')
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
    clearNoAnswerTimer()
    stopRingback()
    setRingingCall(null)
    clearCallInvite()
    closeCallResources()
    setEnded(true); setEndReason(reason || 'Call ended')
    // লিংক-কলে গ্রহণকারী দেন না — খরচ ০, ফ্রি মিনিটও খরচ হয় না; কলকারী আগের মতোই দেবেন
    const cost = isLinkCall ? 0 : roundPi(Math.ceil(Math.max(0, secondsRef.current - freeSeconds) / 60) * rate)
    if (cost > 0) addPi(-cost, 'Call Cost', `Call — ${name}`)
    if (!isLinkCall && isFreeAvailable && secondsRef.current > 0) markFreeMinuteUsed()
    // peerId — হিস্ট্রি থেকে সরাসরি কল-ব্যাক/চ্যাটে লাগে (বন্ধু: নামে,
    // ডেটিং: id, এক্সপার্ট: expert.id, সার্ভিস: providerUid)
    const peerId = type === 'friend' ? friends.find((f) => f.name === name)?.id
      : type === 'service' ? service?.providerUid
      : expert ? expert.id
      : isDating ? id : undefined
    addCall({ name, type: expert ? 'Expert' : isService ? 'Service' : isDating ? 'Dating' : 'Friend', rate, durationSec: secondsRef.current, cost, freeMinute: !isLinkCall && isFreeAvailable && secondsRef.current > 0, status: reason.startsWith('Auto-cut') ? 'Auto-cut' : 'Completed', peerId })
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

  // প্রগ্রেসিভ KYC — ৫ জন আলাদা মানুষের সাথে ডেটিংয়ে চ্যাট করার পর KYC
  // বাধ্যতামূলক হলে ডেটিং কল শুরু করা যাবে না — কল শুরু হলে টাকাও কাটবে না
  if (isDating && datingKycRequired) {
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
          {isService && !isLinkCall && seconds > 0 && service && uid && (
            <ServiceReviewForm serviceId={service.id} reviewerUid={uid} reviewerName={user?.name || 'You'} />
          )}
          <div className="flex gap-2 mt-5 justify-center">
            <Btn variant="green" onClick={() => navigate('/call-history')}>Call History</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/feed')}>Back to Feed</Btn>
          </div>
        </Card>
      </div>
    )
  }

  // সার্ভিস কল: সার্ভিস না পেলে / নিজের সার্ভিস হলে কল শুরু হয় না
  if (isService && serviceLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">Loading service…</h1>
        </Card>
      </div>
    )
  }
  if (isService && !service) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">Service not found</h1>
          <p className="text-sm text-gray-300 mt-2">This service may have been removed. Pick another service from the Services section.</p>
          <div className="flex gap-2 mt-5 justify-center">
            <Btn variant="green" onClick={() => navigate('/services')}>View Services</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/feed')}>Back to Feed</Btn>
          </div>
        </Card>
      </div>
    )
  }
  if (isService && service && service.providerUid === uid) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <h1 className="text-xl font-bold">This is your own service</h1>
          <p className="text-sm text-gray-300 mt-2">You cannot call yourself — other people can call you for this service.</p>
          <div className="flex gap-2 mt-5 justify-center">
            <Btn variant="green" onClick={() => navigate('/services')}>View Services</Btn>
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
            <p className="text-sm text-gray-300 mt-2">The call may have ended. Ask the caller to call again.</p>
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

  // কল শুরু হয়েছে কিন্তু পিয়ার এখনো সংযুক্ত হননি — অপেক্ষার পর্দা
  if (started && !connected && !ended) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
          <Avatar photo={peerPhoto} name={name} color="#7C3AED" className="w-24 h-24 text-4xl mx-auto" />
          <h1 className="text-xl font-bold mt-3">📞 {name}</h1>
          {callError
            ? <p className="mt-3 bg-red-600 rounded-lg px-3 py-2 text-sm font-medium">{callError}</p>
            : <p className="text-sm text-gray-300 mt-2">{isLinkCall ? 'Connecting…' : 'Waiting for the other person…'}</p>}
          {pushDelivered === false && !callError && !isLinkCall && (
            <p className="text-xs text-amber-300 mt-2">Couldn't reach them by notification — their app may be closed or notifications off. The call will ring when they open the app.</p>
          )}
          {!isLinkCall && (
            <p className="text-xs text-gray-400 mt-4">No money will be cut while waiting — the timer and billing start only after connecting.</p>
          )}
          <button onClick={() => hangUp('Call cancelled')} className="mt-5 px-6 py-2 rounded-full bg-red-600 text-white font-bold">❌ Reject</button>
        </Card>
      </div>
    )
  }

  if (!started) {
    // বন্ধুর কল ডিরেক্ট — সেটআপ পর্দা নেই (দর/ব্যালেন্স/মিনিটের লেখা,
    // ক্যামেরা-বাছাই, Start বোতাম সবই বাদ): ট্যাপ করলেই কল শুরু হয়,
    // সামনের ক্যামেরা চালু থাকে। শুধু ক্রেডিট/ব্যান/ব্লক-এ আটকালে ছোট বার্তা।
    if (type === 'friend') {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <Card className="!bg-slate-800 !text-white max-w-md w-full text-center">
            <Avatar photo={peerPhoto} name={name} color="#7C3AED" className="w-24 h-24 text-4xl mx-auto" />
            <h1 className="text-xl font-bold mt-3">📞 {name}</h1>
            {callError ? (
              <>
                <p className="mt-3 bg-red-600 rounded-lg px-3 py-2 text-sm font-medium">{callError}</p>
                <div className="flex gap-2 mt-5 justify-center">
                  <Btn variant="green" onClick={() => navigate('/wallet')}>Buy Pi</Btn>
                  <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate(-1)}>← Go Back</Btn>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-300 mt-2">Calling…</p>
                <button onClick={() => navigate(-1)} className="mt-5 px-6 py-2 rounded-full bg-red-600 text-white font-bold">❌ Cancel</button>
              </>
            )}
          </Card>
        </div>
      )
    }
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <Card className="!bg-slate-800 !text-white max-w-md w-full">
          <h1 className="text-xl font-bold">📞 {name}</h1>
          <p className="text-sm text-gray-300">{expert ? `${expert.title} • ` : isService ? `${service?.title ?? 'Service'} • ` : isDating ? 'Dating • ' : 'Friend • '}{formatPi(rate)}/ minute</p>
          {isFreeAvailable && <p className="mt-2 text-sm bg-green-600 rounded-lg px-3 py-2">🎉 1st minute free — your first call's first 1 minute is completely free!</p>}
          {isService && <p className="mt-2 text-sm bg-violet-600 rounded-lg px-3 py-2">💼 Prepaid service call — {formatPi(rate)}/minute, video call only. Only you (the caller) will pay; the call will cut itself when your Pi balance ends. After the call you can leave a review with your name.</p>}
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
          <div className="flex gap-2 mt-5">
            <Btn variant="green" className="flex-1" disabled={!canStart} onClick={startCall}>▶️ Start Call</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>Buy Pi</Btn>
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
            <Avatar photo={peerPhoto} name={name} color="#7C3AED" className="w-28 h-28 text-4xl mx-auto" />
            <p className="text-xl font-bold mt-3">{name}</p>
            <p className="text-gray-300 text-sm">{fmt(seconds)} • {isFreeAvailable && seconds < 60 ? '1st minute free' : `${formatPi(liveCost)}`}</p>
            {sharing && <p className="text-xs mt-2 pb-gradient inline-block px-2 py-1 rounded">🖥️ Screen Sharing</p>}
            {camOff && <p className="text-xs mt-2">📷 Camera Off</p>}
          </div>
        )}
        {/* সামনের ক্যামেরায় সেলফ-ভিউ আয়নার মতো (mirror), পেছনের ক্যামেরায় নয়; স্ক্রিন শেয়ারে আয়না নয় */}
        <video ref={(el) => { selfRef.current = el; if (el && streamRef.current) el.srcObject = streamRef.current }} style={{ transform: sharing ? 'none' : (facing === 'user' ? 'scaleX(-1)' : 'none') }} className="absolute bottom-24 right-4 w-28 h-36 rounded-xl object-cover border-2 border-white bg-slate-700" autoPlay playsInline muted />
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
          <button onClick={toggleShare} className={`w-14 h-14 rounded-full text-2xl ${sharing ? 'pb-gradient' : 'glass'}`} title="Screen Share">🖥️</button>
          <button onClick={switchCamera} disabled={switching || (camCount !== null && camCount <= 1) || sharing} className="h-14 px-3 rounded-full glass text-sm font-bold disabled:opacity-50" title="Switch camera — front ↔ back">🔄 {switching ? 'Changing…' : `Camera: ${facing === 'user' ? 'Front' : 'Back'}`}</button>
          <button onClick={() => hangUp('You ended the call')} className="w-16 h-16 rounded-full bg-red-600 text-3xl" title="Call ended">📞</button>
        </div>
        {camCount === 1 && <p className="text-center text-xs text-yellow-300 mb-1">This device has 1 camera — you cannot switch cameras.</p>}
        {sharing && <p className="text-center text-xs text-violet-300 mb-1">🖥️ Sharing your screen — the other person sees your screen, not your camera.</p>}
        {shareError && <p className="text-center text-xs text-red-300 mb-1">{shareError}</p>}
        {camError && <p className="text-center text-xs text-red-300 mb-1">{camError}</p>}
        {callError && <p className="text-center text-xs text-red-300 mb-1">{callError}</p>}
        <p className="text-center text-xs text-gray-400">{isLinkCall ? 'The caller will pay for this call' : `Call will auto-cut when balance ends${maxSeconds > 0 ? ` • Max ${fmt(maxSeconds)}` : ''}`}</p>
      </div>
    </div>
  )
}

// ---------- Call history ----------
export function CallHistory() {
  const { calls, markMissedCallsSeen } = useStore()
  const navigate = useNavigate()
  // হিস্ট্রি খুললেই মিসড কল "দেখা" হয় — ব্যাজ সরে যায়
  useEffect(() => { markMissedCallsSeen() }, [])
  // হিস্ট্রি থেকে সরাসরি কল — বন্ধু নামে, ডেটিং/এক্সপার্ট/সার্ভিস UID-তে;
  // peerId নেই এমন পুরোনো ডেটিং/এক্সপার্ট/সার্ভিস এন্ট্রিতে Call থাকে না
  const callPath = (c: CallRecord): string | null => {
    if (c.type === 'Friend') return `/call/friend/${encodeURIComponent(c.name)}`
    if (!c.peerId) return null
    if (c.type === 'Dating') return `/call/dating/${c.peerId}`
    if (c.type === 'Expert') return `/call/expert/${c.peerId}`
    if (c.type === 'Service') return `/call/service/${c.peerId}`
    return null
  }
  // হিস্ট্রি থেকে সরাসরি চ্যাট — এক্সপার্টের চ্যাট থ্রেড নেই, তাই শুধু
  // বন্ধু/ডেটিং/সার্ভিসে; ডেটিংয়ে datingPartnerId, সার্ভিসে peerId দিয়ে
  // থ্রেড খোলে (প্রোভাইডার বন্ধু তালিকায় না থাকলেও)
  const openChat = (c: CallRecord) => {
    if (c.type === 'Expert') return
    navigate('/chat', {
      state: {
        with: c.name,
        ...(c.type === 'Dating' && c.peerId ? { datingPartnerId: c.peerId } : {}),
        ...(c.type === 'Service' && c.peerId ? { peerId: c.peerId } : {}),
      },
    })
  }
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold flex items-center gap-2"><IconCall className="w-6 h-6" /> Call History</h1>
      {calls.length === 0 && <Card><p className="text-sm text-gray-500">No call yet. The first call's first 1 minute is free!</p></Card>}
      {calls.map(c => {
        const path = callPath(c)
        const missed = c.status === 'Missed'
        return (
          <Card key={c.id}>
            <div className="flex justify-between"><b>{c.name}</b><span className="text-xs text-gray-400">{c.time}</span></div>
            <p className="text-sm text-gray-500">{c.type} • {formatPi(c.rate)}/minute • {Math.floor(c.durationSec / 60)} min {c.durationSec % 60} sec • {c.status}</p>
            <p className="text-sm font-bold">Cost: {formatPi(c.cost)}{c.freeMinute ? ' (with 1st minute free)' : ''}</p>
            {missed && <p className="text-sm font-bold text-red-600 mt-1">📞 Missed call — {c.name} called you</p>}
            <div className="flex gap-2 mt-3">
              {path && (
                <Btn variant="green" onClick={() => navigate(path)}>{missed ? '📞 Call back' : '📞 Call'}</Btn>
              )}
              {c.type !== 'Expert' && (
                <Btn variant="ghost" onClick={() => openChat(c)}>💬 Chat</Btn>
              )}
            </div>
          </Card>
        )
      })}
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
  const totalIncome = sum(['Daily Bonus', 'ডেইলি বোনাস', 'Referral', 'রেফারেল', 'Live Earnings', 'লাইভ আয়', 'Gift Box', 'গিফট বক্স', 'Install Bonus', 'ইন্সটল বোনাস', 'Transfer Received', 'Transfer Fee'])
  const totalExpense = roundPi(-sum(['Call Cost', 'কল খরচ', 'Watching Live', 'লাইভ দেখা', 'Gifts Sent', 'গিফট দেওয়া', 'Boost', 'বুস্ট', 'Super Like', 'সুপার লাইক', 'Transfer Sent']))
  let run = totalPi
  const rows = piLedger.map(r => { const after = run; run = roundPi(run - r.amount); return { ...r, after } })
  return (
    <Card>
      <h2 className="font-bold">📊 Pi Report</h2>
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
  const { uid, points, referrals, referralCode, numericUid, piBalance, bonusPi, totalPi, addPi, piDeposits, piWithdrawals, depositPi, withdrawPi, piRateBDT, usdtRateBDT, piWithdrawFeePct, piMinWithdraw, piTransferFeePct, piMinTransfer, sendPi, lookupUserByUid, friends, pendingTopUps, submitManualTopUp, adminSettings, kycVerified, paymentRequests, requestPayment, payPaymentRequest, declinePaymentRequest, cancelPaymentRequest } = useStore()
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
  // Pi পাঠানো (UID দিয়ে) — UID লিখে খুঁজলে নাম + ছবি দেখে নিশ্চিত হয়ে তবে
  // পাঠানো যায়; অচেনা UID-তে কিছু যায় না। বন্ধু তালিকা থেকেও বেছে নেওয়া যায়।
  const [trUid, setTrUid] = useState('')
  const [trFound, setTrFound] = useState<{ uid: string; displayName: string; colour: string; photo?: string; numericUid?: number } | null>(null)
  const [trLookupMsg, setTrLookupMsg] = useState('')
  const [trLookupBusy, setTrLookupBusy] = useState(false)
  const [trAmount, setTrAmount] = useState('')
  const [trMsg, setTrMsg] = useState('')
  const [trBusy, setTrBusy] = useState(false)
  const [trConfirm, setTrConfirm] = useState(false)
  async function doLookupUid() {
    const n = Number(trUid.replace(/\D/g, ''))
    if (!Number.isInteger(n) || n < 100000 || n > 999999) { setTrLookupMsg('Enter a 6-digit UID (e.g. 100001).'); setTrFound(null); return }
    if (numericUid !== null && n === numericUid) { setTrLookupMsg('That is your own UID — you cannot send Pi to yourself.'); setTrFound(null); return }
    setTrLookupBusy(true); setTrLookupMsg('')
    const found = await lookupUserByUid(n)
    setTrLookupBusy(false)
    if (!found) { setTrFound(null); setTrLookupMsg('No user found with this UID — check the number and try again.'); return }
    setTrFound(found); setTrLookupMsg('')
  }
  async function doSendPi() {
    if (!trFound || trBusy) return
    if (!kycVerified) { setTrMsg('Pi send needs approved KYC — complete Dating KYC first.'); return }
    const m = Number(trAmount)
    if (!Number.isFinite(m) || m <= 0) { setTrMsg('Enter a valid amount.'); return }
    if (m < piMinTransfer) { setTrMsg(`Minimum transfer: ${formatPi(piMinTransfer)}.`); return }
    if (m > piBalance) { setTrMsg('Not enough Pi balance — only real Pi can be sent, bonus Pi cannot be transferred.'); return }
    if (!trConfirm) { setTrConfirm(true); setTrMsg(''); return }
    setTrBusy(true); setTrMsg('')
    const res = await sendPi({ uid: trFound.uid, name: trFound.displayName, numericUid: trFound.numericUid }, m)
    setTrBusy(false); setTrConfirm(false)
    if (res.ok === false) { setTrMsg(res.error); return }
    const { fee, net } = computeTransfer(m, piTransferFeePct)
    setTrMsg(`✅ Sent ${formatPi(m)} to ${trFound.displayName} — fee ${formatPi(fee)} • they get ${formatPi(net)}.`)
    setTrAmount(''); setTrFound(null); setTrUid('')
  }
  const [copied, setCopied] = useState('')
  const [affiliateOn, setAffiliateOn] = useState(false)
  const [affiliateMsg, setAffiliateMsg] = useState('')
  // পেমেন্ট রিকোয়েস্ট — "আমাকে Pi দাও": UID দিয়ে খুঁজে (নাম + ছবি দেখে)
  // বা বন্ধু বেছে পরিমাণ + note পাঠানো; প্রাপক Pay করলে item 6-এর
  // ট্রান্সফারই চলে (৯৮% পান, ২% ফি)। Pay/Decline/Cancel — স্ট্যাটাস
  // বদলালেই তালিকা তাজা হয় (লাইভ সাবস্ক্রিপশন)।
  const [rqUid, setRqUid] = useState('')
  const [rqFound, setRqFound] = useState<{ uid: string; displayName: string; colour: string; photo?: string; numericUid?: number } | null>(null)
  const [rqLookupMsg, setRqLookupMsg] = useState('')
  const [rqLookupBusy, setRqLookupBusy] = useState(false)
  const [rqAmount, setRqAmount] = useState('')
  const [rqNote, setRqNote] = useState('')
  const [rqMsg, setRqMsg] = useState('')
  const [rqBusy, setRqBusy] = useState(false)
  const [payReqId, setPayReqId] = useState('')
  const [payBusy, setPayBusy] = useState(false)
  const [payMsg, setPayMsg] = useState('')
  const [rqActionBusy, setRqActionBusy] = useState('')
  async function doRqLookup() {
    const n = Number(rqUid.replace(/\D/g, ''))
    if (!Number.isInteger(n) || n < 100000 || n > 999999) { setRqLookupMsg('Enter a 6-digit UID (e.g. 100001).'); setRqFound(null); return }
    if (numericUid !== null && n === numericUid) { setRqLookupMsg('You cannot request Pi from yourself.'); setRqFound(null); return }
    setRqLookupBusy(true); setRqLookupMsg('')
    const found = await lookupUserByUid(n)
    setRqLookupBusy(false)
    if (!found) { setRqFound(null); setRqLookupMsg('No user found with this UID — check the number and try again.'); return }
    setRqFound(found); setRqLookupMsg('')
  }
  async function doRequestPayment() {
    if (!rqFound || rqBusy) return
    const m = Number(rqAmount)
    if (!Number.isFinite(m) || m <= 0) { setRqMsg('Enter a valid amount.'); return }
    if (m < piMinTransfer) { setRqMsg(`Minimum request: ${formatPi(piMinTransfer)}.`); return }
    setRqBusy(true); setRqMsg('')
    const res = await requestPayment({ uid: rqFound.uid, name: rqFound.displayName, numericUid: rqFound.numericUid }, m, rqNote)
    setRqBusy(false)
    if (res.ok === false) { setRqMsg(res.error); return }
    setRqMsg(`✅ Payment request sent to ${rqFound.displayName} — ${formatPi(m)}. They will see it in their Wallet.`)
    setRqAmount(''); setRqNote(''); setRqFound(null); setRqUid('')
  }
  async function doPayRequest(req: { id: string; fromUid: string; fromName: string; fromNumericUid?: number; amount: number }) {
    if (payBusy) return
    if (!kycVerified) { setPayMsg('Paying needs approved KYC — complete Dating KYC first.'); return }
    setPayBusy(true); setPayMsg('')
    const res = await payPaymentRequest(req as never)
    setPayBusy(false); setPayReqId('')
    if (res.ok === false) { setPayMsg(res.error); return }
    const { fee, net } = computeTransfer(req.amount, piTransferFeePct)
    setPayMsg(`✅ Paid ${formatPi(req.amount)} to ${req.fromName} — fee ${formatPi(fee)} • they get ${formatPi(net)}.`)
  }
  async function doDeclineRequest(req: { id: string; fromUid: string; toUid: string; status: string }) {
    if (rqActionBusy) return
    setRqActionBusy(req.id); setPayMsg('')
    await declinePaymentRequest(req as never)
    setRqActionBusy('')
  }
  async function doCancelRequest(req: { id: string; fromUid: string; toUid: string; status: string }) {
    if (rqActionBusy) return
    setRqActionBusy(req.id); setPayMsg('')
    await cancelPaymentRequest(req as never)
    setRqActionBusy('')
  }
  const pendingIncoming = pendingIncomingCount(paymentRequests, uid)
  const incomingReqs = paymentRequests.filter(r => r.toUid === uid)
  const outgoingReqs = paymentRequests.filter(r => r.fromUid === uid)
  // অ্যাফিলিয়েট লিংক — ট্যাপ করলেই শেয়ার শিট ওঠে (না থাকলে কপি); শিট বন্ধ
  // করা ব্যর্থতা নয়, চুপচাপ থাকে; আসল ব্যর্থতায় সত্যি বার্তা
  async function shareAffiliateLink() {
    const r = await shareLink('PiCall — Live Expert Advice', 'Join PiCall — first call\'s first 1 minute free + 1 π bonus!', `${INVITE_BASE_URL}?ref=${referralCode}`)
    setAffiliateMsg(r === 'shared' ? '✅ Shared!' : r === 'copied' ? '✅ Link copied — send it to a friend!' : r === 'failed' ? 'Sharing is not supported here — long-press the link to copy it.' : '')
  }
  const depChain = 'Pi Mainnet'
  const wdChain = 'Pi Mainnet'
  // চালু থাকা মাধ্যমেই টপ-আপ — বন্ধ মাধ্যম বোতামে দেখায় না; বর্তমান মাধ্যম
  // বন্ধ হয়ে গেলে প্রথম চালু মাধ্যমে যায়; সব বন্ধ থাকলে ফর্মের বদলে বার্তা।
  const enabledMethods = enabledTopUpMethods(adminSettings.payments.enabled)
  const activeMethod = resolveTopUpMethod(adminSettings.payments.enabled, method)
  const piDepositEnabled = isPaymentMethodEnabled(adminSettings.payments.enabled, 'piDeposit')
  const isUsdt = activeMethod === 'USDT'
  const isBinance = activeMethod === 'Binance Pay'
  const isUsdtAmount = isUsdt || isBinance
  // ব্যাংক বাদ — সব টপ-আপ এখন ম্যানুয়াল (অ্যাডমিন অনুমোদন), তাৎক্ষণিক টপ-আপ আর নেই
  const net = USDT_NETWORKS.find(n => n.id === usdtNetwork) || USDT_NETWORKS[1]
  // টপ-আপের অটো Pi রূপান্তর — ফর্মেই দেখা যায় কত Pi পাওয়া যাবে (টাকা ÷ Pi দর; USDT × USDT দর ÷ Pi দর)
  const previewPi = topUpPi(Number(amount) || 0, isUsdtAmount ? 'USDT' : 'BDT', piRateBDT, usdtRateBDT)
  // অ্যাডমিন সেটিংসে আসল নম্বর/ঠিকানা বসানো থাকলে সেটাই দেখাবে; না থাকলে
  // "Not set up yet — ask the admin" দেখাবে — কোনো ডেমো নম্বর/ঠিকানা দেখানো হয় না
  const savedPayNumber = activeMethod === 'bKash' ? adminSettings.payments.bkash : activeMethod === 'Nagad' ? adminSettings.payments.nagad : activeMethod === 'Rocket' ? adminSettings.payments.rocket : ''
  const savedUsdtAddress = usdtNetwork === 'BEP20' ? adminSettings.payments.usdtBep20 : adminSettings.payments.usdtErc20
  const savedBinanceId = adminSettings.payments.binancePayId
  const savedPiAddress = adminSettings.payments.piDepositAddress
  function copyText(t: string, label: string) { navigator.clipboard?.writeText(t).then(() => setCopied(label)).catch(() => setCopied('')) }
  function doTopUp() {
    // সব টপ-আপ ম্যানুয়াল — আবেদন জমা হয়, অ্যাডমিন অনুমোদন দিলে Pi যোগ হয়
    if (!activeMethod) return
    const err = submitManualTopUp(isUsdt ? `USDT (${usdtNetwork})` : activeMethod, Number(amount), trx, isUsdtAmount ? 'USDT' : 'BDT', isUsdt ? usdtNetwork : undefined)
    setMsg(err || `✅ ${activeMethod} request submitted — ${formatPi(previewPi)} will be added after admin approval.`)
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
    // Pi তোলা সবসময় অনুমোদিত KYC চায় — KYC ছাড়া তোলা যায় না
    if (!kycVerified) { setWdMsg('Pi withdrawal needs approved KYC — complete Dating KYC first.'); return }
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
      <Card className="text-center pb-gradient text-white">
        <p className="text-sm text-white/80">π Pi Balance · Pi Mainnet</p>
        <p className="text-4xl font-extrabold font-display">{formatPi(totalPi)}</p>
        <p className="text-lg font-bold text-white/90">≈ {formatBDT(totalPi * piRateBDT)}</p>
        <p className="text-sm text-white/80 mt-1">Withdrawable: <b>{formatPi(piBalance)}</b> ({formatBDT(piBalance * piRateBDT)}) • Bonus Pi: <b>{formatPi(bonusPi)}</b></p>
        <p className="text-xs text-white/70 mt-1">Bonus Pi cannot be withdrawn — it can only be used for calls/live gifts.</p>
        <div className="flex gap-2 justify-center mt-3">
          <button onClick={() => document.getElementById('wallet-topup')?.scrollIntoView({ behavior: 'smooth' })} className="px-4 py-2 rounded-full bg-white text-pi-purple font-bold text-sm">Deposit</button>
          <button onClick={() => document.getElementById('wallet-withdraw')?.scrollIntoView({ behavior: 'smooth' })} className="px-4 py-2 rounded-full bg-white/20 text-white font-bold text-sm border border-white/40">Withdraw</button>
          <button onClick={() => document.getElementById('wallet-sendpi')?.scrollIntoView({ behavior: 'smooth' })} className="px-4 py-2 rounded-full bg-white/20 text-white font-bold text-sm border border-white/40">Send Pi</button>
          <button onClick={() => document.getElementById('wallet-request')?.scrollIntoView({ behavior: 'smooth' })} className="px-4 py-2 rounded-full bg-white/20 text-white font-bold text-sm border border-white/40">Request Payment{pendingIncoming > 0 ? ` (${pendingIncoming})` : ''}</button>
        </div>
        <p className="text-sm text-white/80 mt-3">Reward Points: {points} • Referral: {referrals} people</p>
        <p className="text-xs text-white/60 mt-1">Calls and live are prepaid — they will not work without a Pi balance. Whatever money or USDT you put in will auto-convert to Pi.</p>
      </Card>
      <Card>
        <h2 className="font-bold flex items-center gap-2"><IconWallet className="w-5 h-5" /> Pi Wallet</h2>
        <p className="text-xs text-gray-500 mt-1">Rate: 1 Pi = {formatBDT(piRateBDT)} • 1 USDT = {formatBDT(usdtRateBDT)} (set by admin)</p>
        <div className="mt-4 border-t pt-3">
          <p className="text-sm font-bold">Pi Deposit</p>
          {piDepositEnabled ? (<>
          <p className="text-sm mt-2">Pi Chain: <b>Pi Mainnet (real Pi)</b></p>
          {savedPiAddress
            ? <><p className="text-sm mt-2">PiCall Pi address (Pi Mainnet): <code className="break-all">{savedPiAddress}</code></p>
              <Btn variant="ghost" className="mt-1" onClick={() => copyText(savedPiAddress, 'Pi Deposit Address')}>📋 Copy Address</Btn></>
            : <p className="text-sm mt-2">PiCall Pi address (Pi Mainnet): <b className="text-gray-400">Not set up yet — ask the admin</b></p>}
          <label className="text-sm block mt-2">Amount of Pi Sent</label>
          <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={depAmount} onChange={e => setDepAmount(e.target.value)} placeholder="e.g. 5" />
          <label className="text-sm block mt-2">Transaction / Memo Reference</label>
          <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={depRef} onChange={e => setDepRef(e.target.value)} placeholder="e.g. PI-TX-..." />
          <Btn variant="green" className="w-full mt-3" onClick={doDeposit}>Confirm Deposit</Btn>
          {depMsg && <p className="text-sm mt-2">{depMsg}</p>}
          {piDeposits.length > 0 && <div className="mt-2">{piDeposits.map(d => <p key={d.id} className="text-sm text-gray-500">{formatPi(d.amount)} • {d.ref}{d.chain ? ` • ${d.chain}` : ''} • {d.date} • {d.status}</p>)}</div>}
          </>) : <p className="text-sm mt-2 text-gray-500">{PI_DEPOSIT_DISABLED_MESSAGE}</p>}
        </div>
        <div id="wallet-withdraw" className="mt-4 border-t pt-3">
          <p className="text-sm font-bold">Pi Withdraw</p>
          <p className="text-sm mt-2">Pi Chain: <b>Pi Mainnet (real Pi)</b></p>
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
        <div id="wallet-sendpi" className="mt-4 border-t pt-3">
          <p className="text-sm font-bold">Send Pi</p>
          <p className="text-sm mt-1">Send Pi to any user by their 6-digit UID — they get {100 - piTransferFeePct}%, {piTransferFeePct}% goes to the admin as a transfer fee. Only real Pi can be sent (bonus Pi cannot be transferred).</p>
          {!kycVerified ? (
            <p className="text-sm mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">Pi send needs approved KYC — complete Dating KYC first.</p>
          ) : (<>
            <label className="text-sm block mt-2">Recipient UID (6 digits)</label>
            <div className="flex gap-2 mt-1">
              <input className="flex-1 min-w-0 border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-600" value={trUid} onChange={e => { setTrUid(e.target.value.replace(/\D/g, '').slice(0, 6)); setTrFound(null); setTrConfirm(false); setTrMsg('') }} placeholder="e.g. 100001" inputMode="numeric" />
              <Btn onClick={doLookupUid} disabled={trLookupBusy}>{trLookupBusy ? 'Finding…' : 'Find'}</Btn>
            </div>
            {trLookupMsg && <p className="text-sm text-red-600 mt-2">{trLookupMsg}</p>}
            {trFound && (
              <div className="flex items-center gap-3 mt-3 border rounded-lg px-3 py-2">
                <Avatar photo={trFound.photo} name={trFound.displayName} color={trFound.colour} className="w-10 h-10" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{trFound.displayName}</p>
                  <p className="text-xs text-gray-400">{trFound.numericUid !== undefined ? `ID: ${trFound.numericUid}` : 'Friend'}</p>
                </div>
                <Btn variant="ghost" onClick={() => { setTrFound(null); setTrUid(''); setTrConfirm(false) }}>Change</Btn>
              </div>
            )}
            {friends.filter(f => !isBuddyId(f.id)).length > 0 && (<>
              <label className="text-sm block mt-3">Or pick a friend</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {friends.filter(f => !isBuddyId(f.id)).slice(0, 8).map(f => (
                  <button key={f.id} onClick={() => { setTrFound({ uid: f.id, displayName: f.name, colour: f.color, ...(f.photo ? { photo: f.photo } : {}), ...(f.numericUid !== undefined ? { numericUid: f.numericUid } : {}) }); setTrUid(f.numericUid !== undefined ? String(f.numericUid) : ''); setTrConfirm(false); setTrMsg('') }} className={`px-3 py-1.5 rounded-full text-sm border ${trFound?.uid === f.id ? 'bg-fb-blue text-white' : ''}`}>{f.name}{f.numericUid !== undefined ? ` (${f.numericUid})` : ''}</button>
                ))}
              </div>
            </>)}
            {trFound && (<>
              <label className="text-sm block mt-3">Amount (Pi)</label>
              <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={trAmount} onChange={e => { setTrAmount(e.target.value); setTrConfirm(false); setTrMsg('') }} placeholder={`Minimum ${formatPi(piMinTransfer)}`} />
              {(Number(trAmount) || 0) > 0 && (() => { const c = computeTransfer(Number(trAmount), piTransferFeePct); return <p className="text-sm mt-2">Send {formatPi(c.amount)} • Fee ({piTransferFeePct}%): {formatPi(c.fee)} • {trFound.displayName} gets {formatPi(c.net)}</p> })()}
              {trConfirm && trFound && (Number(trAmount) || 0) >= piMinTransfer && (() => { const c = computeTransfer(Number(trAmount), piTransferFeePct); return (
                <div className="mt-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-3">
                  <p className="text-sm font-bold">Confirm send to {trFound.displayName}{trFound.numericUid !== undefined ? ` (ID ${trFound.numericUid})` : ''}?</p>
                  <p className="text-sm mt-1">Send {formatPi(c.amount)} • Fee ({piTransferFeePct}%): {formatPi(c.fee)} • Receiver gets {formatPi(c.net)}</p>
                  <p className="text-xs text-gray-500 mt-1">Only your real Pi balance is used — bonus Pi is never sent.</p>
                </div>
              ) })()}
              <Btn variant="green" className="w-full mt-3" disabled={trBusy || !trFound || (Number(trAmount) || 0) < piMinTransfer} onClick={doSendPi}>{trBusy ? 'Sending…' : trConfirm ? 'Confirm Send' : 'Send Pi'}</Btn>
              {trConfirm && <Btn variant="ghost" className="w-full mt-2" onClick={() => setTrConfirm(false)}>Cancel</Btn>}
            </>)}
            {trMsg && <p className="text-sm mt-2">{trMsg}</p>}
          </>)}
        </div>
        <div id="wallet-request" className="mt-4 border-t pt-3">
          <p className="text-sm font-bold">Request Payment</p>
          <p className="text-sm mt-1">Ask any user for Pi by their 6-digit UID — when they pay, you get {100 - piTransferFeePct}% and {piTransferFeePct}% goes to the admin as a transfer fee. Minimum {formatPi(piMinTransfer)}.</p>
          <label className="text-sm block mt-2">Recipient UID (6 digits)</label>
          <div className="flex gap-2 mt-1">
            <input className="flex-1 min-w-0 border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-600" value={rqUid} onChange={e => { setRqUid(e.target.value.replace(/\D/g, '').slice(0, 6)); setRqFound(null); setRqMsg('') }} placeholder="e.g. 100001" inputMode="numeric" />
            <Btn onClick={doRqLookup} disabled={rqLookupBusy}>{rqLookupBusy ? 'Finding…' : 'Find'}</Btn>
          </div>
          {rqLookupMsg && <p className="text-sm text-red-600 mt-2">{rqLookupMsg}</p>}
          {rqFound && (
            <div className="flex items-center gap-3 mt-3 border rounded-lg px-3 py-2">
              <Avatar photo={rqFound.photo} name={rqFound.displayName} color={rqFound.colour} className="w-10 h-10" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{rqFound.displayName}</p>
                <p className="text-xs text-gray-400">{rqFound.numericUid !== undefined ? `ID: ${rqFound.numericUid}` : 'Friend'}</p>
              </div>
              <Btn variant="ghost" onClick={() => { setRqFound(null); setRqUid('') }}>Change</Btn>
            </div>
          )}
          {friends.filter(f => !isBuddyId(f.id)).length > 0 && (<>
            <label className="text-sm block mt-3">Or pick a friend</label>
            <div className="flex gap-2 flex-wrap mt-1">
              {friends.filter(f => !isBuddyId(f.id)).slice(0, 8).map(f => (
                <button key={f.id} onClick={() => { setRqFound({ uid: f.id, displayName: f.name, colour: f.color, ...(f.photo ? { photo: f.photo } : {}), ...(f.numericUid !== undefined ? { numericUid: f.numericUid } : {}) }); setRqUid(f.numericUid !== undefined ? String(f.numericUid) : ''); setRqMsg('') }} className={`px-3 py-1.5 rounded-full text-sm border ${rqFound?.uid === f.id ? 'bg-fb-blue text-white' : ''}`}>{f.name}{f.numericUid !== undefined ? ` (${f.numericUid})` : ''}</button>
              ))}
            </div>
          </>)}
          {rqFound && (<>
            <label className="text-sm block mt-3">Amount (Pi)</label>
            <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={rqAmount} onChange={e => { setRqAmount(e.target.value); setRqMsg('') }} placeholder={`Minimum ${formatPi(piMinTransfer)}`} />
            <label className="text-sm block mt-3">Note / reason (optional)</label>
            <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={rqNote} onChange={e => setRqNote(e.target.value)} placeholder="e.g. Payment for the call" maxLength={200} />
            <Btn variant="green" className="w-full mt-3" disabled={rqBusy || !rqFound || (Number(rqAmount) || 0) < piMinTransfer} onClick={doRequestPayment}>{rqBusy ? 'Sending…' : 'Send Request'}</Btn>
          </>)}
          {rqMsg && <p className="text-sm mt-2">{rqMsg}</p>}
        </div>
        <div id="wallet-requests" className="mt-4 border-t pt-3">
          <p className="text-sm font-bold">Payment Requests {pendingIncoming > 0 && <span className="ml-1 inline-block bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{pendingIncoming}</span>}</p>
          {paymentRequests.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No payment requests yet — ask someone for Pi above, or wait for a request to arrive here.</p>
          ) : (<>
            {incomingReqs.length > 0 && <p className="text-xs text-gray-500 mt-2">Incoming — people asking you for Pi:</p>}
            {incomingReqs.map(r => (
              <div key={r.id} className="flex items-start gap-3 mt-2 border rounded-lg px-3 py-2">
                <Avatar photo={r.fromPhoto} name={r.fromName} color="#7c3aed" className="w-10 h-10" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.fromName}{r.fromNumericUid !== undefined ? ` (ID ${r.fromNumericUid})` : ''}</p>
                  <p className="text-sm">asked for {formatPi(r.amount)}</p>
                  {r.note && <p className="text-xs text-gray-500">“{r.note}”</p>}
                  <p className="text-xs text-gray-400">{paymentRequestStatusLabel(r.status)}</p>
                  {payReqId === r.id && r.status === 'pending' && (() => { const c = computeTransfer(r.amount, piTransferFeePct); return (
                    <div className="mt-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-2">
                      <p className="text-sm font-bold">Pay {formatPi(c.amount)} to {r.fromName}?</p>
                      <p className="text-sm mt-1">Pay {formatPi(c.amount)} • Fee ({piTransferFeePct}%): {formatPi(c.fee)} • {r.fromName} gets {formatPi(c.net)}</p>
                      <p className="text-xs text-gray-500 mt-1">Only your real Pi balance is used — bonus Pi is never sent. Paying needs approved KYC.</p>
                    </div>
                  ) })()}
                </div>
                {r.status === 'pending' && (
                  <div className="flex flex-col gap-1 shrink-0">
                    {payReqId === r.id ? (
                      <><Btn variant="green" disabled={payBusy} onClick={() => doPayRequest(r)}>{payBusy ? 'Paying…' : 'Confirm Pay'}</Btn>
                      <Btn variant="ghost" onClick={() => setPayReqId('')}>Cancel</Btn></>
                    ) : (
                      <><Btn variant="green" disabled={rqActionBusy === r.id} onClick={() => { setPayReqId(r.id); setPayMsg('') }}>Pay</Btn>
                      <Btn variant="ghost" disabled={rqActionBusy === r.id} onClick={() => doDeclineRequest(r)}>Decline</Btn></>
                    )}
                  </div>
                )}
              </div>
            ))}
            {outgoingReqs.length > 0 && <p className="text-xs text-gray-500 mt-3">Sent by you:</p>}
            {outgoingReqs.map(r => (
              <div key={r.id} className="flex items-start gap-3 mt-2 border rounded-lg px-3 py-2">
                <Avatar photo={undefined} name={r.toName} color="#0ea5e9" className="w-10 h-10" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.toName}{r.toNumericUid !== undefined ? ` (ID ${r.toNumericUid})` : ''}</p>
                  <p className="text-sm">you asked for {formatPi(r.amount)}</p>
                  {r.note && <p className="text-xs text-gray-500">“{r.note}”</p>}
                  <p className="text-xs text-gray-400">{paymentRequestStatusLabel(r.status)}{r.status === 'paid' ? ` — you get ${formatPi(computeTransfer(r.amount, piTransferFeePct).net)}` : ''}</p>
                </div>
                {r.status === 'pending' && <Btn variant="ghost" disabled={rqActionBusy === r.id} onClick={() => doCancelRequest(r)}>Cancel</Btn>}
              </div>
            ))}
            {payMsg && <p className="text-sm mt-2">{payMsg}</p>}
          </>)}
        </div>
        <p className="text-xs text-gray-400 mt-3">Real Pi payments need the official Pi SDK + Pi app approval; no real blockchain transaction happens here, and no seed/private key is asked for or stored.</p>
      </Card>
      <div id="wallet-topup">
            <Card>
        <h2 className="font-bold flex items-center gap-2"><IconPlus className="w-5 h-5" /> Top Up</h2>
        {activeMethod === null ? (
          <p className="text-sm mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">{PAYMENTS_ALL_DISABLED_MESSAGE}</p>
        ) : (<>
        {!isUsdtAmount && <div className="flex gap-2 flex-wrap mt-3">{TOPUP_PACKS.map(p => <button key={p} onClick={() => setAmount(p)} className={`px-4 py-2 rounded-lg border font-bold ${amount === p ? 'bg-fb-blue text-white' : 'bg-gray-50 dark:bg-slate-800'}`}>{formatBDT(p)}</button>)}</div>}
        <label className="text-sm block mt-3">Amount ({isUsdtAmount ? 'USDT' : 'Tk'})</label>
        <input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={amount} onChange={e => setAmount(Number(e.target.value))} />
        {previewPi > 0 && <p className="text-sm mt-1 text-green-600 font-bold">≈ {formatPi(previewPi)} will get (auto){isUsdtAmount ? ` — Rate: 1 USDT = ${formatBDT(usdtRateBDT)}` : ` — Rate: 1 Pi = ${formatBDT(piRateBDT)}`}।</p>}
        <label className="text-sm block mt-3">Payment Method</label>
        <div className="flex gap-2 flex-wrap mt-1">{enabledMethods.map(m => <button key={m} onClick={() => setMethod(m)} className={`px-3 py-1.5 rounded-full text-sm border ${activeMethod === m ? 'bg-fb-blue text-white' : ''}`}>{m}</button>)}</div>
        <div className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-3">
          <p className="font-bold">Manual Payment — Steps:</p>
          <p>1. To the address below {isUsdtAmount ? `${amount || 0} USDT` : `${formatBDT(Number(amount) || 0)}`} Send.</p>
          <p>2. Below {isUsdt ? 'Transaction Hash' : isBinance ? 'Binance Pay reference' : 'TrxID'} Write and submit the request. Pi will be added after admin approval.</p>
        </div>
        {(activeMethod === 'bKash' || activeMethod === 'Nagad' || activeMethod === 'Rocket') && <div className="text-sm mt-3">
          {savedPayNumber
            ? <><p>{activeMethod} Number: <b>{savedPayNumber}</b></p>
              <Btn variant="ghost" className="mt-1" onClick={() => copyText(savedPayNumber, activeMethod)}>📋 Copy Number</Btn></>
            : <p>{activeMethod} Number: <b className="text-gray-400">Not set up yet — ask the admin</b></p>}
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
        </>)}
        {pendingList.length > 0 && <div className="mt-4">
          <p className="text-sm font-bold">⏳ Top-up under review — Pi will be added after admin approval.</p>
          {pendingList.map(t => <p key={t.id} className="text-sm mt-1">{t.method}{t.network ? ` (${t.network})` : ''} — {t.currency === 'USDT' ? `${t.amount} USDT → ${formatPi(topUpPi(t.amount, 'USDT', piRateBDT, usdtRateBDT))}` : `${formatBDT(t.amount)} → ${formatPi(topUpPi(t.amount, 'BDT', piRateBDT, usdtRateBDT))}`} • {t.trxId} • {t.date}</p>)}
        </div>}
        {doneList.length > 0 && <div className="mt-3">
          <p className="text-sm font-bold">Earlier Requests</p>
          {doneList.map(t => <p key={t.id} className="text-sm mt-1 text-gray-500">{t.method} — {t.currency === 'USDT' ? `${t.amount} USDT` : formatBDT(t.amount)} • {t.status === 'approved' ? '✅ Approved' : '❌ Rejected'} • {t.date}</p>)}
        </div>}
      </Card>
      </div>
            <PiReportCard />
      <DailyBonusCard />
      <InviteCard />
      <Card>
        <h2 className="font-bold">🔗 Affiliate & Referral</h2>
        <button onClick={shareAffiliateLink} className="text-sm mt-1 break-all text-left w-full" title="Tap to share your link">
          Your link: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{`${INVITE_BASE_URL}?ref=${referralCode}`}</code> <span className="text-violet-600 font-medium">↗️ Share</span>
        </button>
        {affiliateMsg && <p className="text-sm text-green-600 mt-2">{affiliateMsg}</p>}
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
  const { friends, requests, acceptRequest, declineRequest, sendFriendRequest, cancelFriendRequest, sentRequests, removeFriend, referralCode, numericUid, blockedUids, blockUser, unblockUser } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [showSugg, setShowSugg] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reqError, setReqError] = useState('')
  const searching = query.trim() !== ''
  // খোঁজার তালিকা: বন্ধু + People You May Know + চ্যাট পারসোনা + সব আসল ব্যবহারকারী
  // (নাম/আইডি দিয়ে ডুপ্লিকেট বাদ, নিজেকে বাদ)
  const { results, suggestions } = useAllUserSearch(friends, query)
  async function copyId() {
    try { await navigator.clipboard.writeText(String(numericUid ?? referralCode)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* কপি না হলে আইডিটা দেখেই নেওয়া যাবে */ }
  }
  // আসল ব্যবহারকারীকে রিকোয়েস্ট পাঠানো (পারসোনা হলে সাথে সাথে লোকাল বন্ধু —
  // sendFriendRequest-ই সেটা ঠিক করে); ব্যর্থ হলে বোতাম আগের মতোই থাকে।
  async function addFromSearch(p: SearchablePerson) {
    await sendFriendRequest({ id: p.id, name: p.name, color: p.color, online: true, ...(p.photo ? { photo: p.photo } : {}), ...(p.numericUid !== undefined ? { numericUid: p.numericUid } : {}) })
  }
  async function handleAccept(r: Friend) {
    const ok = await acceptRequest(r.requestId ?? r.id)
    setReqError(ok ? '' : 'Could not confirm the request — check your connection and try again.')
  }
  async function handleDecline(r: Friend) {
    const ok = await declineRequest(r.requestId ?? r.id)
    setReqError(ok ? '' : 'Could not decline the request — try again.')
  }
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold flex items-center gap-2"><IconFriends className="w-6 h-6" /> Friends</h1>
      <Card>
        <p className="text-sm">🪪 Your ID: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{numericUid ?? referralCode}</code> <Btn variant="ghost" onClick={copyId}>{copied ? '✅ Copied!' : '📋 Copy'}</Btn></p>
        <p className="text-xs text-gray-400 mt-1">Give this ID to friends — they can find you by this ID or your name.</p>
      </Card>
      <Card>
        <h2 className="font-bold flex items-center gap-2"><IconSearch className="w-5 h-5" /> Find Friends</h2>
        <div className="relative">
          <input className="w-full border rounded-full px-3 py-2 text-sm mt-2 dark:bg-slate-800 dark:border-slate-600" value={query} onChange={e => { setQuery(e.target.value); setShowSugg(true) }} onFocus={() => { if (query.trim()) setShowSugg(true) }} placeholder="Enter name or ID…" />
          {searching && showSugg && <SearchSuggestions suggestions={suggestions} onPick={p => { setQuery(p.name); setShowSugg(false) }} />}
        </div>
        <p className="text-xs text-gray-400 mt-1">Type a name to search by name, an ID to search by ID — all real users.</p>
      </Card>
      {/* বন্ধু রিকোয়েস্টের কার্ড সবসময় দেখায় — খুঁজতে থাকলেও (আগে খোঁজা
          চললে এই কার্ডটাই লুকিয়ে যেত, তাই আসা রিকোয়েস্ট চোখে পড়ত না)।
          রিকোয়েস্ট থাকলে কার্ডটা চোখে পড়ার মতো — বেগুনি বর্ডার + ব্যাজ। */}
      <Card className={requests.length > 0 ? 'border-2 border-[#7C3AED] bg-[#f5f0ff] dark:bg-[#2b2142]' : ''}>
        <h2 className="font-bold flex items-center gap-2">🔔 Friend Requests ({requests.length}){requests.length > 0 && <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-pi-gold text-white text-xs font-bold flex items-center justify-center">{requests.length > 9 ? '9+' : requests.length}</span>}</h2>
        {requests.length > 0 && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">New request — accept to become friends, then you can chat and call directly.</p>}
        {requests.length === 0 && <p className="text-sm text-gray-500 mt-1">No new requests.</p>}
        {reqError && <p className="text-sm text-red-600 mt-1">{reqError}</p>}
        {requests.map(r => (
          <div key={r.requestId ?? r.id} className="flex items-center gap-3 py-2">
            <Avatar photo={r.photo} name={r.name} color={r.color} className="w-10 h-10" />
            <span className="flex-1 min-w-0"><span className="font-medium block truncate">{r.name}</span>{r.numericUid !== undefined && <span className="block text-xs text-gray-400">ID: {r.numericUid}</span>}</span>
            <Btn onClick={() => handleAccept(r)}>Accept</Btn>
            <Btn variant="ghost" onClick={() => handleDecline(r)}>Decline</Btn>
          </div>
        ))}
      </Card>
      {searching ? (
        <Card>
          <h2 className="font-bold flex items-center gap-2"><IconSearch className="w-5 h-5" /> {results.length} people found</h2>
          {results.length === 0 && <p className="text-sm text-gray-500 mt-1">Nobody found — check whether the name or ID is correct.</p>}
          {results.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <Avatar photo={p.photo} name={p.name} color={p.color} className="w-10 h-10" />
              <span className="flex-1"><span className="font-medium">{p.name}</span><span className="block text-xs text-gray-400">ID: {p.numericUid ?? p.referralCode ?? '—'}{p.mutual ? ` • ${p.mutual} mutual friends` : ''}{p.online ? ' • ● Online' : ' • ○ Offline'}</span></span>
              {p.isFriend
                ? <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: p.name } })}><span className="flex items-center gap-1"><IconChat className="w-4 h-4" /> Chat</span></Btn>
                : sentRequests.some(s => s.toUid === p.id)
                  ? <Btn variant="ghost" onClick={() => cancelFriendRequest(p.id)}>Request Sent</Btn>
                  : <Btn onClick={() => addFromSearch(p)}>Add Friend</Btn>}
            </div>
          ))}
        </Card>
      ) : (
        <>
      <Card>
        <h2 className="font-bold">My Friends ({friends.length}) — Chat free, calls prepaid π 0.1/minute</h2>
        {friends.length === 0 && <p className="text-sm text-gray-500 mt-1">No friends yet — find and add friends.</p>}
        {friends.map(f => (
          <div key={f.id} className="flex items-center gap-3 py-2">
            <Avatar photo={f.photo} name={f.name} color={f.color} className="w-10 h-10" online={f.online} />
            <span className="flex-1 font-medium">{f.name} <span className="text-xs text-gray-400">{f.online ? '● Online' : '○ Offline'}{f.numericUid !== undefined ? ` • ID: ${f.numericUid}` : ''}</span></span>
            <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: f.name } })}>💬 Chat</Btn>
            {!blockedUids.includes(f.id) && <Btn variant="green" onClick={() => navigate(`/call/friend/${encodeURIComponent(f.name)}`)}>📞 Call</Btn>}
            {!isBuddyId(f.id) && (blockedUids.includes(f.id)
              ? <Btn variant="ghost" onClick={() => unblockUser(f.id)}>Unblock</Btn>
              : <Btn variant="ghost" onClick={() => blockUser(f.id, f.name)}>🚫 Block</Btn>)}
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
            {sentRequests.some(x => x.toUid === s.id)
              ? <Btn variant="ghost" onClick={() => cancelFriendRequest(s.id)}>Request Sent</Btn>
              : <Btn onClick={() => sendFriendRequest({ id: s.id, name: s.name, color: s.color, online: true })}>Add Friend</Btn>}
          </div>
        ))}
      </Card>
        </>
      )}
    </div>
  )
}

// ---------- সার্চের ফলের পেজ (Facebook-এর মতো — /search?q=…) ----------
// Enter বা "See all results"-এ এখানে আসে। ট্যাব: All / People / Posts /
// Groups & Pages। মানুষের সারিতে ছবি, নাম, ID (referralCode থাকলে — raw
// Firebase uid কখনো দেখায় না), mutual-friend সংখ্যা, অনলাইন; নামে ট্যাপ
// করলে তার প্রোফাইল খোলে, আর Add Friend / Request Sent / Chat বোতাম
// Friends পেজের মতোই কাজ করে। পোস্টে ট্যাপ করলে সেই পোস্টে যায়, গ্রুপ/
// পেজে ট্যাপ করলে তার পেজে যায়।
export function SearchResultsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { friends, posts, sendFriendRequest, cancelFriendRequest, sentRequests } = useStore()
  const q = params.get('q') ?? ''
  const [tab, setTab] = useState<'all' | 'people' | 'posts' | 'communities'>('all')
  const { results: people } = useAllUserSearch(friends, q)
  const postResults = useMemo(() => searchPosts(posts, q), [posts, q])
  const { results: communities } = useCommunitySearch(q)
  // নতুন কোয়েরিতে আবার All ট্যাব থেকে শুরু
  useEffect(() => { setTab('all') }, [q])
  async function addFromSearch(p: SearchablePerson) {
    await sendFriendRequest({ id: p.id, name: p.name, color: p.color, online: true, ...(p.photo ? { photo: p.photo } : {}), ...(p.numericUid !== undefined ? { numericUid: p.numericUid } : {}) })
  }
  function personRow(p: SearchablePerson) {
    return (
      <div key={p.id} className="flex items-center gap-3 py-2">
        <Avatar photo={p.photo} name={p.name} color={p.color} className="w-10 h-10" />
        <span className="flex-1 min-w-0">
          <button onClick={() => navigate(`/profile/${encodeURIComponent(p.id)}`)} className="font-medium hover:underline text-left block truncate">{p.name}</button>
          <span className="block text-xs text-gray-400 truncate">{(p.numericUid ?? p.referralCode) ? `ID: ${p.numericUid ?? p.referralCode}` : ''}{(p.numericUid ?? p.referralCode) && p.mutual ? ' • ' : ''}{p.mutual ? `${p.mutual} mutual friends` : ''}{((p.numericUid ?? p.referralCode) || p.mutual) ? (p.online ? ' • ● Online' : ' • ○ Offline') : (p.online ? '● Online' : '○ Offline')}</span>
        </span>
        {p.isFriend
          ? <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: p.name } })}><span className="flex items-center gap-1"><IconChat className="w-4 h-4" /> Chat</span></Btn>
          : sentRequests.some(s => s.toUid === p.id)
            ? <Btn variant="ghost" onClick={() => cancelFriendRequest(p.id)}>Request Sent</Btn>
            : <Btn onClick={() => addFromSearch(p)}>Add Friend</Btn>}
      </div>
    )
  }
  function postRow(p: { id: string; author: string; text: string }) {
    return (
      <button key={p.id} onClick={() => navigate('/feed', { state: { postId: p.id } })} className="block w-full text-left py-2 border-b dark:border-slate-700 last:border-0">
        <span className="font-medium text-sm block">{p.author}</span>
        <span className="block text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{p.text}</span>
      </button>
    )
  }
  function communityRow(item: { id: string; name: string; description: string; kind: 'group' | 'page'; memberCount?: number }) {
    return (
      <button key={`${item.kind}-${item.id}`} onClick={() => navigate(item.kind === 'group' ? `/groups/${encodeURIComponent(item.id)}` : `/pages/${encodeURIComponent(item.id)}`)} className="flex items-center gap-3 w-full text-left py-2">
        <span className="w-10 h-10 rounded-full bg-fb-blue/10 text-fb-blue grid place-items-center text-xs font-bold shrink-0">{item.kind === 'group' ? 'G' : 'P'}</span>
        <span className="flex-1 min-w-0"><span className="font-medium block truncate">{item.name}</span><span className="block text-xs text-gray-400 truncate">{item.kind === 'group' ? 'Group' : 'Page'}{item.memberCount !== undefined ? ` • ${item.memberCount} ${item.kind === 'group' ? 'members' : 'followers'}` : ''}{item.description ? ` • ${item.description}` : ''}</span></span>
      </button>
    )
  }
  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: people.length + postResults.length + communities.length },
    { key: 'people', label: 'People', count: people.length },
    { key: 'posts', label: 'Posts', count: postResults.length },
    { key: 'communities', label: 'Groups & Pages', count: communities.length },
  ]
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold flex items-center gap-2"><IconSearch className="w-6 h-6" /> Search results for “{q}”</h1>
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${tab === t.key ? 'bg-fb-blue text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>{t.label} ({t.count})</button>
        ))}
      </div>
      {q.trim() === '' && <Card><p className="text-sm text-gray-500">Type something in the search box above to search people, posts, groups and pages.</p></Card>}
      {q.trim() !== '' && tab === 'all' && (
        <>
          <Card>
            <div className="flex items-center justify-between"><h2 className="font-bold">People ({people.length})</h2>{people.length > 5 && <Btn variant="ghost" onClick={() => setTab('people')}>See all</Btn>}</div>
            {people.length === 0 && <p className="text-sm text-gray-500 mt-1">No people found.</p>}
            {people.slice(0, 5).map(personRow)}
          </Card>
          <Card>
            <div className="flex items-center justify-between"><h2 className="font-bold">Posts ({postResults.length})</h2>{postResults.length > 5 && <Btn variant="ghost" onClick={() => setTab('posts')}>See all</Btn>}</div>
            {postResults.length === 0 && <p className="text-sm text-gray-500 mt-1">No posts found.</p>}
            {postResults.slice(0, 5).map(postRow)}
          </Card>
          <Card>
            <div className="flex items-center justify-between"><h2 className="font-bold">Groups &amp; Pages ({communities.length})</h2>{communities.length > 5 && <Btn variant="ghost" onClick={() => setTab('communities')}>See all</Btn>}</div>
            {communities.length === 0 && <p className="text-sm text-gray-500 mt-1">No groups or pages found.</p>}
            {communities.slice(0, 5).map(communityRow)}
          </Card>
        </>
      )}
      {q.trim() !== '' && tab === 'people' && (
        <Card>
          <h2 className="font-bold">People ({people.length})</h2>
          {people.length === 0 && <p className="text-sm text-gray-500 mt-1">Nobody found — check whether the name or ID is correct.</p>}
          {people.map(personRow)}
        </Card>
      )}
      {q.trim() !== '' && tab === 'posts' && (
        <Card>
          <h2 className="font-bold">Posts ({postResults.length})</h2>
          {postResults.length === 0 && <p className="text-sm text-gray-500 mt-1">No posts found.</p>}
          {postResults.map(postRow)}
        </Card>
      )}
      {q.trim() !== '' && tab === 'communities' && (
        <Card>
          <h2 className="font-bold">Groups &amp; Pages ({communities.length})</h2>
          {communities.length === 0 && <p className="text-sm text-gray-500 mt-1">No groups or pages found.</p>}
          {communities.map(communityRow)}
        </Card>
      )}
    </div>
  )
}

// ---------- ব্যবহারকারীর প্রোফাইল পেজ (/profile/:id) ----------
// সার্চের ফল, চ্যাটের নাম, বন্ধু তালিকা থেকে এখানে আসা যায়। আসল ব্যবহারকারী
// হলে publicProfiles থেকে নাম/ছবি/ID দেখায় (raw Firebase uid কখনো নয় —
// শুধু referralCode থাকলে সেটাই ID); চ্যাট পারসোনা হলে তার প্রোফাইল ভিউ
// (about + Chat)। নিজের প্রোফাইল হলে নিজের ID + কপি + Edit profile।
// Add Friend / Request Sent / Chat / Call — Friends পেজের মতোই।
export function UserProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { uid, user, friends, sendFriendRequest, cancelFriendRequest, sentRequests, referralCode, numericUid, profilePhoto, blockedUids, blockUser, unblockUser } = useStore()
  const decodedId = id ? decodeURIComponent(id) : ''
  const buddy = decodedId ? getBuddy(decodedId) : undefined
  const [profiles, setProfiles] = useState<NewMember[] | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (buddy) return
    let cancelled = false
    fetchAllPublicProfiles(100).then(list => { if (!cancelled) setProfiles(list) })
    return () => { cancelled = true }
  }, [buddy])
  const profile = !buddy && profiles ? profiles.find(p => p.id === decodedId) : undefined
  const isSelf = !!uid && decodedId === uid
  const friend = friends.find(f => f.id === decodedId)
  const isFriend = !!friend
  const isBlocked = blockedUids.includes(decodedId)
  async function addFriend() {
    const target = buddy
      ? { id: buddy.id, name: buddy.name, color: buddy.color, online: buddy.online }
      : profile
        ? { id: profile.id, name: profile.displayName, color: profile.colour, online: true, ...(profile.photo ? { photo: profile.photo } : {}) }
        : null
    if (target) await sendFriendRequest(target)
  }
  async function copyId() {
    try { await navigator.clipboard.writeText(String(numericUid ?? referralCode)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* কপি না হলে আইডিটা দেখেই নেওয়া যাবে */ }
  }
  const name = buddy?.name ?? profile?.displayName ?? (isSelf ? (user?.name || 'You') : '')
  const color = buddy?.color ?? profile?.colour ?? colourForUid(decodedId)
  const photo = buddy ? undefined : (isSelf ? (profilePhoto || profile?.photo) : profile?.photo)
  const showId = buddy ? buddy.id : (isSelf ? String(numericUid ?? referralCode) : (profile?.numericUid !== undefined ? String(profile.numericUid) : (profile?.referralCode ?? '')))
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-sm px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 font-medium">← Back</button>
      {!buddy && !profile && !isSelf && profiles === null && (
        <Card><p className="text-sm text-gray-500">Loading profile…</p></Card>
      )}
      {!buddy && !profile && !isSelf && profiles !== null && (
        <Card>
          <p className="font-bold text-lg">This user could not be found.</p>
          <p className="text-sm text-gray-500 mt-1">The profile may have been removed, or the link is wrong.</p>
          <Btn className="mt-3" onClick={() => navigate('/feed')}>Back to Feed</Btn>
        </Card>
      )}
      {(buddy || profile || isSelf) && (
        <Card>
          <div className="flex items-center gap-3">
            <Avatar photo={photo} name={name} color={color} className="w-16 h-16 text-2xl" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg truncate">{name}</p>
              {buddy && <p className="text-sm text-gray-500">{buddy.about}</p>}
              {profile?.district && <p className="text-sm text-gray-500">{profile.district}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{buddy ? 'Chat friend' : isSelf ? 'Your profile' : 'PiCall user'}{!buddy && showId ? ` • ID: ${showId}` : ''}{buddy ? ` • ID: ${buddy.id}` : ''}{friend ? (friend.online ? ' • ● Online' : ' • ○ Offline') : ''}</p>
            </div>
          </div>
          {isSelf && (
            <div className="mt-3">
              <p className="text-sm">🪪 Your ID: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{numericUid ?? referralCode}</code> <Btn variant="ghost" onClick={copyId}>{copied ? '✅ Copied!' : '📋 Copy'}</Btn></p>
              <Btn variant="ghost" className="mt-2" onClick={() => navigate('/menu')}>Edit profile</Btn>
            </div>
          )}
          {!isSelf && (
            <div className="flex flex-wrap gap-2 mt-4">
              {isFriend
                ? <Btn variant="ghost" onClick={() => navigate('/chat', { state: { with: name } })}>💬 Chat</Btn>
                : sentRequests.some(s => s.toUid === decodedId)
                  ? <Btn variant="ghost" onClick={() => cancelFriendRequest(decodedId)}>Request Sent</Btn>
                  : <Btn onClick={addFriend}>Add Friend</Btn>}
              {isFriend && !buddy && !isBlocked && <Btn variant="green" onClick={() => navigate(`/call/friend/${encodeURIComponent(name)}`)}>📞 Call</Btn>}
              {!buddy && !isSelf && (isBlocked
                ? <Btn variant="ghost" onClick={() => unblockUser(decodedId)}>Unblock</Btn>
                : <Btn variant="ghost" onClick={() => blockUser(decodedId, name)}>🚫 Block</Btn>)}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ---------- Chat (free, contact-ban) ----------
export function ChatPage() {
  const { user, friends, addFriend, soundSettings, setSoundSettings, uid, recordDatingChat, blockedUids, blockUser, unblockUser, isBanned, calls, ringingCall, markMissedCallsSeen } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // ডিফল্ট চ্যাট: প্রথম বন্ধু (সাধারণত রিমা) — সরানো ডেমো নাম কখনো ডিফল্ট হবে না
  const [active, setActive] = useState(() => friends[0]?.name ?? 'Rima')
  // চ্যাট localStorage-এ থাকে — বন্ধুদের সাথে কথোপকথন রিফ্রেশের পরেও থাকে
  // বন্ধুরা নিজে থেকে প্রথমে লেখে না — চ্যাট খালি দিয়ে শুরু, ব্যবহারকারী লিখলেই উত্তর আসে
  const [msgs, setMsgs] = useState<Record<string, { from: string; text: string; fsId?: string; localOnly?: boolean }[]>>(() => {
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
  // চ্যাট প্রথমে তালিকা দেখায় — নতুন করে /chat খুললে কথোপকথন নয়, ব্যবহারকারীর
  // তালিকা। {with} টার্গেট থাকলে (বন্ধু/ডেটিং থেকে) সেই কথোপকথন সরাসরি খোলে।
  // পুশ ট্যাপেও (?with=<নাম>&peer=<uid>) একইভাবে খোলে।
  const [showList, setShowList] = useState(() => {
    const st = location.state as { with?: string } | null
    const withParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('with') : null
    return !(st?.with ?? withParam)
  })
  // আসল বন্ধুর মেসেজ সার্ভারে না পৌঁছালে চুপচাপ লোকালেই থেকে যায় — সেটা যেন
  // ব্যবহারকারী দেখতে পান (আগে কোনো চিহ্ন ছাড়াই শুধু এই ডিভাইসে থাকত)।
  const [sendFailed, setSendFailed] = useState(false)
  // অন্য ডিভাইস থেকে আসা চ্যাট — প্রাপক এখনো বন্ধু হিসেবে যোগ না করলেও রুমটা
  // এখানে দেখায়, যাতে মেসেজটা খুলে পড়া/উত্তর দেওয়া যায়।
  const [roomSummaries, setRoomSummaries] = useState<ChatRoomSummary[]>([])
  // কে লিখছে (প্রতি বন্ধুর জন্য আলাদা) — উত্তর আসার ১–৩ সেকেন্ড আগে "লিখছে…" দেখায়
  const [typing, setTyping] = useState<Record<string, boolean>>({})
  const typingTimersRef = useRef<number[]>([])
  const lastReplyRef = useRef<Record<string, string>>({})
  const lastFunRef = useRef<Record<string, boolean>>({})
  // খোলা চ্যাটে সবচেয়ে নতুন মেসেজ দেখা যায় — খুললেই নিচে, নতুন মেসেজ এলেও নিচে।
  const msgListRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = msgListRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [active, msgs, showList])
  // তালিকা থেকে চ্যাট খুললে হিস্ট্রিতে এন্ট্রি পুশ হয় — সিস্টেম ব্যাক
  // (হার্ডওয়্যার/ব্রাউজার) তখন তালিকায় ফেরে; সরাসরি {with} দিয়ে এলে
  // নিচে তালিকার এন্ট্রি নেই।
  const openedFromListRef = useRef(false)
  // ব্লক তালিকা — সাবস্ক্রিপশনের কলব্যাকে সবসময় তাজা মান লাগে
  const blockedUidsRef = useRef<string[]>(blockedUids)
  useEffect(() => { blockedUidsRef.current = blockedUids }, [blockedUids])
  // ডেটিং থেকে আসা চ্যাট — ম্যাচ কার্ডের "Send message" থেকে partnerId আসে;
  // প্রথম মেসেজ পাঠালেই ওই মানুষটা ডেটিং চ্যাটের হিসাবে ধরা হয় (৫ জন হলে KYC)।
  const datingPartnerIdRef = useRef<string | null>(null)
  // Friends পেজ থেকে কোনো বন্ধুর চ্যাটে এলে সেই চ্যাটটাই খুলে যায় (শুধু আসল বন্ধুর নামে)
  // ডেটিং ম্যাচ থেকে এলে (datingPartnerId) ওই মানুষটা বন্ধু তালিকায় না থাকলে
  // এখনই যোগ হয় — নইলে activeFriend মেলে না, roomId null থাকে আর প্রথম
  // মেসেজটা Firestore-এ না গিয়ে শুধু এই ডিভাইসেই থেকে যেত।
  // সার্ভিস প্রোভাইডার থেকেও একইভাবে (peerId) — তবে datingPartnerId নয়,
  // তাই ডেটিং-চ্যাটের KYC-গোনায় (৫ জন) ধরা হয় না। পুশ নোটিফিকেশন ট্যাপে
  // (/chat?with=<নাম>&peer=<uid>) URL দিয়েই একইভাবে খোলে।
  // হিস্ট্রি ব্যাক করে তালিকার এন্ট্রিতে ফিরলে (state-এ with নেই) তালিকা দেখায়।
  useEffect(() => {
    const st = location.state as { with?: string; draft?: string; datingPartnerId?: string; peerId?: string } | null
    const withName = st?.with ?? params.get('with') ?? undefined
    const peerId = st?.peerId ?? st?.datingPartnerId ?? params.get('peer') ?? undefined
    if (withName && friends.some(f => f.name === withName)) { setActive(withName); setShowList(false) }
    else if (withName && peerId) {
      addFriend({ id: peerId, name: withName, color: colourForUid(peerId), online: true })
      setActive(withName)
      setShowList(false)
    }
    else if (!withName) { setShowList(true) }
    if (st?.draft) setDraft(st.draft)
    datingPartnerIdRef.current = st?.datingPartnerId ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, params])
  // থ্রেড খুললেই ওই মানুষটার মিসড কল "দেখা" হয় — ব্যাজ সরে যায় (কার্ডটা
  // হিস্ট্রিতে থেকেই যায়)
  useEffect(() => {
    if (!showList) markMissedCallsSeen(friends.find(f => f.name === active)?.id ?? active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, showList])
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
      // ব্লক করা পাঠকের নতুন মেসেজ আর ঢোকে না (পুরোনো ইতিহাস থাকে)
      const fresh = filterBlockedMessages(list.filter(m => !knownFsIdsRef.current.has(m.id)), blockedUidsRef.current)
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
  // রুম বদলালে আগের "পাঠানো যায়নি" চিহ্ন মুছে যায়
  useEffect(() => { setSendFailed(false) }, [roomId])
  // আমার রুমগুলো — কেউ আমাকে মেসেজ পাঠালে রুমটা এখানে দেখায়, এমনকি আমি
  // তাকে এখনো বন্ধু হিসেবে যোগ না করলেও। নইলে প্রাপকের কাছে রুম খোলার কোনো
  // পথই থাকত না (চ্যাট তালিকায় শুধু বন্ধুরাই থাকে)।
  // ব্লক করা পাঠকের রুম তালিকায় আসে না (incoming-ই ফিল্টার করা)।
  useEffect(() => {
    if (!uid) { setRoomSummaries([]); return }
    const unsub = subscribeMyChatRooms(uid, (rooms) => { setRoomSummaries(rooms) })
    return () => { if (unsub) unsub() }
  }, [uid])
  const incoming = useMemo(() => {
    if (!uid) return []
    const knownIds = new Set(friends.map(f => f.id))
    return filterBlockedRooms(
      roomSummaries.filter(r => r.otherUid !== uid && !knownIds.has(r.otherUid) && !isBuddyId(r.otherUid)),
      blockedUids,
    )
  }, [roomSummaries, friends, uid, blockedUids])
  // ওই ব্যবহারকারী আমাকে ব্লক করেছেন কি না — শেয়ার করা রুম ডকের blockedBy থেকে
  const blockedByThem = !!activeFriend && !!roomId && (roomSummaries.find(r => r.roomId === roomId)?.blockedBy?.includes(activeFriend.id) ?? false)
  const iBlockedThem = !!activeFriend && blockedUids.includes(activeFriend.id)
  function send() {
    // ব্লক করা ব্যবহারকারীকে মেসেজ যায় না; যিনি আমাকে ব্লক করেছেন, তাঁকেও নয় —
    // মেসেজটা সার্ভারে গিয়ে অদৃশ্য হয়ে যাওয়ার চেয়ে এখানেই আটকানো ভালো।
    if (iBlockedThem || blockedByThem) return
    // ব্যান হওয়া অ্যাকাউন্টে মেসেজ যায় না (ব্যান-স্ক্রিনের পাশাপাশি এখানেও গেট)
    if (isBanned) { setBan('Your account is banned — messaging is blocked.'); return }
    const err = contactBanCheck(draft)
    if (err) { setBan(err + ' Repeated attempts will raise more warnings.'); setWarn(w => w + 1); return }
    if (!draft.trim()) return
    const text = draft
    const to = active
    setDraft(''); setBan('')
    // ডেটিং চ্যাটের হিসাব — এই চ্যাটটা ডেটিং থেকে খোলা হলে প্রথম মেসেজেই
    // ওই মানুষটা গোনা হয় (একই মানুষ বারবার গোনা হয় না)।
    if (datingPartnerIdRef.current) recordDatingChat(datingPartnerIdRef.current)
    // আসল বন্ধু — Firestore-এ লিখি; সাবস্ক্রিপশন থেকেই মেসেজ ফিরে এসে দেখাবে।
    // সার্ভারে না পৌঁছালে মেসেজ শুধু এই ডিভাইসে থাকে — সেটা চিহ্নসহ দেখাই,
    // যাতে ব্যবহারকারী ভুল করে না ভাবেন মেসেজটা পৌঁছে গেছে।
    if (isRealUser && roomId && uid) {
      sendChatMessage(roomId, uid, user?.name || 'You', text).then(ok => {
        if (!ok) {
          setSendFailed(true)
          setMsgs(m => ({ ...m, [to]: [...(m[to] || []), { from: user?.name || 'You', text, localOnly: true }] }))
        } else {
          setSendFailed(false)
          // মেসেঞ্জারের মতো পুশ — প্রাপকের অ্যাপ বন্ধ থাকলেও নাম + ঝলকসহ
          // নোটিফিকেশন যায়; ট্যাপে সরাসরি এই চ্যাট খোলে। ব্লক করা
          // প্রাপককে মেসেজই যায় না (উপরে send()-এর গেট), তাই পুশও যায় না।
          const toUid = otherRoomMember(roomId, uid)
          if (toUid) void triggerMessagePush({ toUid, fromName: user?.name || 'You', preview: text.slice(0, 100), roomId })
        }
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
  const contacts = friends
  // এই চ্যাটটা কি আসল মানুষের সাথে — আর মেসেজ কি আদৌ অন্য ডিভাইসে পৌঁছাবে?
  // ৫ চ্যাট পারসোনা আগের মতোই লোকাল (তারাই উত্তর দেয়)। আসল বন্ধুর চ্যাটে
  // Firebase লগইন (Google/ইমেইল লিংক) ছাড়া কোনো UID থাকে না — OTP লগইনে
  // মেসেজ শুধু এই ডিভাইসেই থাকে, সেটা এখানে স্পষ্ট করে জানানো হয়।
  const isBuddyChat = !activeFriend || isBuddyId(activeFriend.id)
  const chatSyncBlocked = !isBuddyChat && (!uid || !isFirebaseConfigured)
  function openChat(name: string) {
    openedFromListRef.current = true
    setActive(name)
    setShowList(false)
    datingPartnerIdRef.current = null
    // তালিকা থেকে খোলা — হিস্ট্রিতে এন্ট্রি পুশ হয়, যাতে সিস্টেম ব্যাক তালিকায় ফেরে
    navigate('/chat', { state: { with: name } })
  }
  function backToList() {
    // তালিকা থেকে খোলা চ্যাট হলে হিস্ট্রি ব্যাক — নিচের তালিকার এন্ট্রিতেই ফেরে।
    // সরাসরি {with} দিয়ে এলে নিচে তালিকা নেই — এই এন্ট্রিটাই তালিকা দিয়ে বদলে যায়।
    if (openedFromListRef.current) navigate(-1)
    else navigate('/chat', { replace: true })
    openedFromListRef.current = false
    setShowList(true)
  }
  // চ্যাটের নামে ট্যাপ করলে তার প্রোফাইল খোলে (আসল ব্যবহারকারী হলে public
  // প্রোফাইল, পারসোনা হলে তার প্রোফাইল ভিউ) — পূর্ণ-পর্দা চ্যাট বা ব্যাক-ধাপ
  // ভাঙে না: প্রোফাইল নতুন হিস্ট্রি এন্ট্রি, সিস্টেম ব্যাক চ্যাটেই ফেরে।
  function openProfile() {
    if (activeFriend) navigate(`/profile/${encodeURIComponent(activeFriend.id)}`)
  }
  function openIncoming(room: ChatRoomSummary) {
    addFriend({ id: room.otherUid, name: room.otherName, color: colourForUid(room.otherUid), online: true })
    openChat(room.otherName)
  }
  // তালিকা — শুধু "All chats"-এ ফিরলেই দেখায়; চ্যাট খোলা থাকলে শুধু চ্যাটটাই
  // পূর্ণ পর্দায় থাকে (আগে মোবাইলে তালিকাটা চ্যাটের উপরে, কম্পিউটারে পাশে থাকত)।
  if (showList) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <h2 className="font-bold mb-2 flex items-center gap-2"><IconChat className="w-5 h-5" /> Chat — completely free</h2>
          {/* চ্যাট সাউন্ড চালু/বন্ধ — একই টগল মোবাইল ও কম্পিউটারে, মেনুর সেটিংসের সাথে এক */}
          <button onClick={() => setSoundSettings({ chatSound: !soundSettings.chatSound })} className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-700 font-medium mb-2">{soundSettings.chatSound ? 'Sound on — tap to turn off' : 'Sound off — tap to turn on'}</button>
          {incoming.length > 0 && (
            <>
              <p className="text-sm font-bold mt-2">New chats</p>
              {incoming.map(r => (
                <button key={r.roomId} onClick={() => openIncoming(r)} className="block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-800"><b>{r.otherName}</b> <span className="text-xs text-green-600 font-bold"> • New message</span></button>
              ))}
            </>
          )}
          {contacts.length === 0 && incoming.length === 0 && <p className="text-sm text-gray-500">No friends yet — add friends.</p>}
          {contacts.map(f => {
            const thread = msgs[f.name] || []
            const last = thread[thread.length - 1]
            const canCall = !!uid && !isBuddyId(f.id) && f.id !== uid && !blockedUids.includes(f.id)
            return (
              <div key={f.id} className={`flex items-center gap-1 rounded-lg text-sm ${active === f.name ? 'bg-violet-50 dark:bg-slate-700' : ''}`}>
                <button onClick={() => openChat(f.name)} className="flex items-center gap-2 flex-1 min-w-0 text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"><Avatar photo={f.photo} name={f.name} color={f.color} className="w-8 h-8 text-sm shrink-0" online={f.online} /><span className="flex-1 min-w-0"><span className={`block truncate ${active === f.name ? 'font-bold' : ''}`}>{f.name}</span><span className="block text-xs text-gray-400 truncate">{last ? `${last.from}: ${last.text}` : 'No messages yet'}</span></span></button>
                {canCall && <button onClick={() => navigate(`/call/friend/${encodeURIComponent(f.name)}`)} className="shrink-0 px-2 py-1.5 mr-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-bold" title={`Call ${f.name}`}>📞</button>}
              </div>
            )
          })}
          <p className="text-xs text-gray-400 mt-3">Phone numbers, WhatsApp/Facebook/Telegram links or emails cannot be shared — they will be blocked automatically.</p>
          {warn > 0 && <p className="text-xs text-red-500 mt-1">Warning: {warn} times the rules were tried to be broken.</p>}
        </Card>
      </div>
    )
  }
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="flex items-center gap-2">
          <button onClick={backToList} className="text-sm px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 font-medium shrink-0">← All chats</button>
          <h2 className="font-bold flex-1 flex items-center gap-2 min-w-0">{activeFriend && <Avatar photo={activeFriend.photo} name={activeFriend.name} color={activeFriend.color} className="w-9 h-9 shrink-0" online={activeFriend.online} />}<button onClick={openProfile} className="truncate text-left hover:underline" title={`View ${active}'s profile`}>{active}</button></h2>
          {isRealUser && !iBlockedThem && !blockedByThem && (
            <button onClick={() => navigate(`/call/friend/${encodeURIComponent(active)}`)} className="shrink-0 px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-bold" title={`Call ${active}`}>📞 Call</button>
          )}
          {isRealUser && !iBlockedThem && activeFriend && (
            <button onClick={() => blockUser(activeFriend.id, activeFriend.name)} className="shrink-0 px-2 py-1.5 rounded-full bg-gray-100 dark:bg-slate-700 text-xs font-medium" title={`Block ${active}`}>🚫 Block</button>
          )}
          {isRealUser && iBlockedThem && activeFriend && (
            <button onClick={() => unblockUser(activeFriend.id)} className="shrink-0 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-700 text-xs font-bold">Unblock</button>
          )}
        </div>
        {chatSyncBlocked && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-3 py-2 mt-2">Messages in this chat stay on this device only — log in with Google or an email link so they reach {active}.</p>
        )}
        {sendFailed && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 mt-2">The last message could not be sent — it stays on this device only.</p>
        )}
        {iBlockedThem && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-3 py-2 mt-2">You blocked {active} — they cannot message or call you. Unblock above to talk again.</p>
        )}
        {blockedByThem && !iBlockedThem && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 mt-2">{active} is not accepting messages or calls from you right now.</p>
        )}
        {ringingCall && activeFriend && (ringingCall.peerId === activeFriend.id || ringingCall.peerName === active) && (
          <p className="text-xs font-medium text-violet-600 bg-violet-50 dark:bg-violet-900/30 rounded-lg px-3 py-2 mt-2">📞 Calling {active}… waiting for an answer</p>
        )}
        {missedCallsOf(calls, activeFriend?.id ?? active).map(m => (
          <div key={m.id} className="flex items-center justify-between gap-2 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 mt-2">
            <p className="text-sm"><b>📞 Missed call</b> from {m.name} <span className="text-gray-400">• {m.time}</span></p>
            <button
              onClick={() => navigate(m.type === 'Dating' && m.peerId ? `/call/dating/${m.peerId}` : m.type === 'Service' && m.peerId ? `/call/service/${m.peerId}` : m.type === 'Expert' && m.peerId ? `/call/expert/${m.peerId}` : `/call/friend/${encodeURIComponent(m.name)}`)}
              className="shrink-0 text-sm font-bold text-white bg-green-600 rounded-full px-3 py-1.5"
            >📞 Call back</button>
          </div>
        ))}
        <div ref={msgListRef} className="h-64 overflow-y-auto space-y-2 mt-3">
          {(msgs[active] || []).map((m, i) => (
            <div key={i} className={`text-sm px-3 py-2 rounded-[17px] max-w-[80%] ${m.from === (user?.name || 'You') ? 'bg-pi-purple text-white ml-auto rounded-br-[5px]' : 'bg-white dark:bg-[#211a30] border border-[#e7e0f2] dark:border-[#372b52] rounded-bl-[5px]'}`}>
              <p>{m.from === (user?.name || 'You') ? <b>{m.from}:</b> : <button onClick={openProfile} className="font-bold hover:underline" title={`View ${m.from}'s profile`}>{m.from}:</button>} {m.text}</p>
              {m.localOnly && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Only on this device — not sent</p>}
            </div>
          ))}
          {(msgs[active] || []).length === 0 && !typing[active] && <p className="text-sm text-gray-400 px-3 py-2">No messages yet — write the first message.</p>}
          {typing[active] && <p className="text-sm text-gray-400 italic px-3 py-2">{active} typing…</p>}
        </div>
        {ban && <p className="text-sm text-red-500 mt-2">{ban}</p>}
        {iBlockedThem || blockedByThem ? (
          <p className="text-sm text-gray-400 mt-3 text-center">Messaging is off for this chat.</p>
        ) : (
          <div className="flex gap-2 mt-3">
            <input className="flex-1 border rounded-full px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Write a message… (chat is free)" />
            <button onClick={send} className="w-11 h-11 rounded-full bg-pi-purple text-white grid place-items-center shrink-0" title="Send"><IconSend className="w-5 h-5" /><span className="sr-only">Send</span></button>
          </div>
        )}
      </Card>
    </div>
  )
}

// ---------- ডেটিং KYC (একবারই) ----------
// প্রগ্রেসিভ KYC — ডেটিং প্রথমে খোলা; ৫ জন আলাদা মানুষের সাথে চ্যাট করলে KYC
// বাধ্যতামূলক হয়। সম্পন্ন হলে আর কখনো চাওয়া হয় না।
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
  const { submitKyc: submitKycToStore, kycStatus, kycInfo, kycRejectReason, resetKyc, datingKycRequired } = useStore()
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
  // রেকর্ডিং চললে অটো-আপডেটের রিলোড থামে — appUpdate.ts এই ফ্ল্যাগ দেখে
  // সুইচ পিছিয়ে দেয় (রেকর্ডিং শেষ হলে ফ্ল্যাগ নামে, পরের চেকে সুইচ হয়)।
  useEffect(() => {
    (window as unknown as { __picallRecording?: boolean }).__picallRecording = recording
    return () => { (window as unknown as { __picallRecording?: boolean }).__picallRecording = false }
  }, [recording])
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
        setVideoNote('Live video could not be captured — verification will use only the selfie photo.')
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    } else {
      setVideoNote('Live video could not be captured — verification will use only the selfie photo.')
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
      <h1 className="text-xl font-bold text-center flex items-center justify-center gap-2"><IconShield className="w-6 h-6" /> Dating KYC — Do It Once Only</h1>
      <p className="text-sm text-gray-500 mt-2 text-center">{datingKycRequired ? `You've chatted with ${DATING_KYC_CHAT_LIMIT} people in Dating — to keep Dating safe and real (18+ only), please complete KYC once. Until it's approved, new matches, chats and calls in Dating are paused.` : 'To see anything in Dating, you must first complete live KYC. Without KYC, you will see no Dating profiles, lives or calls.'}</p>
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
          <p className="text-xs text-gray-400 mt-1">Take your live photo with the front camera. Photo and video are kept for verification only. They are not shared with other users and are not uploaded anywhere (they stay only on this device).</p>
          {!captured && <video ref={videoRef} className="w-full aspect-[3/4] bg-black rounded-xl mt-3 object-cover" autoPlay playsInline muted />}
          {captured && <img src={captured} alt="Live Selfie" className="w-full aspect-[3/4] object-cover rounded-xl mt-3" />}
          {recording && <p className="text-sm text-red-500 mt-2 font-medium">⏳ Please wait ~3 seconds</p>}
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

// ৫ জন আলাদা মানুষের সাথে ডেটিংয়ে চ্যাট করার পর KYC বাধ্যতামূলক হলে ডেটিংয়ের
// ভেতরের রুটগুলোতে (সরাসরি লিংকেও) এই স্ক্রিন দেখাবে
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
            <h1 className="text-xl font-bold">🔒 KYC needed to continue Dating</h1>
            <p className="text-sm text-gray-300 mt-2">{`You've chatted with ${DATING_KYC_CHAT_LIMIT} people in Dating — to keep Dating safe and real (18+ only), please complete KYC once. Until it's approved, new matches, chats and calls in Dating are paused.`}</p>
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
  const { likesUsed, useLike, premium, setPremium, totalPi, addPi, datingRate, liveRate, liveEarnings, datingKycRequired, claimReferralBonus, district: myDistrict, interests: myInterests, uid } = useStore()
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
  // প্রগ্রেসিভ KYC — ডেটিং প্রথমে খোলা; ৫ জন আলাদা মানুষের সাথে চ্যাট করলে
  // KYC বাধ্যতামূলক হয় (নতুন ম্যাচ/চ্যাট/কল বন্ধ, অনুমোদন পেলে আবার খুলবে)।
  // অনুমোদনের পর ডেটিংয়ে ঢুকলে আটকে থাকা রেফারেল বোনাস থাকলে সেটাও দাবি হয়।
  if (datingKycRequired || kycSuccess) {
    return <KycPage onComplete={() => setKycSuccess(true)} onEnter={() => { claimReferralBonus(); setKycSuccess(false) }} />
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
                  <span className="relative w-12 h-12 shrink-0">
                    <Avatar photo={candidates.find(c => c.displayName === r.hostName)?.photo} name={r.hostName} color="#7C3AED" className="w-12 h-12 text-xl" />
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
          <Btn className="!bg-white !text-pink-600 font-bold" onClick={() => navigate('/chat', { state: { with: matched, draft: matchMsg, datingPartnerId: matchedId } })}>💬 Send message</Btn>
          <Btn variant="green" onClick={() => navigate(`/call/dating/${matchedId}`)}>📹 Video Call (Prepaid)</Btn>
        </div>
        <p className="text-xs mt-2 opacity-80">💳 Video call prepaid — {formatPi(datingRate)}/minute, only the caller's Pi will be cut. This call, like other calls, is covered by admin-only recording.</p>
      </Card>}
      <div className="grid sm:grid-cols-2 gap-3">
        {sortedCandidates.filter(p => !dismissed[p.id]).length === 0 && (
          <div className="col-span-2 rounded-[20px] border border-[#e7e0f2] dark:border-[#372b52] p-5 text-center">
            <p className="font-bold text-lg">💛 No profiles yet</p>
            <p className="text-sm text-gray-500 mt-1">Real people only — no fake profiles here. Complete your Dating profile and invite friends to join; new profiles appear here as soon as they sign up.</p>
            <p className="text-xs text-gray-400 mt-2">18+ only • KYC verified before calls and withdrawals</p>
            <Btn className="mt-3" onClick={() => navigate('/menu')}>Complete my profile</Btn>
          </div>
        )}
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
  const { totalPi, addPi, liveRate, user, datingKycRequired, recordShare, addGiftsSent, spendGiftPi, soundSettings } = useStore()
  const navigate = useNavigate()
  // ডেমো হোস্ট সরানো — শুধু আসল রুম (PiCall লাইভ সার্ভার) দেখাবে
  const [realRoom, setRealRoom] = useState<LiveRoom | null>(null)
  const [roomLookupDone, setRoomLookupDone] = useState(false)
  const host = realRoom ? { id: realRoom.id, name: realRoom.hostName, age: 0, city: '', about: 'Live now', color: '#E91E63' } : undefined
  // Host photo — the live server only sends hostName, so resolve the photo
  // from publicProfiles by display name (same source Dating cards use).
  const [hostPhoto, setHostPhoto] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!host) return
    let alive = true
    fetchAllPublicProfiles(100).then(list => { if (alive) setHostPhoto(list.find(m => m.displayName === host.name)?.photo) }).catch(() => { /* initials */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host?.name])
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

  // প্রগ্রেসিভ KYC — ৫ চ্যাটের পর KYC বাধ্যতামূলক হলে সরাসরি লিংকেও ডেটিং লাইভ দেখা যাবে না
  if (datingKycRequired) {
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
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>Buy Pi</Btn>
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
            <p>Your Pi: <b>{formatPi(totalPi)}</b> — you need Pi to send gifts on live.</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">🔴 This live too is covered by admin-only recording — only the admin can view it for appeals/disputes. {realRoom ? '🟢 Live server connected — real broadcast.' : 'Live server not connected — check your connection and try again.'}</p>
          {!canStart && <p className="mt-3 bg-red-600 rounded-lg px-3 py-2 text-sm font-medium">⚠️ You cannot watch live without a Pi balance. Prepaid — buy Pi first.</p>}
          <div className="flex gap-2 mt-5">
            <Btn variant="green" className="flex-1" disabled={!canStart} onClick={() => setStarted(true)}>▶️ Start Watching Live</Btn>
            <Btn variant="ghost" className="!bg-slate-700 !text-white" onClick={() => navigate('/wallet')}>Buy Pi</Btn>
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
          {!remoteReady && <Avatar photo={hostPhoto} name={host.name} color={host.color} className="w-28 h-28 text-4xl mx-auto mt-3" />}
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
            <span className="text-xs">Your Pi: <b>{formatPi(totalPi)}</b></span>
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
          {giftMsg === 'Not enough Pi balance — add Pi to your Pi wallet' && <div className="text-center mt-1"><Btn variant="green" onClick={() => navigate('/wallet')}>Buy Pi</Btn></div>}
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
  const { user, liveRate, liveEarnings, addLiveEarnings, datingKycRequired, recordShare, soundSettings } = useStore()
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

  // প্রগ্রেসিভ KYC — ৫ চ্যাটের পর KYC বাধ্যতামূলক হলে সরাসরি লিংকেও লাইভে যাওয়া যাবে না
  if (datingKycRequired) {
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
  // চলে কি না যাচাই — চলে এমন উপরে, না-চলা নিচে; যাচাই চলাকালীন তালিকা
  // আগের ক্রমেই থাকে, ফল এলে ধাপে ধাপে সাজে। প্রতি সেশনে একবার যাচাই হয়
  // (রিলোড = নতুন যাচাই) — ক্যাশে থাকা ফল নেটওয়ার্ক ছোঁয় না।
  const [playStatus, setPlayStatus] = useState<Record<string, ProbeStatus>>({})
  const [probing, setProbing] = useState(false)
  useEffect(() => {
    // Live TV খুললেই নতুন করে যাচাই — সেশন-ক্যাশ মুছে ফেলা হয়, যাতে
    // একই সেশনে আবার ঢুকলেও চ্যানেলগুলো নতুন করে চালিয়ে দেখা হয়।
    clearProbeCache()
    const urls = channels.map(c => c.streamUrl).filter(Boolean) as string[]
    if (urls.length === 0) return
    let alive = true
    setProbing(true)
    probeChannels(urls, { onProgress: (url, plays) => { if (alive) setPlayStatus(prev => ({ ...prev, [url]: plays })) } })
      .finally(() => { if (alive) setProbing(false) })
    return () => { alive = false }
  }, [channels])
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
  const sortedList = sortChannelsByPlayability(list, playStatus)
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold flex items-center gap-2"><IconLiveTV className="w-6 h-6" /> Live TV</h1>
      <Card>
        <div ref={playerRef} className="tv-player relative w-full aspect-video bg-black rounded-lg overflow-hidden">
          {current.streamUrl && <span className="absolute top-2 left-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">● LIVE</span>}
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
            <button onClick={toggleFullscreen} className="px-3 py-1.5 rounded-full bg-white dark:bg-fb-card text-sm font-medium shadow-sm flex items-center gap-1.5"><IconExpand className="w-4 h-4" /> {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</button>
            <button onClick={async () => { const r = await shareLink('PiCall Live TV', `Watch ${current.name} free on PiCall Live TV!`, INVITE_BASE_URL); setShareMsg(r === 'cancelled' ? '' : r === 'shared' ? '✅ Shared!' : r === 'copied' ? '✅ TV link copied — send it to friends!' : 'Share failed — copy the link from the address bar.') }} className="px-3 py-1.5 rounded-full bg-white dark:bg-fb-card text-sm font-medium shadow-sm flex items-center gap-1.5"><IconShare className="w-4 h-4" /> Share TV</button>
            {current.officialUrl && <a className="text-fb-blue text-sm font-medium" href={current.officialUrl} target="_blank" rel="noreferrer">Official Source →</a>}
          </div>
        </div>
        {shareMsg && <p className="text-sm text-green-600 mt-2">{shareMsg}</p>}
        {playError && <p className="text-sm text-red-600 mt-2">{playError}</p>}
        <p className="text-xs text-gray-400 mt-2">{fromPlaylist ? `${channels.length} channels from the admin playlist.` : 'Playlist could not be loaded — showing saved channels.'} If a channel does not play, try another one.</p>
      </Card>
      <div className="flex gap-2 flex-wrap">{groups.map(c => <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-sm ${cat === c ? 'bg-fb-blue text-white' : 'bg-white dark:bg-fb-card'}`}>{c}</button>)}</div>
      {probing && <p className="text-xs text-gray-400">Checking channels… working ones move to the top.</p>}
      <div className="space-y-2">
        {sortedList.map(ch => {
          const st = ch.streamUrl ? playStatus[ch.streamUrl] : false
          return (
            <button key={ch.id} onClick={() => { setCurrent(ch); setPlayError('') }} className={`w-full flex items-center gap-3 text-left rounded-[16px] px-3 py-2 border ${current.id === ch.id ? 'bg-violet-100 dark:bg-violet-900 ring-2 ring-violet-500 border-transparent' : 'bg-white dark:bg-[#211a30] border-[#e7e0f2] dark:border-[#372b52]'}`}>
              <span className="w-[46px] h-[46px] rounded-xl bg-[#f1ecf9] dark:bg-[#2b2142] grid place-items-center shrink-0">{ch.logo ? <img src={ch.logo} alt="" className="w-6 h-6 rounded object-contain bg-white" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} /> : <IconLiveTV className="w-6 h-6 text-gray-400" />}</span>
              <span className="flex-1 min-w-0"><span className="block font-bold truncate">{ch.name}</span><span className="block text-xs text-gray-400">{ch.group}{ch.streamUrl ? '' : ' • Link only'}</span></span>
              {st === true && <span className="shrink-0 text-xs font-bold text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2 py-1 rounded-full">Playing</span>}
              {st === false && ch.streamUrl && <span className="shrink-0 text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-full">Not playing</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Home services / Groups / Reels / Ads / Admin / Menu ----------
export function ServicesPage() {
  // ভার্চুয়াল সার্ভিসের পাতা — Home-এর Services সেকশনেরই পুরো পাতা সংস্করণ।
  // আগের "Home Service" (সামনাসামনি বুকিং) সরানো হয়েছে: সব সার্ভিস
  // ভিডিও কলে হয়, প্রিপেইড Pi/মিনিটে।
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <ServicesSection />
    </div>
  )
}

// ---------- Groups & Pages ----------
// A group is a member community (public/private); a page is a public
// presence (business/creator/community). Both start empty — member/follower
// counts come only from real uid arrays, never invented. Clicking one opens
// its detail view at /groups/:id (group) or /pages/:id (page) with a
// Join/Follow button and an honest "posts coming" note — no fake posts.
export function GroupsPage() {
  const { user, uid } = useStore()
  const [groups, setGroups] = useState<GroupItem[]>(() => loadLocalGroups())
  const [pages, setPages] = useState<PageItem[]>(() => loadLocalPages())
  const [gName, setGName] = useState('')
  const [gDesc, setGDesc] = useState('')
  const [gVis, setGVis] = useState<'public' | 'private'>('public')
  const [gErr, setGErr] = useState('')
  const [gBusy, setGBusy] = useState(false)
  const [gDone, setGDone] = useState(false)
  const [pName, setPName] = useState('')
  const [pCat, setPCat] = useState('')
  const [pDesc, setPDesc] = useState('')
  const [pErr, setPErr] = useState('')
  const [pBusy, setPBusy] = useState(false)
  const [pDone, setPDone] = useState(false)
  useEffect(() => {
    fetchGroups(50).then(list => { if (list.length > 0) { const m = mergeGroupLists(loadLocalGroups(), list); setGroups(m); saveLocalGroups(m) } })
    fetchPages(50).then(list => { if (list.length > 0) { const m = mergePageLists(loadLocalPages(), list); setPages(m); saveLocalPages(m) } })
    const unG = subscribeGroups(list => { setGroups(list); if (list.length > 0) saveLocalGroups(mergeGroupLists(loadLocalGroups(), list)) })
    const unP = subscribePages(list => { setPages(list); if (list.length > 0) saveLocalPages(mergePageLists(loadLocalPages(), list)) })
    return () => { unG?.(); unP?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  async function submitGroup() {
    const vErr = validateGroupInput({ name: gName, description: gDesc, visibility: gVis })
    if (vErr) { setGErr(vErr); return }
    if (!uid || !user) { setGErr('Log in first to create a group.'); return }
    setGBusy(true); setGErr('')
    const id = await createGroupDoc({ ownerUid: uid, ownerName: user.name, name: gName.trim(), description: gDesc.trim(), visibility: gVis })
    const saved: GroupItem = { id: id ?? ('local-' + Date.now()), ownerUid: uid, ownerName: user.name, name: gName.trim(), description: gDesc.trim(), visibility: gVis, memberUids: [uid], createdAtMs: Date.now() }
    const merged = mergeGroupLists(loadLocalGroups(), [saved])
    saveLocalGroups(merged); setGroups(merged)
    setGDone(true); setGBusy(false)
    setGName(''); setGDesc(''); setGVis('public')
  }
  async function submitPage() {
    const vErr = validatePageInput({ name: pName, category: pCat, description: pDesc })
    if (vErr) { setPErr(vErr); return }
    if (!uid || !user) { setPErr('Log in first to create a page.'); return }
    setPBusy(true); setPErr('')
    const id = await createPageDoc({ ownerUid: uid, ownerName: user.name, name: pName.trim(), category: pCat.trim(), description: pDesc.trim() })
    const saved: PageItem = { id: id ?? ('local-' + Date.now()), ownerUid: uid, ownerName: user.name, name: pName.trim(), category: pCat.trim(), description: pDesc.trim(), followerUids: [], createdAtMs: Date.now() }
    const merged = mergePageLists(loadLocalPages(), [saved])
    saveLocalPages(merged); setPages(merged)
    setPDone(true); setPBusy(false)
    setPName(''); setPCat(''); setPDesc('')
  }
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">👥 Groups & Pages</h1>
      <Card>
        <h2 className="font-bold">Create Group</h2>
        <label className="text-sm font-medium block mt-3">Group name</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={gName} onChange={e => setGName(e.target.value)} placeholder="e.g. Chattogram Book Lovers" />
        <label className="text-sm font-medium block mt-3">Description</label>
        <textarea className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={gDesc} onChange={e => setGDesc(e.target.value)} placeholder="What is this group about?" rows={2} />
        <label className="text-sm font-medium block mt-3">Privacy</label>
        <select className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={gVis} onChange={e => setGVis(e.target.value as 'public' | 'private')}>
          <option value="public">Public — anyone can join</option>
          <option value="private">Private — members join by owner</option>
        </select>
        {gErr && <p className="text-sm text-red-600 mt-2">{gErr}</p>}
        {gDone && <p className="text-sm text-green-600 mt-2">✅ Group created — you are its first member.</p>}
        <Btn className="w-full mt-4" disabled={gBusy} onClick={submitGroup}>{gBusy ? 'Creating…' : 'Create Group'}</Btn>
      </Card>
      <Card>
        <h2 className="font-bold">Create Page</h2>
        <label className="text-sm font-medium block mt-3">Page name</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={pName} onChange={e => setPName(e.target.value)} placeholder="e.g. Jhuli BD" />
        <label className="text-sm font-medium block mt-3">Category</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={pCat} onChange={e => setPCat(e.target.value)} placeholder="e.g. Bookstore" />
        <label className="text-sm font-medium block mt-3">Description</label>
        <textarea className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder="What is this page about?" rows={2} />
        {pErr && <p className="text-sm text-red-600 mt-2">{pErr}</p>}
        {pDone && <p className="text-sm text-green-600 mt-2">✅ Page created.</p>}
        <Btn className="w-full mt-4" disabled={pBusy} onClick={submitPage}>{pBusy ? 'Creating…' : 'Create Page'}</Btn>
      </Card>
      <Card>
        <h2 className="font-bold">Groups</h2>
        {groups.length === 0 && <p className="text-sm text-gray-500 mt-2">No groups yet — create the first one above.</p>}
        {groups.map(g => (
          <Link key={g.id} to={`/groups/${g.id}`} className="block py-3 border-b border-gray-100 dark:border-white/10 last:border-0">
            <p className="font-bold text-sm">{g.name} {g.visibility === 'private' && <span className="text-xs text-gray-400">🔒 Private</span>}</p>
            <p className="text-xs text-gray-500 mt-1">{g.description || 'No description.'}</p>
            <p className="text-xs text-gray-400 mt-1">{memberCount(g)} member{memberCount(g) === 1 ? '' : 's'} • by {g.ownerName}</p>
          </Link>
        ))}
      </Card>
      <Card>
        <h2 className="font-bold">Pages</h2>
        {pages.length === 0 && <p className="text-sm text-gray-500 mt-2">No pages yet — create the first one above.</p>}
        {pages.map(p => (
          <Link key={p.id} to={`/pages/${p.id}`} className="block py-3 border-b border-gray-100 dark:border-white/10 last:border-0">
            <p className="font-bold text-sm">{p.name}</p>
            <p className="text-xs text-gray-500 mt-1">{p.category || 'Page'}{p.description ? ` • ${p.description}` : ''}</p>
            <p className="text-xs text-gray-400 mt-1">{followerCount(p)} follower{followerCount(p) === 1 ? '' : 's'} • by {p.ownerName}</p>
          </Link>
        ))}
      </Card>
    </div>
  )
}

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { uid, user } = useStore()
  const [group, setGroup] = useState<GroupItem | null>(() => loadLocalGroups().find(g => g.id === id) ?? null)
  const [page, setPage] = useState<PageItem | null>(() => loadLocalPages().find(p => p.id === id) ?? null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  // Group posts (members only write) + page posts (owner only writes).
  const [groupPosts, setGroupPosts] = useState<GroupPost[]>(() => (id ? loadLocalGroupPosts(id) : []))
  const [pagePosts, setPagePosts] = useState<PagePost[]>(() => (id ? loadLocalPagePosts(id) : []))
  const [postText, setPostText] = useState('')
  const [postErr, setPostErr] = useState('')
  const [postBusy, setPostBusy] = useState(false)
  const [pagePostText, setPagePostText] = useState('')
  const [pagePostErr, setPagePostErr] = useState('')
  const [pagePostBusy, setPagePostBusy] = useState(false)
  // Member add (owner only): real users from publicProfiles, searched by name.
  const [profiles, setProfiles] = useState<NewMember[]>([])
  const [addQuery, setAddQuery] = useState('')
  const [addBusyUid, setAddBusyUid] = useState('')
  const [addMsg, setAddMsg] = useState('')
  const [removeBusyUid, setRemoveBusyUid] = useState('')
  useEffect(() => {
    if (!id) return
    fetchGroup(id).then(g => { if (g) { setGroup(g); saveLocalGroups(mergeGroupLists(loadLocalGroups(), [g])) } })
    fetchPage(id).then(p => { if (p) { setPage(p); saveLocalPages(mergePageLists(loadLocalPages(), [p])) } })
    fetchGroupPosts(id).then(list => { if (list.length > 0) { const m = mergeGroupPostLists(loadLocalGroupPosts(id), list); setGroupPosts(m); saveLocalGroupPosts(id, m) } })
    fetchPagePosts(id).then(list => { if (list.length > 0) { const m = mergePagePostLists(loadLocalPagePosts(id), list); setPagePosts(m); saveLocalPagePosts(id, m) } })
    const unGP = subscribeGroupPosts(id, list => { const m = mergeGroupPostLists(loadLocalGroupPosts(id), list); setGroupPosts(m); if (list.length > 0) saveLocalGroupPosts(id, m) })
    const unPP = subscribePagePosts(id, list => { const m = mergePagePostLists(loadLocalPagePosts(id), list); setPagePosts(m); if (list.length > 0) saveLocalPagePosts(id, m) })
    fetchAllPublicProfiles(100).then(list => setProfiles(list)).catch(() => { /* names fall back to Member */ })
    return () => { unGP?.(); unPP?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  function memberName(memberUid: string): string {
    if (group && memberUid === group.ownerUid) return group.ownerName
    if (page && memberUid === page.ownerUid) return page.ownerName
    return profiles.find(p => p.id === memberUid)?.displayName ?? 'Member'
  }
  function formatPostTime(ms: number): string {
    if (!ms) return 'Just now'
    return new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }
  if (!group && !page) {
    return (
      <div className="space-y-3 max-w-2xl mx-auto">
        <Card><p className="text-sm text-gray-500">This group or page was not found.</p><Btn className="mt-3" onClick={() => navigate('/groups')}>Back to Groups & Pages</Btn></Card>
      </div>
    )
  }
  async function toggleGroup() {
    if (!group || !uid) return
    setBusy(true); setMsg('')
    const joined = isMember(group, uid)
    const ok = joined ? await leaveGroup(group.id, uid) : await joinGroup(group.id, uid)
    if (ok) {
      const next: GroupItem = { ...group, memberUids: joined ? group.memberUids.filter(u => u !== uid) : [...group.memberUids, uid] }
      setGroup(next); saveLocalGroups(mergeGroupLists(loadLocalGroups(), [next]))
      setMsg(joined ? 'You left the group.' : '✅ You joined the group.')
    } else {
      setMsg(group.visibility === 'private' && !joined ? 'This group is private — only the owner can add members.' : 'Could not update — check the connection and try again.')
    }
    setBusy(false)
  }
  async function togglePage() {
    if (!page || !uid) return
    setBusy(true); setMsg('')
    const following = isFollower(page, uid)
    const ok = following ? await unfollowPage(page.id, uid) : await followPage(page.id, uid)
    if (ok) {
      const next: PageItem = { ...page, followerUids: following ? page.followerUids.filter(u => u !== uid) : [...page.followerUids, uid] }
      setPage(next); saveLocalPages(mergePageLists(loadLocalPages(), [next]))
      setMsg(following ? 'You unfollowed the page.' : '✅ You followed the page.')
    } else {
      setMsg('Could not update — check the connection and try again.')
    }
    setBusy(false)
  }
  async function addMember(m: NewMember) {
    if (!group || !uid || uid !== group.ownerUid) return
    if (group.memberUids.includes(m.id)) return
    setAddBusyUid(m.id); setAddMsg('')
    const ok = await addGroupMember(group.id, m.id)
    if (ok) {
      const next: GroupItem = { ...group, memberUids: [...group.memberUids, m.id] }
      setGroup(next); saveLocalGroups(mergeGroupLists(loadLocalGroups(), [next]))
      setAddMsg(`✅ ${m.displayName} added to the group.`)
    } else {
      setAddMsg('Could not add — check the connection and try again.')
    }
    setAddBusyUid('')
  }
  async function removeMember(memberUid: string) {
    if (!group || !uid || uid !== group.ownerUid || memberUid === group.ownerUid) return
    setRemoveBusyUid(memberUid); setAddMsg('')
    const ok = await removeGroupMember(group.id, memberUid)
    if (ok) {
      const next: GroupItem = { ...group, memberUids: group.memberUids.filter(u => u !== memberUid) }
      setGroup(next); saveLocalGroups(mergeGroupLists(loadLocalGroups(), [next]))
      setAddMsg('Member removed.')
    } else {
      setAddMsg('Could not remove — check the connection and try again.')
    }
    setRemoveBusyUid('')
  }
  async function submitGroupPost() {
    if (!group || !uid || !user) return
    const err = validateGroupPost(postText)
    if (err) { setPostErr(err); return }
    setPostBusy(true); setPostErr('')
    const pid = await createGroupPostDoc(group.id, { authorUid: uid, authorName: user.name, text: postText.trim() })
    const saved: GroupPost = { id: pid ?? ('local-' + Date.now()), authorUid: uid, authorName: user.name, text: postText.trim(), createdAtMs: Date.now() }
    const merged = mergeGroupPostLists(loadLocalGroupPosts(group.id), [saved])
    saveLocalGroupPosts(group.id, merged); setGroupPosts(merged)
    setPostText(''); setPostBusy(false)
  }
  async function submitPagePost() {
    if (!page || !uid || !user) return
    const err = validatePagePost(pagePostText)
    if (err) { setPagePostErr(err); return }
    setPagePostBusy(true); setPagePostErr('')
    const pid = await createPagePostDoc(page.id, { authorUid: uid, authorName: user.name, text: pagePostText.trim() })
    const saved: PagePost = { id: pid ?? ('local-' + Date.now()), authorUid: uid, authorName: user.name, text: pagePostText.trim(), createdAtMs: Date.now() }
    const merged = mergePagePostLists(loadLocalPagePosts(page.id), [saved])
    saveLocalPagePosts(page.id, merged); setPagePosts(merged)
    setPagePostText(''); setPagePostBusy(false)
  }
  const isGroupOwner = !!group && !!uid && uid === group.ownerUid
  const isPageOwner = !!page && !!uid && uid === page.ownerUid
  const addCandidates = addQuery.trim().length < 2 ? [] : profiles
    .filter(p => p.id !== uid && !(group?.memberUids.includes(p.id))
      && ((p.displayName + ' ' + (p.numericUid !== undefined ? String(p.numericUid) : '') + ' ' + (p.referralCode ?? '')).toLowerCase().includes(addQuery.trim().toLowerCase())))
    .slice(0, 10)
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Btn variant="ghost" onClick={() => navigate('/groups')}>← Back to Groups & Pages</Btn>
      {group && <Card>
        <h1 className="text-xl font-bold">{group.name} {group.visibility === 'private' && <span className="text-xs text-gray-400">🔒 Private</span>}</h1>
        <p className="text-sm text-gray-500 mt-1">{group.description || 'No description.'}</p>
        <p className="text-sm text-gray-500 mt-2">{memberCount(group)} member{memberCount(group) === 1 ? '' : 's'} • by {group.ownerName}</p>
        <Btn className="mt-3" disabled={busy || !uid} onClick={toggleGroup}>{isMember(group, uid) ? 'Leave Group' : 'Join Group'}</Btn>
        {msg && <p className="text-sm text-gray-500 mt-2">{msg}</p>}
        <div className="mt-4 pt-3 border-t">
          <h2 className="font-bold">Members</h2>
          {group.memberUids.map(mUid => (
            <div key={mUid} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/10 last:border-0">
              <p className="text-sm font-medium">{memberName(mUid)} {mUid === group.ownerUid && <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">Owner</span>}</p>
              {isGroupOwner && mUid !== group.ownerUid && <button type="button" className="text-xs text-red-600 font-medium" disabled={removeBusyUid === mUid} onClick={() => removeMember(mUid)}>{removeBusyUid === mUid ? 'Removing…' : 'Remove'}</button>}
            </div>
          ))}
        </div>
        {isGroupOwner && <div className="mt-4 pt-3 border-t">
          <h2 className="font-bold">Add members</h2>
          <input className="w-full border rounded-lg px-3 py-2 mt-2 dark:bg-slate-800 dark:border-slate-600" value={addQuery} onChange={e => setAddQuery(e.target.value)} placeholder="Search users by name…" />
          {addCandidates.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/10 last:border-0">
              <p className="text-sm font-medium">{m.displayName}</p>
              <Btn variant="ghost" disabled={addBusyUid === m.id} onClick={() => addMember(m)}>{addBusyUid === m.id ? 'Adding…' : 'Add'}</Btn>
            </div>
          ))}
          {addQuery.trim().length >= 2 && addCandidates.length === 0 && <p className="text-sm text-gray-500 mt-2">No users found with that name.</p>}
          {addMsg && <p className="text-sm text-gray-500 mt-2">{addMsg}</p>}
        </div>}
        <div className="mt-4 pt-3 border-t">
          <h2 className="font-bold">Posts</h2>
          {isMember(group, uid) ? (
            <>
              <textarea className="w-full border rounded-lg px-3 py-2 mt-2 dark:bg-slate-800 dark:border-slate-600" value={postText} onChange={e => setPostText(e.target.value)} placeholder="Share something with the group…" rows={3} />
              {postErr && <p className="text-sm text-red-600 mt-2">{postErr}</p>}
              <Btn className="w-full mt-2" disabled={postBusy} onClick={submitGroupPost}>{postBusy ? 'Posting…' : 'Post'}</Btn>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-2">Join the group to post.</p>
          )}
          {groupPosts.length === 0 && <p className="text-sm text-gray-500 mt-3">No posts yet — be the first to post.</p>}
          {groupPosts.map(p => (
            <div key={p.id} className="py-3 border-b border-gray-100 dark:border-white/10 last:border-0">
              <p className="text-sm font-bold">{p.authorName} <span className="text-xs text-gray-400 font-normal">• {formatPostTime(p.createdAtMs)}</span></p>
              <p className="text-sm mt-1 whitespace-pre-wrap break-words">{p.text}</p>
            </div>
          ))}
        </div>
      </Card>}
      {page && <Card>
        <h1 className="text-xl font-bold">{page.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{page.category || 'Page'}{page.description ? ` — ${page.description}` : ''}</p>
        <p className="text-sm text-gray-500 mt-2">{followerCount(page)} follower{followerCount(page) === 1 ? '' : 's'} • by {page.ownerName}</p>
        <Btn className="mt-3" disabled={busy || !uid} onClick={togglePage}>{isFollower(page, uid) ? 'Unfollow' : 'Follow'}</Btn>
        {msg && <p className="text-sm text-gray-500 mt-2">{msg}</p>}
        <div className="mt-4 pt-3 border-t">
          <h2 className="font-bold">Posts</h2>
          {isPageOwner && (
            <>
              <textarea className="w-full border rounded-lg px-3 py-2 mt-2 dark:bg-slate-800 dark:border-slate-600" value={pagePostText} onChange={e => setPagePostText(e.target.value)} placeholder="Share something on your page…" rows={3} />
              {pagePostErr && <p className="text-sm text-red-600 mt-2">{pagePostErr}</p>}
              <Btn className="w-full mt-2" disabled={pagePostBusy} onClick={submitPagePost}>{pagePostBusy ? 'Posting…' : 'Post'}</Btn>
            </>
          )}
          {pagePosts.length === 0 && <p className="text-sm text-gray-500 mt-3">No posts yet.</p>}
          {pagePosts.map(p => (
            <div key={p.id} className="py-3 border-b border-gray-100 dark:border-white/10 last:border-0">
              <p className="text-sm font-bold">{p.authorName} <span className="text-xs text-gray-400 font-normal">• {formatPostTime(p.createdAtMs)}</span></p>
              <p className="text-sm mt-1 whitespace-pre-wrap break-words">{p.text}</p>
            </div>
          ))}
        </div>
      </Card>}
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
      <h1 className="text-xl font-bold flex items-center gap-2"><IconReels className="w-6 h-6" /> Reels & Monetization</h1>
      <p className="text-sm text-gray-500">Total share: <b>↗️ {totalShares}</b> • If you like it, share — friends will join PiCall!</p>
      {shareMsg && <p className="text-sm text-green-600">{shareMsg}</p>}
      {REELS.length === 0 && videoReels.length === 0 ? (
        <div className="bg-[#241536] rounded-[20px] px-4 py-10 text-center">
          <p className="text-white font-bold text-lg">🎬 Reels is coming soon</p>
          <p className="text-white/60 text-sm mt-2">Video uploads will open here later.</p>
          <p className="text-white/40 text-sm mt-1">No reels yet.</p>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        {REELS.map(r => (
          <Card key={r.id}>
            <div className="text-white"><IconReels className="w-9 h-9" /></div>
            <p className="font-bold mt-2">{r.title}</p>
            <p className="text-sm text-gray-500">{r.views} Views • {r.creator}</p>
            <div className="flex gap-2 mt-3 items-center">
              <Btn variant="ghost" onClick={() => shareReel(r)}><span className="flex items-center gap-1"><IconShare className="w-4 h-4" /> Share</span></Btn>
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
              <Btn variant="ghost" onClick={() => shareReel(r)}><span className="flex items-center gap-1"><IconShare className="w-4 h-4" /> Share</span></Btn>
              <span className="text-sm text-gray-500">↗️ {reelShares[r.id] ?? 0} shares</span>
            </div>
          </Card>
        ))}
      </div>
      )}
      <Card><h2 className="font-bold">Creator Monetization</h2><p className="text-sm mt-1">Earn from Reels, live classes and premium content. Creators get a share from views, gifts and subscriptions — details in the admin revenue panel.</p></Card>
    </div>
  )
}

// ---------- User product ads (self-serve) ----------
// A user advertises their own product — photo, title, description, price and
// a link to their own website/business. Submitting saves PENDING for admin
// review; only APPROVED ads show in the Feed (labelled "Sponsored").
// Billing is CPM + CPC (views/1000 × CPM rate + clicks × CPC rate), rates
// set by the admin in Settings (defaults: CPM ৳50, CPC ৳3). No payment is
// taken here yet. This is NOT Adsterra (owner's own earning, wired later
// when his VAST + banner codes arrive).
export function AdsPage() {
  const { user, uid, adminSettings } = useStore()
  const navigate = useNavigate()
  const rates = adminSettings.ads ?? { cpmRateBDT: 50, cpcRateBDT: 3 }
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [link, setLink] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [deviceOnly, setDeviceOnly] = useState(false)
  const [myAds, setMyAds] = useState<UserAd[]>(() => loadLocalAds())
  const photoInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!uid) return
    fetchAds(50).then(list => {
      const mine = list.filter(a => a.ownerUid === uid)
      if (mine.length > 0) {
        const merged = mergeAdLists(loadLocalAds(), mine)
        setMyAds(merged)
        saveLocalAds(merged)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])
  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => { const d = downscaleImage(img, img.width, img.height, 800); if (d) { setPhoto(d); setErr('') } }
      img.src = String(r.result)
    }
    r.readAsDataURL(f)
  }
  async function submit() {
    const input = { title, description: desc, priceBDT: Number(price), link, ...(photo ? { photo } : {}) }
    const vErr = validateAdInput(input)
    if (vErr) { setErr(vErr); return }
    if (!uid || !user) { setErr('Log in first to place an ad.'); return }
    setBusy(true); setErr('')
    const doc = {
      ownerUid: uid,
      ownerName: user.name,
      title: title.trim(),
      description: desc.trim(),
      priceBDT: Math.round(Number(price) * 100) / 100,
      link: link.trim(),
      ...(photo ? { photo } : {}),
    }
    const id = await createAdDoc(doc)
    const saved: UserAd = { id: id ?? ('local-' + Date.now()), ...doc, status: 'pending', views: 0, clicks: 0, createdAtMs: Date.now() }
    saveLocalAds(mergeAdLists(loadLocalAds(), [saved]))
    setMyAds(mergeAdLists(loadLocalAds(), [saved]))
    if (!id) setDeviceOnly(true)
    setDone(true)
    setBusy(false)
  }
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <h1 className="text-xl font-bold">📢 Place an Ad</h1>
        <p className="text-sm text-gray-500 mt-1">Advertise your own product — it shows in the Feed as Sponsored after the admin approves it.</p>
        <p className="text-sm text-gray-500 mt-1">Billing: {formatBDT(rates.cpmRateBDT)} per 1000 views (CPM) + {formatBDT(rates.cpcRateBDT)} per click (CPC). {adRatesSet(rates) ? 'Your amount due grows with views and clicks — see it below.' : 'Ad rates are not set yet — your ad shows free until the admin sets the rates.'}</p>
        <label className="text-sm font-medium block mt-3">Product photo</label>
        <div className="flex gap-2 items-center mt-1">
          {photo && <img src={photo} alt="Product" className="w-16 h-16 rounded-lg object-cover" />}
          <Btn variant="ghost" onClick={() => photoInputRef.current?.click()}>Add product photo</Btn>
          {photo && <Btn variant="ghost" onClick={() => setPhoto(null)}>Remove</Btn>}
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
        <label className="text-sm font-medium block mt-3">Product title</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Handmade jamdani saree" />
        <label className="text-sm font-medium block mt-3">Description</label>
        <textarea className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What makes it special?" rows={3} />
        <label className="text-sm font-medium block mt-3">Price (Tk)</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 1290" inputMode="decimal" />
        <label className="text-sm font-medium block mt-3">Website / business link</label>
        <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={link} onChange={e => setLink(e.target.value)} placeholder="https://your-website.com" inputMode="url" />
        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
        {done && <p className="text-sm text-green-600 mt-2">✅ Ad submitted — pending admin review. It shows in the Feed only after approval.{deviceOnly ? ' (Saved on this device only — Firestore was unreachable, it will sync when the connection returns.)' : ''}</p>}
        <Btn className="w-full mt-4" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit Ad for Review'}</Btn>
      </Card>
      <Card>
        <h2 className="font-bold">My Ads</h2>
        {myAds.length === 0 && <p className="text-sm text-gray-500 mt-2">No ads yet — submit your first one above.</p>}
        {myAds.map(a => (
          <div key={a.id} className="py-3 border-b border-gray-100 dark:border-white/10 last:border-0">
            <div className="flex items-center gap-2">
              {a.photo && <img src={a.photo} alt={a.title} className="w-12 h-12 rounded-lg object-cover" />}
              <div className="flex-1">
                <p className="font-bold text-sm">{a.title}</p>
                <p className="text-xs text-gray-500">{adPriceLabel(a.priceBDT)} • <a className="text-fb-blue" href={a.link} target="_blank" rel="noopener noreferrer">{a.link}</a></p>
              </div>
            </div>
            <p className="text-sm mt-2">{adStatusLabel(a.status)}</p>
            <p className="text-sm text-gray-500 mt-1">👁️ {a.views.toLocaleString('en-IN')} views • 🖱️ {a.clicks.toLocaleString('en-IN')} clicks • Amount due: <b>{adRatesSet(rates) ? formatBDT(adAmountDue(a, rates)) : 'Free — rates not set yet'}</b></p>
          </div>
        ))}
        <Btn variant="ghost" className="mt-3" onClick={() => navigate('/feed')}>View Feed</Btn>
      </Card>
    </div>
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
  const [an, setAn] = useState<AnalyticsIds>(adminSettings.analytics || { ...EMPTY_ANALYTICS_IDS })
  const [adRates, setAdRates] = useState({ cpmRateBDT: String(adminSettings.ads?.cpmRateBDT ?? 50), cpcRateBDT: String(adminSettings.ads?.cpcRateBDT ?? 3) })
  const [adRatesMsg, setAdRatesMsg] = useState('')
  const [adRatesErr, setAdRatesErr] = useState('')
  const [smsMsg, setSmsMsg] = useState('')
  const [smtpMsg, setSmtpMsg] = useState('')
  const [payMsg, setPayMsg] = useState('')
  const [anMsg, setAnMsg] = useState('')
  const [serverStatus, setServerStatus] = useState<{ smtpConfigured: boolean; smsConfigured: boolean } | null>(null)
  useEffect(() => { getAdminSettingsStatus().then(s => { if (s) setServerStatus(s) }) }, [])

  // সেভের বার্তার রং — সাফল্য সবুজ, অনিশ্চিত (সার্ভারে গেল কি না জানা
  // যায়নি) হলুদ, ব্যর্থ লাল; ব্যর্থ বার্তা কখনো সবুজে দেখায় না।
  function adminMsgCls(msg: string) { return `text-sm mt-2 ${msg.startsWith('❌') ? 'text-red-600' : msg.startsWith('⚠️') ? 'text-amber-600' : 'text-green-600'}` }

  async function saveSms() {
    const cleaned = { provider: sms.provider || 'Nishchit', apiKey: sms.apiKey, senderId: sms.senderId.trim() }
    setSms(cleaned)
    setAdminSettings({ ...adminSettings, sms: cleaned })
    setSmsMsg('Saving…')
    const ok = await saveAdminSms(cleaned)
    const st = await getAdminSettingsStatus(ADMIN_TIMEOUT_MS)
    if (st) setServerStatus(st)
    // সত্যি বার্তা — সার্ভার না পেলে "✅ saved" দিয়ে শুরু হয় না; সাফল্য
    // শুধু তখনই, যখন সার্ভার নিজে smsConfigured নিশ্চিত করে।
    const confirmed = ok && st?.smsConfigured === true
    setSmsMsg(confirmed
      ? '✅ SMS key saved — also sent to the server, SMS OTP will now go through Nishchit.'
      : ok
        ? '⚠️ SMS key sent to the server, but the confirmation check did not come back — check Server Status above; if it still says SMS off, save again.'
        : '❌ SMS key not saved — it did not reach the server (timed out or backend not reachable). SMS OTP will not be sent until it saves. Try again.')
  }
  async function clearSms() {
    const cleared = { provider: 'Nishchit', apiKey: '', senderId: '' }
    setSms(cleared)
    setAdminSettings({ ...adminSettings, sms: cleared })
    await saveAdminSms(cleared)
    const st = await getAdminSettingsStatus(ADMIN_TIMEOUT_MS)
    if (st) setServerStatus(st)
    setSmsMsg('SMS info deleted.')
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
    const st = await getAdminSettingsStatus(ADMIN_TIMEOUT_MS)
    if (st) setServerStatus(st)
    // সত্যি বার্তা — সার্ভার না পেলে "✅ SMTP saved" দিয়ে শুরু হয় না;
    // সাফল্য শুধু তখনই, যখন সার্ভার নিজে smtpConfigured নিশ্চিত করে।
    const confirmed = ok && st?.smtpConfigured === true
    setSmtpMsg(confirmed
      ? '✅ SMTP saved — also sent to the server, OTP mail will now go through this SMTP.'
      : ok
        ? '⚠️ SMTP sent to the server, but the confirmation check did not come back — check Server Status above; if it still says SMTP off, save again.'
        : '❌ SMTP not saved — it did not reach the server (timed out or backend not reachable). OTP mail will not be sent until it saves. Try again.')
  }
  async function clearSmtp() {
    const cleared = { host: 'smtp.gmail.com', port: 587, user: '', pass: '', from: '' }
    setSmtp(cleared)
    setAdminSettings({ ...adminSettings, smtp: cleared })
    await saveAdminSmtp(cleared)
    const st = await getAdminSettingsStatus(ADMIN_TIMEOUT_MS)
    if (st) setServerStatus(st)
    setSmtpMsg('SMTP info deleted.')
  }
  function savePay() {
    const cleaned = {
      bkash: pay.bkash.trim(), nagad: pay.nagad.trim(), rocket: pay.rocket.trim(),
      usdtBep20: pay.usdtBep20.trim(), usdtErc20: pay.usdtErc20.trim(),
      binancePayId: pay.binancePayId.trim(), piDepositAddress: pay.piDepositAddress.trim(), piTestnetAddress: (pay.piTestnetAddress || '').trim(),
      // চালু/বন্ধ ফ্ল্যাগ সংরক্ষণেই থাকে — Save-এ নম্বর/ঠিকানার সঙ্গে ফ্ল্যাগও যায়
      enabled: normalizePaymentEnabled(pay.enabled),
    }
    setPay(cleaned)
    setAdminSettings({ ...adminSettings, payments: cleaned })
    setPayMsg('✅ Payment details saved — the wallet top-up and Pi deposit cards will now show the real numbers/addresses.')
  }
  function clearPay() {
    // শুধু নম্বর/ঠিকানা মোছে — চালু/বন্ধ ফ্ল্যাগ যেমন ছিল তেমনই থাকে
    const cleared = { bkash: '', nagad: '', rocket: '', usdtBep20: '', usdtErc20: '', binancePayId: '', piDepositAddress: '', piTestnetAddress: '', enabled: normalizePaymentEnabled(pay.enabled) }
    setPay(cleared)
    setAdminSettings({ ...adminSettings, payments: cleared })
    setPayMsg('Payment details deleted — the wallet will show "Not set up yet" until you set them again.')
  }
  // পেমেন্ট মাধ্যমের চালু/বন্ধ টগল — সাথে সাথে কার্যকর হয়; নম্বর/ঠিকানা বদলায় না,
  // শুধু ফ্ল্যাগ বদলায় (আবার চালু করলে আগের নম্বর/ঠিকানাই দেখায়)
  function togglePayMethod(id: PaymentMethodId) {
    const enabled = normalizePaymentEnabled(pay.enabled)
    const nextEnabled = { ...enabled, [id]: !enabled[id] }
    const next = { ...pay, enabled: nextEnabled }
    setPay(next)
    setAdminSettings({ ...adminSettings, payments: next })
    const label = PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id
    setPayMsg(`✅ ${label} ${nextEnabled[id] ? 'চালু' : 'বন্ধ'} করা হয়েছে — ${nextEnabled[id] ? 'টপ-আপে আবার দেখাবে।' : 'টপ-আপে আর দেখাবে না (নম্বর/ঠিকানা সংরক্ষিতই আছে)।'}`)
  }
  function payToggle(id: PaymentMethodId, label: string) {
    const on = normalizePaymentEnabled(pay.enabled)[id]
    return <button type="button" title={`${label} — টপ-আপে ${on ? 'চালু' : 'বন্ধ'}`} aria-label={`${label} ${on ? 'চালু' : 'বন্ধ'}`} onClick={() => togglePayMethod(id)} className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${on ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>{on ? 'On' : 'Off'}</button>
  }
  function saveAnalytics() {
    const cleaned: AnalyticsIds = {
      pixelId: sanitizeAnalyticsId(an.pixelId),
      ga4Id: sanitizeAnalyticsId(an.ga4Id),
      clarityId: sanitizeAnalyticsId(an.clarityId),
    }
    setAn(cleaned)
    setAdminSettings({ ...adminSettings, analytics: cleaned })
    setAnMsg('✅ Analytics IDs saved — the trackers will load for signed-in users (empty ID = that tracker stays off).')
  }
  function clearAnalytics() {
    const cleared: AnalyticsIds = { ...EMPTY_ANALYTICS_IDS }
    setAn(cleared)
    setAdminSettings({ ...adminSettings, analytics: cleared })
    setAnMsg('Analytics IDs deleted — all trackers are off until you set them again.')
  }
  // User product ads billing — CPM (per 1000 views) + CPC (per click), Tk.
  // Owner-approved defaults: CPM ৳50, CPC ৳3. Both 0 = ads show free.
  function saveAdRates() {
    const cpm = Number(adRates.cpmRateBDT)
    const cpc = Number(adRates.cpcRateBDT)
    if (!Number.isFinite(cpm) || cpm < 0 || !Number.isFinite(cpc) || cpc < 0) { setAdRatesErr('Rates must be 0 or more.'); setAdRatesMsg(''); return }
    const cleaned = { cpmRateBDT: Math.round(cpm * 100) / 100, cpcRateBDT: Math.round(cpc * 100) / 100 }
    setAdRates({ cpmRateBDT: String(cleaned.cpmRateBDT), cpcRateBDT: String(cleaned.cpcRateBDT) })
    setAdminSettings({ ...adminSettings, ads: cleaned })
    setAdRatesErr('')
    setAdRatesMsg(`✅ Ad rates saved — CPM ${formatBDT(cleaned.cpmRateBDT)} per 1000 views, CPC ${formatBDT(cleaned.cpcRateBDT)} per click.`)
  }
  const inputCls = 'w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600'
  return (
    <Card>
      <h2 className="font-bold">⚙️ Settings — Put Real Info Here</h2>
      <p className="text-xs text-gray-500 mt-1">The numbers/addresses/keys set here will be used in the app — do not send them in chat or code. Secret values (API key, App Password) are never shown in full.</p>

      <h3 className="font-bold mt-5">📩 SMS Gateway</h3>
      <p className="text-xs text-gray-500 mt-1">Server Status: {serverStatus ? (serverStatus.smsConfigured ? 'SMS on ✅ — OTP SMS will be sent' : 'SMS off — SMS OTP will not be sent (add the Nishchit key)') : 'Unknown (could not reach the backend)'}</p>
      <label className="text-sm block mt-2">Provider</label>
      <select className={inputCls} value={sms.provider} onChange={e => { setSms({ ...sms, provider: e.target.value }); setSmsMsg('') }}>
        <option value="Nishchit">Nishchit</option>
      </select>
      <label className="text-sm block mt-2">API Key</label>
      <input type="password" className={inputCls} value={sms.apiKey} onChange={e => { setSms({ ...sms, apiKey: e.target.value }); setSmsMsg('') }} placeholder="Gateway API Key" autoComplete="off" />
      {serverStatus?.smsConfigured && sms.apiKey && <p className="text-xs text-green-600 mt-1">✅ API Key saved</p>}
      <label className="text-sm block mt-2">Sender ID</label>
      <input className={inputCls} value={sms.senderId} onChange={e => { setSms({ ...sms, senderId: e.target.value }); setSmsMsg('') }} placeholder="e.g. PiCall" />
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={saveSms}>Save</Btn>
        <Btn variant="ghost" onClick={clearSms}>Delete</Btn>
      </div>
      {smsMsg && <p className={adminMsgCls(smsMsg)}>{smsMsg}</p>}
      <p className="text-xs text-amber-600 mt-2">The server copy will be deleted on a Railway restart — then you must save again. Permanent way: set the NISHCHIT_API_KEY env var in Railway.</p>

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
      {serverStatus?.smtpConfigured && smtp.pass && <p className="text-xs text-green-600 mt-1">✅ App Password saved</p>}
      <label className="text-sm block mt-2">Sender's Email Address (From)</label>
      <input className={inputCls} value={smtp.from} onChange={e => { setSmtp({ ...smtp, from: e.target.value }); setSmtpMsg('') }} placeholder="e.g. noreply@your-domain.com" inputMode="email" />
      <p className="text-xs text-gray-400 mt-1">If empty, your Gmail address will be the sender. After buying your own domain, put noreply@yourdomain here — then that domain's SMTP must also be set here.</p>
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={saveSmtp}>Save</Btn>
        <Btn variant="ghost" onClick={clearSmtp}>Delete</Btn>
      </div>
      {smtpMsg && <p className={adminMsgCls(smtpMsg)}>{smtpMsg}</p>}
      <p className="text-xs text-amber-600 mt-2">The server copy will be deleted on a Railway restart — then you must save again. Permanent way: set SMTP_* env vars in Railway.</p>

      <h3 className="font-bold mt-6 pt-4 border-t">💰 Real Payment Details</h3>
      <p className="text-xs text-gray-500 mt-1">The numbers/addresses set here will show on the wallet top-up and Pi deposit cards. If empty, the wallet shows “Not set up yet — ask the admin”. Each method’s On/Off switch controls whether it appears in top-up — turning one off keeps its saved number/address.</p>
      <div className="flex items-center justify-between mt-2"><label className="text-sm block">bKash Number</label>{payToggle('bkash', 'bKash')}</div>
      <input className={inputCls} value={pay.bkash} onChange={e => { setPay({ ...pay, bkash: e.target.value }); setPayMsg('') }} placeholder="01XXXXXXXXX" inputMode="tel" />
      <div className="flex items-center justify-between mt-2"><label className="text-sm block">Nagad Number</label>{payToggle('nagad', 'Nagad')}</div>
      <input className={inputCls} value={pay.nagad} onChange={e => { setPay({ ...pay, nagad: e.target.value }); setPayMsg('') }} placeholder="01XXXXXXXXX" inputMode="tel" />
      <div className="flex items-center justify-between mt-2"><label className="text-sm block">Rocket Number</label>{payToggle('rocket', 'Rocket')}</div>
      <input className={inputCls} value={pay.rocket} onChange={e => { setPay({ ...pay, rocket: e.target.value }); setPayMsg('') }} placeholder="01XXXXXXXXX" inputMode="tel" />
      <div className="flex items-center justify-between mt-2"><label className="text-sm block">USDT BEP20 Address</label>{payToggle('usdt', 'USDT (BEP20 + ERC20)')}</div>
      <input className={inputCls} value={pay.usdtBep20} onChange={e => { setPay({ ...pay, usdtBep20: e.target.value }); setPayMsg('') }} placeholder="0x..." />
      <label className="text-sm block mt-2">USDT ERC20 Address</label>
      <input className={inputCls} value={pay.usdtErc20} onChange={e => { setPay({ ...pay, usdtErc20: e.target.value }); setPayMsg('') }} placeholder="0x..." />
      <div className="flex items-center justify-between mt-2"><label className="text-sm block">Binance Pay ID</label>{payToggle('binancePay', 'Binance Pay')}</div>
      <input className={inputCls} value={pay.binancePayId} onChange={e => { setPay({ ...pay, binancePayId: e.target.value }); setPayMsg('') }} placeholder="Binance Pay ID" />
      <div className="flex items-center justify-between mt-2"><label className="text-sm block">Pi Deposit Address</label>{payToggle('piDeposit', 'Pi Deposit')}</div>
      <input className={inputCls} value={pay.piDepositAddress} onChange={e => { setPay({ ...pay, piDepositAddress: e.target.value }); setPayMsg('') }} placeholder="G..." />
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={savePay}>Save</Btn>
        <Btn variant="ghost" onClick={clearPay}>Delete</Btn>
      </div>
      {payMsg && <p className="text-sm text-green-600 mt-2">{payMsg}</p>}

      <h3 className="font-bold mt-6 pt-4 border-t">📊 Analytics — Meta Pixel / Google Analytics / Clarity</h3>
      <p className="text-xs text-gray-500 mt-1">These IDs are public identifiers (they appear in the page source once set) — never a secret or password. Leave an ID empty to keep that tracker off. Saved IDs reach signed-in users; to also track logged-out visitors, set the same IDs as build secrets (VITE_PIXEL_ID / VITE_GA4_ID / VITE_CLARITY_ID).</p>
      <label className="text-sm block mt-2">Meta Pixel ID</label>
      <input className={inputCls} value={an.pixelId} onChange={e => { setAn({ ...an, pixelId: e.target.value }); setAnMsg('') }} placeholder="e.g. 123456789012345" inputMode="numeric" />
      <label className="text-sm block mt-2">Google Analytics 4 — Measurement ID</label>
      <input className={inputCls} value={an.ga4Id} onChange={e => { setAn({ ...an, ga4Id: e.target.value }); setAnMsg('') }} placeholder="e.g. G-XXXXXXXXXX" />
      <label className="text-sm block mt-2">Microsoft Clarity — Project ID</label>
      <input className={inputCls} value={an.clarityId} onChange={e => { setAn({ ...an, clarityId: e.target.value }); setAnMsg('') }} placeholder="e.g. abcdef1234" />
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={saveAnalytics}>Save</Btn>
        <Btn variant="ghost" onClick={clearAnalytics}>Delete</Btn>
      </div>
      {anMsg && <p className="text-sm text-green-600 mt-2">{anMsg}</p>}
      <p className="text-xs text-amber-600 mt-2">Pixel counts PageView on load and CompleteRegistration on first signup; GA4 counts sign_up on first signup; Clarity records sessions + heatmaps. No IDs yet = no tracking, no errors.</p>

      <h3 className="font-bold mt-6 pt-4 border-t">📢 User Product Ads — CPM / CPC Rates</h3>
      <p className="text-xs text-gray-500 mt-1">Users advertise their own products (photo, title, price, website link). Approved ads show in the Feed as Sponsored. Billing: views ÷ 1000 × CPM rate + clicks × CPC rate. Defaults: CPM ৳50 per 1000 views, CPC ৳3 per click. Both 0 = ads show free.</p>
      <label className="text-sm block mt-2">CPM rate — Tk per 1000 views</label>
      <input className={inputCls} type="number" min="0" step="0.01" value={adRates.cpmRateBDT} onChange={e => { setAdRates({ ...adRates, cpmRateBDT: e.target.value }); setAdRatesMsg(''); setAdRatesErr('') }} placeholder="50" inputMode="decimal" />
      <label className="text-sm block mt-2">CPC rate — Tk per click</label>
      <input className={inputCls} type="number" min="0" step="0.01" value={adRates.cpcRateBDT} onChange={e => { setAdRates({ ...adRates, cpcRateBDT: e.target.value }); setAdRatesMsg(''); setAdRatesErr('') }} placeholder="3" inputMode="decimal" />
      <div className="flex gap-2 mt-3 flex-wrap">
        <Btn onClick={saveAdRates}>Save</Btn>
      </div>
      {adRatesMsg && <p className="text-sm text-green-600 mt-2">{adRatesMsg}</p>}
      {adRatesErr && <p className="text-sm text-red-600 mt-2">{adRatesErr}</p>}
    </Card>
  )
}

export function AdminPage() {
  const { datingRate, setDatingRate, liveRate, setLiveRate, kycInfo, kycStatus, kycRejectReason, approveKyc, rejectKyc, piRateBDT, setPiRateBDT, usdtRateBDT, setUsdtRateBDT, piWithdrawFeePct, setPiWithdrawFeePct, piMinWithdraw, piTransferFeePct, setPiTransferFeePct, piMinTransfer, setPiMinTransfer, piBalance, numericUid, lookupUserByUid, sendPiAsAdmin, pendingTopUps, approveTopUp, rejectTopUp, adminSettings, tvPlaylistUrl, setTvPlaylistUrl, uid, bannedUids, setBannedUids } = useStore()
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
  // অ্যাডমিন ওয়ালেট — অ্যাডমিনের নিজের ব্যালেন্স থেকে যেকোনো ব্যবহারকারীকে
  // ম্যানুয়ালি Pi পাঠানো (ফি নেই, প্রাপক পুরোটাই পায়; কোনো Pi বানানো হয় না)।
  const [awUid, setAwUid] = useState('')
  const [awFound, setAwFound] = useState<{ uid: string; displayName: string; colour: string; photo?: string; numericUid?: number } | null>(null)
  const [awLookupMsg, setAwLookupMsg] = useState('')
  const [awLookupBusy, setAwLookupBusy] = useState(false)
  const [awAmount, setAwAmount] = useState('')
  const [awNote, setAwNote] = useState('')
  const [awMsg, setAwMsg] = useState('')
  const [awBusy, setAwBusy] = useState(false)
  const [awConfirm, setAwConfirm] = useState(false)
  async function doAwLookup() {
    const n = Number(awUid.replace(/\D/g, ''))
    if (!Number.isInteger(n) || n < 100000 || n > 999999) { setAwLookupMsg('Enter a 6-digit UID (e.g. 100001).'); setAwFound(null); return }
    if (numericUid !== null && n === numericUid) { setAwLookupMsg('That is your own UID — pick a customer.'); setAwFound(null); return }
    setAwLookupBusy(true); setAwLookupMsg('')
    const found = await lookupUserByUid(n)
    setAwLookupBusy(false)
    if (!found) { setAwFound(null); setAwLookupMsg('No user found with this UID — check the number and try again.'); return }
    setAwFound(found); setAwLookupMsg('')
  }
  async function doAwSend() {
    if (!awFound || awBusy) return
    const m = Number(awAmount)
    if (!Number.isFinite(m) || m <= 0) { setAwMsg('Enter a valid amount.'); return }
    if (m < piMinTransfer) { setAwMsg(`Minimum transfer: ${formatPi(piMinTransfer)}.`); return }
    if (m > piBalance) { setAwMsg('Not enough Pi balance in the Admin Wallet — the admin cannot send more than the wallet holds.'); return }
    if (!awConfirm) { setAwConfirm(true); setAwMsg(''); return }
    setAwBusy(true); setAwMsg('')
    const res = await sendPiAsAdmin({ uid: awFound.uid, name: awFound.displayName, numericUid: awFound.numericUid }, m, awNote)
    setAwBusy(false); setAwConfirm(false)
    if (res.ok === false) { setAwMsg(res.error); return }
    setAwMsg(`✅ Sent ${formatPi(m)} to ${awFound.displayName} — no fee, they get the full amount.`)
    setAwAmount(''); setAwNote(''); setAwFound(null); setAwUid('')
  }
  // অ্যাডমিন লাইভ মনিটরিং — ডেটিং পেজের মতো একই সার্ভার থেকে (GET /api/live) চলমান লাইভের তালিকা
  const [adminRooms, setAdminRooms] = useState<LiveRoom[] | null>(null)
  const [adminLiveOk, setAdminLiveOk] = useState(false)
  function refreshAdminRooms() {
    fetchLiveRooms().then(r => { if (r) { setAdminRooms(r); setAdminLiveOk(true) } else { setAdminLiveOk(false) } })
  }
  useEffect(() => { if (tab === 'kyc') refreshAdminRooms() }, [tab])
  // User product ads — pending review list; approve/reject here. Rates live
  // in Settings (CPM/CPC). Only approved ads show in the Feed as Sponsored.
  const [adminAds, setAdminAds] = useState<UserAd[] | null>(null)
  const [adminAdsMsg, setAdminAdsMsg] = useState('')
  function refreshAdminAds() {
    fetchAds(50).then(list => setAdminAds(list))
  }
  useEffect(() => { if (tab === 'ads') refreshAdminAds() }, [tab])
  // Admin → Users: real list from publicProfiles (same loader as friend
  // search / New Members — rules allow signed-in users to read it).
  // Only public fields are shown: name, referral code, joined date, colour.
  // No emails, no phones, no private users/{uid} reads.
  const [adminUsers, setAdminUsers] = useState<NewMember[] | null>(null)
  const [adminUsersQuery, setAdminUsersQuery] = useState('')
  function refreshAdminUsers() {
    fetchAllPublicProfiles(100).then(list => setAdminUsers(list)).catch(() => setAdminUsers([]))
  }
  useEffect(() => { if (tab === 'users') refreshAdminUsers() }, [tab])
  const adminUsersFiltered = useMemo(() => filterAdminUsers(adminUsers ?? [], adminUsersQuery), [adminUsers, adminUsersQuery])
  // Users ট্যাবে নাম বদল + ব্যান/আনব্যান — অ্যাডমিন শুধু। নাম বদল শুধু
  // displayName বদলায়; নিয়ম publish না হওয়া পর্যন্ত সেভ ব্যর্থ হবে (ভুল দেখায়,
  // চুপচাপ নয়)। নিজেকে ব্যান করা যায় না — নইলে অ্যাডমিন নিজেই আটকে যাবেন।
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [adminUsersMsg, setAdminUsersMsg] = useState('')
  const [adminUsersErr, setAdminUsersErr] = useState('')
  const [backfillBusy, setBackfillBusy] = useState(false)
  // UID নেই এমন ব্যবহারকারীদের যোগদানের ক্রমে সংখ্যার UID বসানো (ব্যাকফিল) —
  // আগে থেকে UID থাকলে ছোঁয়া হয় না; নিয়ম publish না হওয়া পর্যন্ত ব্যর্থ হবে।
  async function assignMissingUids() {
    if (!adminUsers || backfillBusy) return
    setBackfillBusy(true); setAdminUsersMsg(''); setAdminUsersErr('')
    const { assigned, failed } = await backfillNumericUids(adminUsers)
    if (failed > 0) setAdminUsersErr(`Assigned ${assigned} ID${assigned === 1 ? '' : 's'}; ${failed} failed — publish the new firestore.rules, then try again.`)
    else setAdminUsersMsg(assigned === 0 ? 'Every user already has an ID.' : `✅ Assigned ${assigned} ID${assigned === 1 ? '' : 's'}.`)
    const list = await fetchAllPublicProfiles(100).catch(() => null)
    if (list) setAdminUsers(list)
    setBackfillBusy(false)
  }
  const [banBusyUid, setBanBusyUid] = useState<string | null>(null)
  async function saveEditName(m: NewMember) {
    const name = editName.trim()
    if (!name) { setAdminUsersErr('Name cannot be empty.'); return }
    if (name.length > 60) { setAdminUsersErr('Name must be 60 characters or less.'); return }
    const ok = await updatePublicProfileName(m.id, name)
    if (ok) {
      setAdminUsers(prev => prev ? prev.map(x => x.id === m.id ? { ...x, displayName: name } : x) : prev)
      setEditingUid(null)
      setAdminUsersErr('')
      setAdminUsersMsg(`✅ Name updated for ${name}.`)
    } else {
      setAdminUsersErr('Could not save the name — the admin-edit rules update may not be published yet. Publish the new firestore.rules, then try again.')
    }
  }
  async function toggleBan(m: NewMember) {
    const banning = !bannedUids.includes(m.id)
    const next = banning ? [...bannedUids, m.id] : bannedUids.filter(x => x !== m.id)
    setBanBusyUid(m.id)
    const ok = await setBannedUids(next)
    setBanBusyUid(null)
    if (ok) {
      setAdminUsersErr('')
      setAdminUsersMsg(banning ? `🚫 ${m.displayName} banned — they will see a banned screen on next login.` : `✅ ${m.displayName} unbanned.`)
    } else {
      setAdminUsersErr('Could not update the ban — check the connection and try again.')
    }
  }
  async function reviewAd(id: string, status: 'approved' | 'rejected') {
    const ok = await updateAdStatus(id, status)
    setAdminAdsMsg(ok ? (status === 'approved' ? '✅ Ad approved — now showing in the Feed as Sponsored.' : '❌ Ad rejected.') : 'Could not update the ad — check the connection and try again.')
    if (ok) refreshAdminAds()
  }
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
  // Pi ট্রান্সফারের ফি% + সর্বনিম্ন ট্রান্সফার — অ্যাডমিন নির্ধারিত (ওয়ালেটে সাথে সাথে বদলায়)
  const [trFeeInput, setTrFeeInput] = useState('')
  const [trFeeMsg, setTrFeeMsg] = useState('')
  const [trMinInput, setTrMinInput] = useState('')
  const [trMinMsg, setTrMinMsg] = useState('')
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
  function saveTrFee() {
    const v = Math.round(Number(trFeeInput) * 10) / 10
    if (!Number.isFinite(v) || v < 0 || v > 10) { setTrFeeMsg('Fee must be between 0–10%.'); return }
    setPiTransferFeePct(v); setTrFeeMsg(`✅ Transfer fee saved: ${v}%.`)
  }
  function saveTrMin() {
    const v = Math.round(Number(trMinInput) * 100000) / 100000
    if (!Number.isFinite(v) || v < 0.01 || v > 100) { setTrMinMsg('Minimum must be between 0.01–100 π.'); return }
    setPiMinTransfer(v); setTrMinMsg(`✅ Minimum transfer saved: ${formatPi(v)}.`)
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
      <div className="flex gap-2 flex-wrap">{['revenue', 'wallet', 'users', 'kyc', 'ads', 'recordings', 'livetv', 'moderation', 'settings'].map(t => <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-sm capitalize ${tab === t ? 'bg-fb-blue text-white' : 'bg-white dark:bg-fb-card'}`}>{t === 'kyc' ? 'KYC Verification' : t === 'settings' ? '⚙️ Settings' : t === 'wallet' ? '💰 Wallet' : t}</button>)}</div>
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
        <h3 className="font-bold mt-5">Pi Rate (set by admin)</h3>
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
          <div>
            <label className="text-sm block">Pi Transfer Fee (%)</label>
            <input type="number" min={0} max={10} step={0.1} className="border rounded-lg px-3 py-2 w-full dark:bg-slate-800 mt-1" value={trFeeInput} onChange={e => { setTrFeeInput(e.target.value); setTrFeeMsg('') }} placeholder={`Current: ${piTransferFeePct}%`} />
            <Btn className="mt-1" onClick={saveTrFee}>Save</Btn>
            {trFeeMsg && <p className="text-xs text-green-600 mt-1">{trFeeMsg}</p>}
          </div>
          <div>
            <label className="text-sm block">Minimum Transfer (π)</label>
            <input type="number" min={0.01} max={100} step={0.01} className="border rounded-lg px-3 py-2 w-full dark:bg-slate-800 mt-1" value={trMinInput} onChange={e => { setTrMinInput(e.target.value); setTrMinMsg('') }} placeholder={`Current: ${formatPi(piMinTransfer)}`} />
            <Btn className="mt-1" onClick={saveTrMin}>Save</Btn>
            {trMinMsg && <p className="text-xs text-green-600 mt-1">{trMinMsg}</p>}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Current rate: 1 Pi = {formatBDT(piRateBDT)} • 1 USDT = {formatBDT(usdtRateBDT)} • Withdraw fee {piWithdrawFeePct}% (minimum 0.1 π) • Transfer fee {piTransferFeePct}% • Minimum transfer {formatPi(piMinTransfer)} • Minimum withdraw 10 USDT = {formatPi(piMinWithdraw)}।</p>
        <h3 className="font-bold mt-5">Top-up Approval</h3>
        <p className="text-xs text-gray-500">Manual top-up requests — approval adds to the Pi balance (Taka ÷ Pi rate; USDT × USDT rate ÷ Pi rate, at admin-set rates).</p>
        {pendingTopUps.length === 0 && <p className="text-sm text-gray-500 mt-2">No requests.</p>}
        {pendingTopUps.map(t => (
          <div key={t.id} className="border rounded-lg p-3 mt-2 flex justify-between gap-2 flex-wrap">
            <div className="text-sm">
              <p className="font-bold">{t.method}{t.network ? ` (${t.network})` : ''} — {t.currency === 'USDT' ? `${t.amount} USDT → ${formatBDT(Math.round(t.amount * usdtRateBDT))}` : formatBDT(t.amount)}</p>
              <p className="text-green-600 font-bold">→ {formatPi(topUpPi(t.amount, t.currency, piRateBDT, usdtRateBDT))} will be added</p>
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
      {tab === 'wallet' && <Card>
        <h2 className="font-bold">💰 Admin Wallet</h2>
        <p className="text-sm text-gray-500 mt-1">Send Pi manually to any user/customer. The full amount comes out of <b>your own Pi balance</b> — no Pi is created. No fee on admin sends; the receiver gets the full amount.</p>
        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 mt-3 text-center">
          <p className="text-xs text-gray-500">Your Pi Balance (fees + platform earnings accrue here)</p>
          <p className="text-2xl font-extrabold">{formatPi(piBalance)}</p>
          <p className="text-sm text-gray-500">≈ {formatBDT(piBalance * piRateBDT)}</p>
        </div>
        <label className="text-sm block mt-3">Recipient UID (6 digits)</label>
        <div className="flex gap-2 mt-1">
          <input className="flex-1 min-w-0 border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-600" value={awUid} onChange={e => { setAwUid(e.target.value.replace(/\D/g, '').slice(0, 6)); setAwFound(null); setAwConfirm(false); setAwMsg('') }} placeholder="e.g. 100001" inputMode="numeric" />
          <Btn onClick={doAwLookup} disabled={awLookupBusy}>{awLookupBusy ? 'Finding…' : 'Find'}</Btn>
        </div>
        {awLookupMsg && <p className="text-sm text-red-600 mt-2">{awLookupMsg}</p>}
        {awFound && (
          <div className="flex items-center gap-3 mt-3 border rounded-lg px-3 py-2">
            <Avatar photo={awFound.photo} name={awFound.displayName} color={awFound.colour} className="w-10 h-10" />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{awFound.displayName}</p>
              <p className="text-xs text-gray-400">{awFound.numericUid !== undefined ? `ID: ${awFound.numericUid}` : 'Customer'}</p>
            </div>
            <Btn variant="ghost" onClick={() => { setAwFound(null); setAwUid(''); setAwConfirm(false) }}>Change</Btn>
          </div>
        )}
        {awFound && (<>
          <label className="text-sm block mt-3">Amount (Pi)</label>
          <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={awAmount} onChange={e => { setAwAmount(e.target.value); setAwConfirm(false); setAwMsg('') }} placeholder={`Minimum ${formatPi(piMinTransfer)}`} />
          <label className="text-sm block mt-3">Note / reason (optional)</label>
          <input className="w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600" value={awNote} onChange={e => { setAwNote(e.target.value); setAwConfirm(false) }} placeholder="e.g. Refund for order #1234" maxLength={200} />
          {(Number(awAmount) || 0) > 0 && <p className="text-sm mt-2">Send {formatPi(Number(awAmount))} • Fee: {formatPi(0)} • {awFound.displayName} gets {formatPi(Number(awAmount))} (full amount, no fee)</p>}
          {awConfirm && (Number(awAmount) || 0) >= piMinTransfer && (
            <div className="mt-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-3">
              <p className="text-sm font-bold">Confirm send to {awFound.displayName}{awFound.numericUid !== undefined ? ` (ID ${awFound.numericUid})` : ''}?</p>
              <p className="text-sm mt-1">Send {formatPi(Number(awAmount))} • No fee • Receiver gets {formatPi(Number(awAmount))}</p>
              <p className="text-xs text-gray-500 mt-1">This comes out of your own Pi balance — your balance will decrease by {formatPi(Number(awAmount))}.</p>
            </div>
          )}
          <Btn variant="green" className="w-full mt-3" disabled={awBusy || !awFound || (Number(awAmount) || 0) < piMinTransfer} onClick={doAwSend}>{awBusy ? 'Sending…' : awConfirm ? 'Confirm Send' : 'Send Pi'}</Btn>
          {awConfirm && <Btn variant="ghost" className="w-full mt-2" onClick={() => setAwConfirm(false)}>Cancel</Btn>}
        </>)}
        {awMsg && <p className="text-sm mt-2">{awMsg}</p>}
        <p className="text-xs text-gray-400 mt-3">Recorded on both sides in the Pi Report — "Sent by Admin" with your note, and "Received from Admin" for the customer.</p>
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
      {tab === 'users' && <Card>
        <h2 className="font-bold">Users</h2>
        <p className="text-sm text-gray-500 mt-2">{adminUsers === null ? 'Loading users…' : adminUsers.length >= 100 ? 'Showing 100 users' : `${adminUsers.length} user${adminUsers.length === 1 ? '' : 's'}`}</p>
        <input className="w-full border rounded-lg px-3 py-2 mt-3 dark:bg-slate-800 dark:border-slate-600" value={adminUsersQuery} onChange={e => setAdminUsersQuery(e.target.value)} placeholder="Search by name, UID or referral code" />
        {adminUsers && adminUsers.some(m => m.numericUid === undefined) && (
          <Btn variant="ghost" className="mt-3" disabled={backfillBusy} onClick={assignMissingUids}>{backfillBusy ? 'Assigning IDs…' : '🪪 Assign missing IDs'}</Btn>
        )}
        {adminUsersMsg && <p className="text-sm text-green-600 mt-2">{adminUsersMsg}</p>}
        {adminUsersErr && <p className="text-sm text-red-600 mt-2">{adminUsersErr}</p>}
        {adminUsers === null ? <p className="text-sm text-gray-500 mt-3">Loading users…</p>
          : adminUsersFiltered.length === 0 ? <p className="text-sm text-gray-500 mt-3">No users found.</p>
          : <div className="space-y-2 mt-3">{adminUsersFiltered.map(m => (
            <div key={m.id} className="flex items-center gap-3 border rounded-lg px-3 py-2 flex-wrap">
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: m.colour }}>{m.displayName.charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                {editingUid === m.id ? (
                  <input className="w-full border rounded-lg px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-600" value={editName} onChange={e => setEditName(e.target.value)} maxLength={60} placeholder="Display name" />
                ) : (
                  <p className="font-medium truncate">{m.displayName}</p>
                )}
                <p className="text-xs text-gray-500">ID: {m.numericUid ?? m.referralCode ?? '—'} • Joined {m.createdAtMs ? new Date(m.createdAtMs).toLocaleDateString('en-GB') : 'Recently'}{bannedUids.includes(m.id) ? ' • 🚫 Banned' : ''}</p>
              </div>
              {editingUid === m.id ? (
                <div className="flex gap-2">
                  <Btn onClick={() => saveEditName(m)}>Save</Btn>
                  <Btn variant="ghost" onClick={() => { setEditingUid(null); setAdminUsersErr('') }}>Cancel</Btn>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Btn variant="ghost" onClick={() => { setEditingUid(m.id); setEditName(m.displayName); setAdminUsersMsg(''); setAdminUsersErr('') }}>✏️ Edit</Btn>
                  {m.id !== uid && (bannedUids.includes(m.id)
                    ? <Btn variant="ghost" disabled={banBusyUid === m.id} onClick={() => toggleBan(m)}>✅ Unban</Btn>
                    : <Btn variant="ghost" disabled={banBusyUid === m.id} onClick={() => toggleBan(m)}>🚫 Ban</Btn>)}
                </div>
              )}
            </div>
          ))}</div>}
        <p className="text-sm mt-3">Dating KYC: {kycStatus === 'approved' ? `✅ Approved (${kycInfo?.verifiedAt ? new Date(kycInfo.verifiedAt).toLocaleDateString('en-GB') : ''}) — ${kycInfo?.name ?? ''} (${kycInfo?.idType ?? ''}, last 4 of ID: ${kycInfo?.idLast4 ?? ''})` : kycStatus === 'pending' ? '⏳ Under review — waiting for admin approval' : kycStatus === 'rejected' ? `❌ Rejected — ${kycRejectReason || 'No reason given'}` : '⏳ Not yet'}</p>
      </Card>}
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
      {tab === 'ads' && <Card>
        <h2 className="font-bold">📢 User Product Ads</h2>
        <p className="text-sm text-gray-500 mt-1">Only approved ads show in the Feed as Sponsored. Rates (Admin → Settings): CPM {formatBDT(adminSettings.ads?.cpmRateBDT ?? 50)} per 1000 views, CPC {formatBDT(adminSettings.ads?.cpcRateBDT ?? 3)} per click.</p>
        {adminAdsMsg && <p className="text-sm text-green-600 mt-2">{adminAdsMsg}</p>}
        {adminAds === null && <p className="text-sm text-gray-500 mt-2">Loading…</p>}
        {adminAds !== null && adminAds.length === 0 && <p className="text-sm text-gray-500 mt-2">No ads submitted yet.</p>}
        {adminAds !== null && adminAds.map(a => (
          <div key={a.id} className="py-3 border-b border-gray-100 dark:border-white/10 last:border-0">
            <div className="flex items-center gap-2">
              {a.photo && <img src={a.photo} alt={a.title} className="w-12 h-12 rounded-lg object-cover" />}
              <div className="flex-1">
                <p className="font-bold text-sm">{a.title}</p>
                <p className="text-xs text-gray-500">{a.ownerName} • {adPriceLabel(a.priceBDT)} • <a className="text-fb-blue" href={a.link} target="_blank" rel="noopener noreferrer">{a.link}</a></p>
                {a.description && <p className="text-xs text-gray-500 mt-1">{a.description}</p>}
              </div>
            </div>
            <p className="text-sm mt-2">{adStatusLabel(a.status)} • 👁️ {a.views.toLocaleString('en-IN')} views • 🖱️ {a.clicks.toLocaleString('en-IN')} clicks • Amount due: <b>{adRatesSet(adminSettings.ads ?? { cpmRateBDT: 50, cpcRateBDT: 3 }) ? formatBDT(adAmountDue(a, adminSettings.ads ?? { cpmRateBDT: 50, cpcRateBDT: 3 })) : 'Free — rates not set'}</b></p>
            {a.status === 'pending' && <div className="flex gap-2 mt-2">
              <Btn onClick={() => reviewAd(a.id, 'approved')}>Approve</Btn>
              <Btn variant="ghost" onClick={() => reviewAd(a.id, 'rejected')}>Reject</Btn>
            </div>}
          </div>
        ))}
        <Btn variant="ghost" className="mt-3" onClick={refreshAdminAds}>Refresh</Btn>
      </Card>}
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
  const { user, login, profileDob, gender, district, thana, address, hideAddress, profilePhoto, galleryPhotos, interests, updateProfile: saveProfile, kycInfo, recoveryEmail, recoveryPhone, recoveryEmailVerified, recoveryPhoneVerified, twoFactorEnabled, updateSecurity } = useStore()
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
  // পুনরুদ্ধার + দুই ধাপ — ইমেইল + মোবাইল দুটোই (ঐচ্ছিক); ইমেইলের যাচাই
  // কোড আসল OTP পথে যায়। মোবাইল নম্বর শুধু সংরক্ষণ করা হয় — SMS যাচাই
  // বন্ধ (মালিকের সিদ্ধান্ত ২০২৬-১১-২৪), তাই recoveryPhoneVerified আর
  // SMS-এ true হয় না।
  const [recEmail, setRecEmail] = useState(recoveryEmail)
  const [recPhone, setRecPhone] = useState(recoveryPhone)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [secMsg, setSecMsg] = useState('')
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
    // পুনরুদ্ধার যোগাযোগ — বদলালে যাচাই আবার করতে হয় (আগের যাচাই বাতিল)।
    const re = recEmail.trim().toLowerCase()
    const rp = normalizeBdPhone(recPhone) || recPhone.trim()
    updateSecurity({
      recoveryEmail: re,
      recoveryPhone: rp,
      recoveryEmailVerified: re !== '' && re === recoveryEmail ? recoveryEmailVerified : false,
      recoveryPhoneVerified: rp !== '' && rp === recoveryPhone ? recoveryPhoneVerified : false,
    })
    setSaved('✅ Profile saved.')
  }
  const sendRecoveryEmailOtp = async () => {
    const mail = recEmail.trim().toLowerCase()
    if (!mail.includes('@')) { setSecMsg('Enter a valid email.'); return }
    setSecMsg('')
    const r = await sendEmailOtp(mail)
    if (!r || !r.ok) { setSecMsg('Email OTP is not on yet — the admin is setting it up.'); return }
    setEmailOtpSent(true)
    setSecMsg('A 6-digit code has been sent to your email — valid for 10 minutes.')
  }
  const verifyRecoveryEmailOtp = async () => {
    const code = emailOtp.trim()
    if (!/^\d{6}$/.test(code)) { setSecMsg('Enter the 6-digit code.'); return }
    const mail = recEmail.trim().toLowerCase()
    const r = await verifyEmailOtp(mail, code)
    if (r && r.ok) {
      updateSecurity({ recoveryEmail: mail, recoveryEmailVerified: true })
      setSecMsg('Recovery email verified.')
      return
    }
    if (r && r.error === 'expired') setSecMsg('The code has expired — send OTP again.')
    else if (r && r.error === 'not_configured') setSecMsg('Email OTP is not on yet — the admin is setting it up.')
    else setSecMsg('The code is wrong — check and enter it again.')
  }
  const inputCls = 'w-full border rounded-lg px-3 py-2 mt-1 dark:bg-slate-800 dark:border-slate-600'
  return (
    <Card>
      <div className="flex justify-between items-center">
        <h2 className="font-bold flex items-center gap-2"><IconSettings className="w-5 h-5" /> Profile Settings</h2>
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
      {/* পুনরুদ্ধার + দুই ধাপের যাচাই — ইমেইল + মোবাইল দুটোই (ঐচ্ছিক, সম্পাদনাযোগ্য)।
          শুধু users/{uid} ব্যক্তিগত ডকে থাকে — publicProfiles-এ কখনো নয়, অন্য
          ব্যবহারকারীর কাছে মোবাইল নম্বর দেখানো হয় না। মোবাইলে SMS যাচাই নেই
          (SMS বন্ধ) — নম্বরটি শুধু সংরক্ষণ করা হয়। */}
      <div className="mt-5 border-t border-gray-100 dark:border-white/10 pt-4">
        <h3 className="font-bold flex items-center gap-2"><IconShield className="w-5 h-5 text-violet-500" /> Recovery & Two-Step Verification</h3>
        <p className="text-xs text-gray-400 mt-1">Add a second contact so you can get back into your account. Only you can see these — they are never shown to other users.</p>
        <label className="text-sm font-medium mt-4 block">Recovery Email {recoveryEmailVerified
          ? <span className="text-[11px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 px-2 py-0.5 rounded-full font-bold">✓ Verified</span>
          : <span className="text-[11px] bg-gray-100 dark:bg-slate-700 text-gray-500 px-2 py-0.5 rounded-full font-bold">Not verified</span>}</label>
        <div className="relative mt-1">
          <IconMail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
          <input className={inputCls + ' pl-10'} value={recEmail} onChange={e => { setRecEmail(e.target.value); if (e.target.value.trim().toLowerCase() !== recoveryEmail) updateSecurity({ recoveryEmailVerified: false }) }} placeholder="you@example.com" inputMode="email" />
        </div>
        <Btn variant="ghost" className="mt-2 !py-2.5 !rounded-xl" onClick={sendRecoveryEmailOtp}>{emailOtpSent ? 'Send OTP again' : 'Send OTP'}</Btn>
        {emailOtpSent && (
          <div className="mt-2 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800 p-3">
            <label className="text-sm font-medium">6-digit code</label>
            <div className="relative mt-1">
              <IconLock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
              <input className={inputCls + ' pl-10 text-center tracking-[0.5em] font-semibold'} value={emailOtp} onChange={e => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" />
            </div>
            <Btn className="w-full mt-2 !py-3 !rounded-xl" onClick={verifyRecoveryEmailOtp}>Verify recovery email</Btn>
          </div>
        )}
        <label className="text-sm font-medium mt-4 block">Recovery Mobile Number</label>
        <div className="relative mt-1">
          <IconCall className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
          <input className={inputCls + ' pl-10'} value={recPhone} onChange={e => { setRecPhone(e.target.value); if ((normalizeBdPhone(e.target.value) || e.target.value.trim()) !== recoveryPhone) updateSecurity({ recoveryPhoneVerified: false }) }} placeholder="01XXXXXXXXX" inputMode="tel" />
        </div>
        <p className="text-xs text-gray-400 mt-1">Saved with your profile — no SMS code is sent to this number.</p>
        <div className="flex items-center justify-between gap-2 mt-4 text-sm">
          <span className="font-medium flex items-center gap-2"><IconLock className="w-4 h-4 text-violet-500" /> Two-step verification</span>
          <button onClick={() => updateSecurity({ twoFactorEnabled: !twoFactorEnabled })} className={`px-3 py-1.5 rounded-full font-bold ${twoFactorEnabled ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>{twoFactorEnabled ? 'On' : 'Off'}</button>
        </div>
        <p className="text-xs text-gray-400 mt-1">When on, login will ask for a second code by email once the admin sets it up.</p>
        {secMsg && <p className="text-sm text-center mt-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300">{secMsg}</p>}
      </div>
      <Btn className="w-full mt-5" onClick={save}>Save Profile</Btn>
      {saved && <p className="text-sm text-green-600 mt-2">{saved}</p>}
    </Card>
  )
}

export function MenuPage() {
  const { user, totalPi, logout, isAdmin, soundSettings, setSoundSettings, callPrivacy, setCallPrivacy, uid, referralCode, friends, posts, profilePhoto, blockedUids, blockedNames, unblockUser } = useStore()
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
  // মেনুর ছোট লিংক তালিকা — টাইল/কার্ড নয়, শুধু লাইন লিংক। সাইডবার শুধু
  // কম্পিউটারে দেখায়, তাই মোবাইলে এই তালিকাই সব পেজে পৌঁছানোর রাস্তা।
  // Marketplace আর Services একই জিনিস (মালিকের সিদ্ধান্ত ২০২৬-১১-২৪) —
  // শুধু Services-ই আছে, Marketplace লিংক কোথাও নেই।
  const moreLinks = [
    { to: '/feed', label: 'Feed', icon: '📰' },
    { to: '/friends', label: 'Friends', icon: '👥' },
    { to: '/dating', label: 'Dating 18+', icon: '❤️' },
    { to: '/live-tv', label: 'Live TV', icon: '📺' },
    { to: '/services', label: 'Services', icon: '💼' },
    { to: '/reels', label: 'Reels', icon: '🎬' },
    { to: '/wallet', label: 'Wallet', icon: '💰' },
    { to: '/call-history', label: 'Call History', icon: '📞' },
    { to: '/ads', label: 'Ads', icon: '📢' },
    { to: '/groups', label: 'Groups & Pages', icon: '👥' },
    // অ্যাডমিন লিংক শুধু অ্যাডমিনের মেনুতে দেখায় — সাধারণ ব্যবহারকারীর মেনুতে অ্যাডমিন থাকে না
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: '🛡️' }] : [])
  ]
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <div className="flex flex-col items-center text-center">
          {profilePhoto
            ? <img src={profilePhoto} alt="Profile photo" className="w-20 h-20 rounded-full object-cover ring-4 ring-[#e7e0f2] dark:ring-[#372b52]" />
            : <span className="w-20 h-20 rounded-full pb-gradient text-white text-3xl flex items-center justify-center font-bold ring-4 ring-[#e7e0f2] dark:ring-[#372b52]">{user ? user.name.slice(0, 1) : '👤'}</span>}
          <p className="font-bold text-lg mt-2">{user ? user.name : 'Guest user'}</p>
          <p className="text-sm text-gray-500">{user?.email || 'Log in'}</p>
          <button onClick={() => navigate('/wallet')} className="mt-2 bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-200 border border-violet-200 dark:border-violet-700 font-bold px-3 py-1.5 rounded-full text-sm">{formatPi(totalPi)}</button>
        </div>
        {user && <div className="flex gap-2 mt-3 justify-center">
          <Btn variant="ghost" onClick={() => setShowProfileSettings(s => !s)}><span className="flex items-center gap-1"><IconSettings className="w-4 h-4" /> Profile Settings</span></Btn>
          <Btn variant="ghost" onClick={() => { logout(); navigate('/') }}>Log out</Btn>
        </div>}
        {!user && <Btn className="mt-3" onClick={() => navigate('/login')}>Log in</Btn>}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center border border-[#e7e0f2] dark:border-[#372b52] rounded-[16px] py-2"><p className="font-extrabold text-lg">{friends.length}</p><p className="text-xs text-gray-400">Friends</p></div>
          <div className="text-center border border-[#e7e0f2] dark:border-[#372b52] rounded-[16px] py-2"><p className="font-extrabold text-lg">{posts.length}</p><p className="text-xs text-gray-400">Posts</p></div>
          <div className="text-center border border-[#e7e0f2] dark:border-[#372b52] rounded-[16px] py-2"><p className="font-extrabold text-lg">{formatPi(totalPi)}</p><p className="text-xs text-gray-400">Pi balance</p></div>
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
      <Card>
        <h2 className="font-bold">🚫 Blocked users</h2>
        <p className="text-xs text-gray-500 mt-1">Blocked people cannot message or call you — their messages and calls simply do not reach you. They will see that you are not accepting messages or calls from them right now.</p>
        {blockedUids.length === 0
          ? <p className="text-sm text-gray-500 mt-2">No blocked users.</p>
          : blockedUids.map(id => (
            <div key={id} className="flex items-center gap-3 py-2">
              <span className="flex-1 font-medium">{friends.find(f => f.id === id)?.name ?? blockedNames[id] ?? `${id.slice(0, 8)}…`}</span>
              <Btn variant="ghost" onClick={() => unblockUser(id)}>Unblock</Btn>
            </div>
          ))}
      </Card>
      <Card>
        <h2 className="font-bold">More</h2>
        <div className="mt-1 divide-y divide-gray-100 dark:divide-white/10">
          {moreLinks.map(l => (
            <button key={l.to} onClick={() => navigate(l.to)} className="w-full flex items-center gap-2 py-2 text-left text-sm font-medium hover:text-violet-600">
              <span className="w-5 text-center">{l.icon}</span>
              {l.label}
              <span className="ml-auto text-gray-300">›</span>
            </button>
          ))}
        </div>
      </Card>
      <Card><p className="text-xs text-gray-400">PiCall v6 • Chat free, calls prepaid • First call's first 1 minute free • Call recording admin-only (for appeals, 30 days) • Terms and Privacy Policy apply.</p></Card>
    </div>
  )
}
