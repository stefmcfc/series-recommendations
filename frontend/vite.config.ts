import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Bound to the IPv4 loopback explicitly, not the default 'localhost' --
    // some VPN clients disable/reroute IPv6 while connected, which makes the
    // default IPv6-only ([::1]) bind unreachable from the browser even though
    // the dev server is running. See RUNBOOK.md's Troubleshooting section.
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
