// সিঙ্কের পরিচয়-রক্ষা — pure (Firebase/React ছাড়া, Node-এ পরীক্ষা করা যায়)।
// ২০২৬-১১-২৫: নতুন অ্যাকাউন্টের ডকে আগের সেশনের পরিচয় (নাম/ইমেইল/কল
// হিসাব) উঠে যাচ্ছিল — uid আর user আলাদা টিকে বসে (auth listener শুধু
// uid বসায়, login() পরে user বসায়), আর প্রথম-লগইন সিঙ্কের ইফেক্ট
// মাঝের রেন্ডারে (uid নতুন, user পুরোনো) লেখা শুরু করে দিত। এই গার্ড
// ছাড়া কোনো সিঙ্ক-লেখা চলবে না: লিখতে হলে uid + ইমেইল দুটোই বর্তমান
// Firebase ব্যবহারকারীর সঙ্গে মিলতে হবে — না মিললে লেখা বাদ, পরে আবার
// চেষ্টা হবে। নাম মেলানো হয় না — প্রোফাইলে বদলানো নাম Firebase
// displayName থেকে আলাদা হতে পারে, সেটা বৈধ।

/** সিঙ্ক করতে চাওয়া পরিচয় (স্টোরের state থেকে)। */
export type SyncIdentity = { uid: string; userEmail: string }
/** এখন সাইন-ইন করা Firebase ব্যবহারকারী (getCurrentAuthIdentity থেকে)। */
export type AuthIdentity = { uid: string; email: string } | null

/**
 * লেখার আগে: এই (uid, email) কি এখন সাইন-ইন করা Firebase ব্যবহারকারীরই?
 * fail-closed — auth পরিচয় না থাকলে, uid না মিললে, বা কোনো একদিকে
 * ইমেইল না থাকলে false (লেখা হবে না, পরে আবার চেষ্টা হবে)।
 */
export function identityMatchesSync(sync: SyncIdentity, auth: AuthIdentity): boolean {
  if (!auth) return false
  if (!sync.uid || auth.uid !== sync.uid) return false
  const a = sync.userEmail.trim().toLowerCase()
  const b = auth.email.trim().toLowerCase()
  if (!a || !b) return false
  return a === b
}

/** users/{uid} ডক পড়ার ফল — 'missing' (ডক নেই) আর 'error' (পড়া যায়নি:
 *  নিয়ম/নেটওয়ার্ক/টোকেন এখনো আসেনি) আলাদা; error-কে missing ধরে ডক
 *  আবার লেখা যাবে না — ২০২৬-১১-২৫ রাতে প্রোমা/সুস্মিতার ডক সাইন-ইনে
 *  এভাবেই আবার লেখা হয়ে createdAt বদলে গিয়েছিল। */
export type UserDocReadStatus = 'found' | 'missing' | 'error'

/** পড়ার ফল → সিঙ্ক কী করবে: found = ক্লাউড থেকে বসানো (hydrate),
 *  missing = স্থানীয় অবস্থা দিয়ে প্রথমবার লেখা, error = কিছুই লেখা নয়। */
export function syncDocAction(status: UserDocReadStatus): 'hydrate' | 'create' | 'abort' {
  if (status === 'found') return 'hydrate'
  if (status === 'missing') return 'create'
  return 'abort'
}
