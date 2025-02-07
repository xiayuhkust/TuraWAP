import { defineConfig } from 'vite'
import type { UserConfig, ServerOptions } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const serverConfig: ServerOptions = {
  https: undefined,
  host: true,
  allowedHosts: ['wallet-session-app-tunnel-musu5lwr.devinapps.com'],
  proxy: {
    '/rpc': {
      target: 'https://rpc-dev.turablockchain.com',
      changeOrigin: true,
      secure: true,
      ws: false,
      rewrite: (path) => path.replace(/^\/rpc/, '')
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
