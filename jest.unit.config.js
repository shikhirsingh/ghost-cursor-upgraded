module.exports = {
  verbose: true,
  testEnvironment: 'node',
  testMatch: ['**/src/__test__/**/*.spec.ts'],
  modulePathIgnorePatterns: [
    './lib',
    './src/test.ts'
  ],
  reporters: [
    'default',
    'github-actions'
  ],
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest'
  }
}
