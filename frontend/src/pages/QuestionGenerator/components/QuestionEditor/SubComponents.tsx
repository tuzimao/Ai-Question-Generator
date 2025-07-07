// frontend/src/pages/QuestionGenerator/components/QuestionEditor/SubComponents.tsx

import React from 'react';
import { TextField, Box, Typography, Button } from '@mui/material';

/**
 * ContentEditor组件的Props接口
 */
interface ContentEditorProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}

/**
 * 内容编辑器组件
 * 提供富文本编辑功能，目前使用增强的文本框
 * 未来可以扩展为完整的富文本编辑器（如TinyMCE、Quill等）
 */
export const ContentEditor: React.FC<ContentEditorProps> = ({
  content,
  onChange,
  disabled = false,
  placeholder = '请输入内容...',
  rows = 6
}) => {
  // 计算行数（最小为指定行数）
  const lineCount = content.split('\n').length;
  const calculatedRows = Math.max(rows, Math.min(lineCount + 1, 15)); // 最多15行

  return (
    <Box>
      {/* 主编辑器 */}
      <TextField
        fullWidth
        multiline
        rows={calculatedRows}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': {
            minHeight: rows * 24 + 32, // 计算最小高度
            alignItems: 'flex-start',
            '& textarea': {
              resize: 'vertical' // 允许垂直调整大小
            }
          },
          '& .MuiInputBase-input': {
            lineHeight: 1.5,
            fontFamily: 'monospace', // 使用等宽字体便于编辑
            fontSize: '0.9rem'
          }
        }}
        inputProps={{
          style: {
            resize: 'vertical'
          }
        }}
      />
      
      {/* 编辑工具栏和统计信息 */}
      <Box sx={{ 
        mt: 1, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1
      }}>
        {/* 左侧：编辑提示 */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            支持Markdown格式
          </Typography>
          {content.includes('\n') && (
            <Typography variant="caption" color="text.secondary">
              行数: {lineCount}
            </Typography>
          )}
        </Box>
        
        {/* 右侧：字数统计 */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            字数: {content.length}
          </Typography>
          {content.length > 500 && (
            <Typography variant="caption" color="warning.main">
              内容较长
            </Typography>
          )}
        </Box>
      </Box>

      {/* 快捷工具提示 */}
      {!disabled && content.length === 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            💡 提示：支持**粗体**、*斜体*、`代码`、数学公式$x^2$等Markdown语法
          </Typography>
        </Box>
      )}

      {/* 常用格式化按钮（未来扩展） */}
      {!disabled && content.length > 0 && (
        <Box sx={{ mt: 1, display: 'none' }}> {/* 暂时隐藏，未来扩展 */}
          {/* 可以添加格式化按钮，如加粗、斜体、插入公式等 */}
        </Box>
      )}
    </Box>
  );
};

/**
 * 公式编辑器组件（预留）
 * 用于编辑数学公式
 */
interface FormulaEditorProps {
  formula: string;
  onChange: (formula: string) => void;
  disabled?: boolean;
}

export const FormulaEditor: React.FC<FormulaEditorProps> = ({
  formula,
  onChange,
  disabled = false
}) => {
  return (
    <Box>
      <TextField
        fullWidth
        value={formula}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="请输入LaTeX格式的数学公式，如：x^2 + y^2 = r^2"
        variant="outlined"
        sx={{
          '& .MuiInputBase-input': {
            fontFamily: 'monospace',
            fontSize: '0.9rem'
          }
        }}
      />
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        使用LaTeX语法：^{}上标、_{}下标、\frac{}{}分数、\sqrt{}开方
      </Typography>
      
      {/* 公式预览区域（未来可以添加MathJax渲染） */}
      {formula && (
        <Box sx={{ 
          mt: 1, 
          p: 2, 
          bgcolor: 'action.hover', 
          borderRadius: 1,
          border: 1,
          borderColor: 'divider'
        }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            预览：
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontFamily: 'serif',
              fontStyle: 'italic'
            }}
          >
            {formula}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

/**
 * 图片上传组件（预留）
 * 用于上传和管理题目中的图片
 */
interface ImageUploaderProps {
  images: string[];
  onImageAdd: (imageUrl: string) => void;
  onImageRemove: (index: number) => void;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onImageAdd,
  onImageRemove,
  disabled = false
}) => {
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 这里应该实现实际的图片上传逻辑
      const imageUrl = URL.createObjectURL(file);
      onImageAdd(imageUrl);
    }
  };

  return (
    <Box>
      <input
        accept="image/*"
        style={{ display: 'none' }}
        id="image-upload"
        type="file"
        onChange={handleFileSelect}
        disabled={disabled}
      />
      <label htmlFor="image-upload">
        <Button 
          variant="outlined" 
          component="span"
          disabled={disabled}
          size="small"
        >
          添加图片
        </Button>
      </label>
      
      {/* 图片列表 */}
      {images.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {images.map((image, index) => (
            <Box key={index} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <img 
                src={image} 
                alt={`图片 ${index + 1}`}
                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                图片 {index + 1}
              </Typography>
              <Button
                size="small"
                color="error"
                onClick={() => onImageRemove(index)}
                disabled={disabled}
              >
                删除
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};