// PiCall ইনকামিং-কল ওভারলে — হোম পেজে (আসলে লগইন থাকলে যেকোনো পেজে)
// কল এলে ফেসবুকের মতো কার্ড ভেসে ওঠে: কলকারীর নাম+ছবি, বড় ধরো/কাটো বোতাম।
// মোবাইলে উপরে পুরো চওড়া কার্ড, কম্পিউটারে নিচে-ডানে ভাসমান কার্ড —
// ফিচার দুই জায়গায় একই, শুধু লেআউট স্ক্রিন অনুযায়ী বদলায়।
// রিংটোন শেয়ার্ড সাউন্ড ইঞ্জিন দিয়ে বাজে (সেটিংস মেনে); ধরলে/কাটলে/
// মেয়াদ শেষ হলে (৬০ সেকেন্ড) সঙ্গে সঙ্গে থামে। কল-চলা পেজে (/call/*,
// /dating-live/*) ওভারলে ওঠে না — চলমান কলে রিং বাজে না।
// ইনভাইট আসে Firestore callInvites ডক থেকে (২০২৬-১১-২৫ রিবিল্ড) —
// পুরোনো presence-WebSocket পথ বাদ; কলকারী ডক লেখে, গ্রহণকারীর অ্যাপ
// শোনে, ধরলে/কাটলে স্ট্যাটাস বদলায় আর কলকারী কারণ জানতে পারে।
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { Avatar } from './avatar'
import {
  INVITE_TTL_MS,
  idleOverlayState,
  reduceInviteAnswered,
  reduceInviteArrived,
  reduceInviteCleared,
  reduceInviteDeclined,
  shouldShowInvite,
  type CallInvite,
  type InviteOverlayState,
} from './incomingCall'
import { gateReasonToInviteStatus, inviteDocToCallInvite, type CallInviteDoc } from './callInvites'
import { subscribeCallInviteDoc, subscribeIncomingCallInvites, updateCallInviteStatus } from './firestore'
import { shouldPlayRingtone, startRingtone } from './sounds'
import { colourForUid } from './newMembers'

/** এই পাথগুলোতে থাকলে ব্যবহারকারী কলে আছেন — নতুন ইনভাইটে ওভারলে নয়। */
function isInCallPath(pathname: string): boolean {
  return pathname.startsWith('/call/') || pathname.startsWith('/dating-live/') || pathname.startsWith('/dating-go-live')
}

function avatarColor(invite: CallInvite): string {
  return invite.fromColor || colourForUid(invite.fromId)
}

/**
 * ইনকামিং-কল কার্ড — ধরো/কাটো বোতামই কার্ডের সবচেয়ে বড় আর চোখে পড়ার অংশ
 * (মালিকের স্পষ্ট নির্দেশ, ২০২৬-১১-২৩): দুটো বোতামই বড়, পুরো চওড়া, ট্যাপ করার মতো।
 */
export function IncomingCallCard({ invite, photo, onAccept, onDecline }: {
  invite: CallInvite
  photo?: string
  onAccept: () => void
  onDecline: () => void
}) {
  const color = avatarColor(invite)
  return (
    <div
      role="alert"
      aria-label={`${invite.fromName} is calling`}
      className="fixed z-[60] inset-x-0 top-0 md:inset-x-auto md:top-auto md:bottom-6 md:right-6 md:w-[360px] bg-white dark:bg-fb-card shadow-2xl md:rounded-2xl border-b md:border border-gray-200 dark:border-slate-700 p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar photo={photo} name={invite.fromName} color={color} className="w-14 h-14 text-2xl" />
        <div className="min-w-0">
          <p className="font-extrabold text-lg truncate">{invite.fromName}</p>
          <p className="text-sm text-gray-500">📹 Video call incoming…</p>
        </div>
        <span className="ml-auto text-2xl animate-pulse" aria-hidden>📞</span>
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onDecline}
          className="flex-1 py-3.5 rounded-full bg-red-600 text-white text-lg font-extrabold active:scale-[0.98]"
        >
          ❌ Decline
        </button>
        <button
          onClick={onAccept}
          className="flex-1 py-3.5 rounded-full bg-green-600 text-white text-lg font-extrabold active:scale-[0.98]"
        >
          📞 Answer
        </button>
      </div>
    </div>
  )
}

