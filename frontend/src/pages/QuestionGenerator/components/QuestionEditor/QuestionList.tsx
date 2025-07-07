// frontend/src/pages/QuestionGenerator/components/QuestionEditor/EnhancedQuestionList.tsx

import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Typography,
  Chip,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Checkbox,
  FormControlLabel,
  alpha,
  useTheme,
  Card,
  CardContent,
  Avatar,
  LinearProgress
} from '@mui/material';
import {
  RadioButtonChecked,
  CheckBox,
  ToggleOff,
  ShortText,
  MoreVert,
  Delete,
  ContentCopy,
  Edit,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  Star,
  StarBorder
} from '@mui/icons-material';

import { Question, QuestionType, Difficulty } from '@/types/question';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from '@/types/editor';

/**
 * 增强版QuestionList组件的Props接口
 */
interface EnhancedQuestionListProps {
  questions: Question[];                      // 题目列表
  selectedQuestionId: string | null;          // 当前选中的题目ID
  selectedQuestions?: string[];               // 批量选中的题目ID列表
  onQuestionSelect: (questionId: string) => void; // 题目选择回调
  onQuestionDelete: (questionId: string) => void; // 题目删除回调
  onQuestionDuplicate: (questionId: string) => void; // 题目复制回调
  onBulkSelect?: (questionIds: string[], selected: boolean) => void; // 批量选择回调
  disabled?: boolean;                         // 是否禁用操作
  showSelection?: boolean;                    // 是否显示选择框
  showPreview?: boolean;                      // 是否显示预览
  onQuestionStar?: (questionId: string, starred: boolean) => void; // 收藏回调
}

/**
 * 获取题目类型对应的图标和颜色
 */
const getQuestionTypeInfo = (type: QuestionType) => {
  const configs = {
    [QuestionType.SINGLE_CHOICE]: {
      icon: <RadioButtonChecked />,
      label: '单选',
      color: 'primary' as const
    },
    [QuestionType.MULTIPLE_CHOICE]: {
      icon: <CheckBox />,
      label: '多选',
      color: 'secondary' as const
    },
    [QuestionType.TRUE_FALSE]: {
      icon: <ToggleOff />,
      label: '判断',
      color: 'success' as const
    },
    [QuestionType.SHORT_ANSWER]: {
      icon: <ShortText />,
      label: '简答',
      color: 'warning' as const
    }
  };
  
  return configs[type] || configs[QuestionType.SINGLE_CHOICE];
};

/**
 * 获取难度对应的颜色
 */
const getDifficultyColor = (difficulty: Difficulty) => {
  const colors = {
    [Difficulty.EASY]: 'success' as const,
    [Difficulty.MEDIUM]: 'warning' as const,
    [Difficulty.HARD]: 'error' as const
  };
  return colors[difficulty] || 'default' as const;
};

/**
 * 题目验证函数
 */
