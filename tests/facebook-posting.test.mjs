// ফেসবুক-স্টাইল পোস্টিং টেস্ট — কম্পোজার মডাল, আসল কমেন্ট, আসল শেয়ার,
// লাইক ধরে রাখা, নিজের পোস্ট Edit/Delete, ?post= ডিপ লিংক।
// চালানো: রিপো রুট থেকে `node tests/facebook-posting.test.mjs`
// (esbuild দিয়ে src/feedPosts.ts বান্ডল করে Node-এ চালায়; পেজ/স্টোরের
// গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) লাইক টগল — +১/−১, ০-এর নিচে নয়, না থাকা id-তে কিছু বদলায় না
//   ২) কমেন্ট যোগ — তালিকায় জমে, সংখ্যা +১, খালি লেখা বাদ, না থাকা পোস্টে নয়
//   ৩) পোস্ট মোছা/সম্পাদনা — শুধু ওই পোস্ট, বাকি ঘর একই থাকে
//   ৪) শেয়ার লিংক + ?post= ডিপ লিংক — রাউন্ড-ট্রিপ, খালি/ভুলে null
//   ৫) নিজের পোস্ট চেনা — mine ফ্ল্যাগ / author 'You'; পারসোনা নয়
//   ৬) Feed — কম্পোজার মডাল (Create post + Add to your post), ভিডিও
//      সত্যিই disabled (coming soon), কমেন্ট Send আসলে যোগ করে, শেয়ার
//      navigator.share + clipboard ফলব্যাক + "Link copied", ⋯ মেনুতে
//      Edit/Delete, ?post= পড়ে স্ক্রল
//   ৭) store — togglePostLike/addPostComment/deletePost/updatePost/
//      likedPostIds দেয়; Post-এ mine + commentsList আছে
//   ৮) কম্পোজারের পোস্ট addPost-এ যায়, ফিডের একদম উপরে (রিগ্রেশন নয়)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const dataSrc = readFileSync(join(root, 'src/data.ts'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-fbpost-test-'))
async function bundle(entry, name) {
  const outFile = join(outDir, name)
  await build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', platform: 'node', outfile: outFile, logLevel: 'silent' })
  return import(outFile)
}
const FP = await bundle('src/feedPosts.ts', 'feedPosts.mjs')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const POSTS = [
  { id: 'p1', author: 'Rima', time: '2h', text: 'Hello', likes: 5, comments: 2, shares: 1, color: '#E91E63' },
  { id: 'p2', author: 'You', time: 'Now', text: 'Mine', likes: 0, comments: 0, shares: 0, color: '#7C3AED', mine: true },
]

check('লাইক টগল — +১/−১, ০-এর নিচে নয়, না থাকা id-তে কিছু বদলায় না', () => {
  const r1 = FP.togglePostLike(POSTS, [], 'p1')
  assert.equal(r1.posts[0].likes, 6)
  assert.deepEqual(r1.likedIds, ['p1'])
  const r2 = FP.togglePostLike(r1.posts, r1.likedIds, 'p1')
  assert.equal(r2.posts[0].likes, 5)
  assert.deepEqual(r2.likedIds, [])
  const r3 = FP.togglePostLike([{ ...POSTS[1] }], [], 'p2')
  const r4 = FP.togglePostLike(r3.posts, r3.likedIds, 'p2')
  assert.equal(r4.posts[0].likes, 0, 'লাইক ০-এর নিচে গেছে')
  const r5 = FP.togglePostLike(POSTS, [], 'nope')
  assert.deepEqual(r5.posts, POSTS)
  assert.deepEqual(r5.likedIds, [])
})

