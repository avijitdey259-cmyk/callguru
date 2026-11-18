// CallGuru demo backend (Express). Netlify deploys only the frontend (dist/);
// run this separately for local/full-stack use: `npm run server` (port 4000).
// No secrets here — real Firebase / SMS / TURN credentials go in environment variables.
import express from 'express'

const app = express()
app.use(express.json())
// Minimal CORS for the demo API: the Netlify frontend runs on a different
// origin, so browsers would block cross-origin calls without these headers.
// No credentials, no secrets — the demo API takes no auth.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
const PORT = process.env.PORT || 4000

const experts = [
  { id: 'exp-1', name: 'ডা. রাহাত হোসেন', rate: 15, online: true },
  { id: 'exp-2', name: 'অ্যাডভোকেট নুসরাত জাহান', rate: 25, online: true },
  { id: 'exp-4', name: 'মেহজাবিন চৌধুরী', rate: 10, online: true }
]

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'callguru', version: '6.0.0' }))
app.get('/api/experts', (_req, res) => res.json(experts))
app.post('/api/topup', (req, res) => {
  const { amount, method } = req.body || {}
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })
  res.json({ ok: true, amount, method: method || 'bKash', note: 'Demo: integrate a real payment gateway before production.' })
})
app.post('/api/call/start', (req, res) => {
  const { expertId, balance, freeFirstMinuteUsed } = req.body || {}
  const expert = experts.find(e => e.id === expertId)
  const rate = expert?.rate ?? 10
  const canStart = !freeFirstMinuteUsed || balance >= rate
  res.json({ ok: canStart, rate, freeFirstMinute: !freeFirstMinuteUsed, maxMinutes: freeFirstMinuteUsed ? Math.floor((balance || 0) / rate) : 1 + Math.floor((balance || 0) / rate) })
})

app.listen(PORT, () => console.log(`CallGuru API listening on http://localhost:${PORT}`))
