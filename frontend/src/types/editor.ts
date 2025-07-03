// frontend/src/types/editor.ts

import { Question } from './question';

/**
 * 编辑状态接口
 * 跟踪题目的编辑和验证状态
 */
export interface EditState {
  isModified: boolean;        // 是否被修改过
  isValid: boolean;           // 是否通过验证
  lastModified: Date;         // 最后修改时间
  validationErrors: string[]; // 验证错误列表
  hasUnsavedChanges: boolean; // 是否有未保存的更改
}

/**
 * 可编辑的题目接口
 * 扩展原Question接口，添加编辑相关信息
 */
export interface EditableQuestion extends Question {
  editState: EditState;
  tempData?: Partial<Question>; // 临时编辑数据，用于实时编辑但未确认保存的状态
}

/**
 * 题目编辑器状态接口
 * 管理整个编辑器的状态
 */
export interface QuestionEditorState {
  questions: EditableQuestion[];      // 所有题目列表
  selectedQuestionId: string | null;  // 当前选中的题目ID
  searchQuery: string;                // 搜索关键词
  filterOptions: {                    // 过滤选项
    types: string[];                  // 按题型过滤
    difficulties: string[];           // 按难度过滤
    tags: string[];                   // 按标签过滤
    modifiedOnly: boolean;            // 只显示已修改的题目
  };
  bulkSelectedIds: string[];          // 批量选中的题目ID列表
  autoSaveEnabled: boolean;           // 是否启用自动保存
  hasUnsavedChanges: boolean;         // 整体是否有未保存的更改
  lastSavedAt: Date | null;           // 最后保存时间
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * 验证错误接口
 */
export interface ValidationError {
  field: string;        // 错误字段
  message: string;      // 错误信息
  severity: 'error' | 'warning'; // 错误级别
}

/**
 * 标签操作类型
 */
export type TagOperation = 'add' | 'remove' | 'update';

/**
 * 编辑器操作类型
 */
export type EditorAction = 
  | 'select_question'
  | 'edit_content' 
  | 'edit_options'
  | 'edit_answer'
  | 'edit_explanation'
  | 'manage_tags'
  | 'delete_question'
  | 'duplicate_question'
  | 'save_changes'
  | 'discard_changes';

/**
 * 编辑器事件接口
 * 用于组件间通信
 */
export interface EditorEvent {
  type: EditorAction;
  questionId: string;
  data?: any;
  timestamp: Date;
}

/**
 * 自动保存配置接口
 */
export interface AutoSaveConfig {
  enabled: boolean;
  interval: number;     // 自动保存间隔（毫秒）
  maxBackups: number;   // 最大备份数量
}

/**
 * 题目编辑器配置接口
 */
export interface QuestionEditorConfig {
  autoSave: AutoSaveConfig;
  validation: {
    realTime: boolean;            // 是否实时验证
    strict: boolean;              // 是否严格验证
  };
  ui: {
    showLineNumbers: boolean;     // 是否显示行号
    showWordCount: boolean;       // 是否显示字数统计
    autoFocus: boolean;           // 是否自动聚焦
  };
}

/**
 * 导出选项接口
 * 为未来的PreviewMode和导出功能预留
 */
export interface ExportOptions {
  format: 'json' | 'pdf' | 'word' | 'html';
  includeAnswers: boolean;
  includeExplanations: boolean;
  includeMetadata: boolean;
  questionNumbers: boolean;
  pageBreaks: boolean;
}

/**
 * 预览配置接口
 * 为PreviewMode组件预留的接口
 */
export interface PreviewModeConfig {
  layout: 'single' | 'multiple';   // 单题显示还是多题显示
  showProgress: boolean;           // 是否显示进度
  showTimer: boolean;              // 是否显示计时器
  allowNavigation: boolean;        // 是否允许跳题
  showQuestionNumbers: boolean;    // 是否显示题号
  randomOrder: boolean;            // 是否随机顺序
}

/**
 * 默认编辑器配置
 */
export const DEFAULT_EDITOR_CONFIG: QuestionEditorConfig = {
  autoSave: {
    enabled: true,
    interval: 2000,    // 2秒自动保存
    maxBackups: 10
  },
  validation: {
    realTime: true,
    strict: false
  },
  ui: {
    showLineNumbers: false,
    showWordCount: true,
    autoFocus: true
  }
};

/**
 * 题目类型显示配置
 */
export const QUESTION_TYPE_LABELS = {
  'single_choice': '单选题',
  'multiple_choice': '多选题', 
  'true_false': '判断题',
  'short_answer': '简答题'
} as const;

/**
 * 难度级别显示配置
 */
export const DIFFICULTY_LABELS = {
  'easy': '简单',
  'medium': '中等',
  'hard': '困难'
} as const;

/**
 * 常用标签库
 * 供AI生成和用户选择使用
 */
export const COMMON_TAGS = [
  // 学科标签
  '数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治',
  
  // 技术标签  
  'JavaScript', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'C++',
  'HTML', 'CSS', '数据库', '算法', '数据结构', '操作系统', '计算机网络',
  
  // 数学细分
  '代数', '几何', '三角函数', '微积分', '概率统计', '线性代数',
  
  // 通用概念
  '基础概念', '应用题', '计算题', '理解题', '分析题', '综合题',
  '记忆型', '理解型', '应用型', '分析型', '综合型', '评价型'
] as const;