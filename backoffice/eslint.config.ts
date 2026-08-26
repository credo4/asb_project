import { globalIgnores } from 'eslint/config';
import pluginVue from 'eslint-plugin-vue';
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    // Types générés (voir npm run types:generate) : ne pas les faire
    // vérifier stylistiquement, ce n'est pas du code écrit à la main.
    files: ['src/types/api.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  skipFormatting,
);
