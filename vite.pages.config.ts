import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/quiz-studio';
const base = `${basePath.replace(/\/$/, '')}/`;

export default defineConfig({
  base,
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  build: {
    outDir: 'out',
    emptyOutDir: true,
  },
});
