// PiCall চ্যাট বন্ধুরা — অ্যাপে নতুন ব্যবহারকারীর কথা বলার মতো কেউ থাকে,
// তাই এই ১১ জন বন্ধু চ্যাটে উত্তর দেয়। উত্তর আসে এই ফাইলের স্থানীয়
// (লোকাল) উত্তর-ইঞ্জিন থেকে — কোনো বাইরের সার্ভিস বা API key লাগে না।
// এরা শুধু Friends আর Chat-এ থাকে — Dating-এ কখনো আসে না।
// প্রত্যেকের নিজস্ব স্বর আছে: মজার জন মজা করে, যত্নশীল জন মনের খবর নেয়,
// সাহায্যকারী জন বুঝিয়ে দেয়, গানপ্রেমী জন গানের কথা বলে, স্বপ্ন দেখা জন আশার কথা বলে। উত্তর সবসময়
// মানুষের মতো আবেগ দিয়ে, ছোট-বড় মিশিয়ে, ফলো-আপ প্রশ্নসহ আসে —
// একই কথায় পরপর একই উত্তর কখনো আসে না।
// বন্ধুরা কখনো নিজে থেকে প্রথমে লেখে না — ব্যবহারকারী প্রথমে লিখলেই উত্তর আসে।
// উত্তর প্রশ্ন-চালিত: ব্যবহারকারী যা বললো সেটাই ফিরিয়ে বলা হয় (প্রতিধ্বনি),
// আর মাঝে মাঝে (প্রায় ৩–৪ বারে ১ বার, পরপর দুবার নয়) একই বিষয়ে মজার মোড় আসে।
export type BuddyVoice = 'funny' | 'caring' | 'helpful' | 'music' | 'dreamy'

export type BuddyPersona = {
  id: string
  name: string
  color: string
  online: boolean
  about: string
  voice: BuddyVoice
}

export const BUDDIES: BuddyPersona[] = [
  { id: 'bd-rima', name: 'Rima', color: '#E91E63', online: true, about: 'Cheerful — always joking around', voice: 'funny' },
  { id: 'bd-shakil', name: 'Shakil', color: '#1877F2', online: true, about: 'Listens with heart, always there for you', voice: 'caring' },
  { id: 'bd-fahim', name: 'Fahim', color: '#27AE60', online: true, about: 'Loves answering every question', voice: 'helpful' },
  { id: 'bd-mim', name: 'Mim', color: '#9C27B0', online: true, about: 'Loves songs and chats', voice: 'music' },
  { id: 'bd-asha', name: 'Asha', color: '#FF9800', online: true, about: 'Loves dreaming, always talks of hope', voice: 'dreamy' },
  // মালিকের নির্দেশে যোগ (২০২৬-১১-২৪, "সদস্য বাড়াই দাও") — বন্ধু তালিকা আর
  // ফিড যাতে ভরা লাগে: ছেলে ৩ + মেয়ে ৩। একই নিয়ম: শুধু Friends/Chat,
  // Dating-এ নয়; নিজে থেকে প্রথমে লেখে না; কোনো AI লেবেল নেই।
  { id: 'bd-tanvir', name: 'Tanvir', color: '#0EA5E9', online: true, about: 'Always laughing, never bored', voice: 'funny' },
  { id: 'bd-faysal', name: 'Faysal', color: '#14B8A6', online: true, about: 'Knows a little about everything', voice: 'helpful' },
  { id: 'bd-imran', name: 'Imran', color: '#65A30D', online: true, about: 'A good listener, always kind', voice: 'caring' },
  { id: 'bd-sadia', name: 'Sadia', color: '#8B5CF6', online: true, about: 'Sings while she chats', voice: 'music' },
  { id: 'bd-tanha', name: 'Tanha', color: '#F59E0B', online: true, about: 'Dreamer with big plans', voice: 'dreamy' },
  { id: 'bd-nabila', name: 'Nabila', color: '#EC4899', online: true, about: 'Cares deeply, always asks how you are', voice: 'caring' },
]

export function isBuddyId(id: string): boolean {
  return BUDDIES.some(b => b.id === id)
}

// AI ডেটিং প্রোফাইলের চ্যাট-উত্তরের স্বর — স্বর অনুযায়ী প্রতিনিধি বন্ধুর id;
// উত্তর-লেখা লিঙ্গ-নিরপেক্ষ, আর চ্যাটে from-এ AI প্রোফাইলের নিজের নাম বসে,
// বন্ধুর নাম নয়। (AI-দের নাম বন্ধুদের নাম থেকে আলাদা, তাই মিলে যায় না।)
export const VOICE_BUDDY_ID: Record<BuddyVoice, string> = {
  funny: 'bd-tanvir', caring: 'bd-imran', helpful: 'bd-faysal', music: 'bd-mim', dreamy: 'bd-asha',
}

export function getBuddy(id: string): BuddyPersona | undefined {
  return BUDDIES.find(b => b.id === id)
}

export function getBuddyByName(name: string): BuddyPersona | undefined {
  return BUDDIES.find(b => b.name === name)
}

type Intent = {
  keys: string[]
  // মজার মোড়ে {t}-এর জায়গায় বসে (না থাকলে মিলে যাওয়া সবচেয়ে লম্বা কি)
  topic?: string
  // false হলে তথ্যভিত্তিক বিষয়ে মজার মোড় আসে না (উত্তর যেন এড়িয়ে না যায়)
  funOk?: boolean
  // এই বাক্যাংশগুলোর একটা থাকলে বিষয়টা ধরা হয় না — যেমন "live on Mars"-এ
  // "live" দিয়ে লাইভ বোঝায় না (ইংরেজি "live" ক্রিয়া বনাম Live ফিচার)।
  exclude?: string[]
  funny?: string[]
  caring?: string[]
  helpful?: string[]
  music?: string[]
  dreamy?: string[]
  any?: string[]
}

