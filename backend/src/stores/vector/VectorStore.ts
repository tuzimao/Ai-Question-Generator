// src/stores/vector/VectorStore.ts - 向量存储接口

import { VectorPoint, VectorSearchQuery, VectorSearchResult } from '@/types/embedding';

/**
 * 向量存储接口
 */
export interface IVectorStore {
  /**
   * 存储名称
   */
  readonly name: string;

  /**
   * 初始化存储
   */
  initialize(collectionName: string, dimension: number): Promise<void>;

  /**
   * 插入向量点
   */
  upsert(points: VectorPoint[]): Promise<void>;

  /**
   * 搜索相似向量
   */
  search(query: VectorSearchQuery): Promise<VectorSearchResult[]>;

  /**
   * 根据ID获取向量点
   */
  getByIds(ids: string[]): Promise<VectorPoint[]>;

  /**
   * 根据过滤条件删除向量
   */
  deleteByFilter(filter: Record<string, any>): Promise<number>;

  /**
   * 获取集合统计信息
   */
  getStats(): Promise<{
    totalPoints: number;
    indexedPoints: number;
  }>;

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;

  /**
   * 清理资源
   */
  cleanup(): void;
}