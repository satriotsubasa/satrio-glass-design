/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The docs app consumes the package through its public name so every docs
// build exercises the same entry points consumers use.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@satrio/glass-design/fonts', replacement: fileURLToPath(new URL('./src/fonts.ts', import.meta.url)) },
      { find: '@satrio/glass-design/testing', replacement: fileURLToPath(new URL('./src/testing/index.ts', import.meta.url)) },
      { find: '@satrio/glass-design/toast', replacement: fileURLToPath(new URL('./src/components/common/toast.ts', import.meta.url)) },
      { find: '@satrio/glass-design/styles', replacement: fileURLToPath(new URL('./src/styles', import.meta.url)) },
      { find: '@satrio/glass-design', replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
