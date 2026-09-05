import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import * as esbuild from 'esbuild';

function buildExtensionScripts() {
  return {
    name: 'build-extension-scripts',
    closeBundle() {
      // Build content.js as single standalone IIFE with ZERO imports
      esbuild.buildSync({
        entryPoints: [resolve(__dirname, 'src/content/index.js')],
        bundle: true,
        outfile: resolve(__dirname, 'dist/content.js'),
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        minify: false
      });

      // Build background.js as single standalone script
      esbuild.buildSync({
        entryPoints: [resolve(__dirname, 'src/background/service-worker.js')],
        bundle: true,
        outfile: resolve(__dirname, 'dist/background.js'),
        format: 'esm',
        platform: 'browser',
        target: 'es2020',
        minify: false
      });

      console.log('✅ Extension content.js & background.js bundled as standalone scripts');
    }
  };
}

export default defineConfig({
  plugins: [react(), buildExtensionScripts()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html')
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
