import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages from one build: the kiosk at / and the admin panel at /admin/. web/public/ holds the
// installable app's files, copied unhashed so their URLs never change (doc 03).
// In dev the API runs separately (`npm run dev:server`, port 8092) and is proxied.
const backend = 'http://127.0.0.1:8092';

export default defineConfig({
  root: 'web',
  base: '/',
  publicDir: 'public',
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': backend, '/media': backend, '/healthz': backend },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: {
        kiosk: resolve(import.meta.dirname, 'web/index.html'),
        admin: resolve(import.meta.dirname, 'web/admin/index.html'),
      },
    },
  },
});
