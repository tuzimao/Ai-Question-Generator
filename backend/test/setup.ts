// backend/test/setup.ts
import dotenv from 'dotenv';
import path from 'path';
import { jest, beforeAll, afterAll} from '@jest/globals';


// 加载测试环境变量
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// 设置测试超时
jest.setTimeout(30000);

// 全局测试前置和后置钩子
beforeAll(async () => {
  console.log('🧪 测试环境初始化...');
});

afterAll(async () => {
  console.log('🧪 测试环境清理...');
});