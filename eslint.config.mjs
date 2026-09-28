import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/** ESLint (flat config): regras do Next.js (core web vitals) + TypeScript. */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Convenção: parâmetros/variáveis iniciados por "_" são propositalmente ignorados (ex.: `_prev` nas Server Actions).
    rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }] },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'drizzle/**', 'data/**', 'backups/**', 'coverage/**', 'next-env.d.ts'],
  },
];

export default config;
