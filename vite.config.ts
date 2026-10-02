import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No secrets are injected into the client bundle. The only VITE_* values the
// browser sees are the public Convex URL and Clerk publishable key.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
