# CallGuru

Bilingual (English & Bengali) live pay-per-minute expert consultation, social community and creator marketplace — React 18 + Vite + TypeScript + Tailwind, with a small Express backend in `server/`.

**Live demo:** frontend works standalone in demo/local mode (localStorage seed data, no live backend required). The live server (WebSocket signalling + WebRTC, STUN only) is self-hosted in `server/` — see "Dating Live" below. Real Firebase Auth, SMS gateway, a TURN server and payment gateways still need real project credentials before real users.

## Key rules (v6)

- **Calls are PREPAID** — top-up first, no balance = no call. Live prepaid meter, auto-cut when balance runs out.
- **Chat is FREE** everywhere. Calls are NOT free.
- **Free minutes: NOT 2 minutes free.** Only the first call's first 1 minute free, for first users / first friend.
- Friend calls flat **৳10/min**; expert calls at the expert's own rate.
- Wallet packs **৳100–৳1,000**; bKash / Nagad / Bank / USDT (TRC20) top-up.
- Chat blocks phone numbers, WhatsApp/Facebook/Telegram links and emails (attempts logged, repeat attempts escalate).
- Dating is **18+ only**, 30 free likes/day, Premium ৳99/month, Boost ~৳10, Super Like 15 coins.
- Live TV: Bangladeshi channels only, in-app HLS player + official source link. No external video links.
- Call recordings are **admin-only, for appeals** (30-day retention). Call screen shows only a small red dot — no "Recording" text.
- **Camera switch:** in a call, the 🔄 "ক্যামেরা: সামনে/পেছনে" button switches front ↔ back camera (facingMode `user`/`environment`, exact first, plain fallback). Only the video track is restarted — audio, call timer and billing keep running. Front camera self-view is mirrored, back camera is not. If the device has only 1 camera, the button is disabled with a note. The pre-call screen also lets the user pick front/back before starting.
- **Dating video call (prepaid):** after a match only, a "📹 ভিডিও কল করুন (প্রিপেইড)" button appears on the match card and on the matched profile's card → `/call/dating/<profile-id>`. Rate is admin-adjustable from Admin → Revenue ("ডেটিং কল রেট (৳/মিনিট)", min ৳1, whole taka, default ৳10, saved to localStorage) — the pre-call screen, match card and profile button all show the current saved rate. **Only the caller pays**, no free minute (the global first-1-minute-free does not apply and is not consumed by a dating call), prepaid gate + auto-cut on empty balance like other calls. History records it as type `Dating`. Recording is the same as other calls: small red dot only, admin-only for appeals, no user record button. Friend calls stay at the flat ৳10/min FRIEND_RATE — only the dating rate is admin-adjustable.
- **Dating KYC (one-time, mandatory, admin-reviewed):** all of Dating is gated behind a one-time live KYC (`KycPage` in `src/pages.tsx`). Step 1 — পরিচয়: full name, date of birth (age must be 18+), ID type (NID / Passport / Birth Certificate), ID number — **the FULL NID number is stored from step 1** (`kycInfo.idNumber` in localStorage, alongside `idLast4` for short display) so the admin can match it; NID must be 10 or 17 digits, Passport/Birth Certificate at least 6 characters. **Warning: a full NID is sensitive personal data — in real production it must NOT be stored in plain text; encrypt it and use a verified KYC service.** Older submissions that only have the last 4 show "পুরো নম্বর সংরক্ষিত নেই (আগের জমা)" and the user can re-submit to provide the full number. Step 2 — লাইভ সেলফি: live front-camera preview, capture a selfie (downscaled to max 320px, JPEG 0.7) **plus a ~3-second live video clip** (MediaRecorder, 200 kbps; file-upload fallback has no video). Submit → status `pending`; **only an admin approval unlocks Dating** (`kycStatus: none | pending | approved | rejected` in `src/store.tsx`, `kycVerified` is derived = approved). While pending, Dating shows "⏳ KYC পর্যালোচনাধীন" and nothing else; if rejected, the admin's reason is shown with a "আবার KYC জমা দিন" button (re-submission resets to pending). **Admin review — Admin panel → "KYC যাচাই" tab:** shows the submitted name, DOB + age, ID type, **the FULL ID number** (or "পুরো নম্বর সংরক্ষিত নেই (আগের জমা)" for older submissions), ID last 4, submitted date, the selfie photo AND a playable live-video clip side by side so the admin can match the person, plus "✅ অনুমোদন করুন" / "❌ বাতিল করুন" (rejection needs a short reason, stored as `kycRejectReason`). Selfie, video and the full ID number are kept **only for admin verification** — not shared with other users, not uploaded anywhere (demo: localStorage on this device only); if video recording/storage fails, the selfie alone is used and the admin screen says the video could not be kept. **Admin live monitoring — same KYC tab, "🔴 চলমান লাইভ দেখুন" section:** lists currently live rooms from `GET /api/live` (host, viewer count, started time) with a "👁️ দেখুন" link to `/dating-live/<id>`; "এখন কেউ লাইভে নেই।" when empty, and a demo note when the backend is unreachable. Direct routes are guarded too: `/dating-live/:id`, `/dating-go-live` and `/call/dating/:id` show a status-aware blocked screen (pending / rejected with reason / no KYC) when not approved (no call starts, nothing is charged). Admin → users tab also shows the KYC status. **Demo KYC — no real government-database check; a verified KYC service is needed for real verification.** Previously verified (pre-review) users stay approved via the legacy `kycVerified` flag migration.
- **Dating Live (paid, per minute) — REAL live server:** inside the Dating page (after the 18+ gate) a "🔴 ডেটিং লাইভ" section lists live hosts and a "📹 লাইভে যান" button. **The live server is self-hosted in `server/index.js` — Express + `ws` WebSocket signalling on the same HTTP server/port (so it works on Railway's single PORT), no external service, no API keys.** REST: `GET /api/live` (live rooms), `POST /api/live` (create a room), `DELETE /api/live/:id` (end a room). WebSocket protocol (JSON, room = live room id): `join` {roomId, role: host/viewer, name}, `offer`/`answer`/`ice` relayed host↔viewer (viewer sends the offer, host answers — one RTCPeerConnection per viewer on the host side), `viewer-count` broadcast, `gift` broadcast, `chat` broadcast, `host-left` when the host disconnects. Frontend (`src/live.ts`): `fetchLiveRooms` / `createLiveRoom` / `endLiveRoom` / `connectLive` / `sendSignal`, WS URL derived from `VITE_API_URL` (https→wss). Watching a live → `/dating-live/<room-id>`: the viewer joins by WS, sends an offer, and receives the host's REAL camera stream into the video element. Going live → `/dating-go-live`: registers a room via `POST /api/live`, opens a WS as host, and answers each joining viewer's offer with the real camera tracks (front/back switch replaces the video track in every viewer connection). The Dating page shows real rooms from `GET /api/live` first (marked "আসল লাইভ", real viewer count, refresh button), with the 3 seed demo hosts below (marked "ডেমো") when the server is unreachable. When the server IS connected the screens show "🟢 লাইভ সার্ভার সংযুক্ত — আসল সম্প্রচার"; when not, they fall back gracefully to the old demo behaviour (own camera preview / simulated viewers) and say so — the app never crashes. **Limits (honest): STUN only** (`stun:stun.l.google.com:19302`, free, no key) — no TURN yet, so some strict NATs / mobile networks may fail to connect; TURN keys are a future step. **Mesh:** the host sends one stream per viewer, so it works for a small audience (roughly 5–8 viewers); a big audience needs an SFU (e.g. LiveKit) later. Watching a live is prepaid at the admin-set **live rate** (`liveRate`, default **৳৫/মিনিট** — separate from the dating call rate `datingRate`, default ৳১০/মিনিট; each has its own input + Save in Admin → Revenue, min ৳১/min, whole taka, saved to localStorage), only the viewer pays, live meter shows total paid with the split live, auto-cut when the viewer's balance runs out, end screen shows the full breakdown. **Revenue split is fixed: live host gets 70%, admin gets 30%.** **Live gifts (CallGuru coins only):** the watch screen has a gift shop — 🌹 গোলাপ ৫ কয়েন, ❤️ হার্ট ১০ কয়েন, 🎁 গিফট বক্স ২০ কয়েন, 💎 ডায়মন্ড ৫০ কয়েন (১ কয়েন = ৳১). Sending a gift deducts coins, shows the gift on screen and broadcasts it to the host over the live socket, and adds its value to the host's earnings at the same 70/30 split; not enough coins shows "কয়েন যথেষ্ট নয় — কয়েন কিনুন" with a button to the wallet. Coins are bought in the wallet (🪙 কয়েন কিনুন — ১০/৫০/১০০ কয়েন, wallet balance থেকে, ১ কয়েন = ৳১). No external gift purchase, no free gifts. Recording is the same red-dot admin-only rule.
- Affiliate commission (10%) only after the referred user's **first deposit AND first purchase** — never on signup/clicks alone. Referral is 2-tier (1.0 / 0.5 points, 1 point = ৳50).

## Run locally

```bash
npm install
npm run dev        # frontend on http://localhost:5173
npm run server     # demo API on http://localhost:4000 (optional)
npm run build      # production build -> dist/
```

## Deploy on Netlify

1. Create a Netlify site from this GitHub repo (or drag-and-drop `dist/`).
2. Build command: `npm run build` — Publish directory: `dist` (see `netlify.toml`; SPA redirect `/* -> /index.html` included).
3. Free subdomain is assigned automatically, e.g. `callguru.netlify.app`.

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API base URL, e.g. `https://callguru-production.up.railway.app`. The frontend (`src/api.ts`) reads it, fetches `/api/health` + `/api/experts` (5s timeout) and shows a "Live" badge on the marketplace; when it is empty or unreachable the site falls back to local seed data ("Demo") and keeps working fully. |
| `VITE_FIREBASE_API_KEY` etc. | Real Firebase Auth/Firestore (not included — add before real users) |

Never commit secrets, tokens or phone numbers to this repo.

## Structure

- `src/App.tsx` — routes (React Router)
- `src/pages.tsx` — all pages/flows (feed, marketplace, call, wallet, friends, chat, dating, Live TV, admin…)
- `src/store.tsx` — wallet/auth/call-history state (localStorage)
- `src/data.ts` — seed data + contact-ban check + TV channels
- `src/components.tsx` — Facebook-style layout, top bar, mobile bottom nav
- `src/api.ts` — backend client: reads `VITE_API_URL`, fetches `/api/health` + `/api/experts` (5s timeout), merges live rates/online status onto the seed, falls back to demo data when unreachable; `useExperts()` hook + Live/Demo indicator
- `src/live.ts` — live client: `fetchLiveRooms` / `createLiveRoom` / `endLiveRoom`, WebSocket signalling (`connectLive`, `sendSignal`), STUN-only `ICE_SERVERS`; returns null/false when the backend is unreachable so live pages fall back to demo
- `server/index.js` — Express API (health, experts, top-up, call gate) + self-hosted live server: `GET/POST/DELETE /api/live` rooms and WebSocket signalling (join/offer/answer/ice/gift/chat, viewer-count + host-left), minimal CORS so the Netlify frontend can call it from a browser
