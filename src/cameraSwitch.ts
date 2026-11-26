// PiCall ক্যামেরা বদল + স্ক্রিন শেয়ার — pure helpers (DOM/React নেই,
// node টেস্টে সরাসরি চলে)। মালিকের ফোনে (Android) দুটোই ভাঙা ছিল:
//  - ক্যামেরা বদল: অনুমতির আগেই গোনা camCount ১ দেখিয়ে বোতাম বন্ধ করে
//    দিত, আর {facingMode: ideal} চুপচাপ সামনের ক্যামেরাই ফিরিয়ে দিত —
//    তাই "বদল হচ্ছে না" মনে হতো, যদিও কোডে replaceTrack ছিল।
//  - স্ক্রিন শেয়ার: Android-এ (Chrome/PWA/WebView সবখানেই)
//    getDisplayMedia() আদৌ নেই — ডেস্কটপ-অনলি API। চেকটা ঠিক ছিল,
//    বার্তাটাই শেষ-মাথা ছিল ("browser not supported" — কোনো ফোন-ব্রাউজারে
//    কাজ করবে না, Chrome-এও নয়)। সৎ বার্তা: কম্পিউটার লাগবে।

export type CameraFacing = 'user' | 'environment'

export type VideoDeviceInfo = { deviceId: string; label: string; kind: string }

/** ক্যামেরা কয়টি — শুধু videoinput গোনা হয় (অডিও/অন্য ডিভাইস নয়)। */
export function countCameras(devices: VideoDeviceInfo[]): number {
  return devices.filter((d) => d.kind === 'videoinput').length
}

const BACK_LABEL = /back|rear|environment/i
const FRONT_LABEL = /front|user|face/i

/**
 * বদলের লক্ষ্য ক্যামেরা বেছে নেওয়া — deviceId দিয়েই (facingMode ideal-এর
 * মতো চুপচাপ ভুল ক্যামেরা ফেরায় না)। লেবেল মিললে সেটাই, না মিললে বর্তমান
 * deviceId ছাড়া যেকোনো ক্যামেরা; আর কোনো ক্যামেরা না থাকলে null।
 */
export function pickCameraDevice(
  devices: VideoDeviceInfo[],
  currentDeviceId: string | null,
  want: CameraFacing,
): VideoDeviceInfo | null {
  const videos = devices.filter((d) => d.kind === 'videoinput')
  if (videos.length === 0) return null
  const labelRe = want === 'environment' ? BACK_LABEL : FRONT_LABEL
  const labelled = videos.filter((d) => labelRe.test(d.label))
  const otherLabelled = labelled.find((d) => d.deviceId !== currentDeviceId)
  if (otherLabelled) return otherLabelled
  const other = videos.find((d) => d.deviceId !== currentDeviceId)
  return other ?? null
}

/** ক্যামেরা বদলের চেষ্টার ধারা: deviceId exact → facingMode exact → facingMode ideal। */
export function cameraConstraintAttempts(
  deviceId: string | null,
  facing: CameraFacing,
): { video: { deviceId?: { exact: string }; facingMode?: { exact: CameraFacing } | CameraFacing } }[] {
  const attempts: { video: { deviceId?: { exact: string }; facingMode?: { exact: CameraFacing } | CameraFacing } }[] = []
  if (deviceId) attempts.push({ video: { deviceId: { exact: deviceId } } })
  attempts.push({ video: { facingMode: { exact: facing } } })
  attempts.push({ video: { facingMode: facing } })
  return attempts
}

/**
 * নতুন ট্র্যাক আসলেই অন্য ক্যামেরা কি না — ideal ফলব্যাকে একই ক্যামেরা
 * ফিরলে deviceId মিলে যায়; তখন "বদল হয়নি" বলাই সৎ। deviceId না জানা
 * গেলে (পুরোনো ব্রাউজার) মিথ্যা সন্দেহ করা হয় না — false ফেরে।
 */
export function isSameCameraDevice(
  oldDeviceId: string | null | undefined,
  newDeviceId: string | null | undefined,
): boolean {
  if (!oldDeviceId || !newDeviceId) return false
  return oldDeviceId === newDeviceId
}

// ---------- স্ক্রিন শেয়ার — সাপোর্ট যাচাই ----------

export type ScreenShareSupport =
  // message সব সদস্যেই আছে (সমর্থিত হলে undefined) — প্রজেক্ট strict:false,
  // তাই discriminated-union narrowing এখানে চলে না; message-এ সরাসরি
  // হাত দিতে হলে এভাবেই লিখতে হয়।
  | { supported: true; message?: string }
  | { supported: false; reason: 'mobile' | 'missing-api'; message: string }

/** Android/iOS ফোনে getDisplayMedia নেই — কম্পিউটার ব্রাউজার লাগবে (Chrome-ও ফোনে পারবে না)। */
export const SCREEN_SHARE_MOBILE_MESSAGE =
  'Screen sharing needs a computer browser — it does not work on Android phones yet. Join from a computer to share your screen.'
/** কম্পিউটারেও API না থাকলে (পুরোনো/অন্য ব্রাউজার) — কোন ব্রাউজারে হবে তা বলা হয়। */
export const SCREEN_SHARE_UNSUPPORTED_MESSAGE =
  'Screen sharing is not supported in this browser — try Chrome or Edge on a computer.'

export function isMobileBrowser(userAgent: string, coarsePointer: boolean): boolean {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true
  return coarsePointer
}

/**
 * আসল সাপোর্ট যাচাই — মোবাইল আগে (কিছু Android Chrome getDisplayMedia
 * দেখালেও সবসময় প্রত্যাখ্যান করে), তারপর API-র অস্তিত্ব।
 */
export function getScreenShareSupport(env: {
  hasGetDisplayMedia: boolean
  userAgent?: string
  coarsePointer?: boolean
}): ScreenShareSupport {
  if (isMobileBrowser(env.userAgent ?? '', env.coarsePointer === true)) {
    return { supported: false, reason: 'mobile', message: SCREEN_SHARE_MOBILE_MESSAGE }
  }
  if (!env.hasGetDisplayMedia) {
    return { supported: false, reason: 'missing-api', message: SCREEN_SHARE_UNSUPPORTED_MESSAGE }
  }
  return { supported: true }
}
