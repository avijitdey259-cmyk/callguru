// Chat back-stack + auto-scroll + list-preview RUNTIME test.
// চালানো: রিপো রুট থেকে `node tests/chat-back-stack.test.mjs`
// (jsdom-এ আসল ChatPage + আসল react-router memory router + আসল
//  StoreProvider মাউন্ট করে — মডেল নয়, শিপ করা কম্পোনেন্টটাই চলে।
//  সিস্টেম/হার্ডওয়্যার ব্যাক বোতাম = router.navigate(-1), অর্থাৎ ব্রাউজারে
//  ব্যাক চাপলে যে POP নেভিগেশন হয় ঠিক সেটাই। jsdom-এ লেআউট হয় না বলে
//  scrollHeight 2000 ধরে mock করা — scrollTop = scrollHeight অ্যাসাইনমেন্টটা
//  আসল effect-ই করে কি না, সেটাই যাচাই হয়।)
// যাচাই করে:
//   ১) Chat খুললে প্রথমে USER LIST দেখায় (কথোপকথন নয়)
//   ২) তালিকার প্রতি সারিতে সেই কথোপকথনের শেষ মেসেজের প্রিভিউ থাকে;
//      মেসেজ নেই এমন সারিতে "No messages yet"
//   ৩) ব্যবহারকারী খুললে শুধু সেই চ্যাটটাই পূর্ণ পর্দায় দেখায়, আর
//      খোলার সময়ই সবচেয়ে নতুন মেসেজ দেখা যায় (auto-scroll to bottom)
//   ৪) নতুন মেসেজ পাঠালে ভিউ নিচেই থাকে (সবচেয়ে নতুন মেসেজ দেখা যায়)
//   ৫) পুরো ক্রম — list → A খোলা → back → list → B খোলা → back → list —
//      ইন-অ্যাপ "← All chats" তির দিয়ে এবং সিস্টেম ব্যাক দিয়ে, দুটোতেই
//   ৬) তালিকা থেকে দ্বিতীয়বার ব্যাক করলে /chat ছেড়ে আগের পেজে যায়
//   ৭) {with} টার্গেট দিয়ে Chat খুললে সেই কথোপকথন সরাসরি খোলে; সেখান
//      থেকে ব্যাক করলে তালিকা দেখায়, তারপর ব্যাক করলে আগের পেজে যায়
//      (আগের কথোপকথন আর ফিরে আসে না)
//   ৮) সোর্স-স্তরে: openChat হিস্ট্রি এন্ট্রি পুশ করে, backToList
//      navigate(-1) ব্যবহার করে, showList-এর ডিফল্ট তালিকা
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const chatSrc = pagesSrc.slice(pagesSrc.indexOf('export function ChatPage()'))
const chatPage = chatSrc.slice(0, chatSrc.indexOf('// ---------- ডেটিং KYC'))

// ---- jsdom globals (harness বান্ডল import করার আগেই) ----
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
const g = globalThis
g.window = dom.window
g.document = dom.window.document
// NOTE: global navigator is getter-only in Node 24 — bundled code reads
// window.navigator via the jsdom window, so no global override is needed.
g.localStorage = dom.window.localStorage
g.HTMLElement = dom.window.HTMLElement
g.Element = dom.window.Element
g.Node = dom.window.Node
g.Event = dom.window.Event
g.MouseEvent = dom.window.MouseEvent
g.CustomEvent = dom.window.CustomEvent
g.HTMLInputElement = dom.window.HTMLInputElement
g.HTMLDivElement = dom.window.HTMLDivElement
g.HTMLButtonElement = dom.window.HTMLButtonElement
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
if (typeof dom.window.requestAnimationFrame === 'function') g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
g.IS_REACT_ACT_ENVIRONMENT = true
// jsdom-এ লেআউট হয় না (scrollHeight সবসময় 0) — লম্বা চ্যাটের মতো করে
// 2000 ধরে দিই, যাতে scrollTop = scrollHeight অ্যাসাইনমেন্টটা ধরা যায়।
Object.defineProperty(dom.window.HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return 2000 } })

// ---- seed: Rima-র সাথে ৩০ মেসেজের লম্বা চ্যাট; Shakil-এর সাথে কিছু নেই ----
const rimaThread = Array.from({ length: 30 }, (_, i) => ({ from: i % 2 ? 'Rima' : 'You', text: `Rima message ${i + 1}` }))
rimaThread[29] = { from: 'Rima', text: 'LAST RIMA MSG 30' }
dom.window.localStorage.setItem('callguru:chatMsgs', JSON.stringify({ Rima: rimaThread }))

