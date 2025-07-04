// frontend/src/pages/QuestionGenerator/components/index.tsx (更新版本)

/**
 * 题目生成器组件统一导出
 */

export { GenerationModeSelector } from './GenerationModeSelector';
export { ConfigurationPanel } from './ConfigurationPanel';
export { FileUploadZone } from './FileUploadZone';
export { ImageUploadZone } from './ImageUploadZone';
export { QuestionTypeConfig } from './QuestionTypeConfig';
export { GenerationProgress } from './GenerationProgress';

// ✅ 重要：导出简化版QuestionEditor（确保这个文件存在）
export { QuestionEditor } from './QuestionEditor';

// 临时预览模式组件
export const PreviewMode = (props: any) => (
  <div style={{ 
    padding: '3rem', 
    textAlign: 'center', 
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    color: '#666' 
  }}>
    <h3>📋 预览模式组件</h3>
    <p>即将实现题目预览和测试功能</p>
    <p>当前题目数量: <strong>{props.questions?.length || 0}</strong></p>
    <div style={{ marginTop: '1rem', color: '#999', fontSize: '0.9rem' }}>
      功能包括：在线答题、计时、结果统计、打印导出等
    </div>
  </div>
);