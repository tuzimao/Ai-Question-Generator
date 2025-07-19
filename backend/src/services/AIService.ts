// src/services/AIService.ts

import OpenAI from 'openai';
import { encoding_for_model, TiktokenModel } from 'tiktoken';

/**
 * 嵌入请求接口
 */
export interface EmbeddingRequest {
  text: string;
  model?: string;
}

/**
 * 嵌入响应接口
 */
export interface EmbeddingResponse {
  vector: number[];
  tokens: number;
  model: string;
}

/**
 * 聊天完成请求接口
 */
export interface ChatCompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * 聊天完成响应接口
 */
export interface ChatCompletionResponse {
  content: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  finishReason: string;
}

/**
 * Token使用统计接口
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  estimatedCost: number; // 美元
}

/**
 * AI服务类
 * 封装OpenAI API调用，提供嵌入生成、聊天完成、Token计数等功能
 */
export class AIService {
  private openai: OpenAI | null = null;
  private encoder: any = null;
  private readonly defaultEmbeddingModel: string;
  private readonly defaultChatModel: string;
  private readonly maxRetries: number;
  private isInitialized: boolean = false;
  private initializationError: string | null = null;

  constructor() {
    // 延迟初始化，不在构造函数中验证API密钥
    this.defaultEmbeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.defaultChatModel = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxRetries = 3;

    console.log(`🤖 AI服务构造完成（延迟初始化）`);
  }

  /**
   * 初始化 AI 服务
   * 在实际使用前调用
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 验证API密钥
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('OPENAI_API_KEY环境变量未设置或为空');
      }

      // 初始化OpenAI客户端
      this.openai = new OpenAI({
        apiKey,
        maxRetries: 3,
        timeout: 60000 // 60秒超时
      });

      // 初始化Token编码器
      try {
        this.encoder = encoding_for_model(this.defaultEmbeddingModel as TiktokenModel);
      } catch (error) {
        console.warn('无法为嵌入模型创建编码器，使用默认编码器');
        this.encoder = encoding_for_model('gpt-4');
      }

      this.isInitialized = true;
      console.log(`🤖 AI服务初始化完成`);
      console.log(`   嵌入模型: ${this.defaultEmbeddingModel}`);
      console.log(`   聊天模型: ${this.defaultChatModel}`);
    } catch (error) {
      this.initializationError = error.message;
      console.error('AI服务初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 健康检查
   * @returns 是否服务可用
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // 如果有初始化错误，返回 false
      if (this.initializationError) {
        console.warn('AI服务初始化失败，健康检查返回false:', this.initializationError);
        return false;
      }

      // 尝试初始化（如果还没有初始化）
      if (!this.isInitialized) {
        await this.initialize();
      }

      // 检查OpenAI客户端是否可用
      if (!this.openai) {
        return false;
      }

      await this.openai.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI健康检查失败:', error.message);
      return false;
    }
  }

  /**
   * 生成文本嵌入向量
   * @param request 嵌入请求
   * @returns 嵌入向量和元数据
   */
  public async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // 确保服务已初始化
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.openai) {
      throw new Error('OpenAI客户端未初始化');
    }

    const model = request.model || this.defaultEmbeddingModel;
    
    try {
      // 预处理文本
      const cleanText = this.preprocessText(request.text);
      
      // 计算Token数量
      const tokens = this.countTokens(cleanText);
      
      // 检查Token限制
      if (tokens > 8191) { // text-embedding-3-small的最大Token限制
        throw new Error(`文本Token数量 (${tokens}) 超过模型限制 (8191)`);
      }

      // 调用OpenAI API
      const response = await this.openai.embeddings.create({
        model,
        input: cleanText,
        encoding_format: 'float'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('OpenAI返回的嵌入数据为空');
      }

      return {
        vector: response.data[0].embedding,
        tokens: response.usage?.total_tokens || tokens,
        model
      };
    } catch (error) {
      console.error('生成嵌入向量失败:', error);
      throw new Error(`嵌入生成失败: ${error.message}`);
    }
  }

  /**
   * 批量生成嵌入向量
   * @param texts 文本数组
   * @param model 使用的模型（可选）
   * @returns 嵌入向量数组
   */
  public async createBatchEmbeddings(
    texts: string[],
    model?: string
  ): Promise<EmbeddingResponse[]> {
    const embeddingModel = model || this.defaultEmbeddingModel;
    const batchSize = 100; // OpenAI建议的批次大小
    const results: EmbeddingResponse[] = [];

    try {
      // 分批处理
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const cleanBatch = batch.map(text => this.preprocessText(text));

        console.log(`🔄 处理嵌入向量批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);

        const response = await this.openai.embeddings.create({
          model: embeddingModel,
          input: cleanBatch,
          encoding_format: 'float'
        });

        // 处理批次响应
        response.data.forEach((embedding, index) => {
          results.push({
            vector: embedding.embedding,
            tokens: this.countTokens(cleanBatch[index]),
            model: embeddingModel
          });
        });

        // 添加延迟以避免速率限制
        if (i + batchSize < texts.length) {
          await this.delay(200); // 200ms延迟
        }
      }

      console.log(`✅ 批量嵌入完成，共处理 ${results.length} 个文本`);
      return results;
    } catch (error) {
      console.error('批量嵌入生成失败:', error);
      throw error;
    }
  }

  /**
   * 聊天完成（问答生成）
   * @param request 聊天请求
   * @returns 聊天响应
   */
  public async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    // 确保服务已初始化
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.openai) {
      throw new Error('OpenAI客户端未初始化');
    }

    const model = request.model || this.defaultChatModel;
    const maxTokens = request.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10);
    
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: request.messages,
        max_tokens: maxTokens,
        temperature: request.temperature || 0.7,
        stream: false // 暂不支持流式响应
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('OpenAI返回的聊天响应为空');
      }

      return {
        content: choice.message.content || '',
        tokens: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0
        },
        model,
        finishReason: choice.finish_reason || 'unknown'
      };
    } catch (error) {
      console.error('聊天完成失败:', error);
      throw new Error(`聊天完成失败: ${error.message}`);
    }
  }

  /**
   * 流式聊天完成（实时响应）
   * @param request 聊天请求
   * @returns 异步生成器，逐步返回响应内容
   */
  public async *createStreamingChatCompletion(
    request: ChatCompletionRequest
  ): AsyncGenerator<string, ChatCompletionResponse, unknown> {
    const model = request.model || this.defaultChatModel;
    const maxTokens = request.maxTokens || parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10);
    
    try {
      const stream = await this.openai.chat.completions.create({
        model,
        messages: request.messages,
        max_tokens: maxTokens,
        temperature: request.temperature || 0.7,
        stream: true
      });

      let fullContent = '';
      let finishReason = 'unknown';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          yield delta.content;
        }
        
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }

      return {
        content: fullContent,
        tokens: {
          prompt: this.countTokens(request.messages.map(m => m.content).join('\n')),
          completion: this.countTokens(fullContent),
          total: 0 // 流式响应中无法直接获取
        },
        model,
        finishReason
      };
    } catch (error) {
      console.error('流式聊天完成失败:', error);
      throw error;
    }
  }

  /**
   * 计算文本Token数量
   * @param text 输入文本
   * @param model 模型名称（可选）
   * @returns Token数量
   */
  public countTokens(text: string, model?: string): number {
    try {
      if (!text || typeof text !== 'string') {
        return 0;
      }

      // 如果encoder还没初始化，使用粗略估算
      if (!this.encoder) {
        const avgCharsPerToken = /[\u4e00-\u9fff]/.test(text) ? 1.5 : 4;
        return Math.ceil(text.length / avgCharsPerToken);
      }

      // 如果指定了不同的模型，尝试使用对应的编码器
      if (model && model !== this.defaultEmbeddingModel) {
        try {
          const modelEncoder = encoding_for_model(model as TiktokenModel);
          const tokens = modelEncoder.encode(text);
          modelEncoder.free();
          return tokens.length;
        } catch {
          // 如果模型编码器不可用，回退到默认编码器
        }
      }

      return this.encoder.encode(text).length;
    } catch (error) {
      console.error('Token计数失败:', error);
      // 粗略估算：英文约4字符/token，中文约1.5字符/token
      const avgCharsPerToken = /[\u4e00-\u9fff]/.test(text) ? 1.5 : 4;
      return Math.ceil(text.length / avgCharsPerToken);
    }
  }

  /**
   * 估算API调用成本
   * @param usage Token使用情况
   * @param model 使用的模型
   * @returns 估算成本（美元）
   */
  public estimateCost(usage: TokenUsage, model?: string): number {
    const modelName = model || this.defaultChatModel;
    
    // OpenAI定价（截至2024年，可能会变化）
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.00003, output: 0.00006 },
      'gpt-4-turbo': { input: 0.00001, output: 0.00003 },
      'gpt-3.5-turbo': { input: 0.0000015, output: 0.000002 },
      'text-embedding-3-small': { input: 0.00000002, output: 0 },
      'text-embedding-3-large': { input: 0.00000013, output: 0 }
    };

    const modelPricing = pricing[modelName] || pricing['gpt-4'];
    return (usage.input * modelPricing.input) + (usage.output * modelPricing.output);
  }

  /**
   * 文本预处理
   * @param text 原始文本
   * @returns 清理后的文本
   */
  private preprocessText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .trim()
      .replace(/\s+/g, ' ') // 合并多个空白字符
      .replace(/\n{3,}/g, '\n\n') // 限制连续换行
      .substring(0, 32768); // 限制最大长度
  }

  /**
   * 延迟函数（用于速率限制）
   * @param ms 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取可用模型列表
   * @returns 模型列表
   */
  public async getAvailableModels(): Promise<string[]> {
    try {
      // 确保服务已初始化
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.openai) {
        throw new Error('OpenAI客户端未初始化');
      }

      const response = await this.openai.models.list();
      return response.data.map(model => model.id).sort();
    } catch (error) {
      console.error('获取模型列表失败:', error);
      return [];
    }
  }

  /**
   * 验证API密钥是否有效
   * @returns 是否有效
   */
  public async validateApiKey(): Promise<boolean> {
    try {
      // 检查环境变量
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        return false;
      }

      // 确保服务已初始化
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.openai) {
        return false;
      }

      await this.openai.models.list();
      return true;
    } catch (error) {
      console.error('API密钥验证失败:', error);
      return false;
    }
  }

  /**
   * 释放资源
   */
  public cleanup(): void {
    if (this.encoder) {
      try {
        this.encoder.free();
      } catch (error) {
        console.warn('释放编码器资源失败:', error);
      }
    }
    console.log('🧹 AI服务资源已清理');
  }
}

/**
 * 创建AI服务单例实例
 * 使用延迟初始化模式，确保安全创建
 */
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}

// 导出单例实例
export const aiService = getAIService();

// 默认导出类
export default AIService;