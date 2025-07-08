// frontend/src/pages/QuestionGenerator/components/PreviewMode/components/QuestionPreviewList.tsx

import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  Typography,
  Checkbox,
  FormControlLabel,
  Divider,
  Chip,
  Collapse,
  IconButton,
  Paper,
  useTheme,
  alpha
} from '@mui/material';
import {
  RadioButtonChecked,
  CheckBox,
  ToggleOff,
  ShortText,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Cancel,
  Lightbulb,
  School,
  Tag as TagIcon
} from '@mui/icons-material';

import { Question, QuestionType, Difficulty } from '@/types/question';
import { PreviewState } from '../hooks/usePreviewState';

/**
 * QuestionPreviewList组件的Props接口
 */
interface QuestionPreviewListProps {
  questions: Question[];                              // 题目列表
  config: PreviewState;                              // 预览配置
  selectedQuestions: Set<string>;                    // 选中的题目ID集合
  onQuestionSelect: (questionId: string, selected?: boolean) => void; // 题目选择回调
  onSelectAll: () => void;                           // 全选回调
  disabled?: boolean;                                // 是否禁用
}

/**
 * 题目类型配置
 */
const QUESTION_TYPE_CONFIG = {
  [QuestionType.SINGLE_CHOICE]: {
    icon: <RadioButtonChecked />,
    label: '单选题',
    color: 'primary' as const
  },
  [QuestionType.MULTIPLE_CHOICE]: {
    icon: <CheckBox />,
    label: '多选题', 
    color: 'secondary' as const
  },
  [QuestionType.TRUE_FALSE]: {
    icon: <ToggleOff />,
    label: '判断题',
    color: 'success' as const
  },
  [QuestionType.SHORT_ANSWER]: {
    icon: <ShortText />,
    label: '简答题',
    color: 'warning' as const
  }
};

/**
 * 难度配置
 */
const DIFFICULTY_CONFIG = {
  [Difficulty.EASY]: { label: '简单', color: 'success' as const },
  [Difficulty.MEDIUM]: { label: '中等', color: 'warning' as const },
  [Difficulty.HARD]: { label: '困难', color: 'error' as const }
};

/**
 * 单个题目卡片组件
 */
interface QuestionPreviewCardProps {
  question: Question;
  index: number;
  config: PreviewState;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  disabled?: boolean;
}

