module.exports = {
  env: {
    browser: true,
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
    'no-console': 'off', // 允许使用console
    'no-unused-vars': 'warn', // 未使用的变量警告而不是错误
    'no-undef': 'error', // 禁止使用未定义的变量
    
    // ES6规则
    'arrow-spacing': 'error',
    'no-var': 'error', // 禁止使用var，推荐使用let或const
    'prefer-const': 'error', // 优先使用const
    
    // 注释规则
    'spaced-comment': ['error', 'always'],
    
    // 其他规则
    'comma-dangle': ['error', 'never'], // 不允许尾随逗号
    'eol-last': ['error', 'always'], // 文件末尾必须有换行符
    'no-trailing-spaces': 'error', // 禁止行尾空格
    'object-curly-spacing': ['error', 'always'], // 对象字面量中的空格
    'array-bracket-spacing': ['error', 'never'] // 数组括号内不加空格
  }
};