const outDir = mkdtempSync(join(tmpdir(), 'picall-chat-back-stack-test-'))
const outFile = join(outDir, 'harness.mjs')
await build({
  entryPoints: [join(root, 'tests/chat-back-stack.harness.tsx')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: outFile,
  logLevel: 'silent',
  // esbuild leaves import.meta.env undefined outside vite — stub it.
  define: { 'import.meta.env.VITE_API_URL': '""' },
})
const H = await import(outFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('Fresh /chat shows the USER LIST first (not a conversation)', () => {
  const m = H.mountChat(['/feed', '/chat'], 1)
  try {
    assert.ok(H.isListShown(m), `list not shown; text: ${H.text(m).slice(0, 200)}`)
    assert.ok(H.text(m).includes('Rima'), 'Rima row missing from list')
  } finally { H.unmount(m) }
})

check('List rows show a last-message preview; empty rows show "No messages yet"', () => {
  const m = H.mountChat(['/feed', '/chat'], 1)
  try {
    assert.ok(H.text(m).includes('Rima: LAST RIMA MSG 30'), 'Rima row has no last-message preview')
    assert.ok(H.text(m).includes('No messages yet'), 'empty Shakil row shows no "No messages yet" hint')
  } finally { H.unmount(m) }
})

check('Full sequence, in-app back: list → open Rima → back → list → open Shakil → back → list', () => {
  const m = H.mountChat(['/feed', '/chat'], 1)
  try {
    assert.ok(H.isListShown(m), 'step 1: list first')
    H.click(m, 'Rima')
    assert.ok(H.isConversationShown(m, 'Rima'), 'step 2: Rima conversation not shown')
    assert.ok(H.text(m).includes('LAST RIMA MSG 30'), 'latest Rima message not visible')
    H.click(m, '← All chats')
    assert.ok(H.isListShown(m), 'step 3: in-app back did not return to list')
    H.click(m, 'Shakil')
    assert.ok(H.isConversationShown(m, 'Shakil'), 'step 4: Shakil conversation not shown')
    H.click(m, '← All chats')
    assert.ok(H.isListShown(m), 'step 5: in-app back did not return to list')
  } finally { H.unmount(m) }
})

check('Full sequence, SYSTEM back: list → open Rima → back → list → open Shakil → back → list → back → feed', () => {
  const m = H.mountChat(['/feed', '/chat'], 1)
  try {
    assert.ok(H.isListShown(m), 'step 1: list first')
    H.click(m, 'Rima')
    assert.ok(H.isConversationShown(m, 'Rima'), 'step 2: Rima conversation not shown')
    H.systemBack(m)
    assert.ok(H.isListShown(m), 'step 3: system back did not return to list')
    H.click(m, 'Shakil')
    assert.ok(H.isConversationShown(m, 'Shakil'), 'step 4: Shakil conversation not shown')
    H.systemBack(m)
    assert.ok(H.isListShown(m), 'step 5: system back did not return to list')
    H.systemBack(m)
    assert.ok(H.text(m).includes('FEED PAGE'), 'step 6: second system back did not leave /chat for the previous page')
  } finally { H.unmount(m) }
})

check('Auto-scroll: opening a long conversation shows the latest message; sending keeps the view at the bottom', () => {
  const m = H.mountChat(['/feed', '/chat'], 1)
  try {
    H.click(m, 'Rima')
    const el = H.msgListEl(m)
    assert.ok(el, 'message list element not found')
    assert.equal(el.scrollTop, 2000, `on open, scrollTop=${el.scrollTop}, expected scrollHeight 2000`)
    H.sendMessage(m, 'hello rima new')
    assert.ok(H.text(m).includes('hello rima new'), 'sent message not shown')
    assert.equal(H.msgListEl(m).scrollTop, 2000, `after send, scrollTop=${H.msgListEl(m).scrollTop}, expected 2000`)
  } finally { H.unmount(m) }
})

check('{with} target still opens that conversation directly; back → list → back → previous page', () => {
  const m = H.mountChat(['/friends', { pathname: '/chat', state: { with: 'Shakil' } }], 1)
  try {
    assert.ok(H.isConversationShown(m, 'Shakil'), 'target entry did not open Shakil directly')
    assert.ok(!H.isListShown(m), 'target entry wrongly showed the list')
    H.click(m, '← All chats')
    assert.ok(H.isListShown(m), 'in-app back from direct entry did not show the list')
    H.systemBack(m)
    assert.ok(H.text(m).includes('FRIENDS PAGE'), 'system back from list did not leave /chat for Friends')
    assert.ok(!H.text(m).includes('← All chats'), 'old conversation resurfaced after back')
  } finally { H.unmount(m) }
})

check('Source: openChat pushes a history entry; back arrow shares the stack via navigate(-1)', () => {
  assert.ok(chatPage.includes("navigate('/chat', { state: { with: name }"), 'openChat does not push a /chat history entry')
  assert.ok(chatPage.includes('function backToList()'), 'backToList missing')
  assert.ok(chatPage.includes('navigate(-1)'), 'back arrow does not use history back')
  assert.ok(chatPage.includes('onClick={backToList}'), '"← All chats" does not call backToList')
})

check('Source: showList defaults to the list (except a {with} target); auto-scroll + preview wired', () => {
  assert.ok(!chatPage.includes('const [showList, setShowList] = useState(false)'), 'showList still defaults to false (conversation first)')
  assert.ok(chatPage.includes('return !(st?.with ?? withParam)'), 'list-first default not derived from location.state / ?with=')
  assert.ok(chatPage.includes('msgListRef'), 'message list ref missing')
  assert.ok(chatPage.includes('el.scrollTop = el.scrollHeight'), 'auto-scroll assignment missing')
  assert.ok(chatPage.includes('ref={msgListRef}'), 'message list div has no ref')
  assert.ok(chatPage.includes("`${last.from}: ${last.text}`"), 'list rows render no last-message preview')
  assert.ok(chatPage.includes('No messages yet'), 'empty list rows show no hint')
})

console.log(`\n${passed}/8 passed`)
