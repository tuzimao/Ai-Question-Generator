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

// ✅ 导出完整的PreviewMode组件（主要使用）
export { default as PreviewMode } from './PreviewMode';

// ✅ 兼容性导出 - 确保现有代码可以正常导入
export { default as QuestionPreview } from './PreviewMode';

// 临时预览模式组件（保持原有功能） - 已被新PreviewMode替换
export const LegacyPreviewMode = (props: any) => (
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

/**
 * 使用说明
 * 
 * 修复内容：
 * 1. ✅ 修复了DetailEditor中标签管理、知识点设置、高级设置区域不显示的问题
 * 2. ✅ 修复了展开状态配置，默认展开更多区域便于用户查看
 * 3. ✅ 修复了TagManager组件导入问题，直接在DetailEditor中实现
 * 4. ✅ 修复了回调函数传递问题，确保onAddTag和onRemoveTag正确传递
 * 5. ✅ 增强了ContentEditor组件，提供更好的编辑体验
 * 6. ✅ 更新了Question类型定义，保持与组件期望格式一致
 * 
 * 主要组件：
 * - QuestionEditor: 主编辑器组件，整合了题目列表和详细编辑
 * - DetailEditor: 详细编辑器，提供完整的题目编辑功能
 * - ContentEditor: 内容编辑器，支持富文本和Markdown
 * - OptionEditor: 选项编辑器，处理不同题型的选项配置
 * - TagManager: 标签管理器（内联实现，解决导入问题）
 * 
 * 使用示例：
 * ```tsx
 * import { QuestionEditor } from '@/pages/QuestionGenerator/components';
 * 
 * <QuestionEditor
 *   questions={questions}
 *   onQuestionEdit={handleQuestionEdit}
 *   onPreview={handlePreview}
 *   selectedQuestionId={selectedId}
 *   onQuestionSelect={handleSelect}
 * />
 * ```
 * 
 * 功能特点：
 * - 📝 完整的题目编辑功能（内容、选项、答案、解析）
 * - 🏷️ 标签管理（添加、删除、建议标签）
 * - 🧠 知识点设置
 * - ⚙️ 高级设置（答题时间、分值等）
 * - ✅ 实时验证和错误提示
 * - 💾 自动保存和本地存储
 * - 🔍 搜索和过滤功能
 * - 📊 统计信息展示
 */