// frontend/src/pages/QuestionGenerator/components/index.tsx

/**
 * 题目生成器组件统一导出
 * 便于其他模块导入使用
 */

export { GenerationModeSelector } from './GenerationModeSelector';
export { ConfigurationPanel } from './ConfigurationPanel';
export { FileUploadZone } from './FileUploadZone';
export { ImageUploadZone } from './ImageUploadZone';
export { QuestionTypeConfig } from './QuestionTypeConfig';
export { GenerationProgress } from './GenerationProgress';

// 导出QuestionEditor相关组件
export { QuestionEditor } from './QuestionEditor/QuestionEditor';

// 临时占位组件导出 - PreviewMode还未实现
export const PreviewMode = (props: any) => <div>预览模式组件 - 待实现</div>;// frontend/src/pages/QuestionGenerator/components/QuestionEditor/index.ts

/**
 * QuestionEditor 组件统一导出
 * 便于其他模块导入使用
 */
export { QuestionList } from './QuestionEditor/QuestionList';
export { DetailEditor } from './QuestionEditor/DetailEditor';
export { ContentEditor } from './QuestionEditor/SubComponents';
export { OptionEditor } from './QuestionEditor/OptionEditor';
export { SearchAndFilter } from './QuestionEditor/SearchAndFilter';
export { TagManager } from './QuestionEditor/TagManager';

// 导出Hook
export { useQuestionEditor } from '@/hooks/useQuestionEditor';

// 导出类型定义
export type {
  EditableQuestion,
  QuestionEditorState,
  ValidationResult,
  ValidationError,
  EditorAction,
  QuestionEditorConfig
} from '@/types/editor';