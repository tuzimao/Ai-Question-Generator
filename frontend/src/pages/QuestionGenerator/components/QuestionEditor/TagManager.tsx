// frontend/src/pages/QuestionGenerator/components/QuestionEditor/TagManager.tsx

import React, { useState } from 'react';
import {
  Box,
  Chip,
  TextField,
  Button,
  Typography,
  Autocomplete,
  Paper
} from '@mui/material';
import { Add, Tag } from '@mui/icons-material';

/**
 * TagManager组件的Props接口
 */
interface TagManagerProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  disabled?: boolean;
  suggestedTags?: readonly string[];
}

/**
 * 标签管理器组件
 * 提供标签的添加、删除和建议功能
 */
export const TagManager: React.FC<TagManagerProps> = ({
  tags,
  onAddTag,
  onRemoveTag,
  disabled = false,
  suggestedTags = []
}) => {
  const [newTag, setNewTag] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  /**
   * 添加标签
   */
  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onAddTag(trimmedTag);
      setNewTag('');
    }
  };

  /**
   * 处理输入框回车
   */
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTag();
    }
  };

  /**
   * 从建议中添加标签
   */
  const handleSuggestedTagClick = (tag: string) => {
    if (!tags.includes(tag)) {
      onAddTag(tag);
    }
  };

  /**
   * 过滤建议标签（排除已有标签）
   */
  const availableSuggestions = suggestedTags.filter(tag => !tags.includes(tag));

  return (
    <Box>
      {/* 现有标签显示 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          当前标签:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {tags.length > 0 ? (
            tags.map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                onDelete={disabled ? undefined : () => onRemoveTag(tag)}
                color="primary"
                variant="outlined"
                size="small"
              />
            ))
          ) : (
            <Typography variant="caption" color="text.secondary">
              暂无标签
            </Typography>
          )}
        </Box>
      </Box>

      {/* 添加新标签 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled}
          placeholder="输入新标签..."
          sx={{ flexGrow: 1 }}
        />
        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={handleAddTag}
          disabled={disabled || !newTag.trim() || tags.includes(newTag.trim())}
          size="small"
        >
          添加
        </Button>
      </Box>

      {/* 建议标签 */}
      {availableSuggestions.length > 0 && (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            建议标签:
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {availableSuggestions.slice(0, 20).map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  onClick={() => handleSuggestedTagClick(tag)}
                  disabled={disabled}
                  variant="outlined"
                  size="small"
                  sx={{ 
                    cursor: disabled ? 'default' : 'pointer',
                    '&:hover': disabled ? {} : {
                      backgroundColor: 'action.hover'
                    }
                  }}
                />
              ))}
            </Box>
          </Paper>
        </Box>
      )}

      {/* 使用提示 */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        标签有助于题目分类和搜索。建议添加学科、知识点、难度等相关标签。
      </Typography>
    </Box>
  );
};

// ================================================================================================
