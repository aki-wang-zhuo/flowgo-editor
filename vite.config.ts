import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * Vite 配置：开发期将 /api 代理到 flowgo-server。
 * base 为 /editor/ 时，需保证依赖预构建路径可用。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // pinia 3 无 dist/pinia.js，显式指向 mjs，避免预构建 ENOENT
      pinia: fileURLToPath(new URL('./node_modules/pinia/dist/pinia.mjs', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'element-plus',
      'axios',
      '@logicflow/core',
      '@logicflow/extension',
    ],
  },
  base: '/editor/',
})
