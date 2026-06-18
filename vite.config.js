import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const reactPath = fileURLToPath(new URL('./node_modules/react/index.js', import.meta.url))
const reactJsxRuntimePath = fileURLToPath(new URL('./node_modules/react/jsx-runtime.js', import.meta.url))
const reactJsxDevRuntimePath = fileURLToPath(new URL('./node_modules/react/jsx-dev-runtime.js', import.meta.url))
const reactDomPath = fileURLToPath(new URL('./node_modules/react-dom/index.js', import.meta.url))
const reactDomClientPath = fileURLToPath(new URL('./node_modules/react-dom/client.js', import.meta.url))
const reactDomServerPath = fileURLToPath(new URL('./node_modules/react-dom/server.browser.js', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  resolve: {
    alias: [
      { find: /^react$/, replacement: reactPath },
      { find: /^react\/jsx-runtime$/, replacement: reactJsxRuntimePath },
      { find: /^react\/jsx-dev-runtime$/, replacement: reactJsxDevRuntimePath },
      { find: /^react-dom$/, replacement: reactDomPath },
      { find: /^react-dom\/client$/, replacement: reactDomClientPath },
      { find: /^react-dom\/server$/, replacement: reactDomServerPath },
    ],
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-final-form',
      'easy-email-core',
      'easy-email-editor',
      'easy-email-extensions',
      '@arco-design/web-react',
    ],
    force: true,
  },
})
