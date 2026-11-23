// প্রোফাইল সেটিংস — pure সাহায্যকারী (React/Firebase লাগে না, Node-এ টেস্ট করা যায়)।
// ব্যবহারকারী অ্যাকাউন্ট করার পর নিজের প্রোফাইল নিজে সাজায়: নাম, জন্মতারিখ,
// লিঙ্গ, জেলা, থানা, পুরো ঠিকানা (+ লুকানোর সুইচ), প্রোফাইল ছবি, গ্যালারি ছবি (সর্বোচ্চ ৮), ইন্টারেস্ট।
// পুরো ঠিকানা + জন্মতারিখ কখনো পাবলিক প্রোফাইলে যায় না (শুধু users/{uid} ডকে থাকে);
// পাবলিক প্রোফাইলে যায় শুধু লিঙ্গ, জেলা, ইন্টারেস্ট আর প্রোফাইল ছবির ছোট কপি (ম্যাচের জন্য)।

export type Gender = '' | 'Male' | 'Female'

export function isGender(v: unknown): v is 'Male' | 'Female' {
  return v === 'Male' || v === 'Female'
}

export type ProfileFields = {
  profileDob: string
  gender: Gender
  district: string
  thana: string
  address: string
  hideAddress: boolean
  profilePhoto: string
  galleryPhotos: string[]
  interests: string[]
}

export const EMPTY_PROFILE: ProfileFields = {
  profileDob: '',
  gender: '',
  district: '',
  thana: '',
  address: '',
  hideAddress: false,
  profilePhoto: '',
  galleryPhotos: [],
  interests: [],
}

// প্রোফাইল সম্পূর্ণতার হিসাব — মোট ১০০%:
// নাম ১৫% + ছবি ১৫% + জন্মতারিখ ১০% + লিঙ্গ ১০% + জেলা ১০% +
// থানা+ঠিকানা ১০% + গ্যালারি ১৫% (ছবির সংখ্যা অনুযায়ী, ৬টায় পূর্ণ) + ইন্টারেস্ট ১৫%।
export function profileCompletion(name: string, p: ProfileFields): number {
  let pct = 0
  if (name.trim()) pct += 15
  if (p.profilePhoto) pct += 15
  if (p.profileDob) pct += 10
  if (p.gender) pct += 10
  if (p.district) pct += 10
  if (p.thana.trim() || p.address.trim()) pct += 10
  const galleryCount = Math.min(p.galleryPhotos.filter(Boolean).length, 6)
  pct += Math.round((galleryCount / 6) * 15)
  if (p.interests.length > 0) pct += 15
  return Math.min(100, pct)
}
