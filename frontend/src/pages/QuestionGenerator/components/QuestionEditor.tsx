// frontend/src/pages/QuestionGenerator/components/QuestionEditor.tsx (简化版本)

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  TextField,
  Divider,
  Grid,
  Alert,
  Paper
} from '@mui/material';
import {
  Preview,
  Edit,
  Save,
  RadioButtonChecked,
  CheckBox,
  ToggleOff,
  ShortText
} from '@mui/icons-material';

import { Question, QuestionType, Difficulty } from '@/types/question';

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
 * 获取题目类型图标和标签
 */
const getQuestionTypeInfo = (type: QuestionType) => {
  switch (type) {
    case QuestionType.SINGLE_CHOICE:
      return { icon: <RadioButtonChecked />, label: '单选题', color: 'primary' };
    case QuestionType.MULTIPLE_CHOICE:
      return { icon: <CheckBox />, label: '多选题', color: 'secondary' };
    case QuestionType.TRUE_FALSE:
      return { icon: <ToggleOff />, label: '判断题', color: 'success' };
    case QuestionType.SHORT_ANSWER:
      return { icon: <ShortText />, label: '简答题', color: 'warning' };
    default:
      return { icon: <Edit />, label: '未知题型', color: 'default' };
  }
};

/**
 * 难度标签映射
 */
const getDifficultyLabel = (difficulty: Difficulty) => {
  switch (difficulty) {
    case Difficulty.EASY: return '简单';
    case Difficulty.MEDIUM: return '中等';
    case Difficulty.HARD: return '困难';
    default: return '中等';
  }
};

/**
 * 单个题目显示组件
 */
