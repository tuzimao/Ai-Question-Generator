// frontend/src/types/question.ts (更新版本)

/**
 * 题目类型枚举
 * 支持四种不同的题目类型
 */
export enum QuestionType {
  SINGLE_CHOICE = 'single_choice',    // 单选题
  MULTIPLE_CHOICE = 'multiple_choice', // 多选题
  TRUE_FALSE = 'true_false',          // 判断题
  SHORT_ANSWER = 'short_answer'       // 简答题
}

/**
 * 题目难度枚举
 */
export enum Difficulty {
  EASY = 'easy',       // 简单
  MEDIUM = 'medium',   // 中等
  HARD = 'hard'        // 困难
}

/**
 * 题目选项接口
 * 用于单选题和多选题的选项
 */
export interface QuestionOption {
  id: string;          // 选项唯一标识 (A, B, C, D)
  text: string;        // 选项文本内容
  isCorrect: boolean;  // 是否为正确答案
}

/**
 * 内容接口
 * 支持富文本和格式化内容
 */
export interface QuestionContent {
  title: string;       // 主要内容
  format: 'text' | 'markdown' | 'html'; // 内容格式
  images?: string[];   // 关联的图片URL（可选）
  attachments?: string[]; // 附件URL（可选）
}

/**
 * 解析接口
 * 支持详细的答案解析
 */
export interface QuestionExplanation {
  text: string;        // 解析内容
  format: 'text' | 'markdown' | 'html'; // 内容格式
  steps?: string[];    // 解题步骤（可选）
  references?: string[]; // 参考资料（可选）
}

/**
 * 题目基础接口（更新版本）
 * 定义所有题目类型的通用字段
 */
export interface Question {
  id: string;                           // 题目唯一标识
  type: QuestionType;                   // 题目类型
  difficulty: Difficulty;               // 难度等级
  
  // ✅ 更新：使用结构化内容格式
  content: QuestionContent;             // 题目内容
  options?: QuestionOption[];           // 选项（选择题使用）
  correctAnswer: string | string[];     // 正确答案
  explanation?: QuestionExplanation;    // 答案解析（可选）
  
  // ✅ 更新：支持多个知识点
  knowledgePoints?: string[];           // 知识点列表（可选）
  tags?: string[];                      // 标签（可选）
  
  // 分值和时间
  score: number;                        // 分值
  estimatedTime?: number;               // 预计答题时间（秒）
  
  // 元数据
  createdAt: Date;                      // 创建时间
  updatedAt: Date;                      // 更新时间
  creatorId: string;                    // 创建者ID
  
  // 扩展字段（可选）
  category?: string;                    // 分类
  subject?: string;                     // 科目
  grade?: string;                       // 年级
  textbook?: string;                    // 教材
  chapter?: string;                     // 章节
}

/**
 * 题目生成配置接口
 * 用于配置AI生成题目的参数
 */
export interface QuestionGenerationConfig {
  subject: string;              // 科目
  grade: string;               // 年级
  textbook: string;            // 教材
  requirements: string;         // 生成要求
  questionCounts: {            // 各类题目数量
    [QuestionType.SINGLE_CHOICE]: number;
    [QuestionType.MULTIPLE_CHOICE]: number;
    [QuestionType.TRUE_FALSE]: number;
    [QuestionType.SHORT_ANSWER]: number;
  };
  difficulties: {              // 各类题目难度
    [QuestionType.SINGLE_CHOICE]: Difficulty;
    [QuestionType.MULTIPLE_CHOICE]: Difficulty;
    [QuestionType.TRUE_FALSE]: Difficulty;
    [QuestionType.SHORT_ANSWER]: Difficulty;
  };
}

/**
 * 学生答案接口
 * 记录学生对某道题的答案
 */
export interface StudentAnswer {
  questionId: string;          // 题目ID
  answer: string | string[];   // 学生答案
  isCorrect?: boolean;         // 是否正确（批改后填入）
  timeSpent?: number;          // 答题用时（秒）
  submittedAt: Date;           // 提交时间
}

/**
 * 练习记录接口
 * 记录一次完整的练习过程
 */
export interface ExerciseRecord {
  id: string;                  // 练习记录ID
  studentId: string;           // 学生ID
  questions: Question[];       // 题目列表
  answers: StudentAnswer[];    // 学生答案列表
  score?: number;              // 总分
  totalScore: number;          // 满分
  startTime: Date;             // 开始时间
  endTime?: Date;              // 结束时间
  isCompleted: boolean;        // 是否完成
  metadata?: {                 // 元数据
    title?: string;            // 练习标题
    description?: string;      // 练习描述
    timeLimit?: number;        // 时间限制（分钟）
    allowReview?: boolean;     // 是否允许回顾
  };
}

/**
 * 题目统计接口
 * 用于统计题目的各种信息
 */
export interface QuestionStatistics {
  totalQuestions: number;                          // 总题目数
  byType: Record<QuestionType, number>;            // 按类型统计
  byDifficulty: Record<Difficulty, number>;        // 按难度统计
  averageScore: number;                            // 平均分值
  averageTime: number;                             // 平均答题时间
  mostUsedTags: Array<{ tag: string; count: number }>; // 最常用标签
}

/**
 * 题目验证规则接口
 */
export interface QuestionValidationRule {
  field: keyof Question;       // 验证字段
  required: boolean;           // 是否必需
  minLength?: number;          // 最小长度
  maxLength?: number;          // 最大长度
  pattern?: RegExp;            // 正则表达式
  customValidator?: (value: any) => string | null; // 自定义验证器
}

/**
 * 默认题目验证规则
 */
export const DEFAULT_VALIDATION_RULES: QuestionValidationRule[] = [
  {
    field: 'content',
    required: true,
    minLength: 5,
    maxLength: 1000
  },
  {
    field: 'type',
    required: true
  },
  {
    field: 'difficulty',
    required: true
  },
  {
    field: 'correctAnswer',
    required: true
  },
  {
    field: 'score',
    required: true,
    customValidator: (value: number) => {
      if (value < 1 || value > 100) {
        return '分值必须在1-100之间';
      }
      return null;
    }
  }
];

/**
 * 创建默认题目的工厂函数
 */
export const createDefaultQuestion = (type: QuestionType = QuestionType.SINGLE_CHOICE): Question => {
  const baseQuestion: Question = {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    difficulty: Difficulty.MEDIUM,
    content: {
      title: '',
      format: 'markdown'
    },
    correctAnswer: type === QuestionType.MULTIPLE_CHOICE ? [] : '',
    score: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    creatorId: 'user'
  };

  // 根据题目类型设置默认选项
  switch (type) {
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.MULTIPLE_CHOICE:
      baseQuestion.options = [
        { id: 'A', text: '', isCorrect: false },
        { id: 'B', text: '', isCorrect: false },
        { id: 'C', text: '', isCorrect: false },
        { id: 'D', text: '', isCorrect: false }
      ];
      break;
    
    case QuestionType.TRUE_FALSE:
      baseQuestion.options = [
        { id: 'true', text: '正确', isCorrect: false },
        { id: 'false', text: '错误', isCorrect: false }
      ];
      break;
    
    case QuestionType.SHORT_ANSWER:
      baseQuestion.options = [];
      break;
  }

  return baseQuestion;
};

/**
 * 题目类型显示名称映射
 */
export const QUESTION_TYPE_NAMES: Record<QuestionType, string> = {
  [QuestionType.SINGLE_CHOICE]: '单选题',
  [QuestionType.MULTIPLE_CHOICE]: '多选题',
  [QuestionType.TRUE_FALSE]: '判断题',
  [QuestionType.SHORT_ANSWER]: '简答题'
};

/**
 * 难度级别显示名称映射
 */
export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  [Difficulty.EASY]: '简单',
  [Difficulty.MEDIUM]: '中等',
  [Difficulty.HARD]: '困难'
};