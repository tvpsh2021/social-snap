module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'Social Snap Test Report',
      outputPath: 'test-report.html',
      includeFailureMsg: true,
      includeConsoleLog: false,
    }],
  ],
};