const validateQuestion = (question: Question): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!question.content?.title?.trim()) {
    errors.push('题目内容为空');
  }
  
  if ([QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE].includes(question.type)) {
    if (!question.options || question.options.length < 2) {
      errors.push('选项不足');
    }
    if (!question.correctAnswer) {
      errors.push('未设置答案');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * 单个题目卡片组件
 */
interface QuestionCardProps {
  question: Question;
  index: number;
  isSelected: boolean;
  isBulkSelected: boolean;
  onSelect: () => void;
  onBulkSelect: (selected: boolean) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onStar?: (starred: boolean) => void;
  disabled?: boolean;
  showSelection?: boolean;
  showPreview?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  isSelected,
  isBulkSelected,
  onSelect,
  onBulkSelect,
  onDelete,
  onDuplicate,
  onStar,
  disabled = false,
  showSelection = false,
  showPreview = false
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  
  const typeInfo = getQuestionTypeInfo(question.type);
  const validation = validateQuestion(question);
  const isStarred = question.tags?.includes('收藏') || false;

  /**
   * 处理菜单操作
   */
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  /**
   * 获取题目预览文本
   */
  const getPreviewText = () => {
    const title = question.content?.title || '无题目内容';
    return title.length > 60 ? `${title.substring(0, 60)}...` : title;
  };

  /**
   * 获取状态指示器
   */
  const getStatusIcon = () => {
    if (!validation.isValid) {
      return (
        <Tooltip title={`错误: ${validation.errors.join(', ')}`}>
          <ErrorIcon color="error" fontSize="small" />
        </Tooltip>
      );
    }
    
    const isModified = question.updatedAt && question.updatedAt > question.createdAt;
    if (isModified) {
      return (
        <Tooltip title="题目已修改">
          <Warning color="warning" fontSize="small" />
        </Tooltip>
      );
    }
    
    return (
      <Tooltip title="题目正常">
        <CheckCircle color="success" fontSize="small" />
      </Tooltip>
    );
  };

  /**
   * 获取预计时间显示
   */
  const getTimeDisplay = () => {
    const time = question.estimatedTime || 120;
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
  };

  return (
    <ListItem 
      disablePadding
      sx={{
        mb: 1,
        borderRadius: 2,
        border: 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        backgroundColor: isSelected 
          ? alpha(theme.palette.primary.main, 0.08)
          : isBulkSelected
          ? alpha(theme.palette.secondary.main, 0.05)
          : 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
          transform: 'translateY(-1px)',
          boxShadow: 2
        }
      }}
    >
      <ListItemButton
        onClick={onSelect}
        disabled={disabled}
        sx={{
          p: 2,
          borderRadius: 2,
          '&.Mui-selected': {
            backgroundColor: 'transparent'
          }
        }}
      >
        {/* 批量选择框 */}
        {showSelection && (
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Checkbox
              checked={isBulkSelected}
              onChange={(e) => {
                e.stopPropagation();
                onBulkSelect(e.target.checked);
              }}
              disabled={disabled}
              size="small"
            />
          </ListItemIcon>
        )}

        {/* 题目类型头像 */}
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              backgroundColor: `${typeInfo.color}.main`,
              color: 'white',
              fontSize: '0.75rem'
            }}
          >
            {typeInfo.icon}
          </Avatar>
        </ListItemIcon>

        {/* 题目内容 */}
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
                {index + 1}. {getPreviewText()}
              </Typography>
              
              {/* 状态和收藏 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {getStatusIcon()}
                {onStar && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStar(!isStarred);
                    }}
                    disabled={disabled}
                  >
                    {isStarred ? (
                      <Star color="warning" fontSize="small" />
                    ) : (
                      <StarBorder fontSize="small" />
                    )}
                  </IconButton>
                )}
              </Box>
            </Box>
          }
          secondary={
            <Box sx={{ mt: 1 }}>
              {/* 题目信息标签 */}
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={typeInfo.label}
                  size="small"
                  variant="outlined"
                  color={typeInfo.color}
                />
                <Chip
                  label={DIFFICULTY_LABELS[question.difficulty] || question.difficulty}
                  size="small"
                  variant="filled"
                  color={getDifficultyColor(question.difficulty)}
                />
                <Chip
                  label={`${question.score || 5}分`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={getTimeDisplay()}
                  size="small"
                  variant="outlined"
                  icon={<Schedule fontSize="small" />}
                />
              </Box>

              {/* 标签显示 */}
              {question.tags && question.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                  {question.tags.slice(0, 3).map((tag, tagIndex) => (
                    <Chip
                      key={tagIndex}
                      label={tag}
                      size="small"
                      variant="filled"
                      sx={{ 
                        height: 18, 
                        fontSize: '0.65rem',
                        backgroundColor: 'action.hover',
                        color: 'text.secondary'
                      }}
                    />
                  ))}
                  {question.tags.length > 3 && (
                    <Chip
                      label={`+${question.tags.length - 3}`}
                      size="small"
                      variant="filled"
                      sx={{ 
                        height: 18, 
                        fontSize: '0.65rem',
                        backgroundColor: 'action.hover',
                        color: 'text.secondary'
                      }}
                    />
                  )}
                </Box>
              )}

              {/* 错误信息显示 */}
              {!validation.isValid && (
                <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                  {validation.errors[0]}
                </Typography>
              )}

              {/* 预览内容 */}
              {showPreview && question.options && question.options.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    选项: {question.options.slice(0, 2).map(opt => 
                      `${opt.id}.${opt.text?.substring(0, 15)}...`
                    ).join(' | ')}
                  </Typography>
                </Box>
              )}
            </Box>
          }
          sx={{ m: 0 }}
        />

        {/* 操作菜单 */}
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          disabled={disabled}
          sx={{ ml: 1 }}
        >
          <MoreVert />
        </IconButton>
      </ListItemButton>

      {/* 右键菜单 */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem 
          onClick={() => {
            handleMenuClose();
            onDuplicate();
          }} 
          disabled={disabled}
        >
          <ContentCopy sx={{ mr: 1 }} fontSize="small" />
          复制题目
        </MenuItem>
        <MenuItem 
          onClick={() => {
            handleMenuClose();
            onSelect();
          }} 
          disabled={disabled}
        >
          <Edit sx={{ mr: 1 }} fontSize="small" />
          编辑题目
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => {
            handleMenuClose();
            onDelete();
          }} 
          disabled={disabled} 
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} fontSize="small" />
          删除题目
        </MenuItem>
      </Menu>
    </ListItem>
  );
};

