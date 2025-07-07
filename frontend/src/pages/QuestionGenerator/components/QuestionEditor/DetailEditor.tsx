// frontend/src/pages/QuestionGenerator/components/QuestionEditor/DetailEditor.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Button,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Tooltip
} from '@mui/material';
import {
  ExpandMore,
  Add,
  Delete,
  Edit,
  Save,
  Undo,
  Tag,
  Help
} from '@mui/icons-material';

import { EditableQuestion } from '@/types/editor';
import { Question, QuestionType, Difficulty } from '@/types/question';
import { QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, COMMON_TAGS } from '@/types/editor';
import { ContentEditor } from './SubComponents';
import { OptionEditor } from './OptionEditor';

/**
 * DetailEditor组件的Props接口
 */
interface DetailEditorProps {
  question: EditableQuestion;                     // 要编辑的题目
  onQuestionUpdate: (questionId: string, updates: Partial<Question>) => void; // 更新回调
  onAddTag: (questionId: string, tag: string) => void; // 添加标签回调
  onRemoveTag: (questionId: string, tag: string) => void; // 删除标签回调
  disabled?: boolean;                             // 是否禁用编辑
  mode?: 'edit' | 'preview';                      // 编辑模式
}

/**
 * 内联标签管理器组件
 * 由于导入问题，我们在这里直接实现TagManager功能
 */
interface TagManagerProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  disabled?: boolean;
  suggestedTags?: readonly string[];
}

const TagManager: React.FC<TagManagerProps> = ({
  tags,
  onAddTag,
  onRemoveTag,
  disabled = false,
  suggestedTags = []
}) => {
  const [newTag, setNewTag] = useState('');

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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 120, overflow: 'auto' }}>
            {availableSuggestions.slice(0, 15).map((tag, index) => (
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
        </Box>
      )}

      {/* 使用提示 */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        标签有助于题目分类和搜索。建议添加学科、知识点、难度等相关标签。
      </Typography>
    </Box>
  );
};

/**
 * 详细编辑器组件
 * 提供单个题目的详细编辑功能
 */
