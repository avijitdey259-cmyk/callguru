// লেবেল করা AI ডেটিং প্রোফাইল — মালিকের সম্মতিতে (২০২৬-১১-২৭), শুধু Dating-এ।
// চালানো: রিপো রুট থেকে `node tests/dating-ai-profiles.test.mjs`
// (src/data.ts + src/buddies.ts pure লজিক esbuild দিয়ে বান্ডল করে চালায়;
// পেজের গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) প্রোফাইল সংখ্যা (৪০: ছেলে ২০ + মেয়ে ২০), সব id 'ai-' দিয়ে শুরু
//   ২) প্রত্যেকের আলাদা ছবি (৪০টি আলাদা /ai-dating-*.jpg, ফাইল আছে)
//   ৩) সবাই ১৮+, জেলা + ইন্টারেস্ট + স্বর + isAI: true
//   ৪) কোনো নাম চ্যাট পারসোনার নামের সাথে মেলে না
//   ৫) হেলপার (isAiDatingId / getAiDatingProfile / byName / converter)
//   ৬) কার্ডে 🤖 AI ব্যাজ, AI ম্যাচে স্পষ্ট লেবেল, Super Like ফ্রি
//   ৭) AI-দের ভিডিও কল নেই (CallPage গার্ড + নোট), চ্যাটে লোকাল উত্তর
//   ৮) AI কখনো Firestore / সার্চ / New Members / Friends-এ যায় না
//   ৯) আসল ব্যবহারকারীর প্রবাহ (fetchNewMembers) অপরিবর্তিত
import { build } from 'esbuild'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-dating-ai-test-'))

