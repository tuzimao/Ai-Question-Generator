// frontend/src/pages/QuestionGenerator/components/PreviewMode/components/PreviewToolbar.tsx

import React from 'react';
import {
  Box,
  Button,
  Typography,
  Chip,
  Divider,
  Tooltip,
  ButtonGroup,
  useTheme,
  alpha
} from '@mui/material';
import {
  ArrowBack,
  Settings,
  FileDownload,
  Save,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Assignment,
  FilterList,
  GetApp
} from '@mui/icons-material';

/**
 * PreviewToolbar组件的Props接口
 */
interface PreviewToolbarProps {
  statistics: {                                      // 统计信息
    total: number;
    selected: number;
    byType: Record<string, number>;
  };
  selectedCount: number;                             // 选中数量
  showAnswers: boolean;                              // 是否显示答案
  onToggleAnswers: () => void;                       // 切换答案显示
  onShowConfig: () => void;                          // 显示配置面板
  onExport: () => void;                              // 导出操作
  onSave: () => void;                                // 保存操作
  onBack: () => void;                                // 返回操作
  canExport: boolean;                                // 是否可以导出
  canSave: boolean;                                  // 是否可以保存
  disabled?: boolean;                                // 是否禁用
}

/**
 * 预览工具栏组件
 * 提供快速操作和状态显示
 */
export const PreviewToolbar: React.FC<PreviewToolbarProps> = ({
  statistics,
  selectedCount,
  showAnswers,
  onToggleAnswers,
  onShowConfig,
  onExport,
  onSave,
  onBack,
  canExport,
  canSave,
  disabled = false
}) => {
  const theme = useTheme();

  /**
   * 获取题目类型标签
   */
  const getTypeLabel = (type: string): string => {
    const typeLabels: Record<string, string> = {
      'single_choice': '单选',
      'multiple_choice': '多选',
      'true_false': '判断',
      'short_answer': '简答'
    };
    return typeLabels[type] || type;
  };

  /**
   * 获取操作按钮的颜色
   */
  const getButtonColor = (condition: boolean) => 
    condition ? 'primary' : 'inherit';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      {/* 左侧：导航和统计 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {/* 返回按钮 */}
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={onBack}
          disabled={disabled}
          sx={{ flexShrink: 0 }}
        >
          返回编辑
        </Button>

        <Divider orientation="vertical" flexItem />

        {/* 统计信息 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Assignment color="action" fontSize="small" />
          <Typography variant="body2" color="text.secondary" fontWeight="medium">
            题目统计:
          </Typography>
          
          <Chip 
            label={`总计 ${statistics.total}`}
            size="small"
            color="primary"
            variant="outlined"
          />
          
          {Object.entries(statistics.byType).map(([type, count]) => (
            <Chip
              key={type}
              label={`${getTypeLabel(type)} ${count}`}
              size="small"
              variant="outlined"
            />
          ))}
          
          {selectedCount > 0 && (
            <Chip
              label={`已选 ${selectedCount}`}
              size="small"
              color="secondary"
              variant="filled"
              icon={<CheckCircle />}
            />
          )}
        </Box>
      </Box>

      {/* 右侧：操作按钮 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {/* 快速切换按钮组 */}
        <ButtonGroup variant="outlined" size="small">
          <Tooltip title={showAnswers ? "隐藏答案" : "显示答案"}>
            <Button
              onClick={onToggleAnswers}
              disabled={disabled}
              startIcon={showAnswers ? <VisibilityOff /> : <Visibility />}
              color={getButtonColor(showAnswers)}
            >
              {showAnswers ? '隐藏答案' : '显示答案'}
            </Button>
          </Tooltip>
          
          <Tooltip title="显示配置选项">
            <Button
              onClick={onShowConfig}
              disabled={disabled}
              startIcon={<Settings />}
            >
              配置
            </Button>
          </Tooltip>
        </ButtonGroup>

        <Divider orientation="vertical" flexItem />

        {/* 主要操作按钮 */}
        <ButtonGroup variant="contained" size="small">
          <Tooltip title={canExport ? "导出选中题目" : "请先选择题目"}>
            <span>
              <Button
                onClick={onExport}
                disabled={disabled || !canExport}
                startIcon={<FileDownload />}
                color="primary"
              >
                导出
              </Button>
            </span>
          </Tooltip>
          
          <Tooltip title={canSave ? "保存到题库" : "暂无题目可保存"}>
            <span>
              <Button
                onClick={onSave}
                disabled={disabled || !canSave}
                startIcon={<Save />}
                color="success"
              >
                保存题库
              </Button>
            </span>
          </Tooltip>
        </ButtonGroup>
      </Box>
    </Box>
  );
};

export default PreviewToolbar;