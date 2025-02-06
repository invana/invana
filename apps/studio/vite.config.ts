import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import * as path from 'path';
import dts from "vite-plugin-dts";


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/**/*'],
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, './src'),
      "@invana/ui": path.resolve(__dirname, '../../packages/ui/src'),
      "@invana/canvas-flow": path.resolve(__dirname, '../../packages/canvas-flow/src'),
      "@invana/canvas-graph": path.resolve(__dirname, '../../packages/canvas-graph/src'),
      "@invana/data-store": path.resolve(__dirname, '../../packages/data-store'),

      // "@/lib": path.resolve(__dirname, '../../packages/ui/src/lib')
    },
  }
})
