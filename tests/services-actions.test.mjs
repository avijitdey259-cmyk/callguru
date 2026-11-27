// সার্ভিসেস পেজ — কার্ডে Chat + Service বোতাম, অপেক্ষা দেখানো, কল-শেষে রিভিউ।
// চালানো: রিপো রুট থেকে `node tests/services-actions.test.mjs`
// (services.ts pure লজিক esbuild দিয়ে বান্ডল করে চালায়; কার্ড/কল-পেজ/
//  স্টোরের গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) প্রতিটা সার্ভিস কার্ডে Chat + Service বোতাম (নিজের সার্ভিসে নয়)
//   ২) Service বোতাম কার্ডের দরেই (π X/minute) প্রিপেইড কল শুরু করে
//   ৩) অপেক্ষা: কল স্ক্রিনে "Waiting…" + সার্ভিস কার্ডে + চ্যাট থ্রেডে
//   ৪) সার্ভিস কল শেষে (সংযুক্ত হয়েছিল) কলকারী নামসহ রিভিউ দিতে পারেন;
//      Reviews (N) আসল রিভিউ গোনে, তালিকায় নামসহ দেখায়
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-svc-test-'))
const outFile = join(outDir, 'services.mjs')
await build({
  entryPoints: [join(root, 'src/services.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const S = await import(outFile)

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const servicesSrc = readFileSync(join(root, 'src/services.ts'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

console.log('— কার্ডের বোতাম (pure নিয়ম) —')
check('নিজের সার্ভিস চেনা যায় (providerUid == uid)', () => {
  const svc = { id: 's1', providerUid: 'u-me', providerName: 'Me', title: 'Help call', ratePiPerMin: 0.2 }
  assert.equal(S.isOwnService(svc, 'u-me'), true)
  assert.equal(S.isOwnService(svc, 'u-other'), false)
  assert.equal(S.isOwnService(svc, null), false)
})
check('কার্ডের দরের লেবেল ঠিক (π 0.2/minute)', () => {
  assert.equal(S.serviceRateLabel(0.2), 'π 0.2/minute')
  assert.equal(S.serviceRateLabel(0.15), 'π 0.15/minute')
})
check('কল শুরু: ফ্রি মিনিট থাকলে চলে; নইলে ব্যালেন্স ≥ দর লাগে', () => {
  assert.equal(S.canStartServiceCall(0, 0.2, true), true)
  assert.equal(S.canStartServiceCall(0.2, 0.2, false), true)
  assert.equal(S.canStartServiceCall(0.1, 0.2, false), false)
  assert.equal(S.canStartServiceCall(5, 0, false), false)
})
check('রিভিউ যাচাই: ১–৫ তারা লাগে, লেখা ৩০০ অক্ষরের ভেতরে', () => {
  assert.equal(S.validateReviewInput(0, ''), 'Pick 1 to 5 stars.')
  assert.equal(S.validateReviewInput(6, ''), 'Pick 1 to 5 stars.')
  assert.equal(S.validateReviewInput(5, ''), null)
  assert.equal(S.validateReviewInput(4, 'Great help!'), null)
  assert.ok(S.validateReviewInput(5, 'x'.repeat(301)) !== null)
})
check('গড় রেটিং + সংখ্যা আসল রিভিউ থেকেই', () => {
  assert.deepEqual(S.averageRating([]), { avg: 0, count: 0 })
  assert.deepEqual(S.averageRating([{ stars: 5 }, { stars: 3 }]), { avg: 4, count: 2 })
})

console.log('— ওয়্যারিং (সোর্স-গঠন) —')
check('কার্ডে Chat + Service বোতাম আছে (দরসহ); নিজের সার্ভিসে শুধু "This is your service"', () => {
  assert.ok(pagesSrc.includes("💼 Service — {serviceRateLabel(service.ratePiPerMin)}"))
  assert.ok(pagesSrc.includes("navigate('/chat', { state: { with: service.providerName, peerId: service.providerUid } })"))
  assert.ok(pagesSrc.includes('💬 Chat</Btn>'))
  assert.ok(pagesSrc.includes("navigate(`/call/service/${service.id}`)"))
  assert.ok(pagesSrc.includes('This is your service'))
})
check('Chat বোতাম প্রোভাইডারের থ্রেড খোলে (peerId দিয়ে — ডেটিং-KYC গোনায় নয়)', () => {
  assert.ok(pagesSrc.includes("const peerId = st?.peerId ?? st?.datingPartnerId ?? params.get('peer')"))
  assert.ok(pagesSrc.includes('datingPartnerIdRef.current = st?.datingPartnerId && !isAiDatingId(st.datingPartnerId) ? st.datingPartnerId : null'))
  assert.ok(pagesSrc.includes('isAiDatingId(st.datingPartnerId)'), 'AI পার্টনার KYC-গোনায় বাদ নেই')
})
check('Service কল কার্ডের দরেই চলে — CallPage-র rate = service.ratePiPerMin', () => {
  assert.ok(pagesSrc.includes('isService ? (service?.ratePiPerMin ?? 0)'))
  assert.ok(pagesSrc.includes('Prepaid service call — {formatPi(rate)}/minute'))
})
check('প্রিপেইড মিটার + ব্যালেন্স শেষে অটো-কাট (সার্ভিস কলেও)', () => {
  assert.ok(pagesSrc.includes("if (next >= maxSeconds && maxSeconds > 0) { hangUp('Auto-cut — out of balance') }"))
})
check('অপেক্ষা: কল স্ক্রিনে "Waiting for the other person…" আছে', () => {
  assert.ok(pagesSrc.includes("Waiting for the other person…"))
})
check('অপেক্ষা: সার্ভিস কার্ডে বাজতে থাকা কল দেখায় (ringingCall)', () => {
  assert.ok(pagesSrc.includes("ringingCall?.kind === 'Service' && ringingCall.peerId === service.providerUid"))
  assert.ok(pagesSrc.includes('Calling {service.providerName}… waiting for an answer'))
})
check('অপেক্ষা: চ্যাট থ্রেডেও বাজতে থাকা কল দেখায়', () => {
  assert.ok(pagesSrc.includes('Calling {active}… waiting for an answer'))
})
check('অপেক্ষা: কল শুরুতে ringingCall বসে; সংযোগ/ব্যর্থতা/শেষে সরে', () => {
  assert.ok(pagesSrc.includes('setRingingCall({'))
  assert.ok(pagesSrc.includes("if (connected) { stopRingback(); setRingingCall(null) }"))
  assert.ok(storeSrc.includes('ringingCall: RingingCall | null'))
})
check('রিভিউ ফর্ম শুধু সার্ভিস কল শেষে (সংযুক্ত হয়েছিল, seconds > 0) দেখায়', () => {
  assert.ok(pagesSrc.includes('{isService && !isLinkCall && seconds > 0 && service && uid && ('))
  assert.ok(pagesSrc.includes('<ServiceReviewForm serviceId={service.id} reviewerUid={uid} reviewerName={user?.name'))
})
check('রিভিউ নামসহ সবার কাছে দেখায়; Reviews (N) আসল সংখ্যা গোনে', () => {
  assert.ok(pagesSrc.includes('<b>{r.reviewerName}</b>'))
  assert.ok(pagesSrc.includes('Reviews ({count})'))
  assert.ok(pagesSrc.includes('subscribeServiceReviews(service.id'))
  assert.ok(pagesSrc.includes("Your review — with your name — will be visible to everyone"))
})
check('নিয়ম: রিভিউ লিখতে পারেন শুধু রিভিউয়ার নিজে (reviewerUid == auth.uid); পড়তে পারেন সবাই', () => {
  assert.ok(rulesSrc.includes('match /services/{serviceId}/reviews/{reviewId}'))
  assert.ok(rulesSrc.includes('request.resource.data.reviewerUid == request.auth.uid'))
})
check('রিভিউ জমা: নাম + তারা + লেখা Firestore-এ যায়', () => {
  assert.ok(pagesSrc.includes('submitServiceReview(serviceId, { reviewerUid, reviewerName, stars, text })'))
})

console.log(`\n${passed} passed`)
