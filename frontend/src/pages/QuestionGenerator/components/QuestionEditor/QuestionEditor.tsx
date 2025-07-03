// frontend/src/pages/QuestionGenerator/components/QuestionEditor.tsx

import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
  Fade,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  alpha,
  useTheme,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem as SelectMenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Paper,
  OutlinedInput
} from '@mui/material';
import {
  Save,
  Preview,
  Search,
  FilterList,
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
  ExpandMore,
  Add,
  Undo,
  Tag,
  Help
} from '@mui/icons-material';

import { Question, QuestionType, Difficulty } from '@/types/question';
import { useQuestionEditor } from '@/hooks/useQuestionEditor';
import { 
  EditableQuestion, 
  QUESTION_TYPE_LABELS, 
  DIFFICULTY_LABELS, 
  COMMON_TAGS 
} from '@/types/editor';

/**
 * QuestionEditor组件的Props接口
 */
interface QuestionEditorProps {
  questions: Question[];                          
  onQuestionEdit?: (questionId: string, updatedQuestion: Question) => void; 
  onPreview?: () => void;                         
  selectedQuestionId?: string | null;             
  onQuestionSelect?: (id: string | null) => void; 
  mode?: 'edit' | 'preview';                      
  disabled?: boolean;                             
}

/**
 * 获取题目类型对应的图标
 */
const getQuestionTypeIcon = (type: QuestionType) => {
  switch (type) {
    case QuestionType.SINGLE_CHOICE: return <RadioButtonChecked />;
    case QuestionType.MULTIPLE_CHOICE: return <CheckBox />;
    case QuestionType.TRUE_FALSE: return <ToggleOff />;
    case QuestionType.SHORT_ANSWER: return <ShortText />;
    default: return <Edit />;
  }
};

/**
 * 获取题目类型对应的颜色
 */
const getQuestionTypeColor = (type: QuestionType) => {
  switch (type) {
    case QuestionType.SINGLE_CHOICE: return 'primary';
    case QuestionType.MULTIPLE_CHOICE: return 'secondary';
    case QuestionType.TRUE_FALSE: return 'success';
    case QuestionType.SHORT_ANSWER: return 'warning';
    default: return 'default';
  }
};

/**
 * 题目编辑器主组件
 * 提供完整的题目编辑功能，包括题目列表、详细编辑、搜索过滤等
 */
