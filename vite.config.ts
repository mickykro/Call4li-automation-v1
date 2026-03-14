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
        host: true, // Listen on all local IPs
        port: 5173,
        hmr: {
            host: '127.0.0.1', // Explicitly tell the client to connect via 127.0.0.1
            protocol: 'ws'
        },
        watch: {
            ignored: ['**/node_modules/**', '**/.git/**']
        }
    }
})
