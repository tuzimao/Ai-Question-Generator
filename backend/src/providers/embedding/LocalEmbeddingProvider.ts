// src/providers/embedding/LocalEmbeddingProvider.ts

import { IEmbeddingProvider } from './EmbeddingProvider';
import { BatchEmbeddingInput, BatchEmbeddingOutput, EmbeddingConfig } from '@/types/embedding';
import crypto from 'crypto';

/**
 * 本地Mock Embedding提供者（用于测试）
 */
export class LocalEmbeddingProvider implements IEmbeddingProvider {
  public readonly name = 'Local';
  public readonly dimension: number;
  
  private config!: EmbeddingConfig;
  
  constructor(dimension: number = 384) {
    this.dimension = dimension;
  }

  /**
   * 初始化
   */
  public async initialize(config: EmbeddingConfig): Promise<void> {
    this.config = config;
    console.log(`✅ Local Embedding Provider初始化成功 (维度: ${this.dimension})`);
  }

  /**
   * 生成单个向量（模拟）
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // 基于文本生成确定性的向量
    return this.generateMockVector(text);
  }

  /**
   * 批量生成向量（模拟）
   */
  public async generateBatchEmbeddings(
    inputs: BatchEmbeddingInput[]
  ): Promise<BatchEmbeddingOutput[]> {
    const results: BatchEmbeddingOutput[] = [];
    
    for (const input of inputs) {
      // 模拟处理延迟
      await new Promise(resolve => setTimeout(resolve, 5));
      
      results.push({
        id: input.id,
        vector: this.generateMockVector(input.text),
        metadata: input.metadata
      });
    }
    
    return results;
  }

  /**
   * 估算成本（免费）
   */
  public estimateCost(_tokenCount: number): number {
    return 0;
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<boolean> {
    return true;
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    // 无需清理
  }

  /**
   * 生成模拟向量
   */
  private generateMockVector(text: string): number[] {
    // 使用文本的哈希来生成确定性的向量
    const hash = crypto.createHash('sha256').update(text).digest();
    const vector: number[] = [];
    
    for (let i = 0; i < this.dimension; i++) {
      // 从哈希中获取字节，循环使用
      const byte = hash[i % hash.length] ?? 0;
      // 转换为 -1 到 1 之间的浮点数
      vector.push((byte / 127.5) - 1);
    }
    
    // 归一化向量
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
  }
}