export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  questions,
  onQuestionEdit,
  onPreview,
  selectedQuestionId: externalSelectedId,
  onQuestionSelect,
  mode = 'edit',
  disabled = false
}) => {
  const theme = useTheme();
  const [searchExpanded, setSearchExpanded] = useState(false);
  
  // 使用编辑器Hook管理状态
  const {
    editorState,
    selectedQuestion,
    filteredQuestions,
    statistics,
    updateQuestion,
    selectQuestion,
    deleteQuestion,
    duplicateQuestion,
    addTag,
    removeTag,
    setSearchQuery,
    setFilterOptions,
    saveChanges
  } = useQuestionEditor(questions);

  /**
   * 处理题目选择
   */
  const handleQuestionSelect = (questionId: string | null) => {
    if (onQuestionSelect) {
      onQuestionSelect(questionId);
    } else {
      selectQuestion(questionId);
    }
  };

  /**
   * 处理题目更新
   */
  const handleQuestionUpdate = (questionId: string, updates: Partial<Question>) => {
    updateQuestion(questionId, updates);
    
    if (onQuestionEdit) {
      const currentQuestion = editorState.questions.find(q => q.id === questionId);
      if (currentQuestion) {
        const updatedQuestion: Question = {
          ...currentQuestion,
          ...updates,
          updatedAt: new Date()
        };
        onQuestionEdit(questionId, updatedQuestion);
      }
    }
  };

  /**
   * 处理保存操作
   */
  const handleSave = () => {
    saveChanges();
  };

  /**
   * 获取当前显示的题目
   */
  const currentSelectedQuestion = externalSelectedId 
    ? editorState.questions.find(q => q.id === externalSelectedId)
    : selectedQuestion;

  const invalidCount = statistics.invalid;
  const modifiedCount = statistics.modified;

  /**
   * 题目列表组件
   */
  const QuestionListComponent = () => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight="bold">
          题目列表
        </Typography>
        <Typography variant="caption" color="text.secondary">
          共 {filteredQuestions.length} 道题目
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {filteredQuestions.length > 0 ? (
          <List disablePadding>
            {filteredQuestions.map((question) => (
              <ListItem 
                key={question.id}
                disablePadding
                sx={{
                  mb: 1,
                  borderRadius: 2,
                  border: 1,
                  borderColor: currentSelectedQuestion?.id === question.id ? 'primary.main' : 'divider',
                  backgroundColor: currentSelectedQuestion?.id === question.id
                    ? alpha(theme.palette.primary.main, 0.05)
                    : 'background.paper',
                }}
              >
                <ListItemButton
                  onClick={() => handleQuestionSelect(question.id)}
                  disabled={disabled}
                  sx={{ p: 2, borderRadius: 2 }}
                >
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

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
                          {question.content?.title?.substring(0, 50) || '无题目内容'}...
                        </Typography>
                        {!question.editState.isValid ? (
                          <Tooltip title="题目存在错误">
                            <Warning color="error" fontSize="small" />
                          </Tooltip>
                        ) : question.editState.isModified ? (
                          <Tooltip title="题目已修改">
                            <CheckCircle color="warning" fontSize="small" />
                          </Tooltip>
                        ) : (
                          <Tooltip title="题目正常">
                            <CheckCircle color="success" fontSize="small" />
                          </Tooltip>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
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
                          </Box>
                        )}
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
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
            <Typography variant="body2">暂无题目</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  /**
   * 详细编辑器组件
   */
  const DetailEditorComponent = () => {
    const [localChanges, setLocalChanges] = useState<Partial<Question>>({});
    const [hasLocalChanges, setHasLocalChanges] = useState(false);

    if (!currentSelectedQuestion) {
      return (
        <Box 
          sx={{ 
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            color: 'text.secondary',
            gap: 2
          }}
        >
          <Typography variant="h6">请选择要编辑的题目</Typography>
          <Typography variant="body2">从左侧列表中点击题目开始编辑</Typography>
        </Box>
      );
    }

    const currentQuestion = { ...currentSelectedQuestion, ...localChanges };

    const handleLocalChange = (field: string, value: any) => {
      setLocalChanges(prev => ({ ...prev, [field]: value }));
      setHasLocalChanges(true);
    };

    const commitChanges = () => {
      if (hasLocalChanges) {
        handleQuestionUpdate(currentSelectedQuestion.id, localChanges);
        setLocalChanges({});
        setHasLocalChanges(false);
      }
    };

    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">题目详细编辑</Typography>
            {hasLocalChanges && (
              <Button
                size="small"
                variant="contained"
                startIcon={<Save />}
                onClick={commitChanges}
                disabled={disabled}
              >
                保存更改
              </Button>
            )}
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>题目类型</InputLabel>
                <Select
                  value={currentQuestion.type}
                  label="题目类型"
                  onChange={(e) => handleLocalChange('type', e.target.value)}
                  disabled={disabled}
                >
                  {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                    <SelectMenuItem key={value} value={value}>{label}</SelectMenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>难度级别</InputLabel>
                <Select
                  value={currentQuestion.difficulty}
                  label="难度级别"
                  onChange={(e) => handleLocalChange('difficulty', e.target.value)}
                  disabled={disabled}
                >
                  {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                    <SelectMenuItem key={value} value={value}>{label}</SelectMenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="分值"
                type="number"
                value={currentQuestion.score || 5}
                onChange={(e) => handleLocalChange('score', parseInt(e.target.value) || 5)}
                disabled={disabled}
              />
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">题目内容</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={currentQuestion.content?.title || ''}
                onChange={(e) => handleLocalChange('content', { title: e.target.value, format: 'markdown' })}
                disabled={disabled}
                placeholder="请输入题目内容..."
              />
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">答案解析</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={currentQuestion.explanation?.text || ''}
                onChange={(e) => handleLocalChange('explanation', { text: e.target.value, format: 'markdown' })}
                disabled={disabled}
                placeholder="请输入答案解析..."
              />
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">题目标签</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {currentQuestion.tags?.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={disabled ? undefined : () => removeTag(currentSelectedQuestion.id, tag)}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 编辑器顶部工具栏 */}
      <Card elevation={1} sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" fontWeight="bold">题目编辑器</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label={`共 ${statistics.total} 题`} variant="outlined" size="small" />
                {modifiedCount > 0 && (
                  <Chip label={`${modifiedCount} 题已修改`} color="warning" variant="outlined" size="small" />
                )}
                {invalidCount > 0 && (
                  <Chip label={`${invalidCount} 题有错误`} color="error" variant="outlined" size="small" />
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={!editorState.hasUnsavedChanges || disabled}
                size="small"
              >
                保存更改
              </Button>
              
              {onPreview && (
                <Button
                  variant="contained"
                  startIcon={<Preview />}
                  onClick={onPreview}
                  disabled={invalidCount > 0 || disabled}
                  size="small"
                >
                  预览测试
                </Button>
              )}
            </Box>
          </Box>

          {editorState.lastSavedAt && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              最后保存: {editorState.lastSavedAt.toLocaleString()}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {invalidCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          有 {invalidCount} 道题目存在错误，请检查并修正后再进行预览或保存。
        </Alert>
      )}

      {/* 主编辑区域 */}
      <Box sx={{ flex: 1, display: 'flex', gap: 2, minHeight: 0 }}>
        {/* 左侧题目列表 */}
        <Card elevation={2} sx={{ width: 350, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
            <QuestionListComponent />
          </CardContent>
        </Card>

        {/* 右侧详细编辑区域 */}
        <Card elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
            <DetailEditorComponent />
          </CardContent>
        </Card>
      </Box>

      {/* 底部状态栏 */}
      {editorState.hasUnsavedChanges && (
        <Fade in>
          <Card elevation={1} sx={{ mt: 2 }}>
            <CardContent sx={{ py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="warning.main">有未保存的更改</Typography>
                </Box>
                <Button size="small" variant="outlined" startIcon={<Save />} onClick={handleSave}>
                  立即保存
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      )}
    </Box>
  );
};

export default QuestionEditor;