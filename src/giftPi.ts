// গিফট Pi — অ্যাপ ইন্সটলের ৫ π বোনাস; শুধু গিফট কেনা যাবে, কল/লাইভ দেখা/তোলায় নয়।
// কল/লাইভ/বুস্ট/সুপার লাইকের খরচ giftPi ছোঁয় না — শুধু গিফট পাঠানোই এখান থেকে কাটে।
// (pure logic — React/Firebase ছাড়া টেস্ট করা যায়।)
export const INSTALL_BONUS_PI = 5

export type GiftPiDraw = {
  fromGift: number
  fromBonus: number
  fromMain: number
  ok: boolean
}

/** গিফটের খরচের ভাগ — গিফট Pi আগে, তারপর বোনাস Pi, তারপর তোলা যায় এমন Pi।
 *  মোটের চেয়ে বেশি চাইলে ok=false, কিছুই কাটা যাবে না। */
export function planGiftSpend(gift: number, bonus: number, main: number, amount: number): GiftPiDraw {
  const m = Math.round(amount * 100000) / 100000
  if (!Number.isFinite(m) || m <= 0) return { fromGift: 0, fromBonus: 0, fromMain: 0, ok: false }
  const avail = Math.round((gift + bonus + main) * 100000) / 100000
  if (m > avail) return { fromGift: 0, fromBonus: 0, fromMain: 0, ok: false }
  const fromGift = Math.min(gift, m)
  const rest1 = Math.round((m - fromGift) * 100000) / 100000
  const fromBonus = Math.min(bonus, rest1)
  const fromMain = Math.round((rest1 - fromBonus) * 100000) / 100000
  return { fromGift, fromBonus, fromMain, ok: true }
}

/** ইন্সটল বোনাস একবারই — দাবি করা হয়ে থাকলে আর নয়। */
export function canClaimInstallBonus(claimed: boolean): boolean {
  return !claimed
}
