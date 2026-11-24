// প্রথমবার খুললেই হোম/ফিড টেস্ট — লগইন থাকলে / খুললেই /feed-এ যায়,
// আর কোনো ওয়েলকাম পেজে ট্যাপ করতে হয় না; লগইন না থাকলে /login;
// লগইনের পরেও সরাসরি /feed।
// চালানো: রিপো রুট থেকে `node tests/home-landing.test.mjs`
// (সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) / রুট সরাসরি /feed-এ পাঠায় (Landing আর /-এ নয়)
//   ২) Landing শুধু /welcome-এ থাকে (পেজটা মোছা হয়নি)
//   ৩) লগইন দেওয়াল আগের মতোই — লগইন ছাড়া /login বাদে কিছু খোলে না
//   ৪) লগইন সফল হলেই /feed-এ যায় (Google + ইমেইল/পাসওয়ার্ড)
//   ৫) ধরা-না-পড়া পথ (* ক্যাচ-অল) /-এ যায় — যা এখন /feed
//   ৬) PWA start_url / — অ্যাপ খুললেও একই রিডাইরেক্টে ফিডে যায়
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const appSrc = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'))

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('/ রুট সরাসরি /feed-এ পাঠায় (Landing আর /-এ নয়)', () => {
  assert.ok(appSrc.includes('<Route path="/" element={<Navigate to="/feed" replace />} />'), '/ এখনো Landing দেখায় বা /feed-এ পাঠায় না')
  assert.ok(!appSrc.includes('<Route path="/" element={<Landing />} />'), '/-এ এখনো Landing আছে')
})

check('Landing শুধু /welcome-এ থাকে (পেজটা মোছা হয়নি)', () => {
  assert.ok(appSrc.includes('<Route path="/welcome" element={<Landing />} />'), '/welcome-এ Landing নেই')
})

check('লগইন দেওয়াল আগের মতোই — লগইন ছাড়া /login বাদে কিছু খোলে না', () => {
  assert.ok(appSrc.includes("if (!user && loc.pathname !== '/login') return <Navigate to=\"/login\" replace />"), 'লগইন দেওয়াল ভেঙেছে')
})

check('লগইন সফল হলেই /feed-এ যায় (Google + ইমেইল/পাসওয়ার্ড)', () => {
  const navs = (pagesSrc.match(/navigate\('\/feed'\)/g) || []).length
  assert.ok(navs >= 3, `লগইনের পর /feed-এ যাওয়া ${navs} বার — কমপক্ষে ৩ বার থাকার কথা`)
  assert.ok(pagesSrc.includes("login(u.name, u.email); navigate('/feed')"), 'Google লগইনের পর /feed-এ যায় না')
})

check('ধরা-না-পড়া পথ (* ক্যাচ-অল) /-এ যায় — যা এখন /feed', () => {
  assert.ok(appSrc.includes('<Route path="*" element={<Navigate to="/" replace />} />'), 'ক্যাচ-অল বদলেছে')
})

check('PWA start_url / — অ্যাপ খুললেও একই রিডাইরেক্টে ফিডে যায়', () => {
  assert.equal(manifest.start_url, '/', 'PWA start_url / নয়')
})

console.log(`\nhome-landing: ${passed} checks passed`)