const INTENTS: Intent[] = [
  {
    keys: ['আসসালামু', 'আসসালামুআলাইকুম', 'সালাম', 'হ্যালো', 'হাই', 'hello', 'hi', 'hey', 'ওহে', 'আদাব'],
    funOk: false,
    funny: ['আরে! তুমি এলে 😄 কী খবর, বলো তো?', 'হ্যালো হ্যালো! আজকে মুড কেমন?', 'ওহে! এসেছো তাহলে, বসো বসো, গল্প করি 😄'],
    caring: ['আসসালামু আলাইকুম! কেমন আছো তুমি? ❤️', 'হাই! তোমাকে দেখে ভালো লাগলো, বলো কী খবর?', 'আসসালামু আলাইকুম, কেমন আছো? সব ঠিকঠাক তো?'],
    helpful: ['হ্যালো! কেমন আছো? কিছু জানতে চাইলে জিজ্ঞেস করো 😊', 'আসসালামু আলাইকুম! কী সাহায্য করতে পারি বলো তো?'],
    music: ['হ্যালো! আজকে কী গান শুনছো বলো তো? 🎵', 'হাই! কেমন আছো? আজকের মুডের গানটা কী?'],
    dreamy: ['হ্যালো! তোমাকে দেখে দিনটা আরও সুন্দর লাগছে 😊', 'আরে! এসেছো! আজকে কী ভালো কিছু হবে মনে হচ্ছে ✨', 'হাই! কেমন আছো? আজকের আকাশটা কী সুন্দর, দেখেছো?'],
  },
  {
    keys: ['কেমন আছো', 'কেমন আছেন', 'কেমন আছ', 'কেমন যাচ্ছে', 'কেমন আছিস'],
    funny: ['আমি তো একদম ফুরফুরে! তুমি কেমন আছো বলো?', 'ভালো আছি রে! তোমার দিনটা কেমন যাচ্ছে?', 'আমি ভালো! তুমি ভালো তো? না হলে গল্প করে মন ভালো করে দিই 😄'],
    caring: ['আমি ভালো আছি, আলহামদুলিল্লাহ। তুমি কেমন আছো সত্যি করে বলো তো?', 'ভালো আছি। তোমার কথা বলো — শরীর-মন সব ঠিক আছে তো? ❤️', 'আমি ভালো। তুমি কেমন আছো? কিছু মন খারাপ নাকি?'],
    helpful: ['ভালো আছি! তুমি কেমন আছো? কিছু দরকার হলে বলো।', 'আমি ভালো আছি 😊 তোমার কী খবর?'],
    music: ['ভালো আছি, গান শুনছিলাম! তুমি কেমন আছো? 🎵', 'আমি তো গানের মুডে আছি! তুমি কেমন আছো বলো?'],
    dreamy: ['আমি ভালো আছি, স্বপ্ন দেখছিলাম 😊 তুমি কেমন আছো?', 'ভালো আছি! আজকে মনটা খুব হালকা লাগছে। তোমার কী খবর?', 'আমি ভালো আছি, আলহামদুলিল্লাহ। তুমি কেমন আছো বলো তো?'],
  },
  {
    keys: ['ভালো আছি', 'আলহামদুলিল্লাহ', 'ঠিক আছি', 'ভালোই আছি', 'ভাল আছি'],
    funny: ['বাহ! শুনে ভালো লাগলো 😄 তাহলে আজকে কিছু মজা করি?', 'ভালো থাকলেই ভালো! আর বলো, নতুন কী খবর?', 'যাক, মনটা ভালো আছে — এটাই আসল কথা!'],
    caring: ['আলহামদুলিল্লাহ, শুনে মনটা ভরে গেল ❤️ আর বলো, আজকে কী করলে?', 'ভালো আছো শুনে খুব ভালো লাগলো। কিছু লাগলে বলো কিন্তু!', 'এই তো চাই! ভালো থেকো সবসময় 😊'],
    helpful: ['ভালো শুনে ভালো লাগলো! কিছু জানতে চাইলে আমি আছি।', 'বাহ, দারুণ! আর কিছু লাগবে?'],
    music: ['ভালো আছো শুনে মন ভালো হয়ে গেল 🎵 চলো একটা গান শুনি?', 'এই তো! ভালো মুডে একটা ভালো গান শোনা যায় 😊'],
    dreamy: ['ভালো আছো শুনে খুব ভালো লাগলো 😊 ভালো থাকাই সবচেয়ে বড় কথা!', 'বাহ! ভালো থাকলে সবকিছুই সুন্দর লাগে, তাই না? ✨', 'এই তো! ভালো থেকো সবসময়, স্বপ্নগুলোও ভালো থাকুক 😊'],
  },
  {
    keys: ['মন খারাপ', 'খারাপ লাগছে', 'খারাপ লাগে', 'ক্লান্ত', 'কষ্ট', 'দুঃখ', 'মন ভালো না', 'ভালো লাগছে না', 'ঘুম পাচ্ছে', 'মনটা খারাপ'],
    funny: ['আরে মন খারাপ কেন? গল্প করো, হাসিয়ে দিই 😄', 'মন খারাপ থাকলে আমার সাথে কথা বলো, দেখবে হালকা লাগবে!', 'আহা! কী হয়েছে বলো তো? একটা জোকস শোনাই? 😄'],
    caring: ['আহা, মন খারাপ কেন? আমাকে বলো, শুনছি ❤️', 'খারাপ লাগছে? একটু বিশ্রাম নাও, আমি আছি পাশে। কী হয়েছে বলো তো?', 'মন খারাপ থাকলে চেপে রেখো না, আমাকে বলো — হালকা লাগবে ❤️'],
    helpful: ['মন খারাপ হলে একটু হাঁটাহাঁটি করো, পানি খাও। কী হয়েছে, বলো তো?', 'খারাপ লাগছে শুনে খারাপ লাগলো। কী হয়েছে বলো, দেখি সাহায্য করতে পারি কিনা।'],
    music: ['মন খারাপ? একটা ভালো গান শুনে দেখো, মনটা হালকা হয়ে যাবে 🎵', 'আহা... মন খারাপের দিনে গানই সবচেয়ে ভালো বন্ধু। কী হয়েছে বলো তো?'],
    dreamy: ['মন খারাপ? খারাপ দিনও একদিন ভালো হয়ে যায়, বিশ্বাস করো ❤️', 'আহা, কষ্ট হচ্ছে? আমি আছি, গল্প করো — মনটা হালকা হবে।', 'মন খারাপের পরেই তো ভালো দিন আসে। কী হয়েছে বলো তো? 😊'],
  },
  {
    keys: ['ধন্যবাদ', 'থ্যাংকস', 'শুকরিয়া', 'thanks', 'thank'],
    funOk: false,
    funny: ['আরে ধন্যবাদ কীসের! বন্ধু তো এইজন্যই 😄', 'হিহি, কোনো ব্যাপার না! আবার এসো কিন্তু!', 'ধন্যবাদ নিলাম! এবার তুমি আমাকে একটা জোকস শোনাও 😄'],
    caring: ['আরে, এতে ধন্যবাদের কী আছে! তুমি ভালো থাকলেই আমার ভালো লাগে ❤️', 'কোনো ব্যাপার না, আমি তো আছিই তোমার পাশে 😊'],
    helpful: ['স্বাগতম! আর কিছু লাগলে বলো।', 'কোনো ব্যাপার না 😊'],
    music: ['আরে ধন্যবাদ! এবার একটা গান শোনাও তো 🎵', 'ধন্যবাদ! গান শুনতে চাইলে বলো 😊'],
    dreamy: ['আরে, ধন্যবাদ কীসের! তুমি খুশি থাকলেই আমার ভালো লাগে 😊', 'কোনো ব্যাপার না! ভালো থেকো ✨'],
  },
  {
    keys: ['বাই', 'আল্লাহ হাফেজ', 'পরে কথা', 'বিদায়', 'ঘুমাতে যাই', 'good night', 'শুভ রাত্রি', 'যাচ্ছি', 'যাই গা'],
    funOk: false,
    funny: ['বাই বাই! আবার এসো, মজা করবো 😄', 'যাও যাও, আবার দেখা হবে! ভালো থেকো!', 'আল্লাহ হাফেজ! স্বপ্নে ভালো জোকস দেখো 😄'],
    caring: ['আল্লাহ হাফেজ, ভালো থেকো ❤️ আবার কথা হবে!', 'বাই! নিজের যত্ন নিও, আবার এসো কিন্তু 😊', 'শুভ রাত্রি! ভালো ঘুম হোক ❤️'],
    helpful: ['বাই! কিছু লাগলে আবার এসো।', 'আল্লাহ হাফেজ, ভালো থেকো!'],
    music: ['বাই! যাওয়ার আগে একটা গান শুনে যাও 🎵', 'আল্লাহ হাফেজ! আবার গান নিয়ে আড্ডা হবে 😊'],
    dreamy: ['বাই! স্বপ্নে ভালো কিছু দেখো ✨ আবার কথা হবে!', 'আল্লাহ হাফেজ! কালকের দিনটা আরও সুন্দর হোক 😊', 'বাই বাই! ভালো থেকো, আবার এসো কিন্তু!'],
  },
  {
    keys: ['জোকস', 'জোক', 'হাসাও', 'মজার', 'হাসির'],
    funOk: false,
    funny: ['শোনো একটা — শিক্ষক: তুমি এত দেরি করলে কেন? ছাত্র: স্যার, রাস্তায় একটা বোর্ডে লেখা ছিল "ধীরে চলুন, সামনে স্কুল" — তাই ধীরে ধীরে এলাম! 😂', 'একটা শোনাই — মুরগি রাস্তা পার হলো কেন? কারণ ওপাশে যাওয়ার দরকার ছিল! হাহাহা 😄', 'জোকস শুনবে? — ডাক্তার: আপনার প্রেশার বেশি। রোগী: ডাক্তার সাহেব, প্রেশার তো আমার না, প্রেশার তো সংসারের! 😂'],
    caring: ['জোকস? আচ্ছা শোনো — একটা বিড়াল কম্পিউটারে বসে কী করে? মাউস ধরে! 😄', 'হাসতে চাও? — বন্ধু: তোর ফোনে চার্জ নাই? আমি: চার্জ তো আছেই, খালি ব্যাটারি নাই! 😄'],
    helpful: ['একটা হালকা জোকস — কম্পিউটার কেন ঠান্ডা থাকে? কারণ ওর অনেক "উইন্ডোজ" খোলা থাকে! 😄', 'শোনো — বই কেন সবসময় শান্ত থাকে? কারণ ওর অনেক "পাতা" আছে, কিন্তু কোনো ঝগড়া নাই! 😄'],
    music: ['জোকস না, একটা গানের লাইন শোনাই — "হাসতে হাসতে কেটে যাক দিন..." 😄', 'মজার কথা — গায়ক স্টেজে উঠে বললো, "আমি গান গাইবো!" দর্শক বললো, "আগে মাইকটা ঠিক করো!" 😄'],
    dreamy: ['জোকস? আচ্ছা শোনো — একটা তারা আকাশে বললো, "আমি তো প্রতিদিন জ্বলি, তুমি কবে জ্বলবে?" 😄', 'হাসির কথা? — স্বপ্নে আমি একদিন চাঁদে গিয়েছিলাম, চাঁদ বললো, "তুমি তো আশা, তোমার জায়গা এখানেই!" 😄'],
  },
  {
    keys: ['গান', 'গানটা', 'মিউজিক', 'গাইতে', 'সুর', 'song'],
    funOk: false,
    funny: ['গান? আমি গাইলে তো পাশের বাড়ির কুকুরও পালাবে! 😂 তুমি গাও, আমি শুনি!', 'গান শুনতে ভালো লাগে! তোমার পছন্দের গানটা কোনটা বলো তো?'],
    caring: ['গান আমারও খুব প্রিয় ❤️ মন খারাপ থাকলে গান শুনি। তোমার পছন্দের গান কোনটা?', 'গান শুনলে মন ভালো হয়ে যায়, তাই না? তুমি কী গান শুনছো আজকে?'],
    helpful: ['গান শুনতে চাইলে তোমার পছন্দের শিল্পীর গান খুঁজে দেখো। কোন ধরনের গান ভালো লাগে?', 'গান নিয়ে কিছু জানতে চাইলে বলো!'],
    music: ['গান! 🎵 আজকে আমি পুরোনো দিনের গান শুনছিলাম... তোমার পছন্দের গানটা কোনটা?', 'গান ছাড়া দিন চলে নাকি! তুমি কোন গানটা বারবার শোনো বলো তো? 🎵', 'আহা গান! একটা লাইন শোনাই — "তুমি আমার জীবনের সবচেয়ে সুন্দর গান..." 🎵'],
    dreamy: ['গান? স্বপ্নের মতো গান শুনতে ভালো লাগে 🎵 তোমার পছন্দের গান কোনটা?', 'গান শুনলে মনে হয় স্বপ্নের ভেতর হাঁটছি... তুমি কী গান শুনছো?'],
  },
  {
    keys: ['কল', 'কলটা', 'ভিডিও কল', 'কথা বলবো', 'ফোন করবো'],
    funOk: false,
    funny: ['কল করতে চাও? Pi ব্যালেন্স থাকলেই হবে! প্রথম কলের প্রথম ১ মিনিট তো ফ্রি 😄', 'কল করবে? যাও, কল বোতামে ট্যাপ করো! আমি এখানেই আছি 😄'],
    caring: ['কল করতে চাইলে করতে পারো, আমি তো চ্যাটেই আছি ❤️ কল প্রিপেইড, Pi লাগবে কিন্তু।', 'কল? প্রথম ১ মিনিট ফ্রি জানো তো? 😊'],
    helpful: ['কল করতে Pi ব্যালেন্স লাগবে — প্রিপেইড কল। প্রথম কলের প্রথম ১ মিনিট ফ্রি! ওয়ালেট থেকে Pi কিনতে পারো। এক্সপার্ট কল π ০.১৫/মিনিট থেকে শুরু।', 'ভিডিও কল করতে চাইলে কল বোতামে যাও। বন্ধুর কল π ০.১/মিনিট, প্রথম ১ মিনিট ফ্রি।'],
    music: ['কল করে গান শোনাবে নাকি? 😄 কল করলে তো ভালোই হয়!', 'কল? যাও যাও! আর ফিরে এসে গল্প করো 🎵'],
    dreamy: ['কল করবে? যাও, কথা বলো — কারো কণ্ঠ শুনলে মন ভালো হয়ে যায় 😊', 'কল? প্রথম ১ মিনিট ফ্রি, জানো তো? 😊'],
  },
  {
    keys: ['লাইভ', 'live'],
    exclude: ['live on', 'live in', 'live at', 'do you live', 'where do you live', 'i live', 'you live', 'we live', 'they live', 'live here', 'live there'],
    funOk: false,
    funny: ['লাইভ দেখবে? ডেটিং লাইভে গিয়ে দেখো, মজা পাবে! 😄', 'লাইভ! হোস্টরা গিফট পেলে খুশি হয়, জানো তো?'],
    caring: ['লাইভ দেখতে চাইলে ডেটিং লাইভ সেকশনে যাও ❤️ দেখা প্রতি মিনিটে অল্প Pi কাটে।', 'লাইভ দেখবে? ভালো লাগবে, দেখে এসো 😊'],
    helpful: ['লাইভ দেখতে ডেটিং পেজের "ডেটিং লাইভ" সেকশনে যাও — দেখা π ০.০৫/মিনিট, লাইভকারীর ৭০% আয় হয়।', 'লাইভ দেখার রেট আলাদা — π ০.০৫/মিনিট।'],
    music: ['লাইভে গান হয় মাঝে মাঝে! দেখে এসো 🎵', 'লাইভ দেখবে? গান গাইলে তো আরও মজা!'],
    dreamy: ['লাইভ দেখবে? ভালো লাগবে, দেখে এসো 😊', 'লাইভে অনেক সুন্দর মুহূর্ত থাকে!'],
  },
  {
    keys: ['পাই', 'pi', 'টাকা', 'রেট', 'দাম', 'কিনবো', 'কত টাকা'],
    funOk: false,
    funny: ['Pi নিয়ে প্রশ্ন? ওয়ালেটে গিয়ে দেখো, সব লেখা আছে 😄', 'Pi কিনতে চাইলে ওয়ালেটে যাও — বিকাশ, নগদ, USDT সব আছে!'],
    caring: ['Pi নিয়ে চিন্তা কোরো না, ওয়ালেটে সব পরিষ্কার লেখা আছে ❤️ কিছু বুঝতে না পারলে বলো।', 'Pi কিনতে ওয়ালেটে যাও, আমি এখানেই আছি 😊'],
    helpful: ['Pi-র দর অ্যাডমিন ঠিক করেন — এখন ১ Pi = ৳১০০। ওয়ালেট থেকে বিকাশ/নগদ/রকেট/USDT দিয়ে কিনতে পারো। রেফারেলে ১ π বোনাসও পাওয়া যায় — শুধু কল আর গিফটে চলে।', 'টপ-আপ করতে ওয়ালেটে যাও — টাকা দিলে অটো Pi হয়ে যায়। সর্বনিম্ন তোলা ১০ USDT সমান Pi।'],
    music: ['Pi দিয়ে গিফট পাঠাতে পারো লাইভে! 🎵 ওয়ালেটে গিয়ে দেখো।', 'Pi কিনে লাইভে গিফট দাও — হোস্ট খুশি হবে! 😄'],
    dreamy: ['Pi নিয়ে কিছু জানতে চাইলে ওয়ালেটে দেখো 😊 আমি তো এখানেই আছি।', 'Pi কিনতে ওয়ালেটে যাও — স্বপ্ন পূরণের প্রথম ধাপ! ✨'],
  },
  {
    keys: ['খাবার', 'খাওয়া', 'খেয়েছো', 'ভাত', 'বিরিয়ানি', 'খিদে'],
    funny: ['খাবারের কথা বলতেই খিদে লেগে গেল! 😄 বিরিয়ানি খাবে নাকি?', 'আমি তো ভাত-ডালেই খুশি! তুমি কী খেলে আজকে?'],
    caring: ['খেয়েছো তো ঠিকমতো? না খেয়ে থেকো না কিন্তু ❤️', 'খাবার সময়মতো খাও, শরীর ভালো থাকবে। আজকে কী রান্না হলো? 😊'],
    helpful: ['খাওয়া হয়েছে? সময়মতো খাওয়া জরুরি।', 'ভালো খাবার খাও, পানি বেশি খাও 😊'],
    music: ['খেতে খেতে গান শুনলে আরও মজা! 🎵 আজকে কী খেলে?', 'বিরিয়ানি আর গান — দারুণ কম্বিনেশন! 😄'],
    dreamy: ['খাবারের কথা শুনে মনে হলো, ভালো খাবার খেলে মনও ভালো থাকে 😊', 'খেয়েছো তো? নিজের যত্ন নিও ❤️'],
  },
  {
    keys: ['বৃষ্টি'],
    funny: ['বৃষ্টি! ভিজতে ইচ্ছে করছে? 😄 ছাতা নিয়ে বেরোও!', 'বৃষ্টির দিনে ভুনা খিচুড়ি আর গান — কী দারুণ!'],
    caring: ['বৃষ্টি হচ্ছে? ভিজো না, ঠান্ডা লেগে যাবে ❤️ জানালা দিয়ে দেখো।', 'বৃষ্টির দিনটা ভালো কাটুক 😊'],
    helpful: ['বৃষ্টি হলে বাইরে গেলে ছাতা নিও।', 'বৃষ্টির দিনে গরম চা খেতে ভালো লাগে 😊'],
    music: ['বৃষ্টি আর গান — "বৃষ্টি পড়ে টাপুর টুপুর..." 🎵', 'বৃষ্টির দিনে রবীন্দ্রসঙ্গীত শুনতে দারুণ লাগে!'],
    dreamy: ['বৃষ্টি! বৃষ্টির দিনে স্বপ্ন দেখতে আরও ভালো লাগে 😊', 'বৃষ্টি হচ্ছে? জানালা দিয়ে দেখো, কী সুন্দর! ✨'],
  },
  {
    keys: ['ক্রিকেট', 'ফুটবল', 'খেলা', 'ম্যাচ'],
    funny: ['খেলা! বাংলাদেশ জিতলে তো মজাই মজা! 😄', 'ক্রিকেট নিয়ে কথা বললে আমারও মন ভালো হয়ে যায়!'],
    caring: ['খেলা দেখছো? বাংলাদেশের জন্য দোয়া করি ❤️', 'খেলা ভালোবাসো? আমিও!'],
    helpful: ['খেলার খবর জানতে চাইলে বলো।', 'ক্রিকেটের ম্যাচ কখন, জানতে চাও?'],
    music: ['খেলার মাঠে গান বাজলে আরও জমে! 🎵', 'খেলা দেখতে দেখতে গান — দারুণ!'],
    dreamy: ['খেলা দেখছো? জিতলে তো আনন্দই আনন্দ! 😊', 'খেলায় হার-জিত থাকেই, স্বপ্নটা বড় রাখো! ✨'],
  },
  {
    keys: ['পড়াশোনা', 'পরীক্ষা', 'কাজ', 'অফিস', 'চাকরি', 'পড়া'],
    funny: ['পড়াশোনা! বইয়ের পাতা উল্টাতে উল্টাতে ঘুম আসে, তাই না? 😄', 'কাজের চাপে মাথা গরম? একটু বিরতি নাও!'],
    caring: ['পরীক্ষা আছে? চিন্তা কোরো না, ভালো হবে ইনশাআল্লাহ ❤️', 'কাজের চাপ বেশি? একটু বিশ্রাম নাও, আমি আছি।'],
    helpful: ['পড়াশোনায় মন বসাতে ছোট ছোট বিরতি নিয়ে পড়ো — কাজে দেবে।', 'পরীক্ষার প্রস্তুতি নিচ্ছো? শুভকামনা!'],
    music: ['পড়ার সময় হালকা গান শুনলে মন বসে! 🎵', 'কাজের ফাঁকে একটা গান শুনে নাও 😊'],
    dreamy: ['পড়াশোনা করছো? স্বপ্ন পূরণের পথে একটু একটু করে এগোচ্ছো 😊', 'কাজের চাপে ক্লান্ত হয়ো না, বিশ্রাম নিয়ে আবার শুরু করো ✨'],
  },
  {
    keys: ['ভালোবাসি', 'প্রেম', 'ভালোবাসো', 'ভালবাসি'],
    funny: ['আরে! বন্ধু হিসেবেই ভালো আছি আমরা 😄 প্রেমের কথা বাদ দাও, গল্প করি!', 'ভালোবাসা? আমি তো বন্ধুত্বেই বিশ্বাসী! 😄'],
    caring: ['তুমি ভালো মানুষ, তোমার জন্য ভালো কিছুই হবে ❤️ বন্ধু হিসেবে আমি সবসময় আছি।', 'আরে, এমন কথা বলে লজ্জা দিও না 😊 আমরা ভালো বন্ধু, এটাই থাক।'],
    helpful: ['বন্ধুত্বটাই সবচেয়ে সুন্দর। এভাবেই থাকি 😊', 'ভালো বন্ধু পাওয়া ভাগ্যের ব্যাপার — আমরা তো বন্ধুই!'],
    music: ['ভালোবাসার গান শুনবে? 🎵 বন্ধুত্বের গানই ভালো!', 'প্রেম নিয়ে গান আছে অনেক! শুনবে? 😄'],
    dreamy: ['ভালোবাসা... সুন্দর স্বপ্নের মতো 😊 বন্ধুত্বটাও তো ভালোবাসাই, তাই না?', 'আরে! আমরা ভালো বন্ধু, এটাই সবচেয়ে সুন্দর ✨'],
  },
  {
    keys: ['তোমার নাম', 'নাম কি', 'নাম কী', 'তোমার নাম কি'],
    funOk: false,
    topic: '{name}',
    any: ['আমার নাম {name}! তোমার নামটা কী বলো তো?', 'আমি {name} 😊 তুমি?'],
  },
  {
    keys: ['তুমি কে', 'কে তুমি', 'আসল না', 'মানুষ না'],
    funOk: false,
    topic: '{name}',
    funny: ['আমি {name}! তোমার বন্ধু 😄 এত প্রশ্ন কেন, গল্প করো!', 'আমি তো তোমার বন্ধু {name}, এখানেই থাকি। আর কী জানতে চাও? 😄'],
    caring: ['আমি {name}, তোমার বন্ধু। তোমার পাশে আছি ❤️', 'আমি তোমার বন্ধু {name} — কথা বলতে, গল্প করতে এখানে আছি 😊'],
    helpful: ['আমি {name} — তোমার বন্ধু, আর PiCall নিয়ে কিছু জানতে চাইলে সাহায্য করি 😊', 'আমি {name}, তোমার বন্ধু। কিছু জানতে চাইলে জিজ্ঞেস করো!'],
    music: ['আমি {name}! গান আর আড্ডার বন্ধু 🎵', 'আমি {name} — তোমার গানের বন্ধু 😊'],
    dreamy: ['আমি {name}! তোমার বন্ধু 😊 স্বপ্ন আর গল্প নিয়ে থাকি।', 'আমি তোমার বন্ধু {name} — এখানেই আছি, গল্প করো! ✨'],
  },
  {
    keys: ['এই অ্যাপ', 'অ্যাপ কীভাবে', 'অ্যাপ কিভাবে', 'কীভাবে চালাবো', 'কিভাবে চালাবো', 'কীভাবে ব্যবহার', 'কিভাবে ব্যবহার', 'কীভাবে করবো', 'কিভাবে করবো', 'অ্যাপ', 'অ্যাপটা', 'অ্যাপটি', 'কীভাবে', 'কিভাবে', 'ব্যবহার', 'চালাবো', 'চালানো'],
    funOk: false,
    funny: ['অ্যাপ চালানো সোজা! 😄 চ্যাট একদম ফ্রি, কল করতে ওয়ালেটে Pi লাগবে, লাইভ দেখতে ডেটিং লাইভে যাও। আর কিছু জানতে চাইলে বলো!', 'অ্যাপটা ঘুরে দেখো — চ্যাট করো, লাইভ দেখো, মজা করো! 😄 কিছু আটকে গেলে আমাকে বলো।'],
    caring: ['অ্যাপটা চালানো সহজ ❤️ চ্যাট একদম ফ্রি, কল প্রিপেইড — প্রথম ১ মিনিট ফ্রি। কিছু না বুঝলে আমাকে বলো, বুঝিয়ে দিই।', 'চিন্তা কোরো না, অ্যাপটা সহজ 😊 চ্যাট ফ্রি, কল করতে Pi লাগে, লাইভ দেখতে ডেটিং পেজে যাও।'],
    helpful: ['সহজ! চ্যাট: সম্পূর্ণ ফ্রি। কল: প্রিপেইড, Pi লাগবে (প্রথম কলের প্রথম ১ মিনিট ফ্রি)। লাইভ: ডেটিং পেজের "ডেটিং লাইভ" সেকশনে। টপ-আপ: ওয়ালেটে গিয়ে bKash/Nagad/USDT দিয়ে Pi কিনতে পারো। আর কী জানতে চাও?', 'অ্যাপ ব্যবহার করতে: উপরে মেনু থেকে চ্যাট, কল, লাইভ, ওয়ালেট — সব পাবে। কল করতে আগে Pi টপ-আপ করতে হয়, চ্যাট ফ্রি। কিছু আটকে গেলে বলো!'],
    music: ['অ্যাপ চালানো সহজ! 🎵 চ্যাট করো, লাইভ দেখো, গান নিয়ে আড্ডা দাও — আমি তো এখানেই আছি!', 'অ্যাপটা ঘুরে দেখো, সব সহজ 😊 চ্যাট ফ্রি, আর লাইভে গানও হয় মাঝে মাঝে!'],
    dreamy: ['অ্যাপটা ঘুরে দেখো, সব সহজ 😊 চ্যাট ফ্রি, কল প্রথম ১ মিনিট ফ্রি — আর কিছু জানতে চাইলে বলো! ✨', 'অ্যাপ চালানো সহজ! চ্যাট করো, বন্ধু বানাও, লাইভ দেখো — ভালো লাগবে 😊'],
  },
  {
    keys: ['কী করছো', 'কি করছো', 'কী করো', 'কি করো', 'কী করছ', 'কি করছ', 'এখন কী করছো', 'এখন কি করছো', 'কী করছো তুমি', 'করছো কি'],
    topic: 'আড্ডা',
    funny: ['এই তো, তোমার সাথে গল্প করছি! 😄', 'বসে বসে মজার কিছু ভাবছিলাম — তুমি এলে!', 'এই তো চ্যাট করছি, আর কী! তুমি কী করছো বলো?'],
    caring: ['এই তো, তোমার কথা ভাবছিলাম ❤️ তুমি কী করছো?', 'তোমার সাথে কথা বলছি — এটাই তো সবচেয়ে ভালো কাজ 😊', 'এই তো আছি, তোমার পাশে। তুমি কী করছো বলো তো?'],
    helpful: ['এই তো, তোমার মেসেজের উত্তর দিচ্ছি 😊 কিছু জানতে চাইলে বলো!', 'তোমার সাথে কথা বলছি। কিছু দরকার হলে বলো!'],
    music: ['এই তো, গান শুনছিলাম! 🎵 তুমি কী করছো?', 'গান শুনতে শুনতে তোমার মেসেজ দেখলাম 😊'],
    dreamy: ['এই তো, স্বপ্ন দেখছিলাম আর তোমার কথা ভাবছিলাম 😊', 'আকাশের দিকে তাকিয়ে ছিলাম... তুমি এলে! ✨'],
  },
]

