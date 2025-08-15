// src/providers/embedding/EmbeddingProvider.ts - Embedding提供者接口

import { BatchEmbeddingInput, BatchEmbeddingOutput, EmbeddingConfig } from '@/types/embedding';

/**
 * Embedding提供者接口
 */
export interface IEmbeddingProvider {
  /**
   * 提供者名称
   */
  readonly name: string;

  /**
   * 向量维度
   */
  readonly dimension: number;

  /**
   * 初始化提供者
   */
  initialize(config: EmbeddingConfig): Promise<void>;

  /**
   * 生成单个文本的向量
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * 批量生成向量
   */
  generateBatchEmbeddings(inputs: BatchEmbeddingInput[]): Promise<BatchEmbeddingOutput[]>;

  /**
   * 估算成本
   */
  estimateCost(tokenCount: number): number;

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;

  /**
   * 清理资源
   */
  cleanup(): void;
}