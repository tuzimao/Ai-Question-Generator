// frontend/src/pages/QuestionGenerator/components/index.ts

/**
 * 题目生成器组件统一导出
 * 便于其他模块导入使用
 */

export { GenerationModeSelector } from './GenerationModeSelector';
export { ConfigurationPanel } from './ConfigurationPanel';
export { FileUploadZone } from './FileUploadZone';
export { QuestionTypeConfig } from './QuestionTypeConfig';

// 临时占位组件导出
// 这些组件将在后续步骤中实现
export const GenerationProgress = () => <div>生成进度组件 - 待实现</div>;
export const QuestionEditor = () => <div>题目编辑器组件 - 待实现</div>;
export const PreviewMode = () => <div>预览模式组件 - 待实现</div>;