const QuestionPreviewCard: React.FC<QuestionPreviewCardProps> = ({
  question,
  index,
  config,
  isSelected,
  onSelect,
  disabled = false
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(config.expandAll || false);
  
  const typeConfig = QUESTION_TYPE_CONFIG[question.type];
  const difficultyConfig = DIFFICULTY_CONFIG[question.difficulty];

  /**
   * 渲染题目选项
   */
  const renderOptions = () => {
    if (!question.options || question.options.length === 0) return null;

    return (
      <Box sx={{ mt: 2, ml: 2 }}>
        {question.options.map((option) => (
          <Box key={option.id} sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              minWidth: 60,
              mr: 1
            }}>
              {/* 选项标识 */}
              <Typography 
                variant="body2" 
                fontWeight="medium"
                sx={{ mr: 1, minWidth: 20 }}
              >
                {option.id}.
              </Typography>
              
              {/* 正确答案标识 */}
              {config.showAnswers && option.isCorrect && (
                <CheckCircle 
                  color="success" 
                  fontSize="small"
                  sx={{ mr: 1 }}
                />
              )}
            </Box>
            
            {/* 选项内容 */}
            <Typography 
              variant="body2"
              sx={{ 
                flex: 1,
                color: config.showAnswers && option.isCorrect 
                  ? 'success.main' 
                  : 'text.primary',
                fontWeight: config.showAnswers && option.isCorrect 
                  ? 'medium' 
                  : 'normal'
              }}
            >
              {option.text}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  /**
   * 渲染正确答案（非选择题）
   */
  const renderCorrectAnswer = () => {
    if (!config.showAnswers) return null;
    
    if (question.type === QuestionType.SHORT_ANSWER && question.correctAnswer) {
      return (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <CheckCircle color="success" fontSize="small" sx={{ mr: 1 }} />
            <Typography variant="subtitle2" fontWeight="bold" color="success.dark">
              参考答案
            </Typography>
          </Box>
          <Typography variant="body2" color="success.dark">
            {typeof question.correctAnswer === 'string' 
              ? question.correctAnswer 
              : Array.isArray(question.correctAnswer) 
                ? question.correctAnswer.join(', ')
                : ''}
          </Typography>
        </Box>
      );
    }

    return null;
  };

  /**
   * 渲染答案解析
   */
  const renderExplanation = () => {
    if (!config.showExplanations || !question.explanation?.text) return null;

    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Lightbulb color="info" fontSize="small" sx={{ mr: 1 }} />
          <Typography variant="subtitle2" fontWeight="bold" color="info.dark">
            答案解析
          </Typography>
        </Box>
        <Typography variant="body2" color="info.dark">
          {question.explanation.text}
        </Typography>
      </Box>
    );
  };

  /**
   * 渲染知识点和标签
   */
  const renderMetadata = () => {
    const hasKnowledgePoints = config.showKnowledgePoints && question.knowledgePoints && question.knowledgePoints.length > 0;
    const hasTags = question.tags && question.tags.length > 0;
    
    if (!hasKnowledgePoints && !hasTags) return null;

    return (
      <Box sx={{ mt: 2 }}>
        {hasKnowledgePoints && (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <School fontSize="small" color="action" sx={{ mr: 1 }} />
              <Typography variant="caption" color="text.secondary" fontWeight="medium">
                知识点
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {question.knowledgePoints!.map((point, idx) => (
                <Chip
                  key={idx}
                  label={point}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Box>
          </Box>
        )}

        {hasTags && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TagIcon fontSize="small" color="action" sx={{ mr: 1 }} />
              <Typography variant="caption" color="text.secondary" fontWeight="medium">
                标签
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {question.tags!.map((tag, idx) => (
                <Chip
                  key={idx}
                  label={tag}
                  size="small"
                  variant="filled"
                  color="default"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.7rem',
                    backgroundColor: 'action.hover'
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        mb: 2,
        border: 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        backgroundColor: isSelected 
          ? alpha(theme.palette.primary.main, 0.05)
          : 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: 2
        }
      }}
    >
      {/* 题目头部 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        {/* 选择框 */}
        <Checkbox
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
          disabled={disabled}
          color="primary"
        />

        {/* 题目编号和类型 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {config.showQuestionNumbers && (
            <Typography variant="h6" fontWeight="bold" color="primary.main">
              {index + 1}.
            </Typography>
          )}
          
          <Chip
            icon={typeConfig.icon}
            label={typeConfig.label}
            size="small"
            color={typeConfig.color}
            variant="outlined"
          />
          
          <Chip
            label={difficultyConfig.label}
            size="small"
            color={difficultyConfig.color}
            variant="filled"
          />
          
          <Chip
            label={`${question.score || 5}分`}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* 展开/收起按钮 */}
        <Box sx={{ ml: 'auto' }}>
          <IconButton
            onClick={() => setExpanded(!expanded)}
            size="small"
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>

      {/* 题目内容 */}
      <Box sx={{ ml: 5 }}>
        <Typography 
          variant="body1" 
          fontWeight="medium"
          sx={{ mb: 2, lineHeight: 1.6 }}
        >
          {question.content?.title}
        </Typography>

        {/* 可展开的详细内容 */}
        <Collapse in={expanded}>
          <Box>
            {/* 选项 */}
            {renderOptions()}
            
            {/* 正确答案（简答题） */}
            {renderCorrectAnswer()}
            
            {/* 答案解析 */}
            {renderExplanation()}
            
            {/* 知识点和标签 */}
            {renderMetadata()}
            
            {/* 题目统计信息 */}
            {(question.estimatedTime || question.createdAt) && (
              <Box sx={{ 
                mt: 2, 
                pt: 2, 
                borderTop: 1, 
                borderColor: 'divider',
                display: 'flex', 
                gap: 2, 
                flexWrap: 'wrap' 
              }}>
                {question.estimatedTime && (
                  <Typography variant="caption" color="text.secondary">
                    预计用时: {Math.round(question.estimatedTime / 60)}分钟
                  </Typography>
                )}
                {question.createdAt && (
                  <Typography variant="caption" color="text.secondary">
                    创建时间: {question.createdAt.toLocaleDateString()}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
    </Paper>
  );
};

/**
 * 题目预览列表主组件
 */
export const QuestionPreviewList: React.FC<QuestionPreviewListProps> = ({
  questions,
  config,
  selectedQuestions,
  onQuestionSelect,
  onSelectAll,
  disabled = false
}) => {
  const theme = useTheme();
  
  // 是否全选状态
  const isAllSelected = selectedQuestions.size === questions.length && questions.length > 0;
  const isIndeterminate = selectedQuestions.size > 0 && selectedQuestions.size < questions.length;

  return (
    <Box sx={{ p: 3 }}>
      {/* 列表头部 */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 3,
        pb: 2,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={isAllSelected}
              indeterminate={isIndeterminate}
              onChange={onSelectAll}
              disabled={disabled || questions.length === 0}
            />
          }
          label={
            <Typography variant="h6" fontWeight="bold">
              题目列表
            </Typography>
          }
        />
        
        <Typography variant="caption" color="text.secondary">
          共 {questions.length} 道题目
          {selectedQuestions.size > 0 && ` · 已选 ${selectedQuestions.size} 道`}
        </Typography>
      </Box>

      {/* 题目列表 */}
      <List disablePadding>
        {questions.map((question, index) => (
          <ListItem key={question.id} disablePadding sx={{ display: 'block' }}>
            <QuestionPreviewCard
              question={question}
              index={index}
              config={config}
              isSelected={selectedQuestions.has(question.id)}
              onSelect={(selected) => onQuestionSelect(question.id, selected)}
              disabled={disabled}
            />
          </ListItem>
        ))}
      </List>

      {/* 空状态 */}
      {questions.length === 0 && (
        <Box sx={{ 
          py: 6, 
          textAlign: 'center',
          color: 'text.secondary'
        }}>
          <School sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
          <Typography variant="h6" gutterBottom>
            暂无题目
          </Typography>
          <Typography variant="body2">
            请先生成或添加题目
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default QuestionPreviewList;