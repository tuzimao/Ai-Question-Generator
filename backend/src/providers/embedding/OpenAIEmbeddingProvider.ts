// src/providers/embedding/OpenAIEmbeddingProvider.ts

import { IEmbeddingProvider } from './EmbeddingProvider';
import { BatchEmbeddingInput, BatchEmbeddingOutput, EmbeddingConfig } from '@/types/embedding';
import { AIService } from '@/services/AIService';
import { delay } from '@/utils/typescript-helpers';

/**
 * OpenAI Embedding提供者
 */
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  public readonly name = 'OpenAI';
  public readonly dimension: number;
  
  private config!: EmbeddingConfig;
  private aiService: AIService;
  private requestInterval: number = 200; // 默认200ms间隔
  private lastRequestTime: number = 0;

  constructor(dimension: number = 1536) {
    this.dimension = dimension;
    this.aiService = new AIService();
  }

  /**
   * 初始化
   */
  public async initialize(config: EmbeddingConfig): Promise<void> {
    this.config = config;
    this.requestInterval = config.requestInterval || 200;
    
    // 验证API密钥
    const isValid = await this.aiService.validateApiKey();
    if (!isValid) {
      throw new Error('OpenAI API密钥无效');
    }
    
    console.log(`✅ OpenAI Embedding Provider初始化成功 (模型: ${config.model})`);
  }

  /**
   * 生成单个向量
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    await this.enforceRateLimit();
    
    const response = await this.aiService.createEmbedding({
      text,
      model: this.config.model
    });
    
    return response.vector;
  }

  /**
   * 批量生成向量
   */
  public async generateBatchEmbeddings(
    inputs: BatchEmbeddingInput[]
  ): Promise<BatchEmbeddingOutput[]> {
    const results: BatchEmbeddingOutput[] = [];
    
    // OpenAI建议的批次大小
    const batchSize = Math.min(this.config.batchSize, 100);
    
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      
      console.log(`🔄 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(inputs.length / batchSize)}`);
      
      await this.enforceRateLimit();
      
      try {
        const texts = batch.map(input => input.text);
        const embeddings = await this.aiService.createBatchEmbeddings(
          texts,
          this.config.model
        );
        
        for (let j = 0; j < batch.length; j++) {
          const input = batch[j];
          const embedding = embeddings[j];
          
          if (input && embedding) {
            results.push({
              id: input.id,
              vector: embedding.vector,
              metadata: input.metadata
            });
          }
        }
      } catch (error) {
        console.error(`批次处理失败:`, error);
        
        // 如果是速率限制错误，增加延迟
        if (this.isRateLimitError(error)) {
          await delay(5000); // 等待5秒
          i -= batchSize; // 重试这个批次
          continue;
        }
        
        throw error;
      }
    }
    
    return results;
  }

  /**
   * 估算成本
   */
  public estimateCost(tokenCount: number): number {
    // text-embedding-3-small: $0.00002 per 1K tokens
    const pricePerKToken = 0.00002;
    return (tokenCount / 1000) * pricePerKToken;
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<boolean> {
    return await this.aiService.healthCheck();
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.aiService.cleanup();
  }

  /**
   * 强制速率限制
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestInterval) {
      await delay(this.requestInterval - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * 检查是否是速率限制错误
   */
  private isRateLimitError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('rate limit') || 
           message.includes('too many requests') ||
           error?.status === 429;
  }
}