/** গ্লোবাল হোস্ট — App.tsx-এ Layout রুটের ভেতরে একবারই বসে। */
export function IncomingCallHost() {
  const { user, uid, referralCode, friends, soundSettings, callPrivacy, blockedUids } = useStore()
  const navigate = useNavigate()
  const loc = useLocation()
  const [overlay, setOverlay] = useState<InviteOverlayState>(idleOverlayState())
  const ringStopRef = useRef<(() => void) | null>(null)
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // এখন বাজতে থাকা ইনভাইট ডক — ধরো/কাটোতে এর স্ট্যাটাস বদলায়
  const inviteDocRef = useRef<CallInviteDoc | null>(null)
  const dismissUnsubRef = useRef<(() => void) | null>(null)
  // কলব্যাকের ভেতরে সবসময় তাজা মান — বন্ধু তালিকা/সেটিংস/পাথ বদলালেও ঠিক থাকে
  const liveRef = useRef({ friends, soundSettings, callPrivacy, blockedUids, pathname: loc.pathname })
  liveRef.current = { friends, soundSettings, callPrivacy, blockedUids, pathname: loc.pathname }

  const stopRingtone = () => {
    if (ringStopRef.current) { try { ringStopRef.current() } catch { /* ignore */ } ringStopRef.current = null }
  }
  const clearExpireTimer = () => {
    if (expireTimerRef.current !== null) { clearTimeout(expireTimerRef.current); expireTimerRef.current = null }
  }
  const clearOverlay = () => {
    stopRingtone()
    clearExpireTimer()
    inviteDocRef.current = null
    if (dismissUnsubRef.current) { dismissUnsubRef.current(); dismissUnsubRef.current = null }
    setOverlay(reduceInviteCleared)
  }

  // ইনভাইট এলে: গেটিং → ওভারলে + রিংটোন (৬০ সেকেন্ডের মধ্যে না ধরলে নিজে থেকে থামে)
  useEffect(() => {
    const myId = uid ?? referralCode
    if (!user || !myId) return
    const unsub = subscribeIncomingCallInvites(myId, (docs) => {
      const doc = docs[0]
      if (!doc) {
        // বাজতে থাকা ইনভাইট মুছে গেছে (কলকারী কাটলেন/কল শেষ) — ওভারলে সরে
        if (inviteDocRef.current) clearOverlay()
        return
      }
      if (inviteDocRef.current?.id === doc.id) return // একই ইনভাইট আবার নয়
      const invite = inviteDocToCallInvite(doc)
      const { friends: fr, soundSettings: ss, callPrivacy: cp, blockedUids: bl, pathname } = liveRef.current
      const gate = shouldShowInvite(invite, {
        privacy: cp,
        isFriend: fr.some((f) => f.id === invite.fromId),
        inCall: isInCallPath(pathname),
        selfId: myId,
        isBlocked: bl.includes(invite.fromId),
      })
      if (!gate.show) {
        // ব্যস্ত/ব্লক/কল-প্রাইভেসি থাকলে কলকারীকে সঙ্গে সঙ্গে কারণসহ
        // জানিয়ে দেওয়া — উনি "কল যাচ্ছে না কেন" না বুঝে অপেক্ষায় থাকেন না
        if (gate.reason === 'in-call' || gate.reason === 'privacy-nobody' || gate.reason === 'privacy-friends' || gate.reason === 'blocked') {
          const status = gateReasonToInviteStatus(gate.reason)
          if (status) void updateCallInviteStatus(doc.id, status)
        }
        // মেয়াদোত্তীর্ণ হলে কিছু জানানো নয় — কলকারী ৬৫ সেকেন্ডে "No answer" দেখেন
        return
      }
      inviteDocRef.current = doc
      clearExpireTimer()
      setOverlay((prev) => reduceInviteArrived(prev, invite))
      if (shouldPlayRingtone(ss, false)) {
        stopRingtone()
        try { ringStopRef.current = startRingtone(ss) } catch { ringStopRef.current = null }
      }
      const remaining = Math.max(0, INVITE_TTL_MS - (Date.now() - invite.at))
      expireTimerRef.current = setTimeout(() => { clearOverlay() }, remaining)
      // ডক বদলালে/মুছলে (কলকারী কাটলেন, অন্য ডিভাইসে ধরলেন) ওভারলে সরে
      if (dismissUnsubRef.current) dismissUnsubRef.current()
      dismissUnsubRef.current = subscribeCallInviteDoc(doc.id, (d2) => {
        if (!d2 || d2.status !== 'ringing') clearOverlay()
      })
    })
    return () => { unsub?.(); clearOverlay() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, uid, referralCode])

  // পেজ বদলে /call/*-এ ঢুকলে বাজতে থাকা ওভারলে সরিয়ে ফেলা
  useEffect(() => {
    if (isInCallPath(loc.pathname)) clearOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname])

  if (overlay.status !== 'ringing') return null
  const invite = overlay.invite
  const accept = () => {
    stopRingtone()
    clearExpireTimer()
    const docId = inviteDocRef.current?.id
    if (docId) void updateCallInviteStatus(docId, 'accepted')
    setOverlay((prev) => reduceInviteAnswered(prev))
    setOverlay(idleOverlayState())
    navigate(`/call/${invite.code}`)
  }
  const decline = () => {
    stopRingtone()
    clearExpireTimer()
    const docId = inviteDocRef.current?.id
    if (docId) void updateCallInviteStatus(docId, 'declined')
    setOverlay((prev) => reduceInviteDeclined(prev))
    setOverlay(idleOverlayState())
  }
  return <IncomingCallCard invite={invite} photo={friends.find(f => f.id === invite.fromId)?.photo ?? inviteDocRef.current?.fromPhoto} onAccept={accept} onDecline={decline} />
}
