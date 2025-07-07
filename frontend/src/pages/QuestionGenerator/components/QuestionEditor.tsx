// frontend/src/pages/QuestionGenerator/components/QuestionEditor.tsx (替换原版本)

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Divider,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Tooltip,
  Fab,
  Zoom,
  useTheme,
  alpha,
  Switch,
  TextField,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Save,
  Preview,
  SelectAll,
  FilterList,
  Search,
  MoreVert,
  Delete,
  ContentCopy,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Add,
  ViewList,
  ViewModule,
  Download,
  Upload,
  Settings,
  ExpandMore,
  Undo,
  Tag,
  Help,
  RadioButtonChecked,
  CheckBox,
  ToggleOff,
  ShortText
} from '@mui/icons-material';

import { Question, QuestionType, Difficulty } from '@/types/question';

/**
 * 题目编辑器的Props接口 (保持向后兼容)
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
 * 视图模式
 */
enum ViewMode {
  LIST = 'list',
  DETAIL = 'detail'
}

/**
 * 题目类型信息配置
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
 * 难度标签配置
 */
const DIFFICULTY_CONFIG = {
  [Difficulty.EASY]: { label: '简单', color: 'success' as const },
  [Difficulty.MEDIUM]: { label: '中等', color: 'warning' as const },
  [Difficulty.HARD]: { label: '困难', color: 'error' as const }
};

/**
 * 题目验证函数
 */
const validateQuestion = (question: Question): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!question.content?.title?.trim()) {
    errors.push('题目内容不能为空');
  }
  
  if ([QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE].includes(question.type)) {
    if (!question.options || question.options.length < 2) {
      errors.push('选择题至少需要2个选项');
    }
    if (!question.correctAnswer) {
      errors.push('请设置正确答案');
    }
  }
  
  if (question.type === QuestionType.TRUE_FALSE) {
    if (!question.correctAnswer || !['true', 'false'].includes(question.correctAnswer as string)) {
      errors.push('判断题必须设置正确或错误');
    }
  }
  
  if (question.type === QuestionType.SHORT_ANSWER) {
    if (!question.correctAnswer || !String(question.correctAnswer).trim()) {
      errors.push('简答题需要参考答案');
    }
  }
  
  return { isValid: errors.length === 0, errors };
};

/**
 * 题目列表组件
 */
interface QuestionListProps {
  questions: Question[];
  selectedQuestionId: string | null;
  selectedQuestions: string[];
  onQuestionSelect: (id: string) => void;
  onBulkSelect: (ids: string[], selected: boolean) => void;
  onSelectAll: () => void;
  disabled?: boolean;
}

