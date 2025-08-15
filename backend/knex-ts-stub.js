// knex-ts-stub.js
// 这个文件帮助 Knex 在开发环境中运行 TypeScript 迁移文件

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    resolveJsonModule: true,
    moduleResolution: 'node',
    declaration: false,
    removeComments: true,
    strict: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    baseUrl: '.',
    paths: {
      '@/*': ['src/*']
    }
  }
});

// 注册 tsconfig-paths 以支持路径映射
require('tsconfig-paths/register');