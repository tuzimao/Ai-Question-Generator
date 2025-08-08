const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1" // 让 Jest 识别 @ 为 src
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', {
      diagnostics: false,      // 跳过类型检查
      isolatedModules: true,   // 仅转译，更快
      tsconfig: {
        strict: false,
        skipLibCheck: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
    }],
  },

    collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/types/**/*',
    '!src/**/__tests__/**/*'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  clearMocks: true,
};