check('কমেন্ট যোগ — তালিকায় জমে, সংখ্যা +১, খালি লেখা বাদ, না থাকা পোস্টে নয়', () => {
  const out = FP.addPostComment(POSTS, 'p1', { id: 'c1', author: 'Asha', text: 'Nice!', time: 'Now' })
  assert.equal(out[0].comments, 3)
  assert.equal(out[0].commentsList.length, 1)
  assert.equal(out[0].commentsList[0].text, 'Nice!')
  const out2 = FP.addPostComment(out, 'p1', { id: 'c2', author: 'Asha', text: 'Second', time: 'Now' })
  assert.equal(out2[0].comments, 4)
  assert.equal(out2[0].commentsList.length, 2)
  assert.deepEqual(FP.addPostComment(POSTS, 'p1', { id: 'c3', author: 'A', text: '   ', time: 'Now' }), POSTS, 'খালি কমেন্ট যোগ হয়েছে')
  assert.deepEqual(FP.addPostComment(POSTS, 'nope', { id: 'c4', author: 'A', text: 'x', time: 'Now' }), POSTS)
})

check('পোস্ট মোছা/সম্পাদনা — শুধু ওই পোস্ট, বাকি ঘর একই থাকে', () => {
  assert.deepEqual(FP.deletePost(POSTS, 'p1').map(p => p.id), ['p2'])
  const edited = FP.updatePost(POSTS, 'p2', { text: 'Edited', audience: 'Friends' })
  assert.equal(edited[1].text, 'Edited')
  assert.equal(edited[1].audience, 'Friends')
  assert.equal(edited[1].likes, 0, 'সম্পাদনায় লাইক বদলেছে')
  assert.equal(edited[0].text, 'Hello')
})

check('শেয়ার লিংক + ?post= ডিপ লিংক — রাউন্ড-ট্রিপ, খালি/ভুলে null', () => {
  const url = FP.buildPostShareUrl('https://picallbd.web.app/', 'p1')
  assert.equal(url, 'https://picallbd.web.app/feed?post=p1')
  assert.equal(FP.parsePostDeepLink('?post=p1'), 'p1')
  assert.equal(FP.parsePostDeepLink('post=p1'), 'p1')
  assert.equal(FP.parsePostDeepLink('?post='), null)
  assert.equal(FP.parsePostDeepLink(''), null)
  assert.equal(FP.parsePostDeepLink('?q=hello'), null)
})

check("নিজের পোস্ট চেনা — mine ফ্ল্যাগ / author 'You'; পারসোনা নয়", () => {
  assert.equal(FP.isOwnPost(POSTS[1]), true)
  assert.equal(FP.isOwnPost({ ...POSTS[0], author: 'You' }), true)
  assert.equal(FP.isOwnPost(POSTS[0]), false)
})

const feedStart = pagesSrc.indexOf('export function Feed()')
const feedEnd = pagesSrc.indexOf('export function Marketplace()')
const feed = pagesSrc.slice(feedStart, feedEnd)

check('Feed — কম্পোজার মডাল (Create post + Add to your post), ভিডিও সত্যিই disabled', () => {
  assert.ok(feed.includes("aria-label={editingPost ? 'Edit post' : 'Create post'}"), 'মডাল নেই')
  assert.ok(feed.includes('fixed inset-0 z-50'), 'মডাল ফিক্সড ওভারলে নয়')
  assert.ok(feed.includes('Add to your post'), 'Add to your post সারি নেই')
  assert.ok(feed.includes('Create post'), 'Create post শিরোনাম নেই')
  assert.ok(feed.includes("What's on your mind?"), 'কম্পোজার পিল নেই')
  assert.ok(feed.includes('Video (max 50 MB) — coming soon'), 'ভিডিও coming soon লেবেল নেই')
  assert.ok(feed.includes('<button disabled'), 'ভিডিও বোতাম disabled নয়')
  assert.ok(feed.includes('placeholder="Title (optional)"'), 'ঐচ্ছিক Title ঘর নেই')
  assert.ok(feed.includes("Ctrl + Enter to post"), 'Ctrl+Enter ইঙ্গিত নেই')
})

check('Feed — কমেন্ট Send আসলে যোগ করে, কমেন্টের তালিকা দেখায়', () => {
  assert.ok(feed.includes('addPostComment(p.id, t)'), 'Send কমেন্ট যোগ করে না')
  assert.ok(feed.includes('commentsList'), 'কমেন্টের তালিকা দেখায় না')
  assert.ok(feed.includes('Write a comment…'), 'কমেন্ট লেখার ঘর নেই')
  assert.ok(feed.includes('setShowComments'), 'কমেন্ট খোলা/বন্ধ হয় না')
})

