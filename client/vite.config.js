import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the Vite dev server proxies /api to Express so the
// browser only ever talks to a single origin (simpler, secure cookies).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
});
