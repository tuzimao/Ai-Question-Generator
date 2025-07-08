// frontend/src/pages/QuestionGenerator/components/PreviewMode/components/SaveToLibraryDialog.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Grid,
  Paper,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Save,
  School,
  Category,
  Tag,
  Assignment,
  CheckCircle,
  Storage,
  Info
} from '@mui/icons-material';

import { Question } from '@/types/question';

/**
 * 保存数据接口
 */
export interface SaveToLibraryData {
  title: string;                                     // 题目集标题
  description: string;                               // 描述
  subject: string;                                   // 科目
  grade: string;                                     // 年级
  category: string;                                  // 分类
  tags: string[];                                    // 标签
  isPublic: boolean;                                 // 是否公开
  questionIds: string[];                             // 选中的题目ID
}

/**
 * SaveToLibraryDialog组件的Props接口
 */
interface SaveToLibraryDialogProps {
  open: boolean;                                     // 是否打开对话框
  questions: Question[];                             // 所有题目
  selectedQuestions: string[];                       // 选中的题目ID
  onSave: (data: SaveToLibraryData) => void;        // 保存回调
  onClose: () => void;                              // 关闭对话框回调
}

/**
 * 科目选项
 */
const SUBJECTS = [
  '数学', '语文', '英语', '物理', '化学', '生物',
  '历史', '地理', '政治', '计算机', '艺术', '体育'
];

/**
 * 年级选项
 */
const GRADES = [
  '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
  '初中一年级', '初中二年级', '初中三年级',
  '高中一年级', '高中二年级', '高中三年级', '大学', '研究生'
];

/**
 * 分类选项
 */
const CATEGORIES = [
  '课堂练习', '课后作业', '单元测试', '期中考试', '期末考试',
  '模拟考试', '竞赛题目', '基础训练', '提高练习', '综合测评'
];

/**
 * 常用标签
 */
const COMMON_TAGS = [
  '基础题', '提高题', '综合题', '易错题', '经典题',
  '新课标', '考试重点', '课外拓展', '实际应用'
];

/**
 * 保存到题库对话框组件
 */
export const SaveToLibraryDialog: React.FC<SaveToLibraryDialogProps> = ({
  open,
  questions,
  selectedQuestions,
  onSave,
  onClose
}) => {
  // 保存数据状态
  const [saveData, setSaveData] = useState<SaveToLibraryData>({
    title: '',
    description: '',
    subject: '',
    grade: '',
    category: '',
    tags: [],
    isPublic: false,
    questionIds: selectedQuestions.length > 0 ? selectedQuestions : questions.map(q => q.id)
  });

  // 保存状态
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * 获取要保存的题目
   */
  const questionsToSave = saveData.questionIds.length > 0 
    ? questions.filter(q => saveData.questionIds.includes(q.id))
    : questions;

  /**
   * 处理表单字段变更
   */
  const handleFieldChange = (field: keyof SaveToLibraryData, value: any) => {
    setSaveData(prev => ({ ...prev, [field]: value }));
    
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  /**
   * 验证表单
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!saveData.title.trim()) {
      newErrors.title = '请输入题目集标题';
    }

    if (!saveData.subject) {
      newErrors.subject = '请选择科目';
    }

    if (!saveData.category) {
      newErrors.category = '请选择分类';
    }

    if (questionsToSave.length === 0) {
      newErrors.questions = '没有选择要保存的题目';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * 处理保存操作
   */
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      // 模拟保存延迟
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 调用保存回调
      onSave(saveData);

      // 重置状态
      setIsSaving(false);
      onClose();
    } catch (error) {
      setIsSaving(false);
      console.error('保存失败:', error);
    }
  };

  /**
   * 自动生成标题建议
   */
  const generateTitleSuggestion = () => {
    const parts = [];
    if (saveData.subject) parts.push(saveData.subject);
    if (saveData.grade) parts.push(saveData.grade);
    if (saveData.category) parts.push(saveData.category);
    parts.push(`${questionsToSave.length}题`);
    
    const suggestion = parts.join(' - ');
    handleFieldChange('title', suggestion);
  };

  /**
   * 获取题目类型统计
   */
  const getQuestionTypeStats = () => {
    const stats = questionsToSave.reduce((acc, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeLabels: Record<string, string> = {
      'single_choice': '单选',
      'multiple_choice': '多选',
      'true_false': '判断',
      'short_answer': '简答'
    };

    return Object.entries(stats).map(([type, count]) => ({
      type: typeLabels[type] || type,
      count
    }));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Save color="primary" />
          <Typography variant="h6" fontWeight="bold">
            保存到题库
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ py: 1 }}>
          {/* 保存摘要 */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              将保存 <strong>{questionsToSave.length}</strong> 道题目到题库中
              {selectedQuestions.length > 0 && ` (从选中的 ${selectedQuestions.length} 道题目中)`}
            </Typography>
          </Alert>

          {/* 题目集基本信息 */}
          <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                题目集信息
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={generateTitleSuggestion}
                disabled={!saveData.subject || !saveData.category}
              >
                自动生成标题
              </Button>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="题目集标题"
                  value={saveData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  error={!!errors.title}
                  helperText={errors.title || '请输入一个清晰的题目集名称'}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="描述（可选）"
                  value={saveData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="描述这套题目的用途、特点或适用场景..."
                />
              </Grid>
            </Grid>
          </Paper>

          {/* 分类信息 */}
          <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              分类信息
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth error={!!errors.subject}>
                  <InputLabel>科目 *</InputLabel>
                  <Select
                    value={saveData.subject}
                    label="科目 *"
                    onChange={(e) => handleFieldChange('subject', e.target.value)}
                  >
                    {SUBJECTS.map(subject => (
                      <MenuItem key={subject} value={subject}>
                        {subject}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>年级</InputLabel>
                  <Select
                    value={saveData.grade}
                    label="年级"
                    onChange={(e) => handleFieldChange('grade', e.target.value)}
                  >
                    {GRADES.map(grade => (
                      <MenuItem key={grade} value={grade}>
                        {grade}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth error={!!errors.category}>
                  <InputLabel>分类 *</InputLabel>
                  <Select
                    value={saveData.category}
                    label="分类 *"
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                  >
                    {CATEGORIES.map(category => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* 标签设置 */}
          <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              标签设置
            </Typography>
            
            <Autocomplete
              multiple
              freeSolo
              options={COMMON_TAGS}
              value={saveData.tags}
              onChange={(_, newValue) => handleFieldChange('tags', newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option}
                    {...getTagProps({ index })}
                    key={option}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="标签"
                  placeholder="选择或输入标签..."
                  helperText="添加标签有助于后续搜索和分类"
                />
              )}
            />
          </Paper>

          {/* 题目统计 */}
          <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              题目构成
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    题目类型分布:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {getQuestionTypeStats().map(({ type, count }) => (
                      <Chip
                        key={type}
                        label={`${type} ${count}题`}
                        size="small"
                        variant="outlined"
                        icon={<Assignment />}
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    保存位置:
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Storage color="action" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      本地题库 (MySQL数据库)
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    * 暂时保存在本地，后续将同步到云端题库
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* 错误提示 */}
          {Object.keys(errors).length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                请修正以下问题：
              </Typography>
              <List dense>
                {Object.entries(errors).map(([field, message]) => (
                  <ListItem key={field} sx={{ py: 0 }}>
                    <ListItemText primary={`• ${message}`} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isSaving}>
          取消
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} /> : <Save />}
        >
          {isSaving ? '保存中...' : '保存到题库'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveToLibraryDialog;