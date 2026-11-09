import {defineConfig} from 'vite';
export default defineConfig({base:'/',build:{outDir:'dist-infantry',rollupOptions:{input:{main:'infantry-test.html',trigger:'infantry-trigger.html'}}}});
