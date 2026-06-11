import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  return {
    // Use relative asset URLs for the default production build so the bundled
    // app can be served from any static root, including VS Code Live Server.
    // GitHub Pages keeps using an explicit subpath via `npm run build:pages`.
    base: command === 'build' ? './' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          // The lazy-loaded surfaces (Launchpad, capture, transcribe,
          // settings, Mixer, Piano Roll) split into their own chunks through
          // dynamic imports; pinning them here would drag them back into the
          // boot path. Only the always-needed groups stay manual.
          manualChunks: {
            'tone-engine': ['./src/audio/ToneEngine.ts'],
            'project-core': ['./src/project/schema.ts', './src/project/storage.ts'],
            'vendor': ['react', 'react-dom', 'tone', 'lucide-react'],
          },
        },
      },
      chunkSizeWarningLimit: 1024,
    },
  };
});
