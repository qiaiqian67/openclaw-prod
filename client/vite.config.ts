import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

let majorVersion = '0.1.0'
try {
  majorVersion = fs.readFileSync(path.resolve(__dirname, './VERSION'), 'utf-8').trim()
} catch {
  try {
    majorVersion = fs.readFileSync(path.resolve(__dirname, '../VERSION'), 'utf-8').trim()
  } catch {}
}

const now = new Date()
const buildTimestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
const version = `${majorVersion}+${buildTimestamp}`

export default defineConfig({
  plugins: [react()],
  root: 'web',
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'web/src'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'web/index.html'),
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-icons': ['@tabler/icons-react'],
        },
      },
    },
  },
})