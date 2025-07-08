// frontend/src/pages/QuestionGenerator/components/PreviewMode/components/ConfigPanel.tsx

import React from 'react';
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
  Divider,
  Paper,
  FormGroup,
  Chip,
  Alert
} from '@mui/material';
import {
  Settings,
  Visibility,
  Lightbulb,
  School,
  ViewCompact,
  ExpandMore,
  FormatListNumbered,
  Close
} from '@mui/icons-material';

import { PreviewConfig } from '@/types/generator';
import { PreviewState } from '../hooks/usePreviewState';

/**
 * ConfigPanel组件的Props接口
 */
interface ConfigPanelProps {
  open: boolean;                                      // 是否打开对话框
  config: PreviewState;                              // 当前配置
  onConfigChange: (updates: Partial<PreviewConfig>) => void; // 配置更新回调
  onClose: () => void;                               // 关闭对话框回调
}

/**
 * 配置选项界面组件
 * 提供预览显示选项的设置功能
 */
export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  open,
  config,
  onConfigChange,
  onClose
}) => {
  /**
   * 处理配置项变更
   */
  const handleChange = (field: keyof PreviewConfig, value: boolean) => {
    onConfigChange({ [field]: value });
  };

  /**
   * 重置为默认配置
   */
  const handleReset = () => {
    onConfigChange({
      showAnswers: false,
      showExplanations: false,
      showKnowledgePoints: true,
      shuffleQuestions: false,
      shuffleOptions: false
    });
  };

  /**
   * 快速配置预设
   */
  const handlePreset = (preset: 'minimal' | 'standard' | 'complete') => {
    switch (preset) {
      case 'minimal':
        onConfigChange({
          showAnswers: false,
          showExplanations: false,
          showKnowledgePoints: false,
          shuffleQuestions: false,
          shuffleOptions: false
        });
        break;
      case 'standard':
        onConfigChange({
          showAnswers: true,
          showExplanations: false,
          showKnowledgePoints: true,
          shuffleQuestions: false,
          shuffleOptions: false
        });
        break;
      case 'complete':
        onConfigChange({
          showAnswers: true,
          showExplanations: true,
          showKnowledgePoints: true,
          shuffleQuestions: false,
          shuffleOptions: false
        });
        break;
    }
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
          <Settings color="primary" />
          <Typography variant="h6" fontWeight="bold">
            预览配置选项
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ py: 1 }}>
          {/* 快速预设 */}
          <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              快速预设
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="最简模式"
                variant="outlined"
                onClick={() => handlePreset('minimal')}
                clickable
                size="small"
              />
              <Chip
                label="标准模式"
                variant="outlined"
                onClick={() => handlePreset('standard')}
                clickable
                size="small"
              />
              <Chip
                label="完整模式"
                variant="outlined"
                onClick={() => handlePreset('complete')}
                clickable
                size="small"
              />
            </Box>
          </Paper>

          {/* 显示选项配置 */}
          <Grid container spacing={3}>
            {/* 内容显示选项 */}
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Visibility color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight="bold">
                    内容显示
                  </Typography>
                </Box>
                
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.showAnswers}
                        onChange={(e) => handleChange('showAnswers', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          显示正确答案
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          在选项中标识正确答案
                        </Typography>
                      </Box>
                    }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.showExplanations}
                        onChange={(e) => handleChange('showExplanations', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          显示答案解析
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          显示详细的解题过程
                        </Typography>
                      </Box>
                    }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.showKnowledgePoints}
                        onChange={(e) => handleChange('showKnowledgePoints', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          显示知识点
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          显示相关知识点和标签
                        </Typography>
                      </Box>
                    }
                  />
                </FormGroup>
              </Paper>
            </Grid>

            {/* 布局和排序选项 */}
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <ViewCompact color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight="bold">
                    布局选项
                  </Typography>
                </Box>
                
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.shuffleQuestions || false}
                        onChange={(e) => handleChange('shuffleQuestions', e.target.checked)}
                        color="secondary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          随机题目顺序
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          打乱题目显示顺序
                        </Typography>
                      </Box>
                    }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.shuffleOptions || false}
                        onChange={(e) => handleChange('shuffleOptions', e.target.checked)}
                        color="secondary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          随机选项顺序
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          打乱选择题选项顺序
                        </Typography>
                      </Box>
                    }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.showQuestionNumbers !== false}
                        onChange={(e) => handleChange('showQuestionNumbers' as any, e.target.checked)}
                        color="secondary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          显示题目编号
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          在题目前显示序号
                        </Typography>
                      </Box>
                    }
                  />
                </FormGroup>
              </Paper>
            </Grid>
          </Grid>

          {/* 配置说明 */}
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              💡 <strong>使用提示：</strong>
              配置选项会立即生效，您可以随时调整以获得最佳的预览体验。
              建议在导出或保存前确认显示配置符合您的需求。
            </Typography>
          </Alert>

          {/* 当前配置摘要 */}
          <Paper elevation={0} sx={{ mt: 2, p: 2, bgcolor: 'background.default' }}>
            <Typography variant="caption" color="text.secondary" fontWeight="medium" gutterBottom>
              当前配置摘要:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {config.showAnswers && (
                <Chip label="显示答案" size="small" color="success" variant="filled" />
              )}
              {config.showExplanations && (
                <Chip label="显示解析" size="small" color="info" variant="filled" />
              )}
              {config.showKnowledgePoints && (
                <Chip label="显示知识点" size="small" color="primary" variant="filled" />
              )}
              {config.shuffleQuestions && (
                <Chip label="随机题目" size="small" color="warning" variant="outlined" />
              )}
              {config.shuffleOptions && (
                <Chip label="随机选项" size="small" color="warning" variant="outlined" />
              )}
              {!config.showAnswers && !config.showExplanations && !config.showKnowledgePoints && (
                <Chip label="最简模式" size="small" variant="outlined" />
              )}
            </Box>
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleReset} color="inherit">
          重置默认
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} variant="outlined">
          取消
        </Button>
        <Button onClick={onClose} variant="contained">
          确定
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfigPanel;