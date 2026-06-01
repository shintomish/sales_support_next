import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest 設定 (docs/730 #5)
 *
 * 目的:
 *   handleSelect の async race guard (currentSelectedIdRef) の silent regression を
 *   pin する。ref-based guard を将来うっかり削除した場合、誤発火 (古いレスポンスが
 *   新しい選択を上書き) が再発する可能性があるため CI で検出する。
 *
 * 実行: npm run test
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: false,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
});
