import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
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
        manualChunks: {
          'tone-engine': ['./src/audio/ToneEngine.ts'],
          'project-core': ['./src/project/schema.ts', './src/project/storage.ts'],
          'components-main': ['./src/components/MainWorkspace.tsx', './src/components/PianoRoll.tsx'],
          'components-device': ['./src/components/Mixer.tsx', './src/components/DeviceRack.tsx'],
          'vendor': ['react', 'react-dom', 'tone', 'lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1024,
  },
});
