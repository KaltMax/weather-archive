import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    css: true,
    globals: true,
    setupFiles: ['./__test__/setupTests.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
    },
  },
})
