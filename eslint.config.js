import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier'
import vitest from '@vitest/eslint-plugin'

export default [
  // Global ignores
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      'public/',
      'scripts/',
      'devnotes/',
      'src/kaitai/ksy/presets/generated_formats.js'
    ]
  },

  // Base JS recommended rules
  js.configs.recommended,

  // Vue 3 recommended rules
  ...pluginVue.configs['flat/recommended'],

  // Source files
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off'
    }
  },

  // Web Workers
  {
    files: ['src/workers/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.worker
      }
    }
  },

  // Test files
  {
    files: ['src/**/*.test.js'],
    plugins: {
      vitest
    },
    rules: {
      ...vitest.configs.recommended.rules
    }
  },

  // Config files (Node.js)
  {
    files: ['*.config.js', 'vite.config.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },

  // Prettier must be last — disables formatting rules
  eslintConfigPrettier
]
