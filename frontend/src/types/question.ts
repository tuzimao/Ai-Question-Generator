// frontend/src/types/question.ts

/**
 * 题目类型枚举
 * 支持五种不同的题目类型
 */
export enum QuestionType {
  SINGLE_CHOICE = 'single_choice',    // 单选题
  MULTIPLE_CHOICE = 'multiple_choice', // 多选题
  TRUE_FALSE = 'true_false',          // 判断题
  FILL_BLANK = 'fill_blank',          // 填空题
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
  id: string;          // 选项唯一标识
  text: string;        // 选项文本内容
  isCorrect: boolean;  // 是否为正确答案
}

/**
 * 题目基础接口
 * 定义所有题目类型的通用字段
 */
export interface Question {
  id: string;                    // 题目唯一标识
  type: QuestionType;            // 题目类型
  title: string;                 // 题目标题
  content: string;               // 题目内容/题干
  options?: QuestionOption[];    // 选项（选择题使用）
  correctAnswer: string | string[]; // 正确答案
  explanation: string;           // 答案解析
  knowledgePoint: string;        // 知识点
  difficulty: Difficulty;        // 难度等级
  score: number;                 // 分值
  tags?: string[];              // 标签（可选）
  createdAt: Date;              // 创建时间
  updatedAt: Date;              // 更新时间
  creatorId: string;            // 创建者ID
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
    [QuestionType.FILL_BLANK]: number;
    [QuestionType.SHORT_ANSWER]: number;
  };
  difficulties: {              // 各类题目难度
    [QuestionType.SINGLE_CHOICE]: Difficulty;
    [QuestionType.MULTIPLE_CHOICE]: Difficulty;
    [QuestionType.TRUE_FALSE]: Difficulty;
    [QuestionType.FILL_BLANK]: Difficulty;
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
}