// frontend/src/pages/QuestionGenerator/components/PreviewMode/index.tsx

/**
 * PreviewMode 组件统一导出
 * 简化版预览功能，专注于题目确认和保存
 */

// 主组件
export { PreviewMode as default } from './PreviewMode';

// 子组件
export { QuestionPreviewList } from './components/QuestionPreviewList';
export { PreviewToolbar } from './components/PreviewToolbar';
export { ConfigPanel } from './components/ConfigPanel';
export { ExportDialog } from './components/ExportDialog';
export { SaveToLibraryDialog } from './components/SaveToLibraryDialog';

// Hooks
export { usePreviewState } from './hooks/usePreviewState';
export type { PreviewState } from './hooks/usePreviewState';

// 工具函数
export { ExportUtils, LibraryUtils } from './utils/exportUtils';

// 类型定义
export type { ExportFormat, ExportOptions } from './components/ExportDialog';
export type { SaveToLibraryData } from './components/SaveToLibraryDialog';

/**
 * 使用说明
 * 
 * 主要功能：
 * 1. 📋 题目列表预览 - 清晰展示所有生成的题目
 * 2. ⚙️ 显示配置 - 控制答案、解析、知识点的显示
 * 3. 📤 导出功能 - 支持PDF、JSON、打印等多种格式
 * 4. 💾 保存题库 - 保存题目到本地题库(Mock数据库)
 * 5. 🔄 无缝集成 - 与QuestionGenerator工作流完美配合
 * 
 * 设计特点：
 * - 简洁专注：专注于预览确认，不做过度设计
 * - 快速操作：一键导出、保存，提高工作效率
 * - 灵活配置：可选择显示内容，适应不同使用场景
 * - 向后兼容：完全兼容现有的类型定义和状态管理
 * - 扩展友好：为未来的题库功能预留接口
 * 
 * 使用示例：
 * ```tsx
 * import { PreviewMode } from '@/pages/QuestionGenerator/components/PreviewMode';
 * 
 * <PreviewMode
 *   questions={generatedQuestions}
 *   config={previewConfig}
 *   onConfigUpdate={handleConfigUpdate}
 *   onExitPreview={handleBackToEdit}
 *   onSave={handleSaveComplete}
 * />
 * ```
 * 
 * 技术栈：
 * - React 18 + TypeScript
 * - Material-UI 组件系统
 * - 状态管理通过React Hooks
 * - 导出功能基于浏览器原生API
 * - 本地存储Mock未来的数据库集成
 */