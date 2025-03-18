import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path';
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react({
      'jsxRuntime': 'classic'
    }),
    dts({
      include: ['src/**/*'],
    })
  ],
  resolve: {
    alias: {
      "@invana/canvas-reactflow": path.resolve(__dirname, "src"),
      "@invana/ui": path.resolve(__dirname, "../ui/src"),
      "@invana/data-store": path.resolve(__dirname, '../../packages/data-store'),

    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src', 'index.ts'),
      name: "CanvasFlow",
      formats: ['es', 'umd'],
      fileName: (ext) => `index.${ext}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
        exports: 'named'
      }
    },
    target: 'esnext',
    sourcemap: true,
    cssCodeSplit: false,
    cssMinify: true
  }
})
