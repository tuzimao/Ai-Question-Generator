// frontend/src/services/aiGenerationService.ts

import { AIConfigManager } from '@/utils/aiConfig';
import { GenerationConfig, GenerationProgress } from '@/types/generator';
import { Question, QuestionType, Difficulty } from '@/types/question';

/**
 * AI生成进度更新接口
 */
export interface ProgressUpdate {
  type: 'progress' | 'question' | 'completed' | 'error';
  stage: string;
  percentage: number;
  currentStep: number;
  totalSteps: number;
  message?: string;
  question?: Question;
  error?: string;
}

/**
 * AI响应格式接口
 */
interface AIResponse {
  success: boolean;
  metadata?: {
    totalQuestions: number;
    generationTime: number;
    model: string;
    cost?: {
      inputTokens: number;
      outputTokens: number;
      estimatedCost: number;
    };
  };
  questions: Question[];
  suggestions?: string[];
}

/**
 * 提示词模板
 */
class PromptBuilder {
  /**
   * 构建系统提示词
   */
  static buildSystemPrompt(): string {
    return `你是一位资深的教育专家和题目设计师，专门负责根据用户需求生成高质量的练习题目。

要求：
1. 题目表述清晰准确，符合对应年级学生的认知水平
2. 选择题的选项设计合理，干扰项有效但不误导学生
3. 每道题目都要包含详细的解析和知识点说明
4. 严格按照指定的JSON格式返回结果，不要包含任何其他内容

返回格式必须是有效的JSON，包含以下结构：
{
  "success": true,
  "metadata": {
    "totalQuestions": 数字,
    "generationTime": 数字,
    "model": "使用的模型名称"
  },
  "questions": [题目数组],
  "suggestions": ["建议数组"]
}

每道题目的格式：
{
  "id": "唯一标识",
  "type": "题目类型",
  "difficulty": "难度级别",
  "content": {
    "title": "题目内容",
    "format": "markdown"
  },
  "options": [选项数组] (仅选择题和判断题),
  "correctAnswer": 正确答案,
  "explanation": {
    "text": "详细解析",
    "format": "markdown"
  },
  "knowledgePoints": ["知识点数组"],
  "tags": ["标签数组"],
  "estimatedTime": 预计答题时间(秒),
  "score": 分值
}`;
  }

  /**
   * 构建用户提示词
   */
  static buildUserPrompt(config: GenerationConfig): string {
    // 防止 config 为 undefined 或 null
    if (!config) {
      throw new Error('生成配置不能为空');
    }

    const { 
      subject = '通用', 
      grade = '通用', 
      textbook = '通用版', 
      description = '', 
      questionTypes = {} 
    } = config;
    
    // 验证必要的配置
    if (!questionTypes || typeof questionTypes !== 'object') {
      throw new Error('题目类型配置缺失或格式错误');
    }

    // 统计启用的题目类型
    const enabledTypes = Object.entries(questionTypes)
      .filter(([_, typeConfig]) => typeConfig && typeConfig.enabled)
      .map(([type, typeConfig]) => ({
        type,
        count: typeConfig.count || 0,
        difficulty: typeConfig.difficulty || 'medium'
      }));

    if (enabledTypes.length === 0) {
      throw new Error('没有启用的题目类型');
    }

    const totalQuestions = enabledTypes.reduce((sum, t) => sum + t.count, 0);

    if (totalQuestions === 0) {
      throw new Error('题目总数不能为0');
    }

    // 构建题目要求
    const questionRequirements = enabledTypes.map(({ type, count, difficulty }) => {
      const typeNames = {
        'single_choice': '单选题',
        'multiple_choice': '多选题', 
        'true_false': '判断题',
        'short_answer': '简答题'
      };
      
      const difficultyNames = {
        'easy': '简单',
        'medium': '中等',
        'hard': '困难'
      };

      const typeName = typeNames[type as keyof typeof typeNames] || type;
      const difficultyName = difficultyNames[difficulty as keyof typeof difficultyNames] || difficulty;

      return `${typeName}：${count}道，难度${difficultyName}`;
    }).join('\n');

    return `请根据以下要求生成${totalQuestions}道练习题目：

学科信息：
- 科目：${subject}
- 年级：${grade}
- 教材：${textbook}

生成要求：
${description || '请生成标准的练习题目'}

题目配置：
${questionRequirements}

注意事项：
1. 确保题目内容准确，难度适中
2. 选择题要有4个选项（A、B、C、D）
3. 判断题选项为"正确"和"错误"
4. 每道题目都要有详细解析
5. 严格按照JSON格式返回，不要有额外内容

请开始生成题目：`;
  }

  /**
   * 构建完整提示词
   */
  static buildCompletePrompt(config: GenerationConfig): {
    systemPrompt: string;
    userPrompt: string;
  } {
    return {
      systemPrompt: this.buildSystemPrompt(),
      userPrompt: this.buildUserPrompt(config)
    };
  }
}

/**
 * AI题目生成服务类
 */
export class AIGenerationService {
  private config = AIConfigManager.getCurrentConfig();
  private abortController: AbortController | null = null;
  private _streamContent = '';

  /**
   * 验证AI配置
   */
  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('AI API密钥未配置，请先在设置中配置API密钥');
    }
    
    if (!this.config.model) {
      throw new Error('AI模型未选择，请先在设置中选择模型');
    }
  }

  /**
   * 构建API请求
   */
  private buildAPIRequest(config: GenerationConfig): any {
    const { systemPrompt, userPrompt } = PromptBuilder.buildCompletePrompt(config);
    
    return {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user', 
          content: userPrompt
        }
      ],
      temperature: this.config.temperature,
      max_tokens: 4000,
      stream: true, // 启用流式响应
      response_format: { type: 'json_object' } // 要求JSON格式（仅部分模型支持）
    };
  }

  /**
   * 解析流式响应
   */
  private async* parseStreamResponse(response: Response): AsyncGenerator<ProgressUpdate, void, unknown> {
    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentStep = 0;
    const totalSteps = 10; // 预估步骤数
    let hasContent = false; // 跟踪是否收到了实际内容
    const processedChunks = new Set(); // 跟踪已处理的内容块
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            // 检查是否为结束标志
            if (data === '[DONE]') {
              yield {
                type: 'completed',
                stage: '生成完成',
                percentage: 100,
                currentStep: totalSteps,
                totalSteps,
                message: '所有题目生成完成'
              };
              return;
            }
            
            // 跳过空数据
            if (!data) continue;
            
            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];
              
              // 检查是否有finish_reason，如果有则表示流结束
              if (choice?.finish_reason) {
                yield {
                  type: 'completed',
                  stage: '生成完成',
                  percentage: 100,
                  currentStep: totalSteps,
                  totalSteps,
                  message: '所有题目生成完成'
                };
                return;
              }
              
              // 检查是否有实际内容（不是空字符串）
              const content = choice?.delta?.content;
              
              // 添加详细的调试日志
              console.log('流式响应调试:', {
                content,
                contentType: typeof content,
                contentLength: content?.length,
                trimmedLength: content?.trim?.()?.length,
                hasContent: content && content.trim().length > 0,
                currentStep,
                choice
              });
              
              // 只有当content不为undefined、不为null、不为空字符串时才处理
              if (content !== undefined && content !== null && content !== '' && content.trim().length > 0) {
                // 创建内容块的唯一标识符（只基于内容）
                const chunkId = content;
                
                // 检查是否已经处理过这个内容块
                if (!processedChunks.has(chunkId)) {
                  processedChunks.add(chunkId);
                  hasContent = true;
                  currentStep++;
                  const percentage = Math.min((currentStep / totalSteps) * 100, 95);
                  
                  // 累积流内容
                  this._streamContent += content;
                  
                  console.log('递增步骤:', { currentStep, content: content.substring(0, 50), chunkId });
                  
                  yield {
                    type: 'progress',
                    stage: '正在生成题目内容',
                    percentage,
                    currentStep,
                    totalSteps,
                    message: `AI正在思考第${Math.ceil(currentStep/2)}题...`
                  };
                } else {
                  console.log('跳过重复内容:', { content: content.substring(0, 50), chunkId });
                }
              } else {
                // 记录被跳过的情况
                console.log('跳过空内容:', { content, contentType: typeof content });
              }
              
            } catch (parseError) {
              console.warn('解析流式响应失败:', parseError, '数据:', data);
            }
          }
        }
      }
      
      // 如果流结束但没有收到[DONE]标志，手动结束
      if (hasContent) {
        yield {
          type: 'completed',
          stage: '生成完成',
          percentage: 100,
          currentStep: totalSteps,
          totalSteps,
          message: '所有题目生成完成'
        };
      }
      
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 解析最终AI响应
   */
  private parseAIResponse(content: string): AIResponse {
    try {
      // 清理响应内容，移除可能的额外字符
      const cleanContent = content.trim();
      let jsonStart = cleanContent.indexOf('{');
      let jsonEnd = cleanContent.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('响应中未找到有效的JSON内容');
      }
      
      const jsonContent = cleanContent.slice(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonContent);
      
      // 验证响应格式
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('AI响应格式错误：缺少questions数组');
      }
      
      // 标准化题目数据
      const questions: Question[] = parsed.questions.map((q: any, index: number) => ({
        id: q.id || `q_${Date.now()}_${index}`,
        type: q.type || QuestionType.SINGLE_CHOICE,
        difficulty: q.difficulty || Difficulty.MEDIUM,
        content: {
          title: q.content?.title || q.title || '题目内容缺失',
          format: 'markdown'
        },
        options: q.options || [],
        correctAnswer: q.correctAnswer || [],
        explanation: {
          text: q.explanation?.text || q.explanation || '解析内容缺失',
          format: 'markdown'
        },
        knowledgePoints: q.knowledgePoints || [],
        tags: q.tags || [],
        estimatedTime: q.estimatedTime || 120,
        score: q.score || 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        creatorId: 'ai_generated'
      }));
      
      return {
        success: true,
        metadata: {
          totalQuestions: questions.length,
          generationTime: parsed.metadata?.generationTime || 0,
          model: this.config.model,
          cost: parsed.metadata?.cost
        },
        questions,
        suggestions: parsed.suggestions || []
      };
      
    } catch (error) {
      console.error('解析AI响应失败:', error);
      throw new Error(`解析AI响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 生成题目（主要方法）
   */
  async* generateQuestions(config: GenerationConfig): AsyncGenerator<ProgressUpdate, AIResponse, unknown> {
    // 验证配置
    this.validateConfig();
    
    // 验证生成配置
    if (!config) {
      throw new Error('生成配置不能为空');
    }
    
    if (!config.questionTypes) {
      throw new Error('题目类型配置缺失');
    }

    // 清空之前的流内容
    this._streamContent = '';

    // 创建取消控制器
    this.abortController = new AbortController();
    
    try {
      // 发送初始进度
      yield {
        type: 'progress',
        stage: '连接AI服务',
        percentage: 5,
        currentStep: 1,
        totalSteps: 10,
        message: '正在连接AI服务...'
      };
      
      // 构建请求
      const requestData = this.buildAPIRequest(config);
      const headers = AIConfigManager.getAuthHeaders(this.config);
      const url = AIConfigManager.buildApiUrl('/chat/completions', this.config);
      
      yield {
        type: 'progress',
        stage: '发送生成请求',
        percentage: 10,
        currentStep: 2,
        totalSteps: 10,
        message: '正在发送题目生成请求...'
      };
      
      // 发送请求
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(requestData),
        signal: this.abortController.signal
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API调用失败 (${response.status}): ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          // 忽略JSON解析错误，使用默认错误信息
        }
        
        throw new Error(errorMessage);
      }
      
      // 收集流式响应内容
      const startTime = Date.now();
      
      // 处理流式响应
      for await (const update of this.parseStreamResponse(response)) {
        yield update;
        
        if (update.type === 'completed') {
          break;
        }
      }
      
      // 使用流式响应中收集的内容
      const fullContent = this._streamContent;
      
      yield {
        type: 'progress',
        stage: '解析生成结果',
        percentage: 95,
        currentStep: 9,
        totalSteps: 10,
        message: '正在解析AI生成的题目...'
      };
      
      // 解析最终结果
      const result = this.parseAIResponse(fullContent);
      result.metadata!.generationTime = Date.now() - startTime;
      
      yield {
        type: 'completed',
        stage: '生成完成',
        percentage: 100,
        currentStep: 10,
        totalSteps: 10,
        message: `成功生成${result.questions.length}道题目`
      };
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      yield {
        type: 'error',
        stage: '生成失败',
        percentage: 0,
        currentStep: 0,
        totalSteps: 10,
        error: errorMessage,
        message: `生成失败: ${errorMessage}`
      };
      
      throw error;
    }
  }

  /**
   * 取消生成
   */
  cancelGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * 测试AI连接
   */
  async testConnection(): Promise<{ success: boolean; message: string; latency?: number }> {
    return AIConfigManager.testConnection(this.config);
  }
}

/**
 * 创建AI生成服务实例
 */
export const createAIGenerationService = () => new AIGenerationService();