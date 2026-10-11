import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, forward API and websocket traffic to the Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
});
