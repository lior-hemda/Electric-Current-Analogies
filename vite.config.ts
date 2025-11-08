// --- Polyfill ל-WebCrypto בזמן build ב-Node (פותר getRandomValues) ---
import { webcrypto } from 'node:crypto';
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}
// ---------------------------------------------------------------------

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// חשוב ל-GitHub Pages: assets ייטענו מתוך /<repo>/
// החלף אם שם הריפו שונה
const BASE = '/Electric-Current-Analogies/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    base: BASE,
    server: { port: 3000, host: '0.0.0.0' },
    plugins: [react()],

    // ⚠️ מומלץ להסיר כדי לא לחשוף מפתחות בצד-לקוח
    // אם זו רק סימולציה — מחק את define לגמרי.
    // אם בכל זאת אתה שומר, דע שהערכים יהיו גלויים בקוד המהודר.
    // define: {
    //   'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    //   'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    // },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
