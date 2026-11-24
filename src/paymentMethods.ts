// পেমেন্ট মাধ্যমের চালু/বন্ধ — অ্যাডমিন সেটিংস থেকে নিয়ন্ত্রিত।
// এই ফাইলটি PURE (কোনো import নেই), তাই Node-এ সরাসরি টেস্ট করা যায়
// (tests/payment-methods.test.mjs)।
//
// নিয়ম:
// - প্রতিটি মাধ্যমের একটি on/off ফ্ল্যাগ থাকে (adminSettings.payments.enabled)।
// - ফ্ল্যাগ বন্ধ করলে শুধু মাধ্যমটি লুকায় — সংরক্ষিত নম্বর/ঠিকানা মোছা হয় না;
//   আবার চালু করলে আগের নম্বর/ঠিকানাই দেখায়।
// - পুরোনো সংরক্ষণে (enabled ঘর নেই) সব মাধ্যম চালু ধরা হয় — আগের আচরণ বদলায় না।

export type PaymentMethodId = 'bkash' | 'nagad' | 'rocket' | 'usdt' | 'binancePay' | 'piDeposit'

export type PaymentEnabledMap = Record<PaymentMethodId, boolean>

// টপ-আপ বোতামে যে লেবেলে মাধ্যম দেখায় (WalletPage-এর method state-এর মান)।
export const PAYMENT_METHODS: { id: PaymentMethodId; label: string }[] = [
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'rocket', label: 'Rocket' },
  { id: 'usdt', label: 'USDT' },
  { id: 'binancePay', label: 'Binance Pay' },
  { id: 'piDeposit', label: 'Pi Deposit' },
]

// টপ-আপে বোতাম হিসেবে দেখানো মাধ্যমগুলো — Pi Deposit আলাদা কার্ডে থাকে,
// টপ-আপের বোতাম তালিকায় নয়।
export const TOP_UP_METHODS: { id: PaymentMethodId; label: string }[] = PAYMENT_METHODS.filter((m) => m.id !== 'piDeposit')

export const DEFAULT_PAYMENT_ENABLED: PaymentEnabledMap = {
  bkash: true,
  nagad: true,
  rocket: true,
  usdt: true,
  binancePay: true,
  piDeposit: true,
}

export const PAYMENT_METHOD_IDS: PaymentMethodId[] = ['bkash', 'nagad', 'rocket', 'usdt', 'binancePay', 'piDeposit']

// সব মাধ্যম বন্ধ থাকলে টপ-আপ কার্ডে ফর্মের বদলে এই বার্তা দেখায়।
export const PAYMENTS_ALL_DISABLED_MESSAGE = 'কোনো পেমেন্ট মাধ্যম এখন চালু নেই — অ্যাডমিনকে জানান'

// Pi Deposit বন্ধ থাকলে Pi Deposit কার্ডে এই বার্তা দেখায়।
export const PI_DEPOSIT_DISABLED_MESSAGE = 'Pi Deposit এখন বন্ধ আছে — অ্যাডমিনকে জানান'

// আংশিক/পুরোনো/ভুল enabled ঘরকে পূর্ণ ম্যাপে নরমালাইজ করে —
// না থাকা বা boolean নয় এমন ঘর চালু (true) ধরা হয়।
export function normalizePaymentEnabled(input: unknown): PaymentEnabledMap {
  const out: PaymentEnabledMap = { ...DEFAULT_PAYMENT_ENABLED }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  const rec = input as Record<string, unknown>
  for (const id of PAYMENT_METHOD_IDS) {
    if (typeof rec[id] === 'boolean') out[id] = rec[id] as boolean
  }
  return out
}

export function isPaymentMethodEnabled(enabled: unknown, id: PaymentMethodId): boolean {
  return normalizePaymentEnabled(enabled)[id]
}

// চালু থাকা টপ-আপ মাধ্যমের লেবেলগুলো, আগের ক্রমেই।
export function enabledTopUpMethods(enabled: unknown): string[] {
  const map = normalizePaymentEnabled(enabled)
  return TOP_UP_METHODS.filter((m) => map[m.id]).map((m) => m.label)
}

// টপ-আপের বর্তমান মাধ্যম: চালু থাকলে সেটাই, বন্ধ থাকলে প্রথম চালুটি,
// সব বন্ধ থাকলে null (তখন ফর্মের বদলে বন্ধ-বার্তা দেখায়)।
export function resolveTopUpMethod(enabled: unknown, selected: string): string | null {
  const list = enabledTopUpMethods(enabled)
  if (list.length === 0) return null
  if (list.includes(selected)) return selected
  return list[0]
}
