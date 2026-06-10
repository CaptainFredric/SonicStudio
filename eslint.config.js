import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Type-aware linting stays off: tsc --noEmit already runs alongside this in the
// lint script, so eslint's job here is the bug classes the compiler cannot see,
// above all the React hooks rules.
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Deliberate dependency omissions exist (documented inline where they
      // do), so surface mismatches without failing the build on them.
      'react-hooks/exhaustive-deps': 'warn',
      // The React Compiler readiness rules describe patterns the compiler
      // cannot optimize, not defects. This codebase predates them and works;
      // keep them visible as warnings so new code trends better, without
      // forcing a rewrite of proven components. rules-of-hooks stays an error.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      // tsc owns unused checks; eslint's version double-reports. Keep the rule
      // for genuinely dead locals but allow the conventional _ prefix.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