interface QuestionDisplayProps {
  question: Question;
  index: number;
  onEdit: (question: Question) => void;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ question, index, onEdit }) => {
  const typeInfo = getQuestionTypeInfo(question.type);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState<Question>(question);

  const handleSave = () => {
    onEdit(editedQuestion);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedQuestion(question);
    setIsEditing(false);
  };

  const renderOptions = () => {
    if (!question.options || question.options.length === 0) return null;

    if (question.type === QuestionType.TRUE_FALSE) {
      return (
        <Box sx={{ ml: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            判断：
          </Typography>
          <RadioGroup value={question.correctAnswer} row>
            <FormControlLabel 
              value="true" 
              control={<Radio size="small" />} 
              label="正确" 
              disabled
            />
            <FormControlLabel 
              value="false" 
              control={<Radio size="small" />} 
              label="错误" 
              disabled
            />
          </RadioGroup>
        </Box>
      );
    }

    return (
      <Box sx={{ ml: 2, mt: 1 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          选项：
        </Typography>
        {question.options.map((option, optIndex) => (
          <Box key={option.id || optIndex} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            {question.type === QuestionType.SINGLE_CHOICE ? (
              <Radio 
                checked={question.correctAnswer === option.id}
                size="small"
                disabled
              />
            ) : (
              <Checkbox 
                checked={
                  Array.isArray(question.correctAnswer) 
                    ? question.correctAnswer.includes(option.id)
                    : false
                }
                size="small"
                disabled
              />
            )}
            <Typography variant="body2" sx={{ ml: 1 }}>
              <strong>{option.id}.</strong> {option.text}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  const renderCorrectAnswer = () => {
    if (question.type === QuestionType.SHORT_ANSWER) {
      return (
        <Box sx={{ ml: 2, mt: 2 }}>
          <Typography variant="body2" color="success.main" gutterBottom>
            <strong>参考答案：</strong>
          </Typography>
          <Paper variant="outlined" sx={{ p: 1, backgroundColor: 'success.light' }}>
            <Typography variant="body2">
              {typeof question.correctAnswer === 'string' ? question.correctAnswer : '未设置答案'}
            </Typography>
          </Paper>
        </Box>
      );
    }

    return (
      <Box sx={{ ml: 2, mt: 1 }}>
        <Typography variant="body2" color="success.main">
          <strong>正确答案：</strong> {
            Array.isArray(question.correctAnswer) 
              ? question.correctAnswer.join(', ')
              : question.correctAnswer
          }
        </Typography>
      </Box>
    );
  };

  const renderExplanation = () => {
    const explanationText = question.explanation?.text || '';
    if (!explanationText) return null;

    return (
      <Box sx={{ ml: 2, mt: 2 }}>
        <Typography variant="body2" color="info.main" gutterBottom>
          <strong>答案解析：</strong>
        </Typography>
        <Paper variant="outlined" sx={{ p: 1, backgroundColor: 'info.light' }}>
          <Typography variant="body2">
            {explanationText}
          </Typography>
        </Paper>
      </Box>
    );
  };

  if (isEditing) {
    return (
      <Card variant="outlined" sx={{ mb: 2, border: 2, borderColor: 'warning.main' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="warning.main">
            编辑题目 {index + 1}
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="题目内容"
            value={editedQuestion.content?.title || ''}
            onChange={(e) => setEditedQuestion({
              ...editedQuestion,
              content: { title: e.target.value, format: 'markdown' }
            })}
            sx={{ mb: 2 }}
          />

          {editedQuestion.type === QuestionType.SHORT_ANSWER && (
            <TextField
              fullWidth
              multiline
              rows={2}
              label="参考答案"
              value={typeof editedQuestion.correctAnswer === 'string' ? editedQuestion.correctAnswer : ''}
              onChange={(e) => setEditedQuestion({
                ...editedQuestion,
                correctAnswer: e.target.value
              })}
              sx={{ mb: 2 }}
            />
          )}

          <TextField
            fullWidth
            multiline
            rows={3}
            label="答案解析"
            value={editedQuestion.explanation?.text || ''}
            onChange={(e) => setEditedQuestion({
              ...editedQuestion,
              explanation: { text: e.target.value, format: 'markdown' }
            })}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" onClick={handleSave} size="small">
              保存
            </Button>
            <Button variant="outlined" onClick={handleCancel} size="small">
              取消
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        {/* 题目头部信息 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              题目 {index + 1}
            </Typography>
            <Chip 
              icon={typeInfo.icon}
              label={typeInfo.label} 
              color={typeInfo.color as any} 
              size="small" 
              variant="outlined"
            />
            <Chip 
              label={getDifficultyLabel(question.difficulty)} 
              size="small" 
              variant="filled"
              color={question.difficulty === Difficulty.EASY ? 'success' : 
                     question.difficulty === Difficulty.HARD ? 'error' : 'warning'}
            />
            <Chip label={`${question.score || 5}分`} size="small" variant="outlined" />
          </Box>
          
          <Button
            variant="outlined"
            size="small"
            startIcon={<Edit />}
            onClick={() => setIsEditing(true)}
          >
            编辑
          </Button>
        </Box>

        {/* 题目内容 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" fontWeight="medium" gutterBottom>
            {question.content?.title || '题目内容缺失'}
          </Typography>
        </Box>

        {/* 选项显示 */}
        {renderOptions()}

        {/* 正确答案 */}
        {renderCorrectAnswer()}

        {/* 解析 */}
        {renderExplanation()}

        {/* 标签 */}
        {question.tags && question.tags.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              标签：
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {question.tags.map((tag, tagIndex) => (
                <Chip
                  key={tagIndex}
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
          </Box>
        )}

        {/* 知识点 */}
        {question.knowledgePoints && question.knowledgePoints.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              知识点: {question.knowledgePoints.join(', ')}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * 简化版题目编辑器主组件
 * 专注于正确显示和基础编辑功能
 */
export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  questions,
  onQuestionEdit,
  onPreview,
  mode = 'edit',
  disabled = false
}) => {
  const [localQuestions, setLocalQuestions] = useState<Question[]>(questions);
  const [hasChanges, setHasChanges] = useState(false);

  // 当传入的questions发生变化时，更新本地状态
  React.useEffect(() => {
    setLocalQuestions(questions);
    setHasChanges(false);
  }, [questions]);

  /**
   * 处理题目编辑
   */
  const handleQuestionEdit = (updatedQuestion: Question) => {
    const newQuestions = localQuestions.map(q => 
      q.id === updatedQuestion.id ? updatedQuestion : q
    );
    setLocalQuestions(newQuestions);
    setHasChanges(true);

    // 触发外部回调
    if (onQuestionEdit) {
      onQuestionEdit(updatedQuestion.id, updatedQuestion);
    }
  };

  /**
   * 保存所有更改
   */
  const handleSaveAll = () => {
    // 这里可以添加保存到localStorage或发送到服务器的逻辑
    console.log('保存所有题目:', localQuestions);
    setHasChanges(false);
    
    // 可以在这里添加成功提示
    alert('题目已保存！');
  };

  // 计算统计信息
  const stats = {
    total: localQuestions.length,
    byType: localQuestions.reduce((acc, q) => {
      const typeLabel = getQuestionTypeInfo(q.type).label;
      acc[typeLabel] = (acc[typeLabel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byDifficulty: localQuestions.reduce((acc, q) => {
      const diffLabel = getDifficultyLabel(q.difficulty);
      acc[diffLabel] = (acc[diffLabel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  if (localQuestions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          暂无题目
        </Typography>
        <Typography variant="body2" color="text.secondary">
          请先使用AI生成题目
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* 编辑器头部 */}
      <Card elevation={1} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* 左侧信息 */}
            <Box>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                题目编辑器
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={`共 ${stats.total} 题`} variant="outlined" />
                {Object.entries(stats.byType).map(([type, count]) => (
                  <Chip key={type} label={`${type}: ${count}`} size="small" variant="filled" />
                ))}
              </Box>
            </Box>

            {/* 右侧操作 */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              {hasChanges && (
                <Button
                  variant="outlined"
                  startIcon={<Save />}
                  onClick={handleSaveAll}
                  disabled={disabled}
                >
                  保存更改
                </Button>
              )}
              
              {onPreview && (
                <Button
                  variant="contained"
                  startIcon={<Preview />}
                  onClick={onPreview}
                  disabled={disabled}
                >
                  预览测试
                </Button>
              )}
            </Box>
          </Box>

          {/* 统计信息 */}
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">
                  题型分布: {Object.entries(stats.byType).map(([type, count]) => `${type}${count}题`).join(', ')}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">
                  难度分布: {Object.entries(stats.byDifficulty).map(([diff, count]) => `${diff}${count}题`).join(', ')}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* 更改提示 */}
      {hasChanges && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            您有未保存的更改。请及时保存以免丢失。
          </Typography>
        </Alert>
      )}

      {/* 题目列表 */}
      <Box>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          题目列表
        </Typography>
        
        {localQuestions.map((question, index) => (
          <QuestionDisplay
            key={question.id}
            question={question}
            index={index}
            onEdit={handleQuestionEdit}
          />
        ))}
      </Box>

      {/* 底部操作区 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Save />}
              onClick={handleSaveAll}
              disabled={!hasChanges || disabled}
              size="large"
            >
              {hasChanges ? '保存所有更改' : '已保存'}
            </Button>
            
            {onPreview && (
              <Button
                variant="contained"
                startIcon={<Preview />}
                onClick={onPreview}
                disabled={disabled}
                size="large"
              >
                进入预览模式
              </Button>
            )}
          </Box>
          
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
            预览模式下可以测试题目效果，检查题目是否符合要求
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default QuestionEditor;