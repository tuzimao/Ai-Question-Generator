// frontend/src/services/aiGenerationService.ts (修复版本)

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
 * 提示词模板 - 修复版本
 */
class PromptBuilder {
  static buildSystemPrompt(): string {
    return `你是一位资深的教育专家和题目设计师，专门负责根据用户需求生成高质量的练习题目。

严格要求：
1. 必须严格按照用户指定的题目类型和数量生成题目
2. 单选题只能有一个正确答案，多选题可以有多个正确答案
3. 选项标识使用简单的A、B、C、D格式，不要重复
4. 题目表述清晰准确，符合指定的难度级别
5. 每道题目都要包含详细的解析和相关标签

返回格式必须是有效的JSON，结构如下：
{
  "success": true,
  "metadata": {
    "totalQuestions": 数字,
    "generationTime": 数字,
    "model": "使用的模型名称"
  },
  "questions": [
    {
      "id": "唯一标识",
      "type": "题目类型(single_choice/multiple_choice/true_false/short_answer)",
      "difficulty": "难度级别(easy/medium/hard)",
      "content": {
        "title": "题目内容",
        "format": "markdown"
      },
      "options": [
        {"id": "A", "text": "选项A内容", "isCorrect": false},
        {"id": "B", "text": "选项B内容", "isCorrect": true}
      ],
      "correctAnswer": "A" // 单选题为字符串，多选题为数组 ["A", "B"]
      "explanation": {
        "text": "详细解析",
        "format": "markdown"
      },
      "tags": ["标签1", "标签2", "标签3"],
      "knowledgePoints": ["知识点1", "知识点2"],
      "estimatedTime": 预计答题时间(秒),
      "score": 分值
    }
  ]
}

重要注意事项：
- 不要输出任何除JSON之外的内容
- 确保题目类型与用户要求完全一致
- 选项ID使用A、B、C、D，不要重复
- 判断题的选项固定为 [{"id": "true", "text": "正确"}, {"id": "false", "text": "错误"}]`;
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

    // 验证并处理题目类型配置
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

    // 题目类型映射
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

    // 生成详细的题目要求
    const questionRequirements = enabledTypes.map(({ type, count, difficulty }) => {
      const typeName = typeNames[type as keyof typeof typeNames] || type;
      const difficultyName = difficultyNames[difficulty as keyof typeof difficultyNames] || difficulty;
      
      let typeInstruction = '';
      switch (type) {
        case 'single_choice':
          typeInstruction = '单选题：4个选项(A、B、C、D)，只有1个正确答案，correctAnswer为字符串如"A"';
          break;
        case 'multiple_choice':
          typeInstruction = '多选题：4个选项(A、B、C、D)，可有多个正确答案，correctAnswer为数组如["A", "C"]';
          break;
        case 'true_false':
          typeInstruction = '判断题：2个选项(true为"正确"，false为"错误")，correctAnswer为"true"或"false"';
          break;
        case 'short_answer':
          typeInstruction = '简答题：无选项，correctAnswer为参考答案字符串';
          break;
      }
      
      return `${count}道${typeName}(难度：${difficultyName}) - ${typeInstruction}`;
    }).join('\n');

    return `请根据以下要求严格生成${totalQuestions}道练习题目：

学科信息：
- 科目：${subject}
- 年级：${grade}
- 教材：${textbook}

内容要求：
${description || '请生成标准的练习题目'}

题目配置（严格按照以下要求生成）：
${questionRequirements}

额外要求：
1. 为每道题目生成3个相关标签（如学科名称、知识点、题型特征等）
2. 题目内容要准确、无歧义
3. 解析要详细，包含解题思路
4. 确保返回的是完整有效的JSON格式

请开始生成题目，只返回JSON格式的内容：`;
  }

  static buildCompletePrompt(config: GenerationConfig): { systemPrompt: string; userPrompt: string } {
    return {
      systemPrompt: this.buildSystemPrompt(),
      userPrompt: this.buildUserPrompt(config)
    };
  }
}

/**
 * AI响应解析 - 修复版本
 */
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
      // 强制JSON格式输出
      response_format: { type: 'json_object' }
    };
  }

  /**
   * 解析AI响应 - 修复格式问题
   */
  private parseAIResponse(content: string): any {
    try {
      console.log('原始AI响应内容:', content);
      
      // 清理响应内容
      let cleanContent = content.trim();
      
      // 移除可能的markdown标记
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // 移除前后的解释文字
      cleanContent = cleanContent.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
      
      // 找到JSON开始和结束位置
      const jsonStart = cleanContent.indexOf('{');
      const jsonEnd = cleanContent.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('响应中未找到有效的JSON内容');
      }
      
      const jsonContent = cleanContent.slice(jsonStart, jsonEnd);
      console.log('提取的JSON内容:', jsonContent);
      
      const parsed = JSON.parse(jsonContent);
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('AI响应格式错误：缺少questions数组');
      }

      // 处理和验证每个题目
      const processedQuestions: Question[] = parsed.questions.map((q: any, index: number) => {
        console.log(`处理题目 ${index + 1}:`, q);
        
        // 验证必要字段
        if (!q.type || !q.content || !q.content.title) {
          console.warn(`题目 ${index + 1} 缺少必要字段，跳过`);
          return null;
        }

        // 处理选项格式
        let processedOptions: any[] = [];
        let processedCorrectAnswer: string | string[] = '';

        if (q.type === 'single_choice' || q.type === 'multiple_choice') {
          // 确保选项格式正确
          if (q.options && Array.isArray(q.options)) {
            processedOptions = q.options.map((opt: any, optIndex: number) => ({
              id: String.fromCharCode(65 + optIndex), // A, B, C, D
              text: typeof opt === 'string' ? opt : (opt.text || opt.content || `选项${optIndex + 1}`),
              isCorrect: false // 先设为false，后面根据correctAnswer设置
            }));
          } else {
            // 如果没有选项，创建默认选项
            processedOptions = [
              { id: 'A', text: '选项A', isCorrect: false },
              { id: 'B', text: '选项B', isCorrect: false },
              { id: 'C', text: '选项C', isCorrect: false },
              { id: 'D', text: '选项D', isCorrect: false }
            ];
          }

          // 处理正确答案
          if (q.correctAnswer) {
            if (q.type === 'single_choice') {
              processedCorrectAnswer = typeof q.correctAnswer === 'string' ? q.correctAnswer : q.correctAnswer[0] || 'A';
              // 设置正确选项
              const correctIndex = processedOptions.findIndex(opt => opt.id === processedCorrectAnswer);
              if (correctIndex !== -1) {
                processedOptions[correctIndex].isCorrect = true;
              }
            } else {
              processedCorrectAnswer = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
              // 设置正确选项
              (processedCorrectAnswer as string[]).forEach(answer => {
                const correctIndex = processedOptions.findIndex(opt => opt.id === answer);
                if (correctIndex !== -1) {
                  processedOptions[correctIndex].isCorrect = true;
                }
              });
            }
          }
        } else if (q.type === 'true_false') {
          processedOptions = [
            { id: 'true', text: '正确', isCorrect: false },
            { id: 'false', text: '错误', isCorrect: false }
          ];
          processedCorrectAnswer = q.correctAnswer === 'true' || q.correctAnswer === true ? 'true' : 'false';
          const correctIndex = processedOptions.findIndex(opt => opt.id === processedCorrectAnswer);
          if (correctIndex !== -1) {
            processedOptions[correctIndex].isCorrect = true;
          }
        } else if (q.type === 'short_answer') {
          processedOptions = [];
          processedCorrectAnswer = q.correctAnswer || '';
        }

        const processedQuestion: Question = {
          id: q.id || `q_${Date.now()}_${index}`,
          type: q.type as QuestionType,
          difficulty: q.difficulty as Difficulty || Difficulty.MEDIUM,
          content: {
            title: q.content.title || q.content || '题目内容缺失',
            format: 'markdown'
          },
          options: processedOptions,
          correctAnswer: processedCorrectAnswer,
          explanation: {
            text: q.explanation?.text || q.explanation || '解析内容缺失',
            format: 'markdown'
          },
          knowledgePoints: q.knowledgePoints || [],
          tags: q.tags || ['通用题目'],
          estimatedTime: q.estimatedTime || 120,
          score: q.score || 5,
          createdAt: new Date(),
          updatedAt: new Date(),
          creatorId: 'ai_generated'
        };

        console.log(`处理后的题目 ${index + 1}:`, processedQuestion);
        return processedQuestion;
      }).filter(Boolean); // 过滤掉null值

      console.log('最终处理的题目列表:', processedQuestions);

      return {
        success: true,
        metadata: {
          totalQuestions: processedQuestions.length,
          generationTime: parsed.metadata?.generationTime || 0,
          model: this.config.model
        },
        questions: processedQuestions,
        suggestions: parsed.suggestions || []
      };
    } catch (error) {
      console.error('解析AI响应失败:', error);
      console.error('原始内容:', content);
      throw new Error(`解析AI响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 解析流式响应
   */
  private async* parseStreamResponse(response: Response): AsyncGenerator<ProgressUpdate, void, unknown> {
    if (!response.body) throw new Error('响应体为空');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentStep = 0;
    let totalSteps = 10;
    let contentString = '';

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
              if (parsed.choices?.[0]?.delta?.content) {
                contentString += parsed.choices[0].delta.content;
              } else if (parsed.choices?.[0]?.message?.content) {
                contentString += parsed.choices[0].message.content;
              }
            } catch {}
          }
        }
        
        currentStep++;
        yield {
          type: 'progress',
          stage: '正在生成题目内容',
          percentage: Math.min((currentStep / totalSteps) * 80, 80),
          currentStep,
          totalSteps,
          message: 'AI正在生成题目内容...'
        };
      }

      // 解析完整的响应
      yield {
        type: 'progress',
        stage: '解析AI响应',
        percentage: 90,
        currentStep: totalSteps - 1,
        totalSteps,
        message: '正在解析AI生成的题目...'
      };

      const result = this.parseAIResponse(contentString);
      
      // 逐题推送
      if (result.questions && Array.isArray(result.questions)) {
        for (let i = 0; i < result.questions.length; i++) {
          const question = result.questions[i];
          if (this.questionCallback) {
            this.questionCallback(question);
          }
          
          yield {
            type: 'question',
            question,
            stage: '题目生成完成',
            percentage: 90 + (i + 1) / result.questions.length * 10,
            currentStep: totalSteps - 1 + i,
            totalSteps: totalSteps + result.questions.length,
            message: `已生成第 ${i + 1} 道题目`
          };
        }
      }

      yield {
        type: 'completed',
        stage: '生成完成',
        percentage: 100,
        currentStep: totalSteps + (result.questions?.length || 0),
        totalSteps: totalSteps + (result.questions?.length || 0),
        message: `成功生成 ${result.questions?.length || 0} 道题目`
      };
    } finally {
      reader.releaseLock();
    }
  }

  // 注册题目接收回调
  public onQuestionReceived(callback: (question: Question) => void) {
    this.questionCallback = callback;
  }

  async* generateQuestions(config: GenerationConfig): AsyncGenerator<ProgressUpdate, any, unknown> {
    this.validateConfig();
    if (!config) throw new Error('生成配置不能为空');
    if (!config.questionTypes) throw new Error('题目类型配置缺失');
    
    this.abortController = new AbortController();
    const startTime = Date.now();   // 仍然可以统计耗时

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

      console.log('发送AI请求:', { url, requestData });

      const response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Accept': 'text/event-stream' },
        body: JSON.stringify(requestData),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API调用失败:', { status: response.status, statusText: response.statusText, errorText });
        throw new Error(`API调用失败 (${response.status}): ${response.statusText}`);
      }

      const startTime = Date.now();
      for await (const update of this.parseStreamResponse(response)) {
        yield update;
        if (update.type === 'completed') break;
      }

      // 获取完整响应确保数据完整性
      const finalResponse = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...requestData, stream: false }),
        signal: this.abortController.signal
      });

      if (finalResponse.ok) {
        const finalData = await finalResponse.json();
        const fullContent = finalData.choices?.[0]?.message?.content || '';
        console.log('完整AI响应:', fullContent);
        
        const result = this.parseAIResponse(fullContent);
        result.metadata!.generationTime = Date.now() - startTime;
        return result;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('AI生成失败:', error);
      
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