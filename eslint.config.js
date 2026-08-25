// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import nextPlugin from '@next/eslint-plugin-next';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: { '@next/next': nextPlugin },
    rules: { ...nextPlugin.configs.recommended.rules },
  },
  {
    // .claude/skills/** is vendored third-party skill content (installed via
    // the skills.sh CLI, see skills-lock.json) — not project source, so it's
    // excluded the same way node_modules/dist/.next are, rather than
    // reconfigured to satisfy our lint rules.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/*.js',
      'vitest.config.ts',
      '**/next-env.d.ts',
      '.claude/skills/**',
    ],
  }
);
