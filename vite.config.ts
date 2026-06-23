import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020'
  },
  plugins: [
    react(),
    {
      name: 'strip-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/\scrossorigin(="[^"]*")?/g, '')
      }
    }
  ],
  server: {
    port: 5173
  }
})
