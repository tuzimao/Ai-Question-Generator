// frontend/src/types/generator.ts

import { QuestionType, Difficulty, Question } from './question';

/**
 * 题目生成方式枚举
 */
export enum GenerationMode {
  TEXT_DESCRIPTION = 'text_description',  // 文字描述生成
  FILE_UPLOAD = 'file_upload',            // 文件上传生成
  IMAGE_IMPORT = 'image_import',           // 图片导入题目 (新增)
  MANUAL_CREATE = 'manual_create'         // 手动创建
}

/**
 * 题目生成状态枚举
 */
export enum GenerationStatus {
  IDLE = 'idle',                          // 空闲状态
  CONFIGURING = 'configuring',            // 配置中
  GENERATING = 'generating',               // 生成中
  GENERATED = 'generated',                 // 已生成
  EDITING = 'editing',                     // 编辑中
  PREVIEWING = 'previewing',               // 预览中
  SAVING = 'saving',                       // 保存中
  COMPLETED = 'completed'                  // 已完成
}

/**
 * 文件上传接口
 */
export interface UploadedFile {
  id: string;                             // 文件唯一标识
  name: string;                           // 文件名
  size: number;                           // 文件大小（字节）
  type: string;                           // 文件类型
  url?: string;                           // 文件URL（可选）
  content?: string;                       // 解析后的文本内容
  uploadProgress: number;                 // 上传进度 (0-100)
  status: 'uploading' | 'completed' | 'error'; // 上传状态
  error?: string;                         // 错误信息
}

/**
 * 题目生成配置接口
 * 扩展原有配置，增加更多选项
 */
export interface GenerationConfig {
  mode: GenerationMode;                   // 生成方式
  
  // 基础配置 (改为可选)
  subject?: string;                       // 科目 (可选)
  grade?: string;                         // 年级 (可选)
  textbook?: string;                      // 教材 (可选)
  
  // 生成要求
  description: string;                    // 文字描述或要求
  uploadedFiles: UploadedFile[];          // 上传的文件列表
  uploadedImages: UploadedFile[];         // 上传的图片列表 (新增)
  
  // 题目配置 (手动创建模式下可选)
  questionTypes: {                        // 各类题目配置
    [QuestionType.SINGLE_CHOICE]: {
      count: number;                      // 数量
      difficulty: Difficulty;             // 难度
      enabled: boolean;                   // 是否启用
    };
    [QuestionType.MULTIPLE_CHOICE]: {
      count: number;
      difficulty: Difficulty;
      enabled: boolean;
    };
    [QuestionType.TRUE_FALSE]: {
      count: number;
      difficulty: Difficulty;
      enabled: boolean;
    };
    [QuestionType.SHORT_ANSWER]: {
      count: number;
      difficulty: Difficulty;
      enabled: boolean;
    };
  };
  
  // 高级选项
  includeExplanation: boolean;            // 是否包含解析
  autoGenerateKnowledgePoints: boolean;   // 是否自动生成知识点
  customPrompt?: string;                  // 自定义提示词
  
  // 图片识别选项 (新增)
  ocrSettings?: {
    language: 'zh' | 'en' | 'auto';      // 识别语言
    enhanceImage: boolean;                // 是否增强图片质量
    detectTables: boolean;                // 是否识别表格
    detectFormulas: boolean;              // 是否识别数学公式
  };
}

/**
 * 题目生成进度接口
 */
export interface GenerationProgress {
  stage: string;                          // 当前阶段描述
  percentage: number;                     // 完成百分比 (0-100)
  currentStep: number;                    // 当前步骤
  totalSteps: number;                     // 总步骤数
  estimatedTimeRemaining?: number;        // 预计剩余时间（秒）
  message?: string;                       // 进度消息
}

/**
 * 题目生成结果接口
 */
export interface GenerationResult {
  questions: Question[];                  // 生成的题目列表
  totalCount: number;                     // 总题目数
  generationTime: number;                 // 生成耗时（毫秒）
  usedTokens?: number;                    // 使用的AI tokens（可选）
  warnings?: string[];                    // 警告信息
  suggestions?: string[];                 // 建议信息
}

/**
 * 题目编辑状态接口
 */
export interface QuestionEditState {
  questionId: string;                     // 编辑的题目ID
  isEditing: boolean;                     // 是否正在编辑
  hasChanges: boolean;                    // 是否有未保存的更改
  originalQuestion: Question;             // 原始题目数据
  currentQuestion: Question;              // 当前编辑的题目数据
}

