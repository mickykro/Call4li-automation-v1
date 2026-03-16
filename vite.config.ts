import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    // Increase the timeout for dependency optimization
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: false, // Set to true if you're on a VM or Docker, but false is faster for local macOS
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    proxy: {
      // Forward API requests to a local backend/dev server (e.g., vercel dev on 3000)
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    // Force pre-bundling of major dependencies to speed up initial load
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'lucide-react',
      'recharts',
      'zod',
      'clsx',
      'tailwind-merge',
      'class-variance-authority'
    ],
    // Speed up optimization by excluding problematic or very large libs if necessary
    exclude: ['firebase-admin'], // Admin SDK shouldn't be in the client bundle
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          ui: ['lucide-react', 'recharts'],
        },
      },
    },
  },
});
