// PiCall ইনকামিং-কল ওভারলে — হোম পেজে (আসলে লগইন থাকলে যেকোনো পেজে)
// কল এলে ফেসবুকের মতো কার্ড ভেসে ওঠে: কলকারীর নাম+ছবি, বড় ধরো/কাটো বোতাম।
// মোবাইলে উপরে পুরো চওড়া কার্ড, কম্পিউটারে নিচে-ডানে ভাসমান কার্ড —
// ফিচার দুই জায়গায় একই, শুধু লেআউট স্ক্রিন অনুযায়ী বদলায়।
// রিংটোন শেয়ার্ড সাউন্ড ইঞ্জিন দিয়ে বাজে (সেটিংস মেনে); ধরলে/কাটলে/
// মেয়াদ শেষ হলে (৬০ সেকেন্ড) সঙ্গে সঙ্গে থামে। কল-চলা পেজে (/call/*,
// /dating-live/*) ওভারলে ওঠে না — চলমান কলে রিং বাজে না।
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { Avatar } from './avatar'
import { connectPresence, disconnectPresence, sendInviteResponse } from './presence'
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
  const { user, uid, referralCode, friends, soundSettings, callPrivacy } = useStore()
  const navigate = useNavigate()
  const loc = useLocation()
  const [overlay, setOverlay] = useState<InviteOverlayState>(idleOverlayState())
  const ringStopRef = useRef<(() => void) | null>(null)
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // কলব্যাকের ভেতরে সবসময় তাজা মান — বন্ধু তালিকা/সেটিংস/পাথ বদলালেও ঠিক থাকে
  const liveRef = useRef({ friends, soundSettings, callPrivacy, pathname: loc.pathname })
  liveRef.current = { friends, soundSettings, callPrivacy, pathname: loc.pathname }

  const stopRingtone = () => {
    if (ringStopRef.current) { try { ringStopRef.current() } catch { /* ignore */ } ringStopRef.current = null }
  }
  const clearExpireTimer = () => {
    if (expireTimerRef.current !== null) { clearTimeout(expireTimerRef.current); expireTimerRef.current = null }
  }
  const clearOverlay = () => {
    stopRingtone()
    clearExpireTimer()
    setOverlay(reduceInviteCleared)
  }

  // ইনভাইট এলে: গেটিং → ওভারলে + রিংটোন (৬০ সেকেন্ডের মধ্যে না ধরলে নিজে থেকে থামে)
  useEffect(() => {
    const presenceId = uid ?? referralCode
    if (!user || !presenceId) return
    const conn = connectPresence(presenceId, user.name, {
      onInvite: (invite) => {
        const { friends: fr, soundSettings: ss, callPrivacy: cp, pathname } = liveRef.current
        const gate = shouldShowInvite(invite, {
          privacy: cp,
          isFriend: fr.some((f) => f.id === invite.fromId),
          inCall: isInCallPath(pathname),
          selfId: presenceId,
        })
        if (!gate.show) {
          // ব্যস্ত/ব্লক থাকলে কলকারীকে সঙ্গে সঙ্গে জানিয়ে দেওয়া — উনি অপেক্ষায় থাকেন না
          if (gate.reason === 'in-call' || gate.reason === 'privacy-nobody' || gate.reason === 'privacy-friends') {
            sendInviteResponse(invite.fromId, invite.code, false)
          }
          return
        }
        clearExpireTimer()
        setOverlay((prev) => reduceInviteArrived(prev, invite))
        if (shouldPlayRingtone(ss, false)) {
          stopRingtone()
          try { ringStopRef.current = startRingtone(ss) } catch { ringStopRef.current = null }
        }
        const remaining = Math.max(0, INVITE_TTL_MS - (Date.now() - invite.at))
        expireTimerRef.current = setTimeout(() => { clearOverlay() }, remaining)
      },
    })
    return () => { conn?.close(); disconnectPresence(); clearOverlay() }
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
    sendInviteResponse(invite.fromId, invite.code, true)
    setOverlay((prev) => reduceInviteAnswered(prev))
    setOverlay(idleOverlayState())
    navigate(`/call/${invite.code}`)
  }
  const decline = () => {
    stopRingtone()
    clearExpireTimer()
    sendInviteResponse(invite.fromId, invite.code, false)
    setOverlay((prev) => reduceInviteDeclined(prev))
    setOverlay(idleOverlayState())
  }
  return <IncomingCallCard invite={invite} photo={friends.find(f => f.id === invite.fromId)?.photo} onAccept={accept} onDecline={decline} />
}
