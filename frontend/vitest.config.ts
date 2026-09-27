import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.DEV': false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Default 5000ms per-test timeout is too tight for the full suite's
    // real parallel-worker load on this machine -- waitFor/findBy calls in
    // otherwise-passing tests intermittently exceed it under contention,
    // never in isolation. 10s gives real headroom without masking an
    // actual hang.
    testTimeout: 10000,
  },
})