const dataOut = join(outDir, 'data.mjs')
await build({
  entryPoints: [join(root, 'src/data.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: dataOut,
  logLevel: 'silent',
})
const data = await import(dataOut)
const { DATING_PROFILES, AI_DATING_BADGE, isAiDatingId, getAiDatingProfile, getAiDatingProfileByName, aiDatingToNewMember } = data

const buddiesOut = join(outDir, 'buddies.mjs')
await build({
  entryPoints: [join(root, 'src/buddies.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: buddiesOut,
  logLevel: 'silent',
})
const { BUDDIES, VOICE_BUDDY_ID } = await import(buddiesOut)

let n = 0
function check(cond, label) {
  n++
  assert.ok(cond, label)
  console.log(`ok ${n} - ${label}`)
}

// ১) সংখ্যা — ৪০টি প্রোফাইল, ছেলে ২০ + মেয়ে ২০ (১০০টি আলাদা প্রতিকৃতি এক
// রানে সম্ভব নয় বলে ৪০টি করা হয়েছে — সংখ্যাটা এখানে স্পষ্ট, ১০০ বলে নয়)।
check(DATING_PROFILES.length === 40, `40 AI profiles (got ${DATING_PROFILES.length})`)
check(DATING_PROFILES.filter(p => p.gender === 'Male').length === 20, '20 male profiles')
check(DATING_PROFILES.filter(p => p.gender === 'Female').length === 20, '20 female profiles')

// ২) id / নাম — আলাদা, 'ai-' দিয়ে শুরু, কেউ আসল UID-এর মতো নয়।
check(new Set(DATING_PROFILES.map(p => p.id)).size === 40, 'all 40 ids unique')
check(DATING_PROFILES.every(p => p.id.startsWith('ai-')), "all ids start with 'ai-'")
check(new Set(DATING_PROFILES.map(p => p.name)).size === 40, 'all 40 names unique')
check(DATING_PROFILES.every(p => p.isAI === true), 'every profile isAI: true')

// ৩) ছবি — প্রত্যেকের আলাদা /ai-dating-*.jpg, ফাইল public/-এ আছে।
const photos = DATING_PROFILES.map(p => p.photo)
check(new Set(photos).size === 40, 'all 40 photos distinct (no reuse)')
check(photos.every(p => p.startsWith('/ai-dating-') && p.endsWith('.jpg')), 'all photos are /ai-dating-*.jpg')
check(photos.every(p => existsSync(join(root, 'public', p.slice(1)))), 'all 40 photo files exist in public/')

// ৪) ১৮+, জেলা, ইন্টারেস্ট, স্বর।
check(DATING_PROFILES.every(p => p.age >= 18 && p.age <= 40), 'all ages 18+')
check(DATING_PROFILES.every(p => typeof p.city === 'string' && p.city.trim() !== ''), 'every profile has a district')
check(DATING_PROFILES.every(p => Array.isArray(p.interests) && p.interests.length >= 2), 'every profile has interests')
check(DATING_PROFILES.every(p => ['funny', 'caring', 'helpful', 'music', 'dreamy'].includes(p.voice)), 'every profile has a valid chat voice')
check(DATING_PROFILES.every(p => typeof p.about === 'string' && p.about.trim() !== ''), 'every profile has an about line')

// ৫) কোনো AI নাম চ্যাট পারসোনার নামের সাথে মেলে না (নইলে বন্ধুর উত্তরে মিশে যেত)।
const buddyNames = new Set(BUDDIES.map(b => b.name))
check(DATING_PROFILES.every(p => !buddyNames.has(p.name)), 'no AI name collides with a chat persona name')
check(Object.keys(VOICE_BUDDY_ID).length === 5, 'voice-to-buddy map covers all 5 voices')

// ৬) হেলপার।
check(isAiDatingId('ai-m01') && !isAiDatingId('LXnGL8xA6VW8Gp7hvCaoakOha822'), 'isAiDatingId: ai- true, real uid false')
check(getAiDatingProfile('ai-f03')?.name === 'Ayesha', 'getAiDatingProfile finds by id')
check(getAiDatingProfileByName('Rony')?.id === 'ai-m09', 'getAiDatingProfileByName finds by name')
check(getAiDatingProfile('nope') === undefined, 'unknown id returns undefined')
check(AI_DATING_BADGE.includes('AI'), 'badge wording contains AI')

// ৭) কনভার্টার — DatingPage-এর প্রার্থী আকৃতি, isAI সহ।
const m0 = aiDatingToNewMember(DATING_PROFILES[0])
check(m0.isAI === true && m0.displayName === DATING_PROFILES[0].name && m0.photo === DATING_PROFILES[0].photo && m0.district === DATING_PROFILES[0].city, 'aiDatingToNewMember maps name/photo/district + isAI')

// ৮) পেজের গঠন (সোর্স পড়ে)।
const pages = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
check(pages.includes('aiDatingToNewMember'), 'DatingPage merges AI candidates with real candidates')
check(pages.includes('{AI_DATING_BADGE}'), 'AI badge rendered on cards/match/chat')
check(pages.includes('if (!p.isAI)') && pages.includes('⭐ Super Like (Free)'), 'Super Like is free on AI profiles (no Pi cut)')
check(pages.includes("!isAiDatingId(matchedId)") && pages.includes("It's an AI Match"), 'match card labels AI matches and hides Video Call for AI')
check(pages.includes("datingProfile?.isAI"), 'CallPage guards AI video calls')
check(pages.includes("AI profiles can't take video calls"), 'honest no-call note shown for AI')
check(pages.includes('VOICE_BUDDY_ID[aiPeer.voice]'), 'AI chat replies via the local reply engine')
check(pages.includes('!isAiDatingId(activeFriend.id)'), 'AI excluded from real-user chat (no Firestore send)')
check(pages.includes('isAiDatingId(peerId)'), 'AI peer is not added as a friend')
check(pages.includes('fetchNewMembers()'), 'real-user candidate flow unchanged')
check(pages.includes('DATING_PROFILES.map(aiDatingToNewMember)'), 'AI list comes from the local data file only')

// ৯) নিয়ন্ত্রণ — AI কখনো Firestore / সার্চ / স্টোরে যায় না।
const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
check(!firestoreSrc.includes('DATING_PROFILES') && !firestoreSrc.includes('ai-dating'), 'Firestore never references AI profiles')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
check(!storeSrc.includes('DATING_PROFILES'), 'store never references AI profiles')
const searchSrc = readFileSync(join(root, 'src/friendSearch.ts'), 'utf8')
check(!searchSrc.includes('DATING_PROFILES') && !searchSrc.includes('ai-dating'), 'search never includes AI profiles')
const newMembersSrc = readFileSync(join(root, 'src/newMembers.ts'), 'utf8')
check(newMembersSrc.includes('isAI?: boolean'), 'NewMember carries the isAI flag')
check(!readFileSync(join(root, 'src/data.ts'), 'utf8').includes('writePublicProfile'), 'AI list never writes a public profile')

console.log(`\nPASS: ${n} checks — ${DATING_PROFILES.length} labelled AI dating profiles, ${new Set(photos).size} distinct photos`)
