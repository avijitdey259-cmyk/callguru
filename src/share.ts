// শেয়ার হেল্পার — ফেসবুক-স্টাইল শেয়ারের শুদ্ধ (pure) অংশ।
// shareLink (pages.tsx) এগুলোই ব্যবহার করে; Node টেস্টে সরাসরি চলে।
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

// শেয়ার শিট বন্ধ করা (AbortError) ব্যর্থতা নয় — ব্যবহারকারী নিজেই বন্ধ
// করেছেন, তাই চুপচাপ থাকা যায়; বাকি ভুল আসল ব্যর্থতা
export function shareErrorToResult(err: unknown): 'cancelled' | 'failed' {
  return err instanceof DOMException && err.name === 'AbortError' ? 'cancelled' : 'failed'
}

// ইনভাইট লিংকের QR ছবি — লিংকটাই QR-এ এনকোড করা; ট্যাপ করলে শেয়ার হয়
export function inviteQrUrl(link: string, size = 180): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}`
}
