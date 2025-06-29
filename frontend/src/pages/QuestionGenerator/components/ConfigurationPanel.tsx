// frontend/src/pages/QuestionGenerator/components/ConfigurationPanel.tsx

import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Button,
  Chip,
  IconButton,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  ExpandMore,
  Info,
  CloudUpload,
  Delete,
  Add,
  Tune,
  Psychology,
  School,
  MenuBook
} from '@mui/icons-material';

import { FileUploadZone } from './FileUploadZone';
import { QuestionTypeConfig } from './QuestionTypeConfig';
import {
  GenerationMode,
  GenerationConfig,
  UploadedFile
} from '@/types/generator';
import { QuestionType, Difficulty } from '@/types/question';

/**
 * 配置面板组件的 Props 接口
 */
interface ConfigurationPanelProps {
  config: GenerationConfig;               // 当前配置
  onConfigUpdate: (config: GenerationConfig) => void; // 配置更新回调
  onStartGeneration: () => void;          // 开始生成回调
  disabled?: boolean;                     // 是否禁用
}

/**
 * 学科和年级配置
 */
const SUBJECTS = [
  '数学', '语文', '英语', '物理', '化学', '生物',
  '历史', '地理', '政治', '计算机', '艺术', '体育'
];

const GRADES = [
  '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
  '初中一年级', '初中二年级', '初中三年级',
  '高中一年级', '高中二年级', '高中三年级'
];

const TEXTBOOKS = {
  '数学': ['人教版', '北师大版', '苏教版', '沪教版'],
  '语文': ['人教版', '苏教版', '北师大版', '语文版'],
  '英语': ['人教版', '外研版', '牛津版', '冀教版'],
  '物理': ['人教版', '粤教沪科版', '教科版', '沪科版'],
  '化学': ['人教版', '鲁科版', '苏教版', '沪教版']
};

/**
 * 配置面板组件
 * 提供完整的题目生成配置界面
 */