/**
 * 预览模式配置接口
 */
export interface PreviewConfig {
  showAnswers: boolean;                   // 是否显示答案
  showExplanations: boolean;              // 是否显示解析
  showKnowledgePoints: boolean;           // 是否显示知识点
  shuffleQuestions: boolean;              // 是否打乱题目顺序
  shuffleOptions: boolean;                // 是否打乱选项顺序
  timeLimit?: number;                     // 时间限制（分钟，可选）
}

/**
 * 用户答题记录接口
 */
export interface UserAnswerRecord {
  questionId: string;                     // 题目ID
  userAnswer: string | string[];          // 用户答案
  isCorrect?: boolean;                    // 是否正确
  timeSpent: number;                      // 答题用时（秒）
  attempts: number;                       // 尝试次数
}

/**
 * 题目生成器状态接口
 * 用于全局状态管理
 */
export interface GeneratorState {
  // 基础状态
  status: GenerationStatus;               // 当前状态
  config: GenerationConfig;               // 生成配置
  
  // 生成相关
  progress: GenerationProgress | null;    // 生成进度
  result: GenerationResult | null;        // 生成结果
  error: string | null;                   // 错误信息
  
  // 编辑相关
  editState: QuestionEditState | null;    // 编辑状态
  selectedQuestionId: string | null;      // 当前选中的题目ID
  
  // 预览相关
  previewConfig: PreviewConfig;           // 预览配置
  userAnswers: UserAnswerRecord[];        // 用户答题记录
  isPreviewMode: boolean;                 // 是否处于预览模式
  
  // 保存相关
  isSaved: boolean;                       // 是否已保存
  lastSavedAt: Date | null;               // 最后保存时间
  autoSaveEnabled: boolean;               // 是否启用自动保存
}

/**
 * API 请求接口
 */
export interface GenerateQuestionsRequest {
  config: GenerationConfig;               // 生成配置
  sessionId?: string;                     // 会话ID（用于续传）
}

/**
 * API 响应接口
 */
export interface GenerateQuestionsResponse {
  success: boolean;                       // 是否成功
  data?: GenerationResult;                // 生成结果
  error?: string;                         // 错误信息
  sessionId: string;                      // 会话ID
}

/**
 * 文件上传响应接口
 */
export interface FileUploadResponse {
  success: boolean;                       // 是否成功
  fileId: string;                         // 文件ID
  fileName: string;                       // 文件名
  content: string;                        // 解析后的文本内容
  metadata?: {                            // 元数据
    pageCount?: number;                   // 页数（PDF）
    wordCount?: number;                   // 字数
    language?: string;                    // 语言
  };
  error?: string;                         // 错误信息
}

/**
 * 保存题目请求接口
 */
export interface SaveQuestionsRequest {
  questions: Question[];                  // 题目列表
  metadata: {                             // 元数据
    title: string;                        // 题目集标题
    description?: string;                 // 描述
    subject: string;                      // 科目
    grade: string;                        // 年级
    tags?: string[];                      // 标签
  };
}

/**
 * 默认生成配置
 */
export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  mode: GenerationMode.TEXT_DESCRIPTION,
  subject: undefined,                     // 改为可选
  grade: undefined,                       // 改为可选
  description: '',
  uploadedFiles: [],
  uploadedImages: [],                     // 新增
  questionTypes: {
    [QuestionType.SINGLE_CHOICE]: {
      count: 5,
      difficulty: Difficulty.MEDIUM,
      enabled: true
    },
    [QuestionType.MULTIPLE_CHOICE]: {
      count: 3,
      difficulty: Difficulty.MEDIUM,
      enabled: true
    },
    [QuestionType.TRUE_FALSE]: {
      count: 2,
      difficulty: Difficulty.EASY,
      enabled: true
    },
    [QuestionType.SHORT_ANSWER]: {
      count: 2,
      difficulty: Difficulty.HARD,
      enabled: true
    }
  },
  includeExplanation: true,
  autoGenerateKnowledgePoints: true,
  ocrSettings: {                          // 新增默认OCR设置
    language: 'auto',
    enhanceImage: true,
    detectTables: true,
    detectFormulas: true
  }
};

/**
 * 默认预览配置
 */
export const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  showAnswers: false,
  showExplanations: false,
  showKnowledgePoints: true,
  shuffleQuestions: false,
  shuffleOptions: false
};