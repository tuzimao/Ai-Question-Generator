// frontend/src/pages/QuestionGenerator/components/QuestionEditor/SubComponents.tsx

import React from 'react';
import { TextField, Box, Typography } from '@mui/material';

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
 * 目前使用简单的文本框，未来可以扩展为富文本编辑器
 */
export const ContentEditor: React.FC<ContentEditorProps> = ({
  content,
  onChange,
  disabled = false,
  placeholder = '请输入内容...',
  rows = 6
}) => {
  return (
    <Box>
      <TextField
        fullWidth
        multiline
        rows={rows}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': {
            minHeight: rows * 24 + 32 // 计算最小高度
          }
        }}
      />
      
      {/* 字数统计 */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        字数: {content.length}
      </Typography>
    </Box>
  );
};