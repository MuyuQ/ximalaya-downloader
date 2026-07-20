module.exports = {
  env: {
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // 代码风格规则
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],

    // 最佳实践
    'no-console': 'off',
    'no-unused-vars': 'warn',

    // ES6规则
    'arrow-spacing': 'error',
    'no-var': 'error',
    'prefer-const': 'error',

    // 注释规则
    'spaced-comment': ['error', 'always'],

    // 其他规则
    'comma-dangle': ['error', 'never'],
    'eol-last': ['error', 'always'],
    'no-trailing-spaces': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never']
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      globals: {
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        fail: 'readonly'
      }
    },
    {
      files: ['utils/stringUtils.js'],
      rules: {
        'no-control-regex': 'off'
      }
    }
  ]
};
