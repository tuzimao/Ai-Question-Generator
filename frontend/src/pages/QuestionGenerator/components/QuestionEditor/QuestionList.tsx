// frontend/src/pages/QuestionGenerator/components/QuestionEditor/QuestionList.tsx

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
  alpha,
  useTheme
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
  CheckCircle
} from '@mui/icons-material';

import { EditableQuestion } from '@/types/editor';
import { QuestionType } from '@/types/question';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from '@/types/editor';

/**
 * QuestionList组件的Props接口
 */
interface QuestionListProps {
  questions: EditableQuestion[];                 // 题目列表
  selectedQuestionId: string | null;             // 当前选中的题目ID
  onQuestionSelect: (questionId: string) => void; // 题目选择回调
  onQuestionDelete: (questionId: string) => void; // 题目删除回调
  onQuestionDuplicate: (questionId: string) => void; // 题目复制回调
  disabled?: boolean;                             // 是否禁用操作
}

/**
 * 获取题目类型对应的图标
 */
const getQuestionTypeIcon = (type: QuestionType) => {
  switch (type) {
    case QuestionType.SINGLE_CHOICE:
      return <RadioButtonChecked />;
    case QuestionType.MULTIPLE_CHOICE:
      return <CheckBox />;
    case QuestionType.TRUE_FALSE:
      return <ToggleOff />;
    case QuestionType.SHORT_ANSWER:
      return <ShortText />;
    default:
      return <Edit />;
  }
};

/**
 * 获取题目类型对应的颜色
 */
const getQuestionTypeColor = (type: QuestionType) => {
  switch (type) {
    case QuestionType.SINGLE_CHOICE:
      return 'primary';
    case QuestionType.MULTIPLE_CHOICE:
      return 'secondary';
    case QuestionType.TRUE_FALSE:
      return 'success';
    case QuestionType.SHORT_ANSWER:
      return 'warning';
    default:
      return 'default';
  }
};

/**
 * 单个题目卡片组件
 */
interface QuestionCardProps {
  question: EditableQuestion;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  disabled?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  disabled = false
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  /**
   * 处理菜单打开
   */
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  /**
   * 处理菜单关闭
   */
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  /**
   * 处理删除
   */
  const handleDelete = () => {
    onDelete();
    handleMenuClose();
  };

  /**
   * 处理复制
   */
  const handleDuplicate = () => {
    onDuplicate();
    handleMenuClose();
  };

  /**
   * 获取题目预览文本
   */
  const getPreviewText = (question: EditableQuestion) => {
    const title = question.content?.title || '无题目内容';
    return title.length > 50 ? `${title.substring(0, 50)}...` : title;
  };

  /**
   * 获取状态指示器
   */
  const getStatusIndicator = () => {
    if (!question.editState.isValid) {
      return (
        <Tooltip title="题目存在错误">
          <Warning color="error" fontSize="small" />
        </Tooltip>
      );
    }
    
    if (question.editState.isModified) {
      return (
        <Tooltip title="题目已修改">
          <CheckCircle color="warning" fontSize="small" />
        </Tooltip>
      );
    }
    
    return (
      <Tooltip title="题目正常">
        <CheckCircle color="success" fontSize="small" />
      </Tooltip>
    );
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
          ? alpha(theme.palette.primary.main, 0.05)
          : 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: alpha(theme.palette.primary.main, 0.02)
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
        {/* 题目类型图标 */}
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              backgroundColor: `${getQuestionTypeColor(question.type)}.main`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {getQuestionTypeIcon(question.type)}
          </Box>
        </ListItemIcon>

        {/* 题目内容 */}
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
                {getPreviewText(question)}
              </Typography>
              {getStatusIndicator()}
            </Box>
          }
          secondary={
            <Box sx={{ mt: 1 }}>
              {/* 题目类型和难度 */}
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                <Chip
                  label={QUESTION_TYPE_LABELS[question.type] || question.type}
                  size="small"
                  variant="outlined"
                  color={getQuestionTypeColor(question.type) as any}
                />
                <Chip
                  label={DIFFICULTY_LABELS[question.difficulty] || question.difficulty}
                  size="small"
                  variant="outlined"
                />
              </Box>

              {/* 标签 */}
              {question.tags && question.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {question.tags.slice(0, 3).map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      size="small"
                      variant="filled"
                      sx={{ 
                        height: 20, 
                        fontSize: '0.7rem',
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
                        height: 20, 
                        fontSize: '0.7rem',
                        backgroundColor: 'action.hover',
                        color: 'text.secondary'
                      }}
                    />
                  )}
                </Box>
              )}

              {/* 验证错误信息 */}
              {question.editState.validationErrors.length > 0 && (
                <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                  {question.editState.validationErrors[0]}
                </Typography>
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
        <MenuItem onClick={handleDuplicate} disabled={disabled}>
          <ContentCopy sx={{ mr: 1 }} fontSize="small" />
          复制题目
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} disabled={disabled} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} fontSize="small" />
          删除题目
        </MenuItem>
      </Menu>
    </ListItem>
  );
};

/**
 * 题目列表组件
 * 显示所有题目的列表，支持选择、删除、复制等操作
 */
export const QuestionList: React.FC<QuestionListProps> = ({
  questions,
  selectedQuestionId,
  onQuestionSelect,
  onQuestionDelete,
  onQuestionDuplicate,
  disabled = false
}) => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 列表头部 */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight="bold">
          题目列表
        </Typography>
        <Typography variant="caption" color="text.secondary">
          共 {questions.length} 道题目
        </Typography>
      </Box>

      {/* 题目列表 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {questions.length > 0 ? (
          <List disablePadding>
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                isSelected={selectedQuestionId === question.id}
                onSelect={() => onQuestionSelect(question.id)}
                onDelete={() => onQuestionDelete(question.id)}
                onDuplicate={() => onQuestionDuplicate(question.id)}
                disabled={disabled}
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
              gap: 1
            }}
          >
            <Edit fontSize="large" />
            <Typography variant="body2">
              暂无题目
            </Typography>
            <Typography variant="caption">
              开始AI生成或手动创建题目
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default QuestionList;