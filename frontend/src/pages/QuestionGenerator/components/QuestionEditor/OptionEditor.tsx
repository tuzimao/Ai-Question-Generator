// frontend/src/pages/QuestionGenerator/components/QuestionEditor/OptionEditor.tsx

import React from 'react';
import {
  Box,
  TextField,
  IconButton,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Typography,
  Button,
  Divider
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { QuestionType } from '@/types/question';

/**
 * 选项接口
 */
interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

/**
 * OptionEditor组件的Props接口
 */
interface OptionEditorProps {
  type: QuestionType;
  options: Option[];
  correctAnswer: string | string[];
  onChange: (options: Option[], correctAnswer: string | string[]) => void;
  disabled?: boolean;
}

/**
 * 选项编辑器组件
 * 根据题目类型提供相应的选项编辑功能
 */
export const OptionEditor: React.FC<OptionEditorProps> = ({
  type,
  options,
  correctAnswer,
  onChange,
  disabled = false
}) => {
  /**
   * 添加新选项
   */
  const addOption = () => {
    const newId = String.fromCharCode(65 + options.length); // A, B, C, D...
    const newOptions = [...options, { id: newId, text: '', isCorrect: false }];
    onChange(newOptions, correctAnswer);
  };

  /**
   * 删除选项
   */
  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    // 重新分配ID
    const reindexedOptions = newOptions.map((option, i) => ({
      ...option,
      id: String.fromCharCode(65 + i)
    }));
    
    // 更新正确答案
    let newCorrectAnswer = correctAnswer;
    if (type === QuestionType.SINGLE_CHOICE) {
      if (correctAnswer === options[index].id) {
        newCorrectAnswer = '';
      }
    } else if (type === QuestionType.MULTIPLE_CHOICE && Array.isArray(correctAnswer)) {
      newCorrectAnswer = correctAnswer.filter(ans => ans !== options[index].id);
    }
    
    onChange(reindexedOptions, newCorrectAnswer);
  };

  /**
   * 更新选项文本
   */
  const updateOptionText = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], text };
    onChange(newOptions, correctAnswer);
  };

  /**
   * 处理单选题答案选择
   */
  const handleSingleChoiceAnswer = (optionId: string) => {
    onChange(options, optionId);
  };

  /**
   * 处理多选题答案选择
   */
  const handleMultipleChoiceAnswer = (optionId: string, checked: boolean) => {
    const currentAnswers = Array.isArray(correctAnswer) ? correctAnswer : [];
    let newAnswers;
    
    if (checked) {
      newAnswers = [...currentAnswers, optionId];
    } else {
      newAnswers = currentAnswers.filter(id => id !== optionId);
    }
    
    onChange(options, newAnswers);
  };

  /**
   * 判断题特殊处理
   */
  if (type === QuestionType.TRUE_FALSE) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          请选择正确答案：
        </Typography>
        <RadioGroup
          value={correctAnswer || ''}
          onChange={(e) => onChange(options, e.target.value)}
        >
          <FormControlLabel
            value="true"
            control={<Radio disabled={disabled} />}
            label="正确"
          />
          <FormControlLabel
            value="false"
            control={<Radio disabled={disabled} />}
            label="错误"
          />
        </RadioGroup>
      </Box>
    );
  }

  return (
    <Box>
      {/* 选项列表 */}
      {options.map((option, index) => (
        <Box key={option.id} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {/* 答案选择器 */}
          <Box sx={{ width: 60, display: 'flex', alignItems: 'center' }}>
            <Typography variant="body1" fontWeight="medium" sx={{ mr: 1 }}>
              {option.id}.
            </Typography>
            
            {type === QuestionType.SINGLE_CHOICE ? (
              <Radio
                checked={correctAnswer === option.id}
                onChange={() => handleSingleChoiceAnswer(option.id)}
                disabled={disabled}
                size="small"
              />
            ) : (
              <Checkbox
                checked={Array.isArray(correctAnswer) && correctAnswer.includes(option.id)}
                onChange={(e) => handleMultipleChoiceAnswer(option.id, e.target.checked)}
                disabled={disabled}
                size="small"
              />
            )}
          </Box>

          {/* 选项文本输入 */}
          <TextField
            fullWidth
            size="small"
            value={option.text}
            onChange={(e) => updateOptionText(index, e.target.value)}
            disabled={disabled}
            placeholder={`选项 ${option.id}`}
            sx={{ mr: 1 }}
          />

          {/* 删除按钮 */}
          <IconButton
            onClick={() => removeOption(index)}
            disabled={disabled || options.length <= 2}
            size="small"
            color="error"
          >
            <Delete />
          </IconButton>
        </Box>
      ))}

      {/* 添加选项按钮 */}
      <Button
        startIcon={<Add />}
        onClick={addOption}
        disabled={disabled || options.length >= 8}
        variant="outlined"
        size="small"
        sx={{ mt: 1 }}
      >
        添加选项
      </Button>

      {/* 说明文字 */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        {type === QuestionType.SINGLE_CHOICE && '单选题：选择一个正确答案'}
        {type === QuestionType.MULTIPLE_CHOICE && '多选题：可以选择多个正确答案'}
      </Typography>
    </Box>
  );
};

// ================================================================================================
