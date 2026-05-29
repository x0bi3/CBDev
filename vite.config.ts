import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import viteCompression from 'vite-plugin-compression';

const buildStamp = String(Date.now());

export default defineConfig({
  plugins: [
    react(),
    viteCompression({ algorithm: 'gzip' }),
    viteCompression({ algorithm: 'brotliCompress' }),
    {
      name: 'admin-asset-cache-bust',
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          if (!ctx.path.includes('admin')) return html;
          return html.replace(/((?:src|href)="(\/assets\/[^"?]+))(")/g, `$1?v=${buildStamp}$3`);
        },
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin/index.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('framer-motion')) return 'framer-motion';
          if (id.includes('node_modules/react')) return 'react-vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3020',
        changeOrigin: true,
      },
    },
  },
});
