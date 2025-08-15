// src/stores/vector/QdrantVectorStore.ts

import { IVectorStore } from './VectorStore';
import { VectorPoint, VectorSearchQuery, VectorSearchResult } from '@/types/embedding';
import { VectorService } from '@/services/VectorService';

/**
 * Qdrant向量存储
 */
export class QdrantVectorStore implements IVectorStore {
  public readonly name = 'Qdrant';
  
  private vectorService: VectorService;
  private collectionName!: string;
  private dimension!: number;

  constructor() {
    this.vectorService = new VectorService();
  }

  /**
   * 初始化
   */
  public async initialize(collectionName: string, dimension: number): Promise<void> {
    this.collectionName = collectionName;
    this.dimension = dimension;
    
    // 初始化向量服务
    await this.vectorService.initialize();
    
    // 确保集合存在
    await this.vectorService.ensureCollection({
      name: collectionName,
      vectorSize: dimension,
      distance: 'Cosine'
    });
    
    console.log(`✅ Qdrant VectorStore初始化成功 (集合: ${collectionName}, 维度: ${dimension})`);
  }

  /**
   * 插入向量点
   */
  public async upsert(points: VectorPoint[]): Promise<void> {
    const formattedPoints = points.map(point => ({
      id: point.id,
      vector: point.vector,
      payload: point.payload
    }));
    
    await this.vectorService.upsertPoints(formattedPoints, this.collectionName);
    
    console.log(`💾 插入 ${points.length} 个向量到Qdrant`);
  }

  /**
   * 搜索相似向量
   */
  public async search(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const results = await this.vectorService.search(
      query.vector,
      query.topK,
      0.0, // 不设置分数阈值
      query.filter,
      this.collectionName
    );
    
    return results.map(result => ({
      id: result.id,
      score: result.score,
      metadata: query.includeMetadata ? result.payload : {}
    }));
  }

  /**
   * 根据ID获取向量点
   */
  public async getByIds(ids: string[]): Promise<VectorPoint[]> {
    const points = await this.vectorService.getPoints(ids, this.collectionName);
    
    return points.map(point => ({
      id: point.id,
      vector: point.vector,
      payload: point.payload as any
    }));
  }

  /**
   * 根据过滤条件删除向量
   */
  public async deleteByFilter(filter: Record<string, any>): Promise<number> {
    // Qdrant不直接支持按filter删除，需要先搜索再删除
    const searchResults = await this.vectorService.scrollPoints(
      1000,
      undefined,
      this.collectionName
    );
    
    const idsToDelete: string[] = [];
    for (const point of searchResults.points) {
      if (this.matchFilter(point.payload, filter)) {
        idsToDelete.push(point.id);
      }
    }
    
    if (idsToDelete.length > 0) {
      await this.vectorService.deletePoints(idsToDelete, this.collectionName);
    }
    
    return idsToDelete.length;
  }

  /**
   * 获取统计信息
   */
  public async getStats(): Promise<{ totalPoints: number; indexedPoints: number }> {
    const info = await this.vectorService.getCollectionInfo(this.collectionName);
    
    return {
      totalPoints: info.points_count || 0,
      indexedPoints: info.indexed_vectors_count || 0
    };
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<boolean> {
    return await this.vectorService.healthCheck();
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    // Qdrant客户端不需要显式清理
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