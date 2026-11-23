// বাংলাদেশি মোবাইল নম্বর — pure সাহায্যকারী (React/Firebase লাগে না, Node-এ টেস্ট করা যায়)।
// +880 / 880 / বাংলা সংখ্যা / ফাঁকা/ড্যাশ — সব একই ১১ সংখ্যার নম্বরে আসে (01 দিয়ে শুরু)।
// ভুল নম্বরে null ফেরে। (Hisab-এর নম্বর-স্বাভাবিককরণের একই নিয়ম; এই রিপোতে আগে কোনো
// normaliser ছিল না, তাই এখানে যোগ করা হলো।)
const BN_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
}

export function normalizeBdPhone(raw: string): string | null {
  let d = raw.replace(/[০-৯]/g, (ch) => BN_DIGITS[ch] ?? ch).replace(/[\s\-()]/g, '')
  if (d.startsWith('+880')) d = '0' + d.slice(4)
  else if (d.startsWith('880')) d = '0' + d.slice(3)
  if (!/^01[3-9]\d{8}$/.test(d)) return null
  return d
}
