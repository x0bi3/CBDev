import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const buildStamp = String(Date.now());

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'bust-chunk-imports',
      closeBundle() {
        const assetsDir = path.resolve(__dirname, 'dist/assets');
        try {
          for (const f of readdirSync(assetsDir)) {
            if (!f.endsWith('.js')) continue;
            const p = path.join(assetsDir, f);
            const src = readFileSync(p, 'utf8');
            const out = src
              .replace(/from"\.\/([^"?]+\.js)"/g, `from"./$1?v=${buildStamp}"`)
              .replace(/import"\.\/([^"?]+\.js)"/g, `import"./$1?v=${buildStamp}"`);
            if (out !== src) writeFileSync(p, out);
          }
        } catch { /* ignore */ }
      },
    },
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
          if (id.includes('framer-motion')) return 'framer-motion-v2';
          if (id.includes('node_modules/react')) return 'react-vendor-v2';
          // Keep context + API out of the main entry so lazy app chunks can import
          // them without creating a circular main ↔ chunk dependency.
          if (id.includes('context/DeviceContext') || id.includes('lib/standaloneApi')) {
            return 'shared-core';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js' || hostType === 'css') {
        return `/${filename}?v=${buildStamp}`;
      }
      return `/${filename}`;
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
