import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // React 19 compiler rules flag common data-fetch patterns across pages; keep hooks/exhaustive-deps.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      // Context modules legitimately co-export hooks + providers.
      'react-refresh/only-export-components': 'off',
    },
  },
])
