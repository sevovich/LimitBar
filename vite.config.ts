import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  root: path.resolve('src/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve('dist/renderer'),
    emptyOutDir: true,
  },
  test: {
    root: path.resolve('.'),
    environment: 'jsdom',
    setupFiles: [path.resolve('tests/setup.ts')],
  },
})
