// frontend/src/pages/QuestionGenerator/components/PreviewMode/PreviewMode.tsx

import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  Divider,
  Fade,
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
  School,
  Assignment
} from '@mui/icons-material';

import { Question } from '@/types/question';
import { PreviewConfig, UserAnswerRecord } from '@/types/generator';
import { QuestionPreviewList } from './components/QuestionPreviewList';
import { PreviewToolbar } from './components/PreviewToolbar';
import { ConfigPanel } from './components/ConfigPanel';
import { ExportDialog, ExportFormat } from './components/ExportDialog';
import { SaveToLibraryDialog } from './components/SaveToLibraryDialog';
import { usePreviewState } from './hooks/usePreviewState';
import { ExportUtils, LibraryUtils } from './utils/exportUtils';

/**
 * PreviewMode组件的Props接口
 */
interface PreviewModeProps {
  questions: Question[];                              // 要预览的题目列表
  config: PreviewConfig;                             // 预览配置
  userAnswers?: UserAnswerRecord[];                  // 用户答案（可选）
  onAnswerSubmit?: (answers: UserAnswerRecord[]) => void; // 答案提交回调（可选）
  onConfigUpdate: (config: PreviewConfig) => void;   // 配置更新回调
  onExitPreview: () => void;                         // 退出预览回调
  onSave: () => void;                                // 保存回调
  disabled?: boolean;                                // 是否禁用操作
}

/**
 * PreviewMode主组件
 * 提供题目预览、配置、导出和保存功能
 */
