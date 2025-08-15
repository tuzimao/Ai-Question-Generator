// src/types/embedding.ts - Embedding相关类型定义

/**
 * Embedding提供者类型
 */
export enum EmbeddingProviderType {
  OPENAI = 'openai',
  LOCAL = 'local',
  HUGGINGFACE = 'huggingface'
}

/**
 * 向量存储类型
 */
export enum VectorStoreType {
  MEMORY = 'memory',
  QDRANT = 'qdrant',
  PINECONE = 'pinecone'
}

/**
 * Embedding配置
 */
export interface EmbeddingConfig {
  provider: EmbeddingProviderType;
  model: string;
  dimension: number;
  batchSize: number;
  maxConcurrent: number;
  retryOnFailure: boolean;
  costLimit?: number;
  requestInterval?: number;
}

/**
 * Embedding请求
 */
export interface EmbeddingRequest {
  docId: string;
  userId: string;
  config: EmbeddingConfig;
  vectorStore: VectorStoreType;
  onProgress?: (progress: EmbeddingProgress) => Promise<void>;
}

/**
 * Embedding进度
 */
export interface EmbeddingProgress {
  current: number;
  total: number;
  message: string;
  details?: {
    processedChunks: number;
    totalChunks: number;
    failedChunks: number;
    tokensProcessed: number;
    estimatedCost?: number;
  };
}

/**
 * Embedding结果
 */
export interface EmbeddingResult {
  docId: string;
  chunksProcessed: number;
  chunksFailed: number;
  totalTokens: number;
  totalCost?: number;
  provider: string;
  model: string;
  duration: number;
  vectorStoreType: string;
}

/**
 * 批量Embedding输入
 */
export interface BatchEmbeddingInput {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

/**
 * 批量Embedding输出
 */
export interface BatchEmbeddingOutput {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
}

/**
 * 向量搜索查询
 */
export interface VectorSearchQuery {
  vector: number[];
  topK: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * 向量点
 */
export interface VectorPoint {
  id: string;
  vector: number[];
  payload: {
    doc_id: string;
    chunk_id: string;
    user_id: string;
    content: string;
    chunk_index: number;
    section_id?: string;
    page_numbers?: number[];
    token_count: number;
    created_at: string;
    metadata?: Record<string, any>;
  };
}