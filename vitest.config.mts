import path from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      // `server-only` lança erro fora do ambiente de Server Components; nos testes vira um módulo vazio.
      'server-only': path.resolve(root, 'tests/stubs/empty.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Cada arquivo de teste usa seu próprio banco temporário; evita conflitos de escrita.
    fileParallelism: false,
  },
});
