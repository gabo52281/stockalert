/* global process */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = `http://localhost:${process.env.PORT || 4000}`;

const proxy = {
  '/api': { target: apiTarget, changeOrigin: true },
  '/health': { target: apiTarget, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy,
  },
  preview: {
    port: 5173,
    host: true,
    proxy,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
