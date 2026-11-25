// PiCall call-failure reasons — one user calls another and the video call
// does not go through: the caller must see EXACTLY why, in plain English,
// on the call screen — never just "Could not connect to the server".
// The reason travels back to the caller through the Firestore callInvites
// doc status (src/callInvites.ts: declined/busy/not-friend/not-accepting),
// plus the room WS for declines via the service-worker push action.
// Pure module — no imports, fully covered by tests/call-failure-reasons.test.mjs.

/** Every reason a 1-to-1 call can fail before connecting. */
export type CallFailureReason =
  | 'busy'
  | 'offline'
  | 'no-credit'
  | 'not-friend'
  | 'not-accepting'
  | 'declined'
  | 'no-answer'
  | 'server'
  | 'call-not-found'
  | 'room-full'

export const CALL_FAILURE_REASONS: readonly CallFailureReason[] = [
  'busy', 'offline', 'no-credit', 'not-friend', 'not-accepting',
  'declined', 'no-answer', 'server', 'call-not-found', 'room-full',
]

/** Unknown/foreign value → a known reason, or null (never trust the wire blindly). */
export function parseFailureReason(v: unknown): CallFailureReason | null {
  if (typeof v !== 'string') return null
  return (CALL_FAILURE_REASONS as readonly string[]).includes(v) ? (v as CallFailureReason) : null
}

export function isCallFailureReason(v: unknown): v is CallFailureReason {
  return parseFailureReason(v) !== null
}

/**
 * The exact line the caller sees — plain English, with the callee's name
 * when it is known ("User" when it is not).
 */
export function callFailureMessage(reason: CallFailureReason, name: string): string {
  const who = name && name.trim() ? name.trim() : 'User'
  switch (reason) {
    case 'busy': return `${who} is busy on another call`
    case 'offline': return `${who} is offline`
    case 'no-credit': return 'Insufficient Pi balance — buy Pi first to call'
    case 'not-friend': return 'Not friends yet — send a friend request first'
    case 'not-accepting': return `${who} is not accepting calls right now`
    case 'declined': return `${who} declined the call`
    case 'no-answer': return `No answer — ${who} didn't pick up`
    case 'server': return 'Could not connect to the server — please try again.'
    case 'call-not-found': return 'The call was not found or has ended.'
    case 'room-full': return 'There are already 2 people on this call.'
  }
}

/**
 * The callee's invite gate (src/incomingCall.ts shouldShowInvite) → the
 * reason the caller is told. 'ok'/'self' send no reply at all, so null.
 * 'expired' means the callee's phone rang out the full 60 seconds — from
 * the caller's side that is "no answer".
 */
export function gateReasonToFailureReason(gateReason: string): CallFailureReason | null {
  switch (gateReason) {
    case 'in-call': return 'busy'
    case 'privacy-friends': return 'not-friend'
    case 'privacy-nobody': return 'not-accepting'
    case 'blocked': return 'not-accepting'
    case 'expired': return 'no-answer'
    default: return null
  }
}

/** A signalling error code from the call room → the reason the caller sees. */
export function callErrorToFailureReason(err: string): CallFailureReason {
  if (err === 'call-not-found') return 'call-not-found'
  if (err === 'room-full') return 'room-full'
  return 'server'
}

/**
 * Room socket closed before connecting — which reason the caller sees.
 * The no-answer timer is armed only while the caller is still waiting for
 * an answer (invite sent, nobody picked up yet): a socket dying then is
 * almost always an idle mobile/NAT socket or Railway cutting it — the real
 * situation is "nobody answered", not a dead server. Only when the socket
 * fails before any invite went out (timer never armed) is it a server error.
 */
export function closeWhileWaitingToFailureReason(waitingForAnswer: boolean): CallFailureReason {
  return waitingForAnswer ? 'no-answer' : 'server'
}

/**
 * No-answer wait — the callee's ringtone stops after the 60-second invite
 * TTL (src/incomingCall.ts INVITE_TTL_MS); 5 seconds of grace cover the
 * last signalling round-trip before the caller sees "No answer".
 */
export const NO_ANSWER_TIMEOUT_MS = 65000
