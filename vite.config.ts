import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dns from 'node:dns'

dns.setDefaultResultOrder('ipv4first')

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        host: '127.0.0.1',
        port: 5173,
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**']
        }
    },
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-router-dom',
            'firebase/app',
            'firebase/firestore',
            '@google/generative-ai',
            'lucide-react',
            'date-fns',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
        ]
    }
})