const QuestionListComponent: React.FC<QuestionListProps> = ({
  questions,
  selectedQuestionId,
  selectedQuestions,
  onQuestionSelect,
  onBulkSelect,
  onSelectAll,
  disabled
}) => {
  const theme = useTheme();
  
  const isAllSelected = selectedQuestions.length === questions.length && questions.length > 0;
  const isIndeterminate = selectedQuestions.length > 0 && selectedQuestions.length < questions.length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 列表头部 */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={(e) => onSelectAll()}
                  disabled={disabled || questions.length === 0}
                />
              }
              label="题目列表"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            共 {questions.length} 道题目
          </Typography>
        </Box>
      </Box>

      {/* 题目列表 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {questions.map((question, index) => {
          const typeConfig = QUESTION_TYPE_CONFIG[question.type];
          const validation = validateQuestion(question);
          const isSelected = selectedQuestionId === question.id;
          const isBulkSelected = selectedQuestions.includes(question.id);

          return (
            <Card
              key={question.id}
              variant="outlined"
              sx={{
                mb: 1,
                cursor: 'pointer',
                border: 1,
                borderColor: isSelected ? 'primary.main' : 'divider',
                backgroundColor: isSelected 
                  ? alpha(theme.palette.primary.main, 0.08)
                  : isBulkSelected
                  ? alpha(theme.palette.secondary.main, 0.05)
                  : 'background.paper',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: alpha(theme.palette.primary.main, 0.04)
                }
              }}
              onClick={() => onQuestionSelect(question.id)}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Checkbox
                    checked={isBulkSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onBulkSelect([question.id], e.target.checked);
                    }}
                    disabled={disabled}
                    size="small"
                  />
                  
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {index + 1}. {question.content?.title?.substring(0, 50) || '无标题'}
                        {question.content?.title && question.content.title.length > 50 && '...'}
                      </Typography>
                      
                      {validation.isValid ? (
                        <CheckCircle color="success" fontSize="small" />
                      ) : (
                        <Tooltip title={validation.errors.join(', ')}>
                          <ErrorIcon color="error" fontSize="small" />
                        </Tooltip>
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        icon={typeConfig.icon}
                        label={typeConfig.label}
                        size="small"
                        color={typeConfig.color}
                        variant="outlined"
                      />
                      <Chip
                        label={DIFFICULTY_CONFIG[question.difficulty].label}
                        size="small"
                        color={DIFFICULTY_CONFIG[question.difficulty].color}
                        variant="filled"
                      />
                      <Chip
                        label={`${question.score || 5}分`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    
                    {!validation.isValid && (
                      <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
                        {validation.errors[0]}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
        
        {questions.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography variant="h6" gutterBottom>暂无题目</Typography>
            <Typography variant="body2">请先生成或添加题目</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

/**
 * 题目详细编辑器组件
 */
interface DetailEditorProps {
  question: Question | null;
  onUpdate: (updates: Partial<Question>) => void;
  disabled?: boolean;
}

const DetailEditorComponent: React.FC<DetailEditorProps> = ({
  question,
  onUpdate,
  disabled
}) => {
  const [localChanges, setLocalChanges] = useState<Partial<Question>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalChanges({});
    setHasChanges(false);
  }, [question?.id]);

  const currentQuestion = question ? { ...question, ...localChanges } : null;

  const handleChange = (field: string, value: any) => {
    setLocalChanges(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (hasChanges && question) {
      onUpdate(localChanges);
      setLocalChanges({});
      setHasChanges(false);
    }
  };

  const handleDiscard = () => {
    setLocalChanges({});
    setHasChanges(false);
  };

  if (!currentQuestion) {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
        color: 'text.secondary'
      }}>
        <Typography variant="h6">请选择要编辑的题目</Typography>
        <Typography variant="body2">从左侧列表中选择题目开始编辑</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 编辑器头部 */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">题目编辑</Typography>
          {hasChanges && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="outlined" startIcon={<Undo />} onClick={handleDiscard}>
                撤销
              </Button>
              <Button size="small" variant="contained" startIcon={<Save />} onClick={handleSave}>
                保存
              </Button>
            </Box>
          )}
        </Box>

        {/* 基础信息 */}
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <FormControl fullWidth size="small">
              <InputLabel>题目类型</InputLabel>
              <Select
                value={currentQuestion.type}
                label="题目类型"
                onChange={(e) => handleChange('type', e.target.value)}
                disabled={disabled}
              >
                {Object.entries(QUESTION_TYPE_CONFIG).map(([type, config]) => (
                  <MenuItem key={type} value={type}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {config.icon}
                      {config.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <FormControl fullWidth size="small">
              <InputLabel>难度级别</InputLabel>
              <Select
                value={currentQuestion.difficulty}
                label="难度级别"
                onChange={(e) => handleChange('difficulty', e.target.value)}
                disabled={disabled}
              >
                {Object.entries(DIFFICULTY_CONFIG).map(([difficulty, config]) => (
                  <MenuItem key={difficulty} value={difficulty}>
                    {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <TextField
              fullWidth
              size="small"
              label="分值"
              type="number"
              value={currentQuestion.score || 5}
              onChange={(e) => handleChange('score', parseInt(e.target.value) || 5)}
              disabled={disabled}
            />
          </Grid>
        </Grid>
      </Box>

      {/* 编辑内容 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* 题目内容 */}
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
              onChange={(e) => handleChange('content', { title: e.target.value, format: 'markdown' })}
              disabled={disabled}
              placeholder="请输入题目内容..."
            />
          </AccordionDetails>
        </Accordion>

        {/* 选项编辑（选择题） */}
        {[QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE].includes(currentQuestion.type) && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">选项设置</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {currentQuestion.type === QuestionType.TRUE_FALSE ? (
                <FormControl component="fieldset">
                  <Typography variant="body2" gutterBottom>正确答案:</Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={currentQuestion.correctAnswer === 'true'}
                          onChange={(e) => handleChange('correctAnswer', e.target.checked ? 'true' : 'false')}
                          disabled={disabled}
                        />
                      }
                      label="正确"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={currentQuestion.correctAnswer === 'false'}
                          onChange={(e) => handleChange('correctAnswer', e.target.checked ? 'false' : 'true')}
                          disabled={disabled}
                        />
                      }
                      label="错误"
                    />
                  </Box>
                </FormControl>
              ) : (
                <Box>
                  {currentQuestion.options?.map((option, index) => (
                    <Box key={option.id || index} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      <Checkbox
                        checked={
                          currentQuestion.type === QuestionType.SINGLE_CHOICE
                            ? currentQuestion.correctAnswer === option.id
                            : Array.isArray(currentQuestion.correctAnswer) && currentQuestion.correctAnswer.includes(option.id)
                        }
                        onChange={(e) => {
                          if (currentQuestion.type === QuestionType.SINGLE_CHOICE) {
                            handleChange('correctAnswer', e.target.checked ? option.id : '');
                          } else {
                            const current = Array.isArray(currentQuestion.correctAnswer) ? currentQuestion.correctAnswer : [];
                            const newAnswer = e.target.checked 
                              ? [...current, option.id]
                              : current.filter(id => id !== option.id);
                            handleChange('correctAnswer', newAnswer);
                          }
                        }}
                        disabled={disabled}
                      />
                      <Typography variant="body2" sx={{ minWidth: 20 }}>{option.id}.</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={option.text || ''}
                        onChange={(e) => {
                          const newOptions = [...(currentQuestion.options || [])];
                          newOptions[index] = { ...option, text: e.target.value };
                          handleChange('options', newOptions);
                        }}
                        disabled={disabled}
                        placeholder={`选项 ${option.id}`}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        )}

        {/* 参考答案（简答题） */}
        {currentQuestion.type === QuestionType.SHORT_ANSWER && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">参考答案</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={currentQuestion.correctAnswer || ''}
                onChange={(e) => handleChange('correctAnswer', e.target.value)}
                disabled={disabled}
                placeholder="请输入参考答案..."
              />
            </AccordionDetails>
          </Accordion>
        )}

        {/* 答案解析 */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle1" fontWeight="medium">答案解析</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={currentQuestion.explanation?.text || ''}
              onChange={(e) => handleChange('explanation', { text: e.target.value, format: 'markdown' })}
              disabled={disabled}
              placeholder="请输入答案解析..."
            />
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* 底部状态栏 */}
      {hasChanges && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', backgroundColor: 'action.hover' }}>
          <Typography variant="body2" color="warning.main">
            有未保存的更改
          </Typography>
        </Box>
      )}
    </Box>
  );
};

/**
 * 增强版题目编辑器主组件
 */
export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  questions: initialQuestions,
  onQuestionEdit,
  onPreview,
  selectedQuestionId: externalSelectedId,
  onQuestionSelect,
  mode = 'edit',
  disabled = false
}) => {
  // 状态管理
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    externalSelectedId || (initialQuestions.length > 0 ? initialQuestions[0].id : null)
  );
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.DETAIL);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 同步外部题目数据
  useEffect(() => {
    setQuestions(initialQuestions);
  }, [initialQuestions]);

  // 统计信息
  const statistics = {
    total: questions.length,
    valid: questions.filter(q => validateQuestion(q).isValid).length,
    invalid: questions.filter(q => !validateQuestion(q).isValid).length,
    selected: selectedQuestions.length
  };

  // 处理题目选择
  const handleQuestionSelect = useCallback((questionId: string) => {
    setSelectedQuestionId(questionId);
    if (onQuestionSelect) {
      onQuestionSelect(questionId);
    }
  }, [onQuestionSelect]);

  // 处理题目更新
  const handleQuestionUpdate = useCallback((updates: Partial<Question>) => {
    if (!selectedQuestionId) return;

    setQuestions(prev => prev.map(q => 
      q.id === selectedQuestionId 
        ? { ...q, ...updates, updatedAt: new Date() }
        : q
    ));
    setHasUnsavedChanges(true);

    // 触发外部回调
    if (onQuestionEdit) {
      const currentQuestion = questions.find(q => q.id === selectedQuestionId);
      if (currentQuestion) {
        onQuestionEdit(selectedQuestionId, { ...currentQuestion, ...updates });
      }
    }
  }, [selectedQuestionId, onQuestionEdit, questions]);

  // 处理批量选择
  const handleBulkSelect = useCallback((questionIds: string[], selected: boolean) => {
    setSelectedQuestions(prev => {
      if (selected) {
        return [...new Set([...prev, ...questionIds])];
      } else {
        return prev.filter(id => !questionIds.includes(id));
      }
    });
  }, []);

  // 处理全选
  const handleSelectAll = useCallback(() => {
    if (selectedQuestions.length === questions.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(questions.map(q => q.id));
    }
  }, [selectedQuestions.length, questions]);

  // 获取当前选中的题目
  const currentQuestion = selectedQuestionId 
    ? questions.find(q => q.id === selectedQuestionId) || null
    : null;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <Card elevation={1} sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" fontWeight="bold">题目编辑器</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label={`共 ${statistics.total} 题`} variant="outlined" size="small" />
                {statistics.selected > 0 && (
                  <Chip label={`已选 ${statistics.selected} 题`} color="primary" variant="filled" size="small" />
                )}
                {statistics.invalid > 0 && (
                  <Chip label={`${statistics.invalid} 题有错误`} color="error" variant="outlined" size="small" />
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<Save />}
                onClick={() => setShowSaveDialog(true)}
                disabled={selectedQuestions.length === 0 || disabled}
                size="small"
              >
                保存选中
              </Button>
              
              {onPreview && (
                <Button
                  variant="contained"
                  startIcon={<Preview />}
                  onClick={onPreview}
                  disabled={statistics.invalid > 0 || disabled}
                  size="small"
                >
                  预览测试
                </Button>
              )}
            </Box>
          </Box>

          {statistics.total > 0 && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={(statistics.valid / statistics.total) * 100}
                sx={{ height: 4, borderRadius: 2 }}
                color={statistics.valid === statistics.total ? 'success' : 'warning'}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                有效题目: {statistics.valid}/{statistics.total} ({Math.round((statistics.valid / statistics.total) * 100)}%)
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {statistics.invalid > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          有 {statistics.invalid} 道题目存在错误，请检查并修正后再进行预览或保存。
        </Alert>
      )}

      {/* 主编辑区域 */}
      <Box sx={{ flex: 1, display: 'flex', gap: 2, minHeight: 0 }}>
        {/* 左侧题目列表 */}
        <Card elevation={2} sx={{ width: 350, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <QuestionListComponent
            questions={questions}
            selectedQuestionId={selectedQuestionId}
            selectedQuestions={selectedQuestions}
            onQuestionSelect={handleQuestionSelect}
            onBulkSelect={handleBulkSelect}
            onSelectAll={handleSelectAll}
            disabled={disabled}
          />
        </Card>

        {/* 右侧详细编辑器 */}
        <Card elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <DetailEditorComponent
            question={currentQuestion}
            onUpdate={handleQuestionUpdate}
            disabled={disabled}
          />
        </Card>
      </Box>

      {/* 自动保存提示 */}
      {hasUnsavedChanges && (
        <Fab
          color="primary"
          size="small"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => setHasUnsavedChanges(false)}
        >
          <Save />
        </Fab>
      )}

      {/* 保存确认对话框 */}
      <Dialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)}>
        <DialogTitle>保存题目到题库</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            确定要将选中的 {selectedQuestions.length} 道题目保存到题库吗？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>取消</Button>
          <Button 
            onClick={() => {
              // 这里可以添加保存逻辑
              console.log('保存题目:', selectedQuestions);
              setShowSaveDialog(false);
            }} 
            variant="contained"
          >
            确定保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuestionEditor;