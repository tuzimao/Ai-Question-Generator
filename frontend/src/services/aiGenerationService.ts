import { AIConfigManager } from '@/utils/aiConfig';
import { GenerationConfig } from '@/types/generator';
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

  static buildUserPrompt(config: GenerationConfig): string {
    if (!config) throw new Error('生成配置不能为空');
    const {
      subject = '通用',
      grade = '通用',
      textbook = '通用版',
      description = '',
      questionTypes = {}
    } = config;
    if (!questionTypes || typeof questionTypes !== 'object') {
      throw new Error('题目类型配置缺失或格式错误');
    }
    const enabledTypes = Object.entries(questionTypes)
      .filter(([_, typeConfig]) => typeConfig && typeConfig.enabled)
      .map(([type, typeConfig]) => ({
        type,
        count: typeConfig.count || 0,
        difficulty: typeConfig.difficulty || 'medium'
      }));

    if (enabledTypes.length === 0) throw new Error('没有启用的题目类型');
    const totalQuestions = enabledTypes.reduce((sum, t) => sum + t.count, 0);
    if (totalQuestions === 0) throw new Error('题目总数不能为0');
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
    const questionRequirements = enabledTypes.map(({ type, count, difficulty }) => {
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

  static buildCompletePrompt(config: GenerationConfig): { systemPrompt: string; userPrompt: string } {
    return {
      systemPrompt: this.buildSystemPrompt(),
      userPrompt: this.buildUserPrompt(config)
    };
  }
}

export class AIGenerationService {
  private config = AIConfigManager.getCurrentConfig();
  private abortController: AbortController | null = null;
  private questionCallback?: (question: Question) => void;

  private validateConfig(): void {
    if (!this.config.apiKey) throw new Error('AI API密钥未配置，请先在设置中配置API密钥');
    if (!this.config.model) throw new Error('AI模型未选择，请先在设置中选择模型');
  }

  private buildAPIRequest(config: GenerationConfig): any {
    const { systemPrompt, userPrompt } = PromptBuilder.buildCompletePrompt(config);
    return {
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: this.config.temperature,
      max_tokens: 4000,
      stream: true,
      response_format: { type: 'json_object' }
    };
  }

  /**
   * 解析流式响应（浏览器原生实现，兼容所有主流大模型SSE风格）
   */
  private async* parseStreamResponse(response: Response): AsyncGenerator<ProgressUpdate, void, unknown> {
    if (!response.body) throw new Error('响应体为空');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentStep = 0;
    let totalSteps = 10;

    let contentString = ''; // 用于拼接所有 JSON content

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
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              // 兼容 OpenAI/DeepSeek 两种流结构
              if (parsed.choices?.[0]?.delta?.content) {
                contentString += parsed.choices[0].delta.content;
              } else if (parsed.choices?.[0]?.message?.content) {
                contentString += parsed.choices[0].message.content;
              }
            } catch {}
          }
        }
        // 可以在这里显示流式进度
        yield {
          type: 'progress',
          stage: '正在生成题目内容',
          percentage: Math.min((currentStep / totalSteps) * 100, 95),
          currentStep,
          totalSteps,
          message: `AI正在生成题目内容...`
        };
      }

      // 流结束，提取有效 JSON
      const clean = contentString.trim();
      let jsonStart = clean.indexOf('{');
      let jsonEnd = clean.lastIndexOf('}') + 1;
      if (jsonStart === -1 || jsonEnd === 0) throw new Error('未找到有效的 JSON');
      const jsonContent = clean.slice(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonContent);

      // 逐题推送
      if (parsed.questions && Array.isArray(parsed.questions)) {
        totalSteps = parsed.questions.length;
        for (const question of parsed.questions) {
          currentStep++;
          // 推送给回调（UI可以直接订阅）
          if (this.questionCallback) this.questionCallback(question);
          yield {
            type: 'question',
            question,
            stage: '已生成题目',
            percentage: Math.min((currentStep / totalSteps) * 100, 100),
            currentStep,
            totalSteps,
            message: `已生成题目 ${currentStep}`
          };
        }
      }

      yield {
        type: 'completed',
        stage: '生成完成',
        percentage: 100,
        currentStep: totalSteps,
        totalSteps,
        message: '所有题目生成完成'
      };
    } finally {
      reader.releaseLock();
    }
  }

  // 注册 UI 实时题目回调
  public onQuestionReceived(callback: (question: Question) => void) {
    this.questionCallback = callback;
  }

  private parseAIResponse(content: string): AIResponse {
    try {
      const cleanContent = content.trim();
      let jsonStart = cleanContent.indexOf('{');
      let jsonEnd = cleanContent.lastIndexOf('}') + 1;
      if (jsonStart === -1 || jsonEnd === 0) throw new Error('响应中未找到有效的JSON内容');
      const jsonContent = cleanContent.slice(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonContent);
      if (!parsed.questions || !Array.isArray(parsed.questions)) throw new Error('AI响应格式错误：缺少questions数组');
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

  async* generateQuestions(config: GenerationConfig): AsyncGenerator<ProgressUpdate, AIResponse, unknown> {
    this.validateConfig();
    if (!config) throw new Error('生成配置不能为空');
    if (!config.questionTypes) throw new Error('题目类型配置缺失');
    this.abortController = new AbortController();

    try {
      yield {
        type: 'progress',
        stage: '连接AI服务',
        percentage: 5,
        currentStep: 1,
        totalSteps: 10,
        message: '正在连接AI服务...'
      };

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

      const response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Accept': 'text/event-stream' },
        body: JSON.stringify(requestData),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API调用失败 (${response.status}): ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      const startTime = Date.now();
      for await (const update of this.parseStreamResponse(response)) {
        yield update;
        if (update.type === 'completed') break;
      }

      // 为保证完整性，仍然拉一次完整响应
      const finalResponse = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...requestData, stream: false }),
        signal: this.abortController.signal
      });
      if (!finalResponse.ok) throw new Error('获取完整响应失败');
      const finalData = await finalResponse.json();
      const fullContent = finalData.choices?.[0]?.message?.content || '';

      yield {
        type: 'progress',
        stage: '解析生成结果',
        percentage: 95,
        currentStep: 9,
        totalSteps: 10,
        message: '正在解析AI生成的题目...'
      };

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

  cancelGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; latency?: number }> {
    return AIConfigManager.testConnection(this.config);
  }
}

export const createAIGenerationService = () => new AIGenerationService();
export type { Question } from '@/types/question';