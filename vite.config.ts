import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Optional: proxy WebSocket for development
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      }
    }
  }
});