/**
 * 增强版题目列表组件
 */
export const EnhancedQuestionList: React.FC<EnhancedQuestionListProps> = ({
  questions,
  selectedQuestionId,
  selectedQuestions = [],
  onQuestionSelect,
  onQuestionDelete,
  onQuestionDuplicate,
  onBulkSelect,
  disabled = false,
  showSelection = false,
  showPreview = false,
  onQuestionStar
}) => {
  const theme = useTheme();
  
  /**
   * 计算统计信息
   */
  const stats = {
    total: questions.length,
    valid: questions.filter(q => validateQuestion(q).isValid).length,
    selected: selectedQuestions.length
  };

  /**
   * 处理全选
   */
  const handleSelectAll = (checked: boolean) => {
    if (onBulkSelect) {
      onBulkSelect(questions.map(q => q.id), checked);
    }
  };

  /**
   * 判断是否全选
   */
  const isAllSelected = selectedQuestions.length === questions.length && questions.length > 0;
  const isIndeterminate = selectedQuestions.length > 0 && selectedQuestions.length < questions.length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 列表头部 */}
      <Card elevation={0} sx={{ borderRadius: 0 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {showSelection && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={disabled || questions.length === 0}
                    />
                  }
                  label=""
                  sx={{ mr: 1 }}
                />
              )}
              
              <Typography variant="subtitle1" fontWeight="bold">
                题目列表
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={`${stats.total}题`}
                size="small"
                variant="outlined"
              />
              {stats.selected > 0 && (
                <Chip
                  label={`已选${stats.selected}`}
                  size="small"
                  color="primary"
                  variant="filled"
                />
              )}
            </Box>
          </Box>
          
          {/* 进度条 */}
          {stats.total > 0 && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={(stats.valid / stats.total) * 100}
                sx={{ height: 4, borderRadius: 2 }}
                color={stats.valid === stats.total ? 'success' : 'warning'}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                有效题目: {stats.valid}/{stats.total} ({Math.round((stats.valid / stats.total) * 100)}%)
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Divider />

      {/* 题目列表 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {questions.length > 0 ? (
          <List disablePadding>
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                isSelected={selectedQuestionId === question.id}
                isBulkSelected={selectedQuestions.includes(question.id)}
                onSelect={() => onQuestionSelect(question.id)}
                onBulkSelect={(selected) => {
                  if (onBulkSelect) {
                    onBulkSelect([question.id], selected);
                  }
                }}
                onDelete={() => onQuestionDelete(question.id)}
                onDuplicate={() => onQuestionDuplicate(question.id)}
                onStar={onQuestionStar ? (starred) => onQuestionStar(question.id, starred) : undefined}
                disabled={disabled}
                showSelection={showSelection}
                showPreview={showPreview}
              />
            ))}
          </List>
        ) : (
          <Box 
            sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              color: 'text.secondary',
              gap: 2
            }}
          >
            <Edit fontSize="large" />
            <Typography variant="h6">暂无题目</Typography>
            <Typography variant="body2">
              开始AI生成或手动创建题目
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default EnhancedQuestionList;