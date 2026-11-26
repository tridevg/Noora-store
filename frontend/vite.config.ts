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
  build: {
    rollupOptions: {
      treeshake: {
        // The shared barrel re-exports Zod schemas whose modules only define constants.
        // Marking them side-effect free lets the storefront's eager path (cart math, WhatsApp
        // links) stop pulling Zod (about 25 KB gzip) into the initial bundle. Admin and
        // checkout chunks still import the schemas they use.
        moduleSideEffects: (id) => !id.includes('/shared/src/schemas/'),
      },
    },
  },
});
