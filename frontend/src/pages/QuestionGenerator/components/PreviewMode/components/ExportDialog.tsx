// frontend/src/pages/QuestionGenerator/components/PreviewMode/components/ExportDialog.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Grid,
  Paper,
  FormGroup,
  RadioGroup,
  Radio,
  Chip,
  Alert,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress
} from '@mui/material';
import {
  FileDownload,
  PictureAsPdf,
  Code,
  Print,
  Description,
  CheckCircle,
  Schedule,
  Assignment
} from '@mui/icons-material';

import { Question } from '@/types/question';
import { PreviewState } from '../hooks/usePreviewState';

/**
 * 导出格式类型
 */
export type ExportFormat = 'pdf-complete' | 'pdf-questions-only' | 'json' | 'print';

/**
 * 导出选项接口
 */
export interface ExportOptions {
  format: ExportFormat;                              // 导出格式
  includeAnswers: boolean;                           // 是否包含答案
  includeExplanations: boolean;                      // 是否包含解析
  includeKnowledgePoints: boolean;                   // 是否包含知识点
  includeQuestionNumbers: boolean;                   // 是否包含题目编号
  title: string;                                     // 文档标题
  subtitle: string;                                  // 文档副标题
  pageBreaks: boolean;                               // 是否分页
  compactMode: boolean;                              // 紧凑模式
}

/**
 * ExportDialog组件的Props接口
 */
interface ExportDialogProps {
  open: boolean;                                     // 是否打开对话框
  questions: Question[];                             // 所有题目
  selectedQuestions: string[];                       // 选中的题目ID
  config: PreviewState;                             // 预览配置
  onExport: (format: ExportFormat, options: ExportOptions) => void; // 导出回调
  onClose: () => void;                              // 关闭对话框回调
}

/**
 * 导出格式配置
 */
const EXPORT_FORMATS = {
  'pdf-complete': {
    label: 'PDF完整版',
    description: '包含题目、答案、解析的完整PDF文档',
    icon: <PictureAsPdf />,
    color: 'error' as const,
    features: ['题目内容', '正确答案', '详细解析', '知识点标签', '适合教学使用']
  },
  'pdf-questions-only': {
    label: 'PDF题目版',
    description: '仅包含题目的PDF文档，适合学生答题',
    icon: <Assignment />,
    color: 'primary' as const,
    features: ['仅题目内容', '选项列表', '答题空间', '适合考试使用']
  },
  'json': {
    label: 'JSON数据',
    description: '结构化数据格式，便于程序处理和分享',
    icon: <Code />,
    color: 'secondary' as const,
    features: ['完整数据结构', '便于导入', '程序友好', '跨平台兼容']
  },
  'print': {
    label: '浏览器打印',
    description: '在浏览器中直接打印，快速便捷',
    icon: <Print />,
    color: 'success' as const,
    features: ['即时打印', '自适应格式', '节省空间', '快速预览']
  }
};

/**
 * 导出对话框组件
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  questions,
  selectedQuestions,
  config,
  onExport,
  onClose
}) => {
  // 导出选项状态
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf-complete',
    includeAnswers: config.showAnswers,
    includeExplanations: config.showExplanations,
    includeKnowledgePoints: config.showKnowledgePoints,
    includeQuestionNumbers: true,
    title: '练习题目集',
    subtitle: new Date().toLocaleDateString(),
    pageBreaks: true,
    compactMode: false
  });

  // 导出状态
  const [isExporting, setIsExporting] = useState(false);

  /**
   * 获取要导出的题目
   */
  const questionsToExport = selectedQuestions.length > 0 
    ? questions.filter(q => selectedQuestions.includes(q.id))
    : questions;

  /**
   * 处理导出选项变更
   */
  const handleOptionChange = (field: keyof ExportOptions, value: any) => {
    setExportOptions(prev => ({ ...prev, [field]: value }));
  };

  /**
   * 处理导出操作
   */
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // 模拟导出延迟
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onExport(exportOptions.format, exportOptions);
      
      // 重置状态并关闭对话框
      setIsExporting(false);
      onClose();
    } catch (error) {
      setIsExporting(false);
      console.error('导出失败:', error);
    }
  };

  /**
   * 根据格式更新选项
   */
  const handleFormatChange = (format: ExportFormat) => {
    setExportOptions(prev => {
      const updates: Partial<ExportOptions> = { format };
      
      // 根据格式调整默认选项
      switch (format) {
        case 'pdf-complete':
          updates.includeAnswers = true;
          updates.includeExplanations = true;
          updates.pageBreaks = true;
          break;
        case 'pdf-questions-only':
          updates.includeAnswers = false;
          updates.includeExplanations = false;
          updates.pageBreaks = true;
          break;
        case 'json':
          updates.includeAnswers = true;
          updates.includeExplanations = true;
          updates.pageBreaks = false;
          break;
        case 'print':
          updates.compactMode = true;
          updates.pageBreaks = false;
          break;
      }
      
      return { ...prev, ...updates };
    });
  };

  /**
   * 验证导出选项
   */
  const canExport = questionsToExport.length > 0 && exportOptions.title.trim();

  /**
   * 获取文件预估大小
   */
  const getEstimatedSize = () => {
    const baseSize = questionsToExport.length * 2; // 每题约2KB
    const multiplier = exportOptions.includeExplanations ? 1.5 : 1;
    return Math.round(baseSize * multiplier);
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
          <FileDownload color="primary" />
          <Typography variant="h6" fontWeight="bold">
            导出题目
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ py: 1 }}>
          {/* 导出摘要 */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              将导出 <strong>{questionsToExport.length}</strong> 道题目
              {selectedQuestions.length > 0 && ` (从选中的 ${selectedQuestions.length} 道题目中)`}
            </Typography>
          </Alert>

          {/* 导出格式选择 */}
          <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              选择导出格式
            </Typography>
            
            <RadioGroup
              value={exportOptions.format}
              onChange={(e) => handleFormatChange(e.target.value as ExportFormat)}
            >
              <Grid container spacing={2}>
                {Object.entries(EXPORT_FORMATS).map(([format, formatConfig]) => (
                  <Grid item xs={12} sm={6} key={format}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        border: 2,
                        borderColor: exportOptions.format === format 
                          ? `${formatConfig.color}.main` 
                          : 'divider',
                        '&:hover': {
                          borderColor: `${formatConfig.color}.main`
                        }
                      }}
                      onClick={() => handleFormatChange(format as ExportFormat)}
                    >
                      <FormControlLabel
                        control={<Radio value={format} />}
                        label=""
                        sx={{ m: 0, display: 'none' }}
                      />
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Box sx={{ 
                          p: 1, 
                          borderRadius: 1, 
                          bgcolor: `${formatConfig.color}.light`,
                          color: `${formatConfig.color}.dark`
                        }}>
                          {formatConfig.icon}
                        </Box>
                        
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            {formatConfig.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            {formatConfig.description}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {formatConfig.features.map((feature, idx) => (
                              <Chip
                                key={idx}
                                label={feature}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 20 }}
                              />
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </RadioGroup>
          </Paper>

          {/* 导出选项配置 */}
          <Grid container spacing={3}>
            {/* 内容选项 */}
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  内容选项
                </Typography>
                
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.includeAnswers}
                        onChange={(e) => handleOptionChange('includeAnswers', e.target.checked)}
                        disabled={exportOptions.format === 'pdf-questions-only'}
                      />
                    }
                    label="包含正确答案"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.includeExplanations}
                        onChange={(e) => handleOptionChange('includeExplanations', e.target.checked)}
                        disabled={exportOptions.format === 'pdf-questions-only'}
                      />
                    }
                    label="包含答案解析"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.includeKnowledgePoints}
                        onChange={(e) => handleOptionChange('includeKnowledgePoints', e.target.checked)}
                      />
                    }
                    label="包含知识点"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.includeQuestionNumbers}
                        onChange={(e) => handleOptionChange('includeQuestionNumbers', e.target.checked)}
                      />
                    }
                    label="包含题目编号"
                  />
                </FormGroup>
              </Paper>
            </Grid>

            {/* 格式选项 */}
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  格式选项
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="文档标题"
                    value={exportOptions.title}
                    onChange={(e) => handleOptionChange('title', e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    size="small"
                    label="副标题（可选）"
                    value={exportOptions.subtitle}
                    onChange={(e) => handleOptionChange('subtitle', e.target.value)}
                  />
                </Box>
                
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.pageBreaks}
                        onChange={(e) => handleOptionChange('pageBreaks', e.target.checked)}
                        disabled={exportOptions.format === 'json'}
                      />
                    }
                    label="每题分页"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.compactMode}
                        onChange={(e) => handleOptionChange('compactMode', e.target.checked)}
                      />
                    }
                    label="紧凑模式"
                  />
                </FormGroup>
              </Paper>
            </Grid>
          </Grid>

          {/* 导出摘要 */}
          <Paper elevation={0} sx={{ mt: 3, p: 2, bgcolor: 'background.default' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="medium" gutterBottom>
              导出摘要:
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mt: 1 }}>
              <Chip 
                label={`${questionsToExport.length} 道题目`} 
                size="small" 
                color="primary" 
                icon={<Assignment />}
              />
              <Chip 
                label={`预估 ${getEstimatedSize()}KB`} 
                size="small" 
                variant="outlined"
              />
              <Chip 
                label={`${EXPORT_FORMATS[exportOptions.format].label}`} 
                size="small" 
                color={EXPORT_FORMATS[exportOptions.format].color}
                variant="outlined"
              />
            </Box>
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isExporting}>
          取消
        </Button>
        <Button 
          onClick={handleExport} 
          variant="contained"
          disabled={!canExport || isExporting}
          startIcon={isExporting ? <CircularProgress size={16} /> : <FileDownload />}
        >
          {isExporting ? '导出中...' : '开始导出'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;