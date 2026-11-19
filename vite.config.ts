import { defineConfig } from 'vite';

export default defineConfig({
  base: '/MCFTICKETS/',
  server: { port: 4173 },
  build: {
    rollupOptions: {
      input: 'app.html',
    },
  },
});