check('Feed — শেয়ার navigator.share + clipboard ফলব্যাক + "Link copied"', () => {
  assert.ok(feed.includes('sharePost(p)'), 'শেয়ার বোতাম sharePost ডাকে না')
  assert.ok(feed.includes('buildPostShareUrl(window.location.origin, p.id)'), 'শেয়ার লিংকে ?post= নেই')
  assert.ok(pagesSrc.includes('navigator.share'), 'navigator.share নেই')
  assert.ok(pagesSrc.includes('navigator.clipboard.writeText'), 'clipboard ফলব্যাক নেই')
  assert.ok(feed.includes('Link copied — share it anywhere.'), 'Link copied বার্তা নেই')
  assert.ok(!feed.includes("shares: x.shares + 1 } : x))}><IconShare"), 'শেয়ার এখনো শুধু সংখ্যা বাড়ায়')
})

check('Feed — নিজের পোস্টে ⋯ মেনু (Edit/Delete) + মুছে ফেলার নিশ্চিতকরণ', () => {
  assert.ok(feed.includes('Edit post'), 'Edit post নেই')
  assert.ok(feed.includes('Delete post'), 'Delete post নেই')
  assert.ok(feed.includes('Delete this post?'), 'মুছে ফেলার নিশ্চিতকরণ নেই')
  assert.ok(feed.includes('deletePost(p.id)'), 'Delete আসলে মোছে না')
  assert.ok(feed.includes('openComposer(p)'), 'Edit কম্পোজার খোলে না')
})

check('Feed — ?post= ডিপ লিংক পড়ে ওই পোস্টে স্ক্রল করে', () => {
  assert.ok(feed.includes('parsePostDeepLink(window.location.search)'), '?post= পড়ে না')
  assert.ok(feed.includes('jumpToPost(deepPostId)'), 'ডিপ লিংকে স্ক্রল করে না')
})

check('Feed — লাইক store-এ ধরে রাখা হয় (রিলোডেও থাকে)', () => {
  assert.ok(feed.includes('togglePostLike(p.id)'), 'লাইক store টগল ডাকে না')
  assert.ok(feed.includes('likedPostIds.includes(p.id)'), 'লাইক অবস্থা likedPostIds থেকে নয়')
  assert.ok(storeSrc.includes("load('likedPostIds', [])"), 'likedPostIds সংরক্ষণ হয় না')
})

check('store — togglePostLike/addPostComment/deletePost/updatePost/likedPostIds দেয়', () => {
  for (const s of ['likedPostIds', 'togglePostLike:', 'addPostComment:', 'deletePost:', 'updatePost:']) {
    assert.ok(storeSrc.includes(s), `store-এ ${s} নেই`)
  }
  assert.ok(dataSrc.includes('mine?: boolean'), 'Post-এ mine নেই')
  assert.ok(dataSrc.includes('commentsList?: PostComment[]'), 'Post-এ commentsList নেই')
})

check('কম্পোজারের পোস্ট addPost-এ যায়, ফিডের একদম উপরে', () => {
  assert.ok(feed.includes('addPost({'), 'কম্পোজার addPost ব্যবহার করে না')
  assert.ok(feed.includes('mine: true'), 'নতুন পোস্টে mine ফ্ল্যাগ নেই')
  assert.ok(feed.includes('imageUrl: composerPhoto'), 'পোস্টের ছবি পোস্টের সঙ্গে থাকে না')
  assert.ok(feed.includes('videoUrl: composerVideoUrl'), 'পোস্টের ভিডিও পোস্টের সঙ্গে থাকে না')
  assert.ok(storeSrc.includes('addPost: (p) =>'), 'store addPost দেয় না')
})

console.log(`\nfacebook-posting: ${passed} checks passed`)
