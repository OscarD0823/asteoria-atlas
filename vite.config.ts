import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'./',define:{'import.meta.env.VITE_ARCHITECTURE_STANDALONE':JSON.stringify('1')},build:{outDir:'dist-arquitectura',chunkSizeWarningLimit:1800}});
