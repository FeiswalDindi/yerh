import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const laravelBuild = mode === 'laravel';
  const { LARAVEL_DEV_URL = 'http://localhost:8000' } = loadEnv(mode, process.cwd(), 'LARAVEL_');

  return {
    plugins: [react()],
    base: laravelBuild ? '/ui/' : '/',
    server: { proxy: { '/api': LARAVEL_DEV_URL } },
    build: {
      sourcemap: true,
      ...(laravelBuild && {
        outDir: fileURLToPath(new URL('../backend/public/ui', import.meta.url)),
        emptyOutDir: true,
      }),
    },
  };
});
