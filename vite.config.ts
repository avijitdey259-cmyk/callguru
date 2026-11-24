import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// প্রতি বিল্ডের ভার্সন — বিল্ডের সময়; একই মান version.json-এও যায় আর
// বান্ডলে __APP_VERSION__ হিসেবেও বসে, যাতে চলমান অ্যাপ নিজের ভার্সন
// সার্ভারের version.json-এর সঙ্গে মেলাতে পারে (src/appUpdate.ts)।
const appVersion = new Date().toISOString()

const versionPlugin: Plugin = {
  name: 'picall-version',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: appVersion, builtAt: appVersion }),
    })
  },
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react(), versionPlugin],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  preview: { port: 4173 }
})
