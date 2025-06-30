// frontend/src/pages/QuestionGenerator/components/index.ts

/**
 * 题目生成器组件统一导出
 * 便于其他模块导入使用
 */

export { GenerationModeSelector } from './GenerationModeSelector';
export { ConfigurationPanel } from './ConfigurationPanel';
export { FileUploadZone } from './FileUploadZone';
export { ImageUploadZone } from './ImageUploadZone';
export { QuestionTypeConfig } from './QuestionTypeConfig';
export { GenerationProgress } from './GenerationProgress';  // 新增

// 临时占位组件导出
// 这些组件将在后续步骤中实现
export const QuestionEditor = (props: any) => <div>题目编辑器组件 - 待实现 (模式: {props.mode})</div>;
export const PreviewMode = () => <div>预览模式组件 - 待实现</div>;