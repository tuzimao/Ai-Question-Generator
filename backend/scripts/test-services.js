// scripts/test-services.js
// 服务连接测试脚本

const { QdrantClient } = require('@qdrant/js-client-rest');
const OpenAI = require('openai');

async function testQdrant() {
  console.log('\n🔍 测试 Qdrant 连接...');
  
  try {
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });
    
    const collections = await client.getCollections();
    console.log('✅ Qdrant 连接成功');
    console.log('📊 现有集合:', collections.collections.length);
    console.log('📋 集合列表:', collections.collections.map(c => c.name));
    return true;
  } catch (error) {
    console.log('❌ Qdrant 连接失败:', error.message);
    console.log('💡 请确保 Qdrant 容器正在运行: docker-compose up qdrant');
    return false;
  }
}

async function testOpenAI() {
  console.log('\n🤖 测试 OpenAI 连接...');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY 环境变量未设置');
    return false;
  }
  
  try {
    const openai = new OpenAI({ apiKey });
    const models = await openai.models.list();
    console.log('✅ OpenAI API 连接成功');
    console.log('📝 可用模型数量:', models.data.length);
    
    // 测试嵌入功能
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Hello world'
    });
    console.log('🎯 嵌入测试成功，向量维度:', embedding.data[0].embedding.length);
    return true;
  } catch (error) {
    console.log('❌ OpenAI API 连接失败:', error.message);
    console.log('💡 请检查 OPENAI_API_KEY 是否正确');
    return false;
  }
}

async function testDocker() {
  console.log('\n🐳 检查 Docker 容器状态...');
  
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);
  
  try {
    const { stdout } = await execAsync('docker ps --format "table {{.Names}}\\t{{.Status}}" | grep ai-generator');
    console.log('📦 运行中的容器:');
    console.log(stdout);
  } catch (error) {
    console.log('❌ 无法获取容器状态:', error.message);
    console.log('💡 请确保 Docker 正在运行并启动容器: docker-compose up -d');
  }
}

async function main() {
  console.log('🔧 AI 题目生成器服务连接测试');
  console.log('='.repeat(50));
  
  // 加载环境变量
  require('dotenv').config();
  
  console.log('\n📋 环境变量检查:');
  console.log('  QDRANT_URL:', process.env.QDRANT_URL || 'http://localhost:6333');
  console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '已设置' : '未设置');
  console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
  
  await testDocker();
  const qdrantOk = await testQdrant();
  const openaiOk = await testOpenAI();
  
  console.log('\n📊 测试结果汇总:');
  console.log('  Qdrant:', qdrantOk ? '✅ 正常' : '❌ 异常');
  console.log('  OpenAI:', openaiOk ? '✅ 正常' : '❌ 异常');
  
  if (qdrantOk && openaiOk) {
    console.log('\n🎉 所有服务连接正常！可以启动应用程序。');
  } else {
    console.log('\n⚠️ 部分服务连接异常，请按照上述提示修复。');
  }
}

main().catch(console.error);