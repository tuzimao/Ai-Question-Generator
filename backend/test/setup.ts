// backend/test/setup.ts
import dotenv from 'dotenv';
import path from 'path';
import { jest, beforeAll, afterAll, afterEach} from '@jest/globals';
import { TestDatabase } from '../test/utils/database'; // Adjust the path if needed

// 加载测试环境变量
dotenv.config({ path: path.join(__dirname, '/.env.test') });

// 设置测试超时
jest.setTimeout(30000);

// 全局测试前置和后置钩子
beforeAll(async () => {
  await TestDatabase.ensureDatabaseExists();
  await TestDatabase.initialize();
  await TestDatabase.runMigrations();
  await TestDatabase.cleanAllTables(); // ← 新增
});

afterEach(async () => {
  if (process.env.KEEP_TEST_DB === 'true') {
    console.log('🛑 KEEP_TEST_DB=true，跳过清表');
    return;
  }
  await TestDatabase.cleanAllTables();
});

afterAll(async () => {
  await TestDatabase.close(); // 统一在最后关闭
});