export const DetailEditor: React.FC<DetailEditorProps> = ({
  question,
  onQuestionUpdate,
  onAddTag,
  onRemoveTag,
  disabled = false,
  mode = 'edit'
}) => {
  // 本地编辑状态
  const [localChanges, setLocalChanges] = useState<Partial<Question>>({});
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  
  // ✅ 修复：默认展开更多区域，包括标签、知识点、高级设置
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'content', 
    'answer', 
    'explanation',
    'tags',      // ✅ 默认展开标签管理
    'knowledge', // ✅ 默认展开知识点设置
    'advanced'   // ✅ 默认展开高级设置
  ]);

  /**
   * 重置本地更改当题目ID变化时
   */
  useEffect(() => {
    setLocalChanges({});
    setHasLocalChanges(false);
  }, [question.id]);

  /**
   * 处理本地更改
   */
  const handleLocalChange = (field: string, value: any) => {
    const newChanges = { ...localChanges, [field]: value };
    setLocalChanges(newChanges);
    setHasLocalChanges(true);
  };

  /**
   * 提交更改
   */
  const commitChanges = () => {
    if (hasLocalChanges) {
      onQuestionUpdate(question.id, localChanges);
      setLocalChanges({});
      setHasLocalChanges(false);
    }
  };

  /**
   * 撤销更改
   */
  const discardChanges = () => {
    setLocalChanges({});
    setHasLocalChanges(false);
  };

  /**
   * 切换展开区域
   */
  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  /**
   * 获取当前显示的题目数据（合并本地更改）
   */
  const currentQuestion: Question = {
    ...question,
    ...localChanges
  };

  /**
   * 处理题目类型更改
   */
  const handleTypeChange = (newType: QuestionType) => {
    let updates: Partial<Question> = { type: newType };
    
    // 根据题目类型调整默认值
    if (newType === QuestionType.TRUE_FALSE) {
      updates.options = [
        { id: 'true', text: '正确', isCorrect: false },
        { id: 'false', text: '错误', isCorrect: false }
      ];
      updates.correctAnswer = '';
    } else if (newType === QuestionType.SINGLE_CHOICE || newType === QuestionType.MULTIPLE_CHOICE) {
      if (!currentQuestion.options || currentQuestion.options.length < 2) {
        updates.options = [
          { id: 'A', text: '', isCorrect: false },
          { id: 'B', text: '', isCorrect: false },
          { id: 'C', text: '', isCorrect: false },
          { id: 'D', text: '', isCorrect: false }
        ];
      }
      updates.correctAnswer = newType === QuestionType.MULTIPLE_CHOICE ? [] : '';
    } else if (newType === QuestionType.SHORT_ANSWER) {
      updates.options = [];
      updates.correctAnswer = '';
    }

    setLocalChanges(prev => ({ ...prev, ...updates }));
    setHasLocalChanges(true);
  };

  /**
   * 处理内容更改
   */
  const handleContentChange = (content: string) => {
    handleLocalChange('content', { 
      title: content, 
      format: 'markdown' 
    });
  };

  /**
   * 处理解析更改
   */
  const handleExplanationChange = (explanation: string) => {
    handleLocalChange('explanation', { 
      text: explanation, 
      format: 'markdown' 
    });
  };

  /**
   * 是否显示选项编辑器
   */
  const shouldShowOptions = () => {
    return currentQuestion.type === QuestionType.SINGLE_CHOICE ||
           currentQuestion.type === QuestionType.MULTIPLE_CHOICE ||
           currentQuestion.type === QuestionType.TRUE_FALSE;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 编辑器头部 */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            题目详细编辑
          </Typography>
          
          {/* 保存和撤销按钮 */}
          {hasLocalChanges && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Undo />}
                onClick={discardChanges}
                disabled={disabled}
              >
                撤销
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<Save />}
                onClick={commitChanges}
                disabled={disabled}
              >
                保存
              </Button>
            </Box>
          )}
        </Box>

        {/* 基础信息 */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>题目类型</InputLabel>
              <Select
                value={currentQuestion.type}
                label="题目类型"
                onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                disabled={disabled || mode === 'preview'}
              >
                {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
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
                disabled={disabled || mode === 'preview'}
              >
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
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
              disabled={disabled || mode === 'preview'}
              inputProps={{ min: 1, max: 100 }}
            />
          </Grid>
        </Grid>

        {/* 验证错误提示 */}
        {question.editState.validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              请修正以下错误：
            </Typography>
            {question.editState.validationErrors.map((error, index) => (
              <Typography key={index} variant="body2">
                • {error}
              </Typography>
            ))}
          </Alert>
        )}
      </Box>

      {/* 编辑内容区域 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 0 }}>
        {/* 题目内容编辑 */}
        <Accordion 
          expanded={expandedSections.includes('content')}
          onChange={() => toggleSection('content')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle1" fontWeight="medium">
              题目内容
            </Typography>
            {!currentQuestion.content?.title?.trim() && (
              <Chip label="必填" color="error" size="small" sx={{ ml: 1 }} />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <ContentEditor
              content={currentQuestion.content?.title || ''}
              onChange={handleContentChange}
              disabled={disabled || mode === 'preview'}
              placeholder="请输入题目内容..."
            />
          </AccordionDetails>
        </Accordion>

        {/* 选项编辑 */}
        {shouldShowOptions() && (
          <Accordion 
            expanded={expandedSections.includes('options')}
            onChange={() => toggleSection('options')}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">
                选项设置
              </Typography>
              {(!currentQuestion.options || currentQuestion.options.length < 2) && (
                <Chip label="必填" color="error" size="small" sx={{ ml: 1 }} />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <OptionEditor
                type={currentQuestion.type}
                options={currentQuestion.options || []}
                correctAnswer={currentQuestion.correctAnswer}
                onChange={(options, correctAnswer) => {
                  setLocalChanges(prev => ({ 
                    ...prev, 
                    options, 
                    correctAnswer 
                  }));
                  setHasLocalChanges(true);
                }}
                disabled={disabled || mode === 'preview'}
              />
            </AccordionDetails>
          </Accordion>
        )}

        {/* 答案设置（简答题） */}
        {currentQuestion.type === QuestionType.SHORT_ANSWER && (
          <Accordion 
            expanded={expandedSections.includes('answer')}
            onChange={() => toggleSection('answer')}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">
                参考答案
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={typeof currentQuestion.correctAnswer === 'string' ? currentQuestion.correctAnswer : ''}
                onChange={(e) => handleLocalChange('correctAnswer', e.target.value)}
                disabled={disabled || mode === 'preview'}
                placeholder="请输入参考答案..."
                helperText="简答题的参考答案，用于评分参考"
              />
            </AccordionDetails>
          </Accordion>
        )}

        {/* 答案解析 */}
        <Accordion 
          expanded={expandedSections.includes('explanation')}
          onChange={() => toggleSection('explanation')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle1" fontWeight="medium">
              答案解析
            </Typography>
            <Tooltip title="详细的解题步骤和知识点说明">
              <Help fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
            </Tooltip>
          </AccordionSummary>
          <AccordionDetails>
            <ContentEditor
              content={currentQuestion.explanation?.text || ''}
              onChange={handleExplanationChange}
              disabled={disabled || mode === 'preview'}
              placeholder="请输入答案解析..."
              rows={4}
            />
          </AccordionDetails>
        </Accordion>

        {/* ✅ 修复：标签管理 - 确保默认展开 */}
        <Accordion 
          expanded={expandedSections.includes('tags')}
          onChange={() => toggleSection('tags')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle1" fontWeight="medium">
              题目标签
            </Typography>
            <Tooltip title="为题目添加标签，便于分类和搜索">
              <Tag fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
            </Tooltip>
          </AccordionSummary>
          <AccordionDetails>
            <TagManager
              tags={currentQuestion.tags || []}
              onAddTag={(tag) => onAddTag(question.id, tag)}
              onRemoveTag={(tag) => onRemoveTag(question.id, tag)}
              disabled={disabled || mode === 'preview'}
              suggestedTags={COMMON_TAGS}
            />
          </AccordionDetails>
        </Accordion>

        {/* ✅ 修复：知识点设置 - 确保默认展开 */}
        <Accordion 
          expanded={expandedSections.includes('knowledge')}
          onChange={() => toggleSection('knowledge')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle1" fontWeight="medium">
              知识点
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={currentQuestion.knowledgePoints?.join(', ') || ''}
              onChange={(e) => {
                const points = e.target.value.split(',').map(p => p.trim()).filter(p => p);
                handleLocalChange('knowledgePoints', points);
              }}
              disabled={disabled || mode === 'preview'}
              placeholder="请输入相关知识点，用逗号分隔..."
              helperText="例如：三角函数, 正弦定理, 余弦定理"
            />
          </AccordionDetails>
        </Accordion>

        {/* ✅ 修复：高级设置 - 确保默认展开 */}
        <Accordion 
          expanded={expandedSections.includes('advanced')}
          onChange={() => toggleSection('advanced')}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle1" fontWeight="medium">
              高级设置
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="预计答题时间 (秒)"
                  type="number"
                  value={currentQuestion.estimatedTime || 120}
                  onChange={(e) => handleLocalChange('estimatedTime', parseInt(e.target.value) || 120)}
                  disabled={disabled || mode === 'preview'}
                  inputProps={{ min: 30, max: 3600 }}
                  helperText="学生完成此题的预计时间"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="题目分值"
                  type="number"
                  value={currentQuestion.score || 5}
                  onChange={(e) => handleLocalChange('score', parseInt(e.target.value) || 5)}
                  disabled={disabled || mode === 'preview'}
                  inputProps={{ min: 1, max: 100 }}
                  helperText="此题在考试中的分值"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* 底部状态栏 */}
      {hasLocalChanges && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', backgroundColor: 'action.hover' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="warning.main">
              有未保存的更改
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={discardChanges}
                disabled={disabled}
              >
                撤销
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={commitChanges}
                disabled={disabled}
              >
                保存更改
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DetailEditor;