module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    node: true
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
    indent: ['error', 2],

    // Chrome Extension specific globals
    'no-undef': 'error',

    // Allow console.log for debugging in development
    'no-console': 'warn',

    // Semicolon preferences
    semi: ['error', 'always'],

    // Quote preferences
    quotes: ['error', 'single'],

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
    }],

    // Class and interface naming conventions
    camelcase: ['error', {
      properties: 'never',
      ignoreDestructuring: false,
      ignoreImports: false,
      ignoreGlobals: false,
      allow: ['^I[A-Z]'] // Allow interface names starting with I
    }],

    // Enforce consistent import order
    'import/order': ['warn', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true
      }
    }],

    // Prefer const for variables that are never reassigned
    'prefer-const': 'error',

    // Disallow unused variables
    'no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],

    // Require JSDoc comments for classes and methods
    'valid-jsdoc': 'off', // Turn off for now as it's causing many issues

    // Relax some formatting rules
    'padded-blocks': 'off',
    'quote-props': 'off',
    'multiline-ternary': 'off',
    'object-shorthand': 'warn',
    'no-dupe-class-members': 'error',
    'no-new': 'warn'
  },
  globals: {
    // Chrome Extension APIs
    chrome: 'readonly'
  },
  overrides: [
    {
      files: ['src/core/interfaces/*.js'],
      rules: {
        // Allow unused parameters in interface definitions
        'no-unused-vars': 'off',
        // Interfaces may have methods that throw errors
        'no-unused-expressions': 'off'
      }
    },
    {
      files: ['src/platforms/*/tests/*.js', 'tests/**/*.js'],
      env: {
        jest: true,
        mocha: true
      },
      rules: {
        // Allow console.log in tests
        'no-console': 'off'
      }
    },
    {
      files: ['scripts/*.js'],
      env: {
        node: true
      },
      rules: {
        // Allow console.log in build scripts
        'no-console': 'off'
      }
    }
  ]
};
