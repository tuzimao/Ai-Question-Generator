// src/services/VectorService.ts

import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

/**
 * 向量点数据接口
 */
export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

/**
 * 集合配置接口
 */
export interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance?: 'Cosine' | 'Euclid' | 'Dot';
  description?: string;
}

/**
 * 向量服务类
 * 负责管理Qdrant向量数据库的连接和操作
 */
export class VectorService {
  private client: QdrantClient | null = null;
  private readonly defaultCollection!: string;
  private isConnected: boolean = false;
  private initializationError: string | null = null;

  constructor() {
    try {
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      const apiKey = process.env.QDRANT_API_KEY;

      // 初始化Qdrant客户端
      this.client = new QdrantClient(
        apiKey
          ? { url: qdrantUrl, apiKey }
          : { url: qdrantUrl }
      );

      this.defaultCollection = process.env.QDRANT_COLLECTION_NAME || 'documents';
      
      console.log(`🔗 Qdrant向量服务初始化: ${qdrantUrl}`);
    } catch (error) {
      this.initializationError = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : String(error);
      console.error('❌ Qdrant向量服务构造函数失败:', error);
    }
  }

  /**
   * 初始化向量服务
   * 检查连接并创建默认集合
   */
  public async initialize(): Promise<void> {
    try {
      // 检查初始化状态
      if (this.initializationError) {
        throw new Error(`Qdrant服务初始化失败: ${this.initializationError}`);
      }

      if (!this.client) {
        throw new Error('Qdrant客户端未正确初始化');
      }

      // 测试连接
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        throw new Error('Qdrant健康检查失败');
      }
      
      // 确保默认集合存在
      await this.ensureCollection({
        name: this.defaultCollection,
        vectorSize: 1536, // OpenAI text-embedding-3-small的维度
        distance: 'Cosine',
        description: '文档知识库向量集合'
      });

      this.isConnected = true;
      console.log('✅ Qdrant向量服务初始化完成');
    } catch (error) {
      console.error('❌ Qdrant向量服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   * @returns 是否连接正常
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // 检查初始化错误
      if (this.initializationError) {
        console.error('Qdrant服务初始化失败:', this.initializationError);
        return false;
      }

      // 检查客户端是否存在
      if (!this.client) {
        console.error('Qdrant客户端未初始化');
        return false;
      }

      // 尝试连接
      await this.client.getCollections();
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'message' in error) {
        console.error('Qdrant健康检查失败:', (error as { message: string }).message);
      } else {
        console.error('Qdrant健康检查失败:', error);
      }
      return false;
    }
  }

  /**
   * 获取连接状态
   * @returns 是否已连接
   */
  public isConnectedToQdrant(): boolean {
    return this.isConnected;
  }

  /**
   * 确保集合存在，不存在则创建
   * @param config 集合配置
   */
  public async ensureCollection(config: CollectionConfig): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }

      // 检查集合是否存在
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(col => col.name === config.name);

      if (!exists) {
        console.log(`📊 创建Qdrant集合: ${config.name}`);
        await this.createCollection(config);
      } else {
        console.log(`✅ Qdrant集合已存在: ${config.name}`);
      }
    } catch (error) {
      console.error(`创建集合失败 ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * 创建向量集合
   * @param config 集合配置
   */
  public async createCollection(config: CollectionConfig): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }

      await this.client.createCollection(config.name, {
        vectors: {
          size: config.vectorSize,
          distance: config.distance || 'Cosine'
        },
        optimizers_config: {
          default_segment_number: 2,
          memmap_threshold: 20000
        },
        replication_factor: 1
      });

      console.log(`✅ 成功创建集合: ${config.name}`);
    } catch (error) {
      console.error(`创建集合失败 ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * 删除集合
   * @param collectionName 集合名称
   */
  public async deleteCollection(collectionName: string): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }
      await this.client.deleteCollection(collectionName);
      console.log(`🗑️ 成功删除集合: ${collectionName}`);
    } catch (error) {
      console.error(`删除集合失败 ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * 插入向量点
   * @param collectionName 集合名称（可选，默认使用默认集合）
   * @param points 向量点数组
   */
  public async upsertPoints(
    points: VectorPoint[],
    collectionName?: string
  ): Promise<void> {
    const collection = collectionName || this.defaultCollection;
    
    try {
      const formattedPoints = points.map(point => ({
        id: point.id,
        vector: point.vector,
        payload: {
          ...point.payload,
          created_at: new Date().toISOString()
        }
      }));

      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }
      await this.client.upsert(collection, {
        wait: true,
        points: formattedPoints
      });

      console.log(`✅ 成功插入 ${points.length} 个向量点到集合 ${collection}`);
    } catch (error) {
      console.error(`插入向量点失败:`, error);
      throw error;
    }
  }

  /**
   * 搜索相似向量
   * @param queryVector 查询向量
   * @param limit 返回数量限制
   * @param scoreThreshold 分数阈值
   * @param filter 过滤条件
   * @param collectionName 集合名称（可选）
   * @returns 搜索结果
   */
  public async search(
    queryVector: number[],
    limit: number = 10,
    scoreThreshold: number = 0.7,
    filter?: Record<string, any>,
    collectionName?: string
  ): Promise<SearchResult[]> {
    const collection = collectionName || this.defaultCollection;
    
    try {
      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }
      const searchOptions: any = {
        vector: queryVector,
        limit,
        score_threshold: scoreThreshold,
        with_payload: true
      };
      if (filter) {
        searchOptions.filter = { must: [filter] };
      }
      const searchResult = await this.client.search(collection, searchOptions);

      return searchResult.map(result => ({
        id: result.id as string,
        score: result.score,
        payload: result.payload || {}
      }));
    } catch (error) {
      console.error('向量搜索失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取向量点
   * @param ids 向量点ID数组
   * @param collectionName 集合名称（可选）
   * @returns 向量点数据
   */
  public async getPoints(
    ids: string[],
    collectionName?: string
  ): Promise<VectorPoint[]> {
    const collection = collectionName || this.defaultCollection;
    
    try {
      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }
      const result = await this.client.retrieve(collection, {
        ids,
        with_payload: true,
        with_vector: true
      });

      return result.map(point => ({
        id: point.id as string,
        vector: point.vector as number[],
        payload: point.payload || {}
      }));
    } catch (error) {
      console.error('获取向量点失败:', error);
      throw error;
    }
  }

  /**
   * 删除向量点
   * @param ids 要删除的向量点ID数组
   * @param collectionName 集合名称（可选）
   */
  public async deletePoints(
    ids: string[],
    collectionName?: string
  ): Promise<void> {
    const collection = collectionName || this.defaultCollection;
    
    try {
      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }
      await this.client.delete(collection, {
        wait: true,
        points: ids
      });

      console.log(`🗑️ 成功删除 ${ids.length} 个向量点`);
    } catch (error) {
      console.error('删除向量点失败:', error);
      throw error;
    }
  }

  /**
   * 获取集合信息
   * @param collectionName 集合名称（可选）
   * @returns 集合信息
   */
  public async getCollectionInfo(collectionName?: string): Promise<any> {
    const collection = collectionName || this.defaultCollection;
    
    try {
      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }
      return await this.client.getCollection(collection);
    } catch (error) {
      console.error(`获取集合信息失败 ${collection}:`, error);
      throw error;
    }
  }

  /**
   * 滚动浏览所有向量点（分页获取）
   * @param limit 每页数量
   * @param offset 偏移量
   * @param collectionName 集合名称（可选）
   * @returns 向量点数据和下一页偏移量
   */
  public async scrollPoints(
    limit: number = 100,
    offset?: string,
    collectionName?: string
  ): Promise<{ points: VectorPoint[]; nextOffset: string | undefined }> {
    const collection = collectionName || this.defaultCollection;
    
    try {
      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }
      const scrollOptions: any = {
        limit,
        with_payload: true,
        with_vector: false // 为了性能，通常不需要返回向量
      };
      if (offset !== undefined) {
        scrollOptions.offset = offset;
      }
      const result = await this.client.scroll(collection, scrollOptions);

      const points = result.points.map(point => ({
        id: point.id as string,
        vector: [], // 空向量，因为我们没有请求
        payload: point.payload || {}
      }));

      return {
        points,
        nextOffset: result.next_page_offset as string | undefined
      };
    } catch (error) {
      console.error('滚动浏览向量点失败:', error);
      throw error;
    }
  }

  /**
   * 批量搜索（多个查询向量）
   * @param queries 查询参数数组
   * @param collectionName 集合名称（可选）
   * @returns 搜索结果数组
   */
  public async batchSearch(
    queries: Array<{
      vector: number[];
      limit?: number;
      scoreThreshold?: number;
      filter?: Record<string, any>;
    }>,
    collectionName?: string
  ): Promise<SearchResult[][]> {
    const collection = collectionName || this.defaultCollection;
    
    try {
      if (!this.client) {
        throw new Error('Qdrant客户端未初始化');
      }

      const searchQueries = queries.map(query => {
        const searchQuery: any = {
          vector: query.vector,
          limit: query.limit || 10,
          score_threshold: query.scoreThreshold || 0.7,
          with_payload: true
        };
        if (query.filter) {
          searchQuery.filter = { must: [query.filter] };
        }
        return searchQuery;
      });

      const results = await this.client.searchBatch(collection, {
        searches: searchQueries
      });

      return results.map(result => 
        result.map(item => ({
          id: item.id as string,
          score: item.score,
          payload: item.payload || {}
        }))
      );
    } catch (error) {
      console.error('批量搜索失败:', error);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  public async close(): Promise<void> {
    // Qdrant客户端通常不需要显式关闭连接
    this.isConnected = false;
    console.log('📴 Qdrant向量服务连接已关闭');
  }

  /**
   * 生成唯一ID
   * @returns UUID字符串
   */
  public static generateId(): string {
    return uuidv4();
  }
}

/**
 * 创建向量服务单例实例
 * 使用延迟初始化模式，确保安全创建
 */
let vectorServiceInstance: VectorService | null = null;

export function getVectorService(): VectorService {
  if (!vectorServiceInstance) {
    vectorServiceInstance = new VectorService();
  }
  return vectorServiceInstance;
}

// 导出单例实例
export const vectorService = getVectorService();

// 默认导出类
export default VectorService;