import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Capacitor loads index.html from file://, so bundled asset paths must be relative.
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5174
  },
  build: {
    chunkSizeWarningLimit: 700
  }
});
