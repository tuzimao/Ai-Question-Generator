// src/stores/vector/MemoryVectorStore.ts

import { IVectorStore } from './VectorStore';
import { VectorPoint, VectorSearchQuery, VectorSearchResult } from '@/types/embedding';

/**
 * 内存向量存储（用于测试）
 */
export class MemoryVectorStore implements IVectorStore {
  public readonly name = 'Memory';
  
  private points: Map<string, VectorPoint> = new Map();
  private collectionName!: string;
  private dimension!: number;

  /**
   * 初始化
   */
  public async initialize(collectionName: string, dimension: number): Promise<void> {
    this.collectionName = collectionName;
    this.dimension = dimension;
    this.points.clear();
    
    console.log(`✅ Memory VectorStore初始化成功 (集合: ${collectionName}, 维度: ${dimension})`);
  }

  /**
   * 插入向量点
   */
  public async upsert(points: VectorPoint[]): Promise<void> {
    for (const point of points) {
      this.points.set(point.id, point);
    }
    
    console.log(`💾 插入 ${points.length} 个向量到内存存储`);
  }

  /**
   * 搜索相似向量
   */
  public async search(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];
    
    // 计算与所有向量的相似度
    for (const point of this.points.values()) {
      // 应用过滤器
      if (query.filter && !this.matchFilter(point.payload, query.filter)) {
        continue;
      }
      
      // 计算余弦相似度
      const score = this.cosineSimilarity(query.vector, point.vector);
      
      results.push({
        id: point.id,
        score,
        metadata: query.includeMetadata ? point.payload : undefined
      });
    }
    
    // 排序并返回topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, query.topK);
  }

  /**
   * 根据ID获取向量点
   */
  public async getByIds(ids: string[]): Promise<VectorPoint[]> {
    const results: VectorPoint[] = [];
    
    for (const id of ids) {
      const point = this.points.get(id);
      if (point) {
        results.push(point);
      }
    }
    
    return results;
  }

  /**
   * 根据过滤条件删除向量
   */
  public async deleteByFilter(filter: Record<string, any>): Promise<number> {
    let deletedCount = 0;
    
    for (const [id, point] of this.points.entries()) {
      if (this.matchFilter(point.payload, filter)) {
        this.points.delete(id);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  /**
   * 获取统计信息
   */
  public async getStats(): Promise<{ totalPoints: number; indexedPoints: number }> {
    const total = this.points.size;
    return {
      totalPoints: total,
      indexedPoints: total
    };
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
    this.points.clear();
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += (vec1[i] ?? 0) * (vec2[i] ?? 0);
      norm1 += (vec1[i] ?? 0) * (vec1[i] ?? 0);
      norm2 += (vec2[i] ?? 0) * (vec2[i] ?? 0);
    }
    
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * 匹配过滤器
   */
  private matchFilter(payload: any, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (payload[key] !== value) {
        return false;
      }
    }
    return true;
  }
}