import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import {
  NaiveUiResolver,
} from 'unplugin-vue-components/resolvers'
import AutoImport from 'unplugin-auto-import/vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/doc-ai/',
  plugins: [
    vue(),
    Components({
      resolvers: [
        NaiveUiResolver(),
      ]
    }),
    AutoImport({
      imports: [
        'vue'
      ]
    }),
  ],
})
