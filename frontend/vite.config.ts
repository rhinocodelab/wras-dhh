import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Proxy API requests to the backend server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      // Proxy translation API requests
      '/translation-api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/translation-api/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add CORS headers for preflight requests
            if (req.method === 'OPTIONS') {
              res.writeHead(200, {
                'Access-Control-Allow-Origin': 'http://192.168.1.92:5173',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With, Access-Control-Request-Method, Access-Control-Request-Headers',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '3600',
              });
              res.end();
            }
          });
        },
      },
    },
  },
  preview: {
    port: 3000,
    host: true,
  },
});
