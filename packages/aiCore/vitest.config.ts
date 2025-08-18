import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./setupVitest.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{test,spec}.{ts,tsx}']
  },
  resolve: {
    alias: {
      '@': './src'
    }
  },
  esbuild: {
    target: 'node18'
  }
})
