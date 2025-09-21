module.exports = {
  verbose: true,
  testEnvironment: 'node',
  testMatch: ['**/src/__test__/**/*.spec.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/src/__test__/spoof.spec.ts'
  ],
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
