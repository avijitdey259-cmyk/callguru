# PiCall — আসল Gmail লগইন চালু করা (Firebase Setup)

> সাইটে Gmail ১-ক্লিক লগইন বোতাম তৈরি আছে। Firebase প্রজেক্টের তথ্য না থাকলে বোতাম ডেমো মোডে চলে। নিচের ধাপগুলো করলেই আসল Google লগইন চালু হবে। কোনো টাকা লাগে না — Firebase Spark (ফ্রি) প্ল্যানই যথেষ্ট।

## ধাপ ১ — Firebase প্রজেক্ট বানান (Step 1 — Create a Firebase project)

1. https://console.firebase.google.com খুলুন, নিজের Gmail দিয়ে লগইন করুন।
2. **Add project** → নাম দিন (যেমন `picall`) → Google Analytics ছাড়াই এগিয়ে যান → **Create project**।
3. বাম মেনু **Build → Authentication** → **Get started** → **Sign-in method** ট্যাবে **Google** চালু করুন (Enable) → সাপোর্ট ইমেইল দিয়ে **Save** করুন।

## ধাপ ২ — Web App-এর তথ্য নিন (Step 2 — Get the web app config)

1. প্রজেক্টের হোমে (⚙️ Settings → **Project settings**) **Your apps** → **Web app (`</>`)** যোগ করুন, নাম দিন `PiCall`।
2. Firebase Hosting সেটআপের টিক না দিয়ে **Register app** করুন।
3. যে config দেখাবে, সেখান থেকে এই ৪টি মান নিন (আর ২টি থাকলে সেগুলোও):
   - `apiKey`, `authDomain`, `projectId`, `appId`
   - (যদি থাকে) `storageBucket`, `messagingSenderId`

## ধাপ ৩ — Netlify-তে মানগুলো বসান (Step 3 — Set them as Netlify env vars)

Netlify ড্যাশবোর্ড → সাইট `callguru-app` → **Site settings → Environment variables** → **Add a variable**:

| Variable | Value (ধাপ ২ থেকে) |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` (যদি থাকে) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` (যদি থাকে) |

তারপর **Deploys → Trigger deploy → Deploy site** চাপুন (env var বদলালে নতুন deploy লাগে)।

## ধাপ ৪ — যাচাই করুন (Step 4 — Verify)

1. https://callguru-app.netlify.app/login খুলুন — বোতামের নিচে "আসল Gmail লগইন চালু আছে" লেখা থাকবে।
2. **Gmail দিয়ে ১-ক্লিক লগইন** চাপুন → Google পপ-আপ আসবে → নিজের Gmail বাছুন → ফিডে ঢুকবেন, আপনার আসল নাম + ইমেইলে।

## জরুরি কথা (Important)

- এই মানগুলো (বিশেষ করে `apiKey`) কাউকে পাঠাবেন না, চ্যাটে বা কোডে বসাবেন না — শুধু Netlify env var-এ বসান। কোডে কোনো key লেখা নেই।
- OTP (SMS) লগইনের জন্য Firebase SMS ব্যবহার করবেন না — বাংলাদেশে প্রতি SMS $0.18 (~৳২২)। OTP-র জন্য লোকাল গেটওয়ে (BulkSMSBD / SSL Wireless, ৳০.২৫–০.৫০/SMS) ব্যবহার হবে, সেটা পরে জোড়া হবে।
- Firebase Spark ফ্রি: লগইন ৫০,০০০ ইউজার/মাস পর্যন্ত ফ্রি, কার্ড লাগে না।