export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  config,
  onConfigUpdate,
  onStartGeneration,
  disabled = false
}) => {
  // 高级选项展开状态
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  /**
   * 更新配置的通用方法
   */
  const updateConfig = (updates: Partial<GenerationConfig>) => {
    onConfigUpdate({ ...config, ...updates });
  };

  /**
   * 处理文件上传
   */
  const handleFileUpload = (files: UploadedFile[]) => {
    updateConfig({
      uploadedFiles: [...config.uploadedFiles, ...files]
    });
  };

  /**
   * 删除已上传的文件
   */
  const handleFileRemove = (fileId: string) => {
    updateConfig({
      uploadedFiles: config.uploadedFiles.filter(f => f.id !== fileId)
    });
  };

  /**
   * 更新题目类型配置
   * 使用类型安全的方式更新配置
   */
  const handleQuestionTypeUpdate = (type: QuestionType, updates: Partial<GenerationConfig['questionTypes'][QuestionType]>) => {
    updateConfig({
      questionTypes: {
        ...config.questionTypes,
        [type]: {
          ...config.questionTypes[type],
          ...updates
        }
      }
    });
  };

  /**
   * 验证配置是否完整
   */
  const validateConfig = (): { isValid: boolean; message?: string } => {
    if (config.mode === GenerationMode.TEXT_DESCRIPTION && !config.description.trim()) {
      return { isValid: false, message: '请输入题目生成描述' };
    }
    
    if (config.mode === GenerationMode.FILE_UPLOAD && config.uploadedFiles.length === 0) {
      return { isValid: false, message: '请上传至少一个文件' };
    }

    const enabledTypes = Object.values(config.questionTypes).filter(type => type.enabled);
    if (enabledTypes.length === 0) {
      return { isValid: false, message: '请至少启用一种题目类型' };
    }

    const totalQuestions = enabledTypes.reduce((sum, type) => sum + type.count, 0);
    if (totalQuestions === 0) {
      return { isValid: false, message: '题目总数不能为0' };
    }

    return { isValid: true };
  };

  const validation = validateConfig();

  /**
   * 获取可用的教材列表
   */
  const getAvailableTextbooks = () => {
    return TEXTBOOKS[config.subject as keyof typeof TEXTBOOKS] || ['通用版'];
  };

  return (
    <Box>
      {/* 基础配置区域 */}
      <Card elevation={1} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <School color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              基础信息
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {/* 学科选择 */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>学科</InputLabel>
                <Select
                  value={config.subject}
                  label="学科"
                  onChange={(e) => updateConfig({ 
                    subject: e.target.value,
                    textbook: getAvailableTextbooks()[0] // 重置教材
                  })}
                  disabled={disabled}
                >
                  {SUBJECTS.map(subject => (
                    <MenuItem key={subject} value={subject}>
                      {subject}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* 年级选择 */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>年级</InputLabel>
                <Select
                  value={config.grade}
                  label="年级"
                  onChange={(e) => updateConfig({ grade: e.target.value })}
                  disabled={disabled}
                >
                  {GRADES.map(grade => (
                    <MenuItem key={grade} value={grade}>
                      {grade}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* 教材选择 */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>教材版本</InputLabel>
                <Select
                  value={config.textbook || ''}
                  label="教材版本"
                  onChange={(e) => updateConfig({ textbook: e.target.value })}
                  disabled={disabled}
                >
                  {getAvailableTextbooks().map(textbook => (
                    <MenuItem key={textbook} value={textbook}>
                      {textbook}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 内容输入区域 */}
      <Card elevation={1} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <MenuBook color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              内容来源
            </Typography>
          </Box>

          {/* 文字描述模式 */}
          {config.mode === GenerationMode.TEXT_DESCRIPTION && (
            <TextField
              fullWidth
              multiline
              rows={4}
              label="题目生成要求"
              placeholder="请详细描述您希望生成的题目内容，包括知识点、难度要求、题目风格等..."
              value={config.description}
              onChange={(e) => updateConfig({ description: e.target.value })}
              disabled={disabled}
              helperText="提示：描述越详细，生成的题目越符合您的需求"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Psychology color="action" />
                  </InputAdornment>
                )
              }}
            />
          )}

          {/* 文件上传模式 */}
          {config.mode === GenerationMode.FILE_UPLOAD && (
            <Box>
              <FileUploadZone
                onFileUpload={handleFileUpload}
                disabled={disabled}
                acceptedTypes={['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx']}
                maxFileSize={10 * 1024 * 1024} // 10MB
              />
              
              {/* 已上传文件列表 */}
              {config.uploadedFiles.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    已上传文件 ({config.uploadedFiles.length})
                  </Typography>
                  {config.uploadedFiles.map(file => (
                    <Chip
                      key={file.id}
                      label={`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`}
                      onDelete={() => handleFileRemove(file.id)}
                      deleteIcon={<Delete />}
                      variant="outlined"
                      sx={{ mr: 1, mb: 1 }}
                      color={file.status === 'completed' ? 'success' : 'default'}
                    />
                  ))}
                </Box>
              )}

              {/* 补充描述 */}
              <TextField
                fullWidth
                multiline
                rows={2}
                label="补充要求（可选）"
                placeholder="可以补充具体的生成要求，比如重点关注某些章节或知识点..."
                value={config.description}
                onChange={(e) => updateConfig({ description: e.target.value })}
                disabled={disabled}
                sx={{ mt: 2 }}
              />
            </Box>
          )}

          {/* 手动创建模式 */}
          {config.mode === GenerationMode.MANUAL_CREATE && (
            <Alert severity="info">
              手动创建模式下，您可以直接在编辑器中创建题目，或者先配置基本参数让AI提供参考模板。
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 题目类型配置 */}
      <Card elevation={1} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Tune color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              题目配置
            </Typography>
          </Box>

          <QuestionTypeConfig
            config={config.questionTypes}
            onUpdate={handleQuestionTypeUpdate}
            disabled={disabled}
          />
        </CardContent>
      </Card>

      {/* 高级选项 */}
      <Accordion 
        expanded={advancedExpanded} 
        onChange={(_, expanded) => setAdvancedExpanded(expanded)}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6" fontWeight="bold">
            高级选项
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.includeExplanation}
                    onChange={(e) => updateConfig({ includeExplanation: e.target.checked })}
                    disabled={disabled}
                  />
                }
                label="包含答案解析"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.autoGenerateKnowledgePoints}
                    onChange={(e) => updateConfig({ autoGenerateKnowledgePoints: e.target.checked })}
                    disabled={disabled}
                  />
                }
                label="自动生成知识点"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="自定义提示词（可选）"
                placeholder="可以输入自定义的AI提示词来调整生成风格..."
                value={config.customPrompt || ''}
                onChange={(e) => updateConfig({ customPrompt: e.target.value })}
                disabled={disabled}
                helperText="高级用户可以通过自定义提示词来精细控制AI的生成行为"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* 验证提示和开始按钮 */}
      <Box sx={{ mt: 3 }}>
        {!validation.isValid && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {validation.message}
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={onStartGeneration}
          disabled={disabled || !validation.isValid}
          startIcon={<Psychology />}
          sx={{ py: 1.5 }}
        >
          {disabled ? '生成中...' : '开始AI生成题目'}
        </Button>
      </Box>
    </Box>
  );
};

export default ConfigurationPanel;