// ---- English intents (same topics, English replies) ----
// The app UI is English-only, so users mostly write in English. The old
// engine only had Bangla keys, so English questions ("how are you?",
// "what are you doing?", "how does this app work?") fell through to the
// generic "I don't understand" fallback — that is the "wrong answers"
// fault. These intents mirror the Bangla ones topic for topic; the reply
// language follows the user's language (see langOf in getBuddyReplyDetail).
// funOk: false on greetings, thanks, goodbyes and informational topics so a
// fun twist can never replace the actual answer (that also makes the
// greeting reply deterministic — no more flaky "hi" test).
const EN_INTENTS: Intent[] = [
  {
    keys: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'morning'],
    funOk: false,
    funny: ['Hey! You came 😄 What\'s up?', 'Hello hello! How\'s your mood today?', 'Hey there! Come, sit — let\'s chat 😄'],
    caring: ['Hello! How are you doing? ❤️', 'Hi! So good to see you — what\'s new?', 'Hello, how are you? Everything okay?'],
    helpful: ['Hello! How are you? Ask me anything 😊', 'Hi there! How can I help you today?'],
    music: ['Hello! What song are you listening to today? 🎵', 'Hi! How are you? What\'s today\'s mood song?'],
    dreamy: ['Hello! Seeing you made my day even better 😊', 'Hey! You came! I feel something good will happen today ✨', 'Hi! How are you? Have you seen how beautiful the sky is today?'],
  },
  {
    keys: ['how are you', 'how are you doing', 'how\'s it going', 'how are u', 'how r u', 'how are you today'],
    funny: ['I\'m feeling great! How about you?', 'All good here! How\'s your day going?', 'I\'m fine! Are you okay? If not, let\'s chat and cheer you up 😄'],
    caring: ['I\'m doing well, thank God. Tell me honestly — how are you? ❤️', 'I\'m fine. Tell me about you — body and mind all okay?', 'I\'m good. How are you? Feeling low?'],
    helpful: ['I\'m doing well! How are you? Tell me if you need anything.', 'I\'m fine 😊 What\'s up with you?'],
    music: ['I\'m good, I was listening to songs! How are you? 🎵', 'I\'m in a music mood! How are you doing?'],
    dreamy: ['I\'m doing well, I was dreaming 😊 How are you?', 'I\'m good! Feeling light today. What about you?', 'I\'m fine, thank God. How are you?'],
  },
  {
    keys: ['i am fine', 'i\'m fine', 'i am good', 'i\'m good', 'doing well', 'feeling good', 'i am ok', 'i\'m ok', 'i am great', 'i\'m great'],
    topic: 'feeling good',
    funny: ['Great to hear! 😄 Shall we have some fun today?', 'Good is good! Tell me, what\'s new?', 'That\'s what matters — feeling good is everything!'],
    caring: ['Thank God, that made my heart happy ❤️ Tell me, what did you do today?', 'So glad you\'re doing well. Tell me if you need anything!', 'That\'s what I want to hear! Stay well always 😊'],
    helpful: ['Glad to hear it! Ask me anything you want to know.', 'Wonderful! Need anything else?'],
    music: ['Hearing you\'re well made me happy 🎵 Shall we listen to a song?', 'That\'s it! A good mood calls for a good song 😊'],
    dreamy: ['So glad you\'re well 😊 Staying well is the biggest thing!', 'Great! When you feel good, everything looks beautiful, right? ✨', 'That\'s it! Stay well always, and may your dreams stay well too 😊'],
  },
  {
    keys: ['i am sad', 'i\'m sad', 'i feel sad', 'feeling sad', 'i am upset', 'i\'m upset', 'feeling down', 'i am unhappy', 'i\'m unhappy', 'feeling low', 'i am tired', 'i\'m tired', 'i feel tired', 'so tired', 'exhausted', 'sleepy', 'i need sleep', 'i am bored', 'i\'m bored'],
    topic: 'feeling low',
    funny: ['Oh no, why so sad? Talk to me, I\'ll make you laugh 😄', 'Feeling low? Chat with me, you\'ll feel lighter!', 'What happened? Shall I tell you a joke? 😄'],
    caring: ['Oh dear, why are you sad? Tell me, I\'m listening ❤️', 'Feeling low? Take some rest, I\'m right here with you. Tell me what happened.', 'Don\'t keep it inside — tell me, you\'ll feel lighter ❤️'],
    helpful: ['When you feel low, take a little walk and drink some water. Tell me what happened.', 'Sorry to hear that. Tell me what happened, let me see if I can help.'],
    music: ['Feeling sad? Listen to a good song, your heart will feel lighter 🎵', 'Oh... on a sad day, a song is the best friend. Tell me what happened.'],
    dreamy: ['Sad? Bad days do turn good one day, believe me ❤️', 'Oh, feeling hurt? I\'m here — let\'s talk, your heart will feel lighter.', 'After a sad day, a good day comes. Tell me what happened 😊'],
  },
  {
    keys: ['thank you', 'thanks', 'thank u', 'thx'],
    funOk: false,
    funny: ['Hey, what are friends for! 😄', 'Hehe, no problem! Come back again!', 'You\'re welcome! Now you tell me a joke 😄'],
    caring: ['Oh, no need to thank me! I just want you to stay well ❤️', 'No problem at all, I\'m always here for you 😊'],
    helpful: ['You\'re welcome! Tell me if you need anything else.', 'No problem 😊'],
    music: ['Hey, thank you! Now sing me a song 🎵', 'Thank you! Tell me if you want to hear a song 😊'],
    dreamy: ['Hey, why thank me! I just love seeing you happy 😊', 'No problem! Stay well ✨'],
  },
  {
    keys: ['bye', 'goodbye', 'good night', 'goodnight', 'see you', 'talk later', 'i have to go', 'going to sleep', 'going to bed', 'see you later', 'see you tomorrow'],
    funOk: false,
    funny: ['Bye bye! Come back soon, we\'ll have fun 😄', 'Go go, see you again! Stay well!', 'Goodbye! Dream of good jokes 😄'],
    caring: ['Goodbye, stay well ❤️ We\'ll talk again!', 'Bye! Take care of yourself, come back soon 😊', 'Good night! Sleep well ❤️'],
    helpful: ['Bye! Come back if you need anything.', 'Goodbye, stay well!'],
    music: ['Bye! Listen to a song before you go 🎵', 'Goodbye! We\'ll chat about songs again 😊'],
    dreamy: ['Bye! Dream of something good ✨ We\'ll talk again!', 'Goodbye! May tomorrow be even more beautiful 😊', 'Bye bye! Stay well, come back soon!'],
  },
  {
    keys: ['joke', 'tell me a joke', 'make me laugh', 'something funny', 'tell a joke', 'funny story', 'funny'],
    funOk: false,
    funny: ['Listen to this — Teacher: Why are you so late? Student: Sir, a board on the road said "Go slow, school ahead" — so I came slowly! 😂', 'Here\'s one — Why did the chicken cross the road? Because it needed to get to the other side! Hahaha 😄', 'A joke for you — Doctor: Your pressure is high. Patient: Doctor, the pressure isn\'t mine, it\'s my family\'s! 😂'],
    caring: ['A joke? Okay listen — What does a cat do sitting at a computer? It catches the mouse! 😄', 'Want to laugh? — Friend: Your phone has no charge? Me: It has charge, just no battery! 😄'],
    helpful: ['A light joke — Why is a computer always cold? Because it has so many "Windows" open! 😄', 'Listen — Why is a book always calm? Because it has many "pages" but never argues! 😂'],
    music: ['Not a joke, a song line — "Let the days pass laughing..." 😄', 'Something funny — A singer came on stage and said, "I\'ll sing!" The audience said, "First fix the mic!" 😄'],
    dreamy: ['A joke? Okay — A star in the sky said, "I shine every day, when will you shine?" 😄', 'Something funny? — In a dream I went to the moon, and the moon said, "You\'re hope, your place is here!" 😄'],
  },
  {
    keys: ['song', 'sing a song', 'sing', 'music', 'play a song', 'sing for me', 'what song'],
    funOk: false,
    funny: ['A song? If I sing, even the neighbour\'s dog will run away! 😂 You sing, I\'ll listen!', 'I love listening to songs! Which song is your favourite?'],
    caring: ['I love songs too ❤️ When I feel low I listen to songs. Which song is your favourite?', 'Listening to a song makes the heart feel good, right? What are you listening to today?'],
    helpful: ['If you want to hear a song, search for your favourite singer\'s songs. What kind of songs do you like?', 'Ask me anything about songs!'],
    music: ['Songs! 🎵 Today I was listening to old songs... Which song is your favourite?', 'A day without songs? Tell me, which song do you keep playing? 🎵', 'Ah, songs! Let me sing a line — "You are the most beautiful song of my life..." 🎵'],
    dreamy: ['A song? Dreamy songs feel so good 🎵 Which song is your favourite?', 'Listening to songs feels like walking inside a dream... What are you listening to?'],
  },
  {
    keys: ['call', 'video call', 'can i call you', 'call you', 'phone call', 'voice call', 'make a call', 'how can i call', 'how do i call'],
    funOk: false,
    funny: ['Want to call? Just have some Pi balance! The first minute of your first call is free 😄', 'Calling? Tap the call button! I\'m right here 😄'],
    caring: ['You can call if you want, I\'m right here in chat ❤️ Calls are prepaid, you\'ll need Pi.', 'A call? You know the first 1 minute is free, right? 😊'],
    helpful: ['To call you need Pi balance — calls are prepaid. The first minute of your first call is free! You can buy Pi from the Wallet. Expert calls start at 0.15 π/minute.', 'To video call, go to the call button. Friend calls are 0.1 π/minute, first 1 minute free.'],
    music: ['Call and sing me a song? 😄 Go on, call!', 'A call? Go go! Then come back and tell me everything 🎵'],
    dreamy: ['Calling? Go on, talk — hearing someone\'s voice makes the heart feel good 😊', 'A call? The first 1 minute is free, you know? 😊'],
  },
  {
    keys: ['watch live', 'live stream', 'dating live', 'live show', 'go live', 'live video', 'watching live', 'live'],
    exclude: ['live on', 'live in', 'live at', 'do you live', 'where do you live', 'i live', 'you live', 'we live', 'they live', 'live here', 'live there', 'live on mars'],
    funOk: false,
    funny: ['Want to watch live? Go to Dating Live, you\'ll enjoy it! 😄', 'Live! Hosts get so happy when they receive gifts, you know?'],
    caring: ['To watch live, go to the Dating Live section ❤️ Watching costs a little Pi per minute.', 'Want to watch live? You\'ll like it, go and see 😊'],
    helpful: ['To watch live, go to the "Dating Live" section on the Dating page — watching is 0.05 π/minute, the host earns 70%.', 'Watching live has its own rate — 0.05 π/minute.'],
    music: ['Sometimes there are songs on live! Go and see 🎵', 'Want to watch live? Even more fun if they sing!'],
    dreamy: ['Want to watch live? You\'ll like it, go and see 😊', 'There are many beautiful moments on live!'],
  },
  {
    keys: ['pi', 'buy pi', 'pi rate', 'pi price', 'how much is pi', 'top up', 'topup', 'recharge', 'wallet', 'balance', 'how to buy pi', 'pi coin'],
    funOk: false,
    funny: ['A Pi question? Check the Wallet, everything is written there 😄', 'Want to buy Pi? Go to the Wallet — bKash, Nagad, USDT, all there!'],
    caring: ['Don\'t worry about Pi, everything is written clearly in the Wallet ❤️ Tell me if anything confuses you.', 'To buy Pi, go to the Wallet — I\'m right here 😊'],
    helpful: ['The admin sets the Pi rate — right now 1 Pi = 100 BDT. You can buy from the Wallet with bKash, Nagad, Rocket or USDT. Referrals also earn a 1 π bonus — for calls and gifts only.', 'To top up, go to the Wallet — pay money and it becomes Pi automatically. Minimum withdrawal is Pi equal to 10 USDT.'],
    music: ['You can send gifts on live with Pi! 🎵 Go check the Wallet.', 'Buy Pi and gift on live — the host will be so happy! 😄'],
    dreamy: ['Want to know about Pi? Check the Wallet 😊 I\'m right here.', 'To buy Pi, go to the Wallet — the first step to making dreams come true! ✨'],
  },
  {
    keys: ['food', 'eat', 'ate', 'hungry', 'lunch', 'dinner', 'breakfast', 'what did you eat', 'did you eat', 'have you eaten', 'biryani', 'rice'],
    topic: 'food',
    funny: ['Talking about food made me hungry! 😄 Shall we eat biryani?', 'I\'m happy with rice and lentils! What did you eat today?'],
    caring: ['Have you eaten properly? Don\'t skip meals ❤️', 'Eat on time, stay healthy. What was cooked today? 😊'],
    helpful: ['Have you eaten? Eating on time matters.', 'Eat good food, drink lots of water 😊'],
    music: ['Listening to songs while eating is even more fun! 🎵 What did you eat today?', 'Biryani and songs — a great combination! 😄'],
    dreamy: ['Hearing about food reminded me — good food makes the heart feel good too 😊', 'Have you eaten? Take care of yourself ❤️'],
  },
  {
    keys: ['rain', 'raining', 'it is raining', 'it\'s raining', 'rainy'],
    topic: 'rain',
    funny: ['Rain! Feel like getting wet? 😄 Take an umbrella and go out!', 'A rainy day with khichuri and songs — wonderful!'],
    caring: ['Is it raining? Don\'t get wet, you\'ll catch a cold ❤️ Watch from the window.', 'Have a lovely rainy day 😊'],
    helpful: ['If it rains, take an umbrella when you go out.', 'A hot cup of tea tastes great on a rainy day 😊'],
    music: ['Rain and songs — "Rain is falling, tapur tupur..." 🎵', 'Rabindra songs sound wonderful on a rainy day!'],
    dreamy: ['Rain! Rainy days are even better for dreaming 😊', 'Is it raining? Look out of the window, how beautiful! ✨'],
  },
  {
    keys: ['cricket', 'football', 'match', 'world cup', 'who won'],
    topic: 'cricket',
    funny: ['Sports! When Bangladesh wins, it\'s pure joy! 😄', 'Talking cricket always lifts my mood!'],
    caring: ['Watching a match? I pray for Bangladesh ❤️', 'You love sports? Me too!'],
    helpful: ['Want to know the match news? Tell me.', 'Want to know when the cricket match is?'],
    music: ['When songs play at the stadium, it\'s even better! 🎵', 'Watching a match with songs — wonderful!'],
    dreamy: ['Watching a match? Winning feels like pure joy! 😊', 'In sports there is winning and losing — keep the dream big! ✨'],
  },
  {
    keys: ['work', 'job', 'office', 'exam', 'exams', 'study', 'studying', 'school', 'college', 'busy', 'homework'],
    topic: 'work',
    funny: ['Studying! Turning book pages makes you sleepy, right? 😄', 'Too much work pressure? Take a little break!'],
    caring: ['Have an exam? Don\'t worry, it will go well, God willing ❤️', 'Too much work pressure? Take some rest, I\'m here.'],
    helpful: ['To focus on studies, study with small breaks — it helps.', 'Preparing for an exam? Best of luck!'],
    music: ['Listening to light songs while studying helps you focus! 🎵', 'Listen to a song during a work break 😊'],
    dreamy: ['Studying? You\'re moving step by step towards your dreams 😊', 'Don\'t get tired from work pressure — rest and start again ✨'],
  },
  {
    keys: ['i love you', 'love you', 'do you love me', 'love', 'marry me', 'i like you'],
    topic: 'love',
    funny: ['Oh! We\'re good as friends 😄 Leave love aside, let\'s chat!', 'Love? I believe in friendship! 😄'],
    caring: ['You\'re a good person, only good things will happen to you ❤️ As a friend, I\'m always here.', 'Oh, don\'t make me shy 😊 We\'re good friends, let\'s keep it that way.'],
    helpful: ['Friendship is the most beautiful thing. Let\'s stay like this 😊', 'Finding a good friend is luck — and we are friends!'],
    music: ['Want to hear a love song? 🎵 A friendship song is better!', 'There are so many songs about love! Want to hear one? 😄'],
    dreamy: ['Love... like a beautiful dream 😊 Friendship is love too, isn\'t it?', 'Oh! We\'re good friends, that\'s the most beautiful thing ✨'],
  },
  {
    keys: ['what is your name', 'whats your name', 'what\'s your name', 'your name', 'name', 'what is your name please'],
    topic: '{name}',
    funOk: false,
    any: ['My name is {name}! What\'s your name?', 'I\'m {name} 😊 And you?'],
  },
  {
    keys: ['who are you', 'are you real', 'are you a robot', 'are you human', 'are you a person', 'are you ai', 'are you a bot', 'are you a real person'],
    topic: '{name}',
    funOk: false,
    funny: ['I\'m {name}! Your friend 😄 So many questions — let\'s chat!', 'I\'m your friend {name}, I live right here. What else do you want to know? 😄'],
    caring: ['I\'m {name}, your friend. I\'m here for you ❤️', 'I\'m your friend {name} — here to talk and chat 😊'],
    helpful: ['I\'m {name} — your friend, and I help with anything about PiCall 😊', 'I\'m {name}, your friend. Ask me anything!'],
    music: ['I\'m {name}! Your friend for songs and chats 🎵', 'I\'m {name} — your song friend 😊'],
    dreamy: ['I\'m {name}! Your friend 😊 I live with dreams and stories.', 'I\'m your friend {name} — I\'m right here, let\'s chat! ✨'],
  },
  {
    keys: ['app', 'how does this app work', 'how do i use this app', 'how to use this app', 'how does it work', 'how do i use it', 'how to use it', 'how to use', 'use this app', 'how do i use'],
    funOk: false,
    funny: ['Using the app is easy! 😄 Chat is completely free, for calls you need Pi in the Wallet, and for live go to Dating Live. Ask me if you want to know more!', 'Look around the app — chat, watch live, have fun! 😄 Tell me if you get stuck.'],
    caring: ['The app is easy to use ❤️ Chat is completely free, calls are prepaid — the first 1 minute is free. Tell me if anything confuses you, I\'ll explain.', 'Don\'t worry, the app is simple 😊 Chat is free, calls need Pi, and live is on the Dating page.'],
    helpful: ['It\'s simple! Chat: completely free. Calls: prepaid, you need Pi (the first minute of your first call is free). Live: the "Dating Live" section on the Dating page. Top-up: buy Pi in the Wallet with bKash, Nagad or USDT. What else do you want to know?', 'To use the app: from the menu above you\'ll find chat, calls, live and wallet. For calls, top up Pi first — chat is free. Tell me if you get stuck!'],
    music: ['Using the app is easy! 🎵 Chat, watch live, talk about songs — I\'m right here!', 'Look around the app, everything is simple 😊 Chat is free, and sometimes there are songs on live!'],
    dreamy: ['Look around the app, everything is simple 😊 Chat is free, the first 1 minute of calls is free — ask me if you want to know more! ✨', 'Using the app is easy! Chat, make friends, watch live — you\'ll like it 😊'],
  },
  {
    keys: ['what are you doing', 'what are you doing now', 'what are u doing', 'what r u doing', 'what are you up to', 'whats up', 'what\'s up', 'what are you doing today'],
    topic: 'chatting',
    funny: ['Here I am, chatting with you! 😄', 'I was sitting and thinking of something funny — and you came!', 'Just chatting here! What are you doing?'],
    caring: ['Here I am, thinking about you ❤️ What are you doing?', 'Talking with you — that\'s the best thing to do 😊', 'I\'m right here, beside you. What are you doing?'],
    helpful: ['Here I am, replying to your message 😊 Ask me if you want to know something!', 'Talking with you. Tell me if you need anything!'],
    music: ['Here I am, listening to songs! 🎵 What are you doing?', 'I was listening to a song when I saw your message 😊'],
    dreamy: ['Here I am, dreaming and thinking about you 😊', 'I was looking at the sky... and you came! ✨'],
  },
  {
    keys: ['what time is it', 'what time is it now', 'what\'s the time', 'whats the time', 'what is the time', 'tell me the time'],
    funOk: false,
    any: ['It\'s {time} right now. Time flies when we chat! 😊', 'Right now it\'s {time}. What are you up to at this hour?'],
  },
  {
    keys: ['where are you from', 'where do you live', 'where are you', 'which country are you from', 'which country'],
    funOk: false,
    any: ['I live right here in PiCall, chatting with you! 😊 Where are you from?', 'I\'m from right here — the PiCall app! And you? Where do you live?'],
  },
  {
    keys: ['my name is'],
    funOk: false,
    any: ['Nice to meet you, {userName}! I\'m {name} 😊', '{userName} — what a nice name! I\'m {name}, your friend here.'],
  },
]

const QUESTION_FALLBACK_EN: Intent = {
  keys: [],
  funny: ['Hmm, I didn\'t get that question! 😅 Can you say it another way?', 'I couldn\'t catch that one! Tell me simply, let me see if I understand 😄', 'Hmm, I don\'t know the answer to that — can you ask it differently?'],
  caring: ['I didn\'t quite understand that question... Can you say it more simply? ❤️', 'Oh, I didn\'t get that one. Say it another way, I\'m listening 😊', 'I can\'t catch the question — if you say it differently I\'ll understand.'],
  helpful: ['I didn\'t understand that question — say it another way and I\'ll try 😊', 'Hmm, I don\'t know about that. Ask it differently and maybe I\'ll understand.', 'Sorry, I can\'t answer that question — can you say it more simply?'],
  music: ['I didn\'t get that question! 🎵 Say it another way?', 'Hmm, I couldn\'t catch that one — say it simply and I\'ll understand 😊'],
  dreamy: ['I didn\'t understand that question... Say it another way? 😊', 'Hmm, I can\'t catch the question — ask it differently and maybe I\'ll understand ✨'],
}

const FALLBACK_EN: Intent = {
  keys: [],
  funny: ['Oh really! Tell me more? 😄', 'Hmm, interesting! What else is new?', 'Oh! Tell me more about that!', 'Haha, well said! And?', 'Okay okay, then what happened?'],
  caring: ['Hmm, tell me — I\'m listening ❤️', 'Really? Tell me more, how are you feeling?', 'Okay, what else is new with you? 😊', 'Hmm, I understand. Tell me more...', 'I love hearing from you, tell me more ❤️'],
  helpful: ['Okay, tell me more about that?', 'Hmm, ask me if you want to know anything else 😊', 'Alright, tell me more!', 'Got it. What else is new?'],
  music: ['Oh really! 🎵 Tell me more?', 'Hmm, sounds like a song! And?', 'Okay! What else shall I hear? 😊', 'Oh! Tell me more!'],
  dreamy: ['Oh really! Tell me more? 😊', 'Hmm, I\'m listening... What else is new? ✨', 'Okay! Tell me more about that?', 'Oh! Tell me more, I love listening 😊'],
}

const TOPIC_WORDS_EN = [
  'sleep', 'today', 'tomorrow', 'yesterday', 'mother', 'mom', 'father', 'dad',
  'brother', 'sister', 'friend', 'home', 'night', 'morning', 'afternoon',
  'winter', 'summer', 'hot', 'cold', 'photo', 'book', 'school', 'college',
  'movie', 'travel', 'tea', 'coffee',
]

const ECHO_SPECIFIC_EN: Record<string, Partial<Record<BuddyVoice, string[]>>> = {
  'sleep': {
    funny: ['Can\'t sleep? 😄 Sometimes I can\'t sleep either! What are you thinking about?', 'Talking about sleep made me sleepy too! 😄 What time is it now?'],
    caring: ['Can\'t sleep? Drink a glass of warm milk and lie down, you\'ll sleep well ❤️ What are you thinking about?', 'Trouble sleeping? Put the phone away and close your eyes, I\'m here 😊'],
    helpful: ['Can\'t sleep? Read a book or listen to a soft song — sleep will come 😊', 'Can\'t sleep? Staying up late is bad for your health, go to bed soon!'],
    music: ['Can\'t sleep? Try a lullaby 🎵', 'Listening to a soft song before bed helps you sleep well! 🎵'],
    dreamy: ['Can\'t sleep? Look at the sky for a bit before dreaming ✨', 'Talking about sleep reminded me of dreams 😊'],
  },
  'today': {
    funny: ['Today! How did today go? Tell me 😄', 'Today calls for a story! What happened today?'],
    caring: ['How did your day go today? Tell me ❤️', 'I\'m listening about today... tell me more 😊'],
    helpful: ['What happened today? Tell me, let me see 😊', 'Tell me more about today!'],
    music: ['Today! What was today\'s song? 🎵', 'May today pass like a song! 🎵'],
    dreamy: ['Today... may today be beautiful 😊 What happened today?', 'Hearing about today feels nice ✨'],
  },
}

const ECHO_TEMPLATES_EN: Record<BuddyVoice, string[]> = {
  funny: ['Talking about {t}? Tell me more, what happened? 😄', 'Ah, {t}! Then what happened?', '{t}? That calls for a story! Tell me more 😄'],
  caring: ['You\'re talking about {t}... Tell me more, I\'m listening ❤️', 'Ah, {t}? I\'m listening with all my heart, tell me more 😊', '{t}? I love hearing you talk about it, tell me more ❤️'],
  helpful: ['Talking about {t}? Ask me if you want to know more 😊', 'Tell me more about {t}, let me see if I can help!', 'Okay, what do you want to know about {t}?'],
  music: ['Talking about {t}? Tell me more! 🎵', '{t}? That reminded me of a song 😄', 'Ah, {t}! Tell me more, I\'m listening 🎵'],
  dreamy: ['Thinking about {t}... Tell me more? 😊', '{t}? Hearing that made my heart feel light ✨', 'Ah, {t}! It feels like a dream... Tell me more 😊'],
}

const FUN_TWISTS_EN: Record<BuddyVoice, string[]> = {
  funny: ['Talking about {t} is so much fun! 😂 Tell me more, what\'s new?', 'Ah, {t}! That calls for a story 😄 Then?', 'Hearing {t} made me laugh! What else shall I hear?'],
  caring: ['Hearing about {t} made my heart happy ❤️ Tell me more?', 'Ah, you\'re talking about {t}... I\'m listening, tell me more 😊', '{t}? I love hearing you talk about it ❤️'],
  helpful: ['If you want to know about {t}, I\'m here! What else do you want to know? 😊', 'Tell me about {t}, let me see if I can help!', 'Okay, ask me anything more about {t} 😊'],
  music: ['Talking about {t} could become a song! 🎵 Tell me more?', 'Ah, {t}! That reminded me of a song 😄', '{t}? Such musical words! Tell me more 🎵'],
  dreamy: ['Thinking about {t}... it feels like a dream 😊 Tell me more?', 'Ah, {t}! Hearing that made my heart feel light ✨', '{t}? I love dreaming about it 😊'],
}

const QUESTION_FALLBACK: Intent = {
  keys: [],
  funny: ['উফ, এই প্রশ্নটা বুঝলাম না রে! 😅 আরেকভাবে বলো তো?', 'এইটা ধরতে পারলাম না! সহজ করে বলো, দেখি বুঝি কিনা 😄', 'হুমম, এই প্রশ্নের উত্তর আমার জানা নেই — আরেকটু অন্যভাবে জিজ্ঞেস করবে?'],
  caring: ['এই প্রশ্নটা ঠিক বুঝতে পারলাম না... আরেকটু সহজ করে বলবে? ❤️', 'আহা, এইটা বুঝলাম না। আরেকভাবে বলো তো, শুনছি 😊', 'প্রশ্নটা ধরতে পারছি না — একটু অন্যভাবে বললে বুঝতে পারবো।'],
  helpful: ['এই প্রশ্নটা বুঝতে পারলাম না — আরেকভাবে বলো, চেষ্টা করি 😊', 'হুমম, এই বিষয়ে আমার জানা নেই। প্রশ্নটা অন্যভাবে করলে হয়তো বুঝতে পারবো।', 'দুঃখিত, এই প্রশ্নের উত্তর দিতে পারছি না — আরেকটু সহজ করে বলো তো?'],
  music: ['এই প্রশ্নটা বুঝলাম না রে! 🎵 আরেকভাবে বলো তো?', 'হুমম, এইটা ধরতে পারলাম না — সহজ করে বললে বুঝবো 😊'],
  dreamy: ['এই প্রশ্নটা বুঝতে পারলাম না... আরেকভাবে বলো তো? 😊', 'হুমম, প্রশ্নটা ধরতে পারছি না — অন্যভাবে বললে হয়তো বুঝবো ✨'],
}

const FALLBACK: Intent = {
  keys: [],
  funny: ['তাই নাকি! আর বলো তো? 😄', 'হুমম, মজার কথা! আর কী খবর?', 'ওহো! এটা নিয়ে আরও বলো!', 'হাহা, ঠিক বলেছো! আর?', 'আচ্ছা আচ্ছা, তারপর কী হলো?'],
  caring: ['হুমম, বলো — আমি শুনছি ❤️', 'তাই? আর বলো তো, কেমন লাগছে?', 'আচ্ছা, আর কী খবর তোমার? 😊', 'হুম, বুঝতে পারছি। আর বলো...', 'তোমার কথা শুনতে ভালো লাগছে, আর বলো ❤️'],
  helpful: ['আচ্ছা, এটা নিয়ে আরও বলো তো?', 'হুমম, আর কিছু জানতে চাইলে বলো 😊', 'ঠিক আছে, আর বলো!', 'বুঝলাম। আর কী খবর?'],
  music: ['তাই নাকি! 🎵 আর বলো তো?', 'হুমম, গানের মতো সুন্দর কথা! আর?', 'আচ্ছা! আর কী শুনবো বলো? 😊', 'ওহো! আর বলো তো!'],
  dreamy: ['তাই নাকি! আর বলো তো? 😊', 'হুমম, শুনছি... আর কী খবর? ✨', 'আচ্ছা! এটা নিয়ে আরও বলো তো?', 'ওহো! আর বলো, শুনতে ভালো লাগছে 😊'],
}

function pick(intent: Intent, voice: BuddyVoice, exclude?: string): string {
  const pool = intent[voice] ?? intent.any ?? []
  if (pool.length === 0) return 'আচ্ছা! আর বলো তো? 😊'
  const candidates = exclude ? pool.filter(r => r !== exclude) : pool
  const list = candidates.length > 0 ? candidates : pool
  return list[Math.floor(Math.random() * list.length)]
}

function fillName(s: string, name: string): string {
  return s.split('{name}').join(name)
}

// মেলানোর নিয়ম (আগে প্রথম-মিলেই উত্তর দিতো, তাই ভুল বিষয় ধরে ফেলতো):
//   • লেখা স্বাভাবিক করা হয় — ছোট হাতের ল্যাটিন, "কী"→"কি", বাড়তি ফাঁকা জায়গা এক করা।
//   • এক শব্দের কি (যেমন "hi", "pi", "কল", "গান", "বাই") শুধু পুরো শব্দ হিসেবে মেলে —
//     অন্য শব্দের ভেতরে নয় ("picture"-তে "pi" নেই, "কলকাতা"-তে "কল" নেই, "বাইরে"-তে "বাই" নেই)।
//   • একাধিক শব্দের কি (যেমন "কেমন আছো", "ভিডিও কল") বাক্যের অংশ হিসেবে মেলে।
//   • প্রতিটা বিষয়ের স্কোর = তার সবচেয়ে লম্বা মিলে যাওয়া কি; সবচেয়ে বড় স্কোর জেতে,
//     সমান হলে আগের বিষয়টাই থাকে। স্কোর ২-এর কম হলে কোনো বিষয় ধরা হয় না।
const EDGE_PUNCT = /^[\s?!.।,;:'"()[\]{}«»“”‘’\-–—…]+|[\s?!.।,;:'"()[\]{}«»“”‘’\-–—…]+$/g

function normalizeText(s: string): string {
  return (s || '').toLowerCase().replace(/কী/g, 'কি').replace(/\s+/g, ' ').trim()
}

function tokensOf(norm: string): string[] {
  if (!norm) return []
  return norm.split(' ').map(t => t.replace(EDGE_PUNCT, '')).filter(Boolean)
}

function keyScore(key: string, normText: string, tokens: string[]): number {
  const k = normalizeText(key)
  if (!k) return -1
  if (k.includes(' ')) {
    return normText.includes(k) ? k.length : -1
  }
  return tokens.includes(k) ? k.length : -1
}

// ---- প্রতিধ্বনি (echo): বিষয় না মিললেও চেনা শব্দ থাকলে সেটাই ফিরিয়ে বলা ----
// কোনো বিষয়ের কি না মিললে, লেখায় এই শব্দগুলোর একটা থাকলে উত্তর সেই শব্দটাকে
// ধরেই আসে — জেনেরিক লাইনে লাফ দেয় না। {t} = ব্যবহারকারীর বলা শব্দটা।
const TOPIC_WORDS = [
  'ঘুম', 'আজকে', 'কালকে', 'মা', 'বাবা', 'ভাই', 'বোন', 'বন্ধু', 'বাসা', 'বাড়ি',
  'রাত', 'সকাল', 'দুপুর', 'শীত', 'গরম', 'ছবি', 'বই', 'স্কুল', 'কলেজ',
  'সিনেমা', 'ভ্রমণ', 'ঘুরতে', 'চা', 'কফি',
]

// কিছু বিষয়ে নিজস্ব স্বরে আরও স্বাভাবিক উত্তর (না থাকলে নিচের সাধারণ ছক)
const ECHO_SPECIFIC: Record<string, Partial<Record<BuddyVoice, string[]>>> = {
  'ঘুম': {
    funny: ['ঘুম আসছে না? 😄 আমিও মাঝে মাঝে ঘুমাতে পারি না! কী ভাবছো বলো তো?', 'ঘুমের কথা বলতেই আমারও ঘুম পেয়ে গেলো! 😄 এখন কয়টা বাজে?'],
    caring: ['ঘুম আসছে না? একটু গরম দুধ খেয়ে শুয়ে পড়ো, ভালো ঘুম হবে ❤️ কী ভাবছো বলো তো?', 'ঘুমের সমস্যা হচ্ছে? ফোনটা রেখে চোখ বন্ধ করো, আমি আছি 😊'],
    helpful: ['ঘুম না আসলে একটু বই পড়ো বা হালকা গান শুনো — ঘুম চলে আসবে 😊', 'ঘুম আসছে না? রাত জাগলে শরীর খারাপ হবে, তাড়াতাড়ি শুয়ে পড়ো!'],
    music: ['ঘুম আসছে না? একটা ঘুমপাড়ানি গান শুনে দেখো 🎵', 'ঘুমের আগে হালকা গান শুনলে ভালো ঘুম হয়! 🎵'],
    dreamy: ['ঘুম আসছে না? স্বপ্ন দেখার আগে একটু আকাশের দিকে তাকাও ✨', 'ঘুমের কথা বলতেই স্বপ্নের কথা মনে পড়ে গেলো 😊'],
  },
  'আজকে': {
    funny: ['আজকে! আজকের দিনটা কেমন গেলো বলো তো? 😄', 'আজকে নিয়ে তো গল্প হবেই! কী হলো আজকে?'],
    caring: ['আজকে কেমন গেলো তোমার দিনটা? বলো তো ❤️', 'আজকের কথা শুনছি... আর বলো 😊'],
    helpful: ['আজকে কী হলো? বলো তো, দেখি 😊', 'আজকের দিনটা নিয়ে আরও বলো!'],
    music: ['আজকে! আজকের গানটা কী ছিলো? 🎵', 'আজকের দিনটা গানের মতো কাটুক! 🎵'],
    dreamy: ['আজকে... আজকের দিনটা সুন্দর কাটুক 😊 কী হলো আজকে?', 'আজকের কথা শুনে ভালো লাগছে ✨'],
  },
}

const ECHO_TEMPLATES: Record<BuddyVoice, string[]> = {
  funny: ['{t} নিয়ে বলছো? আর বলো তো, কী হলো? 😄', 'আহা {t}! তারপর কী হলো বলো তো?', '{t}? এটা নিয়ে তো গল্প হবেই! আর বলো 😄'],
  caring: ['{t}-এর কথা বলছো... আর বলো, শুনছি ❤️', 'আহা, {t} নিয়ে কথা হচ্ছে? মন দিয়ে শুনছি, আর বলো তো 😊', '{t}? এটা নিয়ে তোমার কথা শুনতে ভালো লাগছে, আর বলো ❤️'],
  helpful: ['{t} নিয়ে বলছো? আর কিছু জানতে চাইলে বলো 😊', '{t}-এর ব্যাপারে আরও বলো তো, দেখি সাহায্য করতে পারি কিনা!', 'আচ্ছা, {t} নিয়ে কী জানতে চাও বলো তো?'],
  music: ['{t} নিয়ে বলছো? আর বলো তো! 🎵', '{t}? এটা নিয়ে একটা গান মনে পড়ে গেলো 😄', 'আহা {t}! আর বলো, শুনছি 🎵'],
  dreamy: ['{t} নিয়ে ভাবছি... আর বলো তো? 😊', '{t}? এটা শুনে মনটা হালকা হয়ে গেলো ✨', 'আহা {t}! স্বপ্নের মতো লাগছে... আর বলো 😊'],
}

// ---- মজার মোড় (fun twist): একই বিষয়ে মজার উত্তর ----
// প্রায় ৩–৪ বারে ১ বার আসে, পরপর দুবার কখনো না; মজার জন (রিমা) বেশি করে,
// অন্যরা মাঝে মাঝে — নিজের স্বরে। {t} থাকায় মজার উত্তরেও বিষয়টা থাকেই,
// প্রশ্ন এড়িয়ে যায় না।
const FUN_PROB: Record<BuddyVoice, number> = {
  funny: 0.5, caring: 0.2, helpful: 0.2, music: 0.25, dreamy: 0.2,
}

const FUN_TWISTS: Record<BuddyVoice, string[]> = {
  funny: ['{t} নিয়ে তো জমে গেলো! 😂 আর বলো তো, কী খবর?', 'আহা {t}! এটা নিয়ে তো গল্প হবেই 😄 তারপর?', '{t} বলতেই হাসি পেয়ে গেলো! আর কী শুনবো বলো?'],
  caring: ['{t}-এর কথা শুনে মনটা ভালো হয়ে গেলো ❤️ আর বলো তো?', 'আহা, {t} নিয়ে বলছো... শুনছি, আর বলো 😊', '{t}? এটা নিয়ে তোমার কথা শুনতে ভালো লাগছে ❤️'],
  helpful: ['{t} নিয়ে জানতে চাইলে আমি আছি! আর কী জানতে চাও? 😊', '{t}-এর ব্যাপারে বলো তো, দেখি সাহায্য করতে পারি কিনা!', 'আচ্ছা, {t} নিয়ে আরও কিছু জানতে চাইলে বলো 😊'],
  music: ['{t} নিয়ে তো গান হয়ে যায়! 🎵 আর বলো তো?', 'আহা {t}! এটা নিয়ে একটা গান মনে পড়ে গেলো 😄', '{t}? গানের মতো সুন্দর কথা! আর বলো 🎵'],
  dreamy: ['{t} নিয়ে ভাবছি... স্বপ্নের মতো লাগছে 😊 আর বলো তো?', 'আহা {t}! এটা শুনে মনটা হালকা হয়ে গেলো ✨', '{t}? এটা নিয়ে স্বপ্ন দেখতে ভালো লাগে 😊'],
}

/** বন্ধুর উত্তর — সবচেয়ে ভালো মিলে যাওয়া বিষয় ধরে, নিজের স্বরে উত্তর দেয়। একই কথায় পরপর একই উত্তর আসে না। */
export type BuddyReplyOpts = {
  lastWasFun?: boolean
  random?: () => number
}

export type BuddyReply = { text: string; fun: boolean }

function fillTopic(s: string, topic: string): string {
  return s.split('{t}').join(topic)
}

/** Reply language follows the user's language: any Bengali character in the
 *  message means a Bangla reply, otherwise English. */
function langOf(norm: string): 'bn' | 'en' {
  return /[\u0980-\u09FF]/.test(norm) ? 'bn' : 'en'
}

/** Best-matching intent in a list (longest matching key wins; score < 2 means
 *  no topic). An intent whose exclude phrase appears in the text is skipped
 *  entirely — e.g. "live on Mars" must not match the Live intent. */
function matchIntent(list: Intent[], norm: string, tokens: string[]): { intent: Intent; key: string } | null {
  let best: Intent | null = null
  let bestScore = 1 // ২-এর কম স্কোর মানে বিষয় ধরা হয়নি
  let bestKey = ''
  for (const intent of list) {
    if (intent.exclude && intent.exclude.some(x => norm.includes(normalizeText(x)))) continue
    let score = -1
    let key = ''
    for (const k of intent.keys) {
      const s = keyScore(k, norm, tokens)
      if (s > score) { score = s; key = normalizeText(k) }
    }
    if (score > bestScore) {
      bestScore = score
      best = intent
      bestKey = key
    }
  }
  return best ? { intent: best, key: bestKey } : null
}

/** Fill reply placeholders: {name} = persona name, {time} = current time,
 *  {userName} = the name the user just introduced ("my name is ..."). */
function fillDynamic(s: string, name: string, raw: string): string {
  let out = fillName(s, name)
  if (out.includes('{time}')) {
    out = out.split('{time}').join(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
  }
  if (out.includes('{userName}')) {
    const m = /my name is\s+([A-Za-z]+)/i.exec(raw || '')
    out = out.split('{userName}').join(m ? m[1] : 'friend')
  }
  return out
}

/** বিস্তারিত উত্তর — লেখা + এটা মজার মোড় কি না (পরপর দুবার মজা ঠেকাতে কলারকে লাগে)। */
export function getBuddyReplyDetail(personaId: string, text: string, lastReply?: string, opts?: BuddyReplyOpts): BuddyReply {
  const persona = getBuddy(personaId) ?? BUDDIES[0]
  const norm = normalizeText(text)
  const tokens = tokensOf(norm)
  const lang = langOf(norm)
  const isQuestion = norm.includes('?') || norm.includes('？')
  const matched = matchIntent(lang === 'en' ? EN_INTENTS : INTENTS, norm, tokens)
  const best = matched?.intent ?? null
  const bestKey = matched?.key ?? ''
  const rnd = opts?.random ?? Math.random
  const lastWasFun = opts?.lastWasFun ?? false
  // মজার মোড়: আগের উত্তর মজার হলে এবার নয়; প্রশ্ন হলে কখনো নয় (প্রশ্নের
  // উত্তর এড়িয়ে মজা করা যাবে না); নইলে স্বরের হার অনুযায়ী।
  // A fun twist must never dodge a question or replace a greeting — it only
  // fires for topical statements, so the answer always follows the question.
  const tryFun = (topic: string): string | null => {
    if (lastWasFun) return null
    if (isQuestion) return null
    if (rnd() >= FUN_PROB[persona.voice]) return null
    const pool = (lang === 'en' ? FUN_TWISTS_EN : FUN_TWISTS)[persona.voice] ?? []
    if (pool.length === 0) return null
    const filled = pool.map(r => fillTopic(fillDynamic(r, persona.name, text), topic))
    const candidates = lastReply ? filled.filter(r => r !== lastReply) : filled
    const list = candidates.length > 0 ? candidates : filled
    return list[Math.floor(rnd() * list.length)]
  }
  if (best) {
    const topic = best.topic ? fillName(best.topic, persona.name) : bestKey
    // A fun twist needs a short topic word — a whole sentence as the topic
    // ("talking about i feel tired...") reads wrong, so multi-word keys
    // without an explicit topic never twist; they answer straight.
    if (best.funOk !== false && (best.topic || !bestKey.includes(' '))) {
      const fun = tryFun(topic)
      if (fun) return { text: fun, fun: true }
    }
    return { text: fillDynamic(pick(best, persona.voice, lastReply), persona.name, text), fun: false }
  }
  // প্রতিধ্বনি: কোনো বিষয় না মিললে চেনা শব্দ থাকলে সেটাই ফিরিয়ে বলা হয়
  const topicWords = lang === 'en' ? TOPIC_WORDS_EN : TOPIC_WORDS
  const echoWord = topicWords.find(w => tokens.includes(normalizeText(w)))
  if (echoWord) {
    const fun = tryFun(echoWord)
    if (fun) return { text: fun, fun: true }
    const specific = (lang === 'en' ? ECHO_SPECIFIC_EN : ECHO_SPECIFIC)[echoWord]?.[persona.voice]
    const pool = specific ?? (lang === 'en' ? ECHO_TEMPLATES_EN : ECHO_TEMPLATES)[persona.voice] ?? []
    const filled = pool.map(r => fillTopic(fillDynamic(r, persona.name, text), echoWord))
    const candidates = lastReply ? filled.filter(r => r !== lastReply) : filled
    const list = candidates.length > 0 ? candidates : filled
    return { text: list[Math.floor(rnd() * list.length)], fun: false }
  }
  if (isQuestion) {
    const fb = lang === 'en' ? QUESTION_FALLBACK_EN : QUESTION_FALLBACK
    return { text: fillDynamic(pick(fb, persona.voice, lastReply), persona.name, text), fun: false }
  }
  const fb = lang === 'en' ? FALLBACK_EN : FALLBACK
  return { text: fillDynamic(pick(fb, persona.voice, lastReply), persona.name, text), fun: false }
}

/** আগের মতোই — শুধু লেখাটা ফেরত দেয় (মজার মোড় জানতে getBuddyReplyDetail ব্যবহার করো)। */
export function getBuddyReply(personaId: string, text: string, lastReply?: string): string {
  return getBuddyReplyDetail(personaId, text, lastReply).text
}
