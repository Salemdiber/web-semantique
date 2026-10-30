import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    server: {
        // Le port 3000 est occupe par un autre conteneur Docker sur cette machine.
        port: 3001,
        strictPort: false,
        host: true,
    },
    preview: {
        port: 3001,
        strictPort: false,
    },
    build: {
        outDir: 'dist',
    },
});
