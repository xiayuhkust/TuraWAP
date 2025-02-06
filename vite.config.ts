import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    https: process.env.NODE_ENV === 'production',
    proxy: {
      '/rpc': {
        target: 'https://rpc-dev.turablockchain.com',
        changeOrigin: true,
        secure: true,
        ws: false,
        rewrite: (path) => path.replace(/^\/rpc/, '')
      }
    }
  },
  envPrefix: 'VITE_',
  css: {
    postcss: './postcss.config.js'
  },
  build: {
    target: 'esnext'
  }
});