export const PreviewMode: React.FC<PreviewModeProps> = ({
  questions,
  config,
  userAnswers = [],
  onAnswerSubmit,
  onConfigUpdate,
  onExitPreview,
  onSave,
  disabled = false
}) => {
  const theme = useTheme();
  
  // 使用预览状态管理Hook
  const {
    previewState,
    selectedQuestions,
    handleQuestionSelect,
    handleSelectAll,
    handleConfigChange,
    resetSelection
  } = usePreviewState(questions, config);

  // 对话框状态
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  /**
   * 处理配置更新
   */
  const handlePreviewConfigUpdate = useCallback((updates: Partial<PreviewConfig>) => {
    const newConfig = { ...config, ...updates };
    onConfigUpdate(newConfig);
    handleConfigChange(updates);
  }, [config, onConfigUpdate, handleConfigChange]);

  /**
   * 处理导出操作
   */
  const handleExport = useCallback(async (format: string, options: any) => {
    try {
      const questionsToExport = selectedQuestions.size > 0 
        ? questions.filter(q => selectedQuestions.has(q.id))
        : questions;
      
      await ExportUtils.exportQuestions(questionsToExport, format as any, options);
      console.log('✅ 导出成功:', { format, questionsCount: questionsToExport.length });
    } catch (error) {
      console.error('❌ 导出失败:', error);
      // 这里可以显示错误提示给用户
    }
    setShowExportDialog(false);
  }, [questions, selectedQuestions]);

  /**
   * 处理保存到题库
   */
  const handleSaveToLibrary = useCallback(async (saveData: any) => {
    try {
      const questionsToSave = saveData.questionIds.length > 0 
        ? questions.filter(q => saveData.questionIds.includes(q.id))
        : questions;
      
      const libraryId = await LibraryUtils.saveToLibrary(questionsToSave, saveData);
      console.log('✅ 保存成功到题库:', libraryId);
      
      setShowSaveDialog(false);
      onSave();
    } catch (error) {
      console.error('❌ 保存失败:', error);
      // 这里可以显示错误提示给用户
    }
  }, [questions, onSave]);

  /**
   * 计算统计信息
   */
  const statistics = {
    total: questions.length,
    selected: selectedQuestions.size,
    byType: questions.reduce((acc, q) => {
      const typeKey = q.type;
      acc[typeKey] = (acc[typeKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  /**
   * 验证是否可以执行操作
   */
  const canExport = selectedQuestions.size > 0;
  const canSave = questions.length > 0;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 页面标题区域 */}
      <Fade in>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            题目预览
          </Typography>
          <Typography variant="body1" color="text.secondary">
            检查生成的题目内容，确认无误后可以保存到题库或导出使用
          </Typography>
        </Box>
      </Fade>

      {/* 工具栏 */}
      <Fade in>
        <Card elevation={1} sx={{ mb: 3 }}>
          <CardContent sx={{ py: 2 }}>
            <PreviewToolbar
              statistics={statistics}
              selectedCount={selectedQuestions.size}
              showAnswers={previewState.showAnswers}
              onToggleAnswers={() => handlePreviewConfigUpdate({ 
                showAnswers: !previewState.showAnswers 
              })}
              onShowConfig={() => setShowConfigPanel(true)}
              onExport={() => setShowExportDialog(true)}
              onSave={() => setShowSaveDialog(true)}
              onBack={onExitPreview}
              canExport={canExport}
              canSave={canSave}
              disabled={disabled}
            />
          </CardContent>
        </Card>
      </Fade>

      {/* 题目统计信息 */}
      <Fade in>
        <Card 
          elevation={1} 
          sx={{ 
            mb: 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.05)})`
          }}
        >
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assignment color="primary" />
                <Typography variant="h6" fontWeight="bold">
                  题目总览
                </Typography>
              </Box>
              
              <Divider orientation="vertical" flexItem />
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip 
                  label={`共 ${statistics.total} 题`} 
                  color="primary" 
                  variant="filled"
                />
                {Object.entries(statistics.byType).map(([type, count]) => (
                  <Chip
                    key={type}
                    label={`${getTypeLabel(type)} ${count}题`}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>

              {selectedQuestions.size > 0 && (
                <>
                  <Divider orientation="vertical" flexItem />
                  <Chip 
                    label={`已选 ${selectedQuestions.size} 题`} 
                    color="secondary" 
                    variant="filled"
                    size="small"
                  />
                </>
              )}
            </Box>
          </CardContent>
        </Card>
      </Fade>

      {/* 主要内容区域 */}
      <Fade in>
        <Card elevation={2}>
          <CardContent sx={{ p: 0 }}>
            {questions.length > 0 ? (
              <QuestionPreviewList
                questions={questions}
                config={previewState}
                selectedQuestions={selectedQuestions}
                onQuestionSelect={handleQuestionSelect}
                onSelectAll={handleSelectAll}
                disabled={disabled}
              />
            ) : (
              <Box sx={{ 
                py: 8, 
                textAlign: 'center',
                color: 'text.secondary'
              }}>
                <School sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                <Typography variant="h6" gutterBottom>
                  暂无题目
                </Typography>
                <Typography variant="body2">
                  请先返回编辑器生成或添加题目
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBack />}
                  onClick={onExitPreview}
                  sx={{ mt: 2 }}
                >
                  返回编辑
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Fade>

      {/* 配置面板对话框 */}
      <ConfigPanel
        open={showConfigPanel}
        config={previewState}
        onConfigChange={handlePreviewConfigUpdate}
        onClose={() => setShowConfigPanel(false)}
      />

      {/* 导出对话框 */}
      <ExportDialog
        open={showExportDialog}
        questions={questions}
        selectedQuestions={Array.from(selectedQuestions)}
        config={previewState}
        onExport={handleExport}
        onClose={() => setShowExportDialog(false)}
      />

      {/* 保存到题库对话框 */}
      <SaveToLibraryDialog
        open={showSaveDialog}
        questions={questions}
        selectedQuestions={Array.from(selectedQuestions)}
        onSave={handleSaveToLibrary}
        onClose={() => setShowSaveDialog(false)}
      />

      {/* 底部提示信息 */}
      {questions.length > 0 && (
        <Alert 
          severity="info" 
          sx={{ mt: 3 }}
          icon={<Visibility />}
        >
          <Typography variant="body2">
            💡 <strong>使用提示：</strong>
            您可以选择性预览题目内容，调整显示选项，然后选择导出格式或保存到题库。
            发现问题可随时返回编辑器进行修改。
          </Typography>
        </Alert>
      )}
    </Container>
  );
};

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

export default PreviewMode;