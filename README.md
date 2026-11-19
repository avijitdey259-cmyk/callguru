# CallGuru

Bilingual (English & Bengali) live pay-per-minute expert consultation, social community and creator marketplace — React 18 + Vite + TypeScript + Tailwind, with a small Express backend in `server/`.

**Live demo:** frontend works standalone in demo/local mode (localStorage seed data, no live backend required). Real Firebase Auth, SMS gateway, WebRTC signalling/TURN and payment gateways need real project credentials before real users.

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
- **Dating Live (paid, per minute):** inside the Dating page (after the 18+ gate) a "🔴 ডেটিং লাইভ" section lists 3 demo live hosts (seed viewers) and a "📹 লাইভে যান" button. Watching a live → `/dating-live/<profile-id>`: prepaid at the current admin-set `datingRate`, only the viewer pays, live meter shows total paid with the split live, auto-cut when the viewer's balance runs out, end screen shows the full breakdown. **Revenue split is fixed: live host gets 70%, admin gets 30%.** Going live → `/dating-go-live`: the user's own camera (front/back switch, front mirrored), LIVE badge, running timer, simulated viewer count, and a live earnings meter showing the host's 70% share accumulating; on end, the host's 70% is added to persisted `liveEarnings` (localStorage `callguru:liveEarnings`) and shown on the Dating page. Recording is the same red-dot admin-only rule. **Demo only:** the live video is the host's own camera preview and viewers are demo data — a real multi-phone broadcast needs a real live-streaming server, which is not built here.
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
- `server/index.js` — demo Express API (health, experts, top-up, call gate) with minimal CORS so the Netlify frontend can call it from a browser
