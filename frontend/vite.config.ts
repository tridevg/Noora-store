import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The browser only talks to 127.0.0.1:5173. Vite forwards API and image
// traffic to wrangler dev (see .claude/architecture.md section 2).
const API_TARGET = 'http://127.0.0.1:8787';
const proxy = {
  '/api': { target: API_TARGET, changeOrigin: false },
  '/images': { target: API_TARGET, changeOrigin: false },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy,
  },
});
