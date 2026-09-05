import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import * as esbuild from 'esbuild';

function buildExtensionScripts(env) {
  return {
    name: 'build-extension-scripts',
    closeBundle() {
      const defines = {
        'import.meta.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL || 'http://localhost:5000'),
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || 'http://localhost:5000/api'),
        'import.meta.env.VITE_DEFAULT_MODEL': JSON.stringify(env.VITE_DEFAULT_MODEL || 'gemini-1.5-flash'),
        'process.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL || 'http://localhost:5000'),
        'process.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || 'http://localhost:5000/api'),
        'process.env.VITE_DEFAULT_MODEL': JSON.stringify(env.VITE_DEFAULT_MODEL || 'gemini-1.5-flash')
      };

      // Build content.js as single standalone IIFE with ZERO imports
      esbuild.buildSync({
        entryPoints: [resolve(__dirname, 'src/content/index.js')],
        bundle: true,
        outfile: resolve(__dirname, 'dist/content.js'),
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        minify: false,
        define: defines
      });

      // Build background.js as single standalone script
      esbuild.buildSync({
        entryPoints: [resolve(__dirname, 'src/background/service-worker.js')],
        bundle: true,
        outfile: resolve(__dirname, 'dist/background.js'),
        format: 'esm',
        platform: 'browser',
        target: 'es2020',
        minify: false,
        define: defines
      });

      console.log('✅ Extension content.js & background.js bundled as standalone scripts');
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), buildExtensionScripts(env)],
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
  };
});
