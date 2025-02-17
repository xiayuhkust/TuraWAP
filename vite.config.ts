import { defineConfig } from 'vite'
import type { UserConfig, ServerOptions } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const serverConfig: ServerOptions = {
  https: undefined,
  host: 'localhost',
  port: 5173,
  cors: true,
  proxy: {
    '/rpc': {
      target: process.env.VITE_RPC_URL || '/rpc',
      changeOrigin: true,
      secure: true,
      ws: false,
      rewrite: (path) => path.replace(/^\/rpc/, ''),
      configure: (proxy, _options) => {
        proxy.on('proxyReq', (proxyReq, _req, _res, _options) => {
          proxyReq.setHeader('Content-Type', 'application/json');
        });
      }
    }
  }
};

const config: UserConfig = {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: serverConfig,
  envPrefix: 'VITE_',
  css: {
    postcss: './postcss.config.js'
  },
  build: {
    target: 'esnext'
  }
};

export default defineConfig(config);
