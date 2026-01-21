import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Single bundle for easy embedding
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
