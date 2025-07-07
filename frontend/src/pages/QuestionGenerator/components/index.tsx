// frontend/src/pages/QuestionGenerator/components/index.tsx (修复后的版本)

/**
 * 题目生成器组件统一导出
 * 修复版本，解决了DetailEditor组件的显示问题
 */

export { GenerationModeSelector } from './GenerationModeSelector';
export { ConfigurationPanel } from './ConfigurationPanel';
export { FileUploadZone } from './FileUploadZone';
export { ImageUploadZone } from './ImageUploadZone';
export { QuestionTypeConfig } from './QuestionTypeConfig';
export { GenerationProgress } from './GenerationProgress';

// ✅ 导出修复后的增强版QuestionEditor（保持向后兼容）
export { QuestionEditor } from './QuestionEditor';

// ✅ 导出QuestionEditor文件夹中的子组件（供高级用户使用）
export { DetailEditor } from './QuestionEditor/DetailEditor';
export { OptionEditor } from './QuestionEditor/OptionEditor';
export { SearchAndFilter } from './QuestionEditor/SearchAndFilter';

// ✅ 导出增强的子组件
export { ContentEditor, FormulaEditor, ImageUploader } from './QuestionEditor/SubComponents';

// ✅ 可选：导出编辑器状态管理Hook（如果需要外部使用）
// export { useQuestionEditorState } from './QuestionEditor/hooks/useQuestionEditorState';

// 临时预览模式组件（保持原有功能）
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
    
    {/* ✅ 调试信息（开发模式下显示） */}
    {process.env.NODE_ENV === 'development' && props.questions && (
      <div style={{ 
        marginTop: '2rem', 
        padding: '1rem', 
        backgroundColor: '#e3f2fd', 
        borderRadius: '4px',
        fontSize: '0.8rem',
        textAlign: 'left'
      }}>
        <strong>🛠️ 开发调试信息：</strong>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          <li>接收到题目数量: {props.questions.length}</li>
          <li>题目类型分布: {
            props.questions.reduce((acc: any, q: any) => {
              acc[q.type] = (acc[q.type] || 0) + 1;
              return acc;
            }, {})
          }</li>
          <li>有效题目: {
            props.questions.filter((q: any) => q.content?.title?.trim()).length
          }</li>
        </ul>
      </div>
    )}
  </div>
);