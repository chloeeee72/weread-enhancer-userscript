import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { greasyForkUserscriptPlugin } from './build/greasyfork-plugin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metadata = fs.readFileSync(new URL('./src/metadata.txt', import.meta.url), 'utf8');
const scriptVersion = (metadata.match(/@version\s+([^\s]+)/) || [])[1] || 'dev';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
    cssCodeSplit: false,
    sourcemap: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      formats: ['iife'],
      name: 'WeReadEnhancer',
      fileName: () => `weread.user-${scriptVersion}.js`
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  },
  plugins: [greasyForkUserscriptPlugin()]
});
