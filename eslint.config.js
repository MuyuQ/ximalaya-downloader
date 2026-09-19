/**
 * ESLint 9 平面配置
 * @type {import('eslint').Linter.Config[]}
 */
import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'downloads/**', '.venv/**']
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js 全局
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        TextDecoder: 'readonly'
      }
    },
    rules: {
      // 代码风格
      'indent': ['error', 2],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],

      // 最佳实践
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'arrow-spacing': 'error',

      // 注释
      'spaced-comment': ['error', 'always'],

      // 格式细节
      'comma-dangle': ['error', 'never'],
      'eol-last': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never']
    }
  },
  {
    files: ['src/utils/stringUtils.js'],
    rules: {
      'no-control-regex': 'off'
    }
  }
];
