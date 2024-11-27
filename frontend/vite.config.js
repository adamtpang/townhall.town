import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['axios', 'firebase/app', 'firebase/auth']
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});