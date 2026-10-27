import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// The API runs separately in development (artifacts/api-server, port 8080);
// /api is proxied so the app talks to it same-origin, as in production.
const apiTarget = process.env.API_PROXY ?? 'http://localhost:8080';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT ?? 5174),
    strictPort: true,
    host: '0.0.0.0',
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  preview: { port: Number(process.env.PORT ?? 5174), host: '0.0.0.0' },
});
