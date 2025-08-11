module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Indentation: 2 spaces (tabs converted to spaces)
    'indent': ['error', 2],

    // Chrome Extension specific globals
    'no-undef': 'error',

    // Allow console.log for debugging in development
    'no-console': 'warn',

    // Semicolon preferences
    'semi': ['error', 'always'],

    // Quote preferences
    'quotes': ['error', 'single'],

    // Trailing comma
    'comma-dangle': ['error', 'never'],

    // Space before function parentheses
    'space-before-function-paren': ['error', 'never'],

    // Maximum line length
    'max-len': ['warn', {
      code: 120,
      ignoreComments: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true
    }]
  },
  globals: {
    // Chrome Extension APIs
    chrome: 'readonly'
  }
};
