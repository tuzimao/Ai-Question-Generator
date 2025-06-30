// frontend/src/pages/QuestionGenerator/index.tsx

import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Alert,
  CircularProgress,
  Fade,
  Divider
} from '@mui/material';
import {
  Settings,
  AutoAwesome,
  Edit,
  Visibility,
  Save
} from '@mui/icons-material';

// 导入组件
import {
  GenerationModeSelector,
  ConfigurationPanel,
  GenerationProgress,
  QuestionEditor,
  PreviewMode
} from './components';

// 导入类型和工具
import {
  GenerationMode,
  GenerationStatus,
  GeneratorState,
  DEFAULT_GENERATION_CONFIG,
  DEFAULT_PREVIEW_CONFIG
} from '@/types/generator';
import { Question } from '@/types/question';

/**
 * 生成步骤配置
 * 根据不同的生成模式显示不同的步骤
 */
const getGenerationSteps = (mode: GenerationMode) => {
  const baseSteps = [
    {
      id: 'configure',
      label: '配置生成参数',
      description: '选择生成方式和配置参数',
      icon: <Settings />
    }
  ];

  const generateStep = {
    id: 'generate',
    label: mode === GenerationMode.IMAGE_IMPORT ? 'AI识别题目' : 'AI生成题目',
    description: mode === GenerationMode.IMAGE_IMPORT ? '使用OCR识别图片中的题目' : '使用AI生成题目内容',
    icon: <AutoAwesome />
  };

  const editStep = {
    id: 'edit',
    label: '编辑和完善',
    description: '编辑题目内容和答案',
    icon: <Edit />
  };

  const previewStep = {
    id: 'preview',
    label: '预览测试',
    description: '预览题目和在线测试',
    icon: <Visibility />
  };

  const saveStep = {
    id: 'save',
    label: '保存题目',
    description: '保存到题库中',
    icon: <Save />
  };

  // 手动创建模式跳过生成步骤
  if (mode === GenerationMode.MANUAL_CREATE) {
    return [
      baseSteps[0],
      editStep,
      previewStep,
      saveStep
    ];
  }

  return [
    ...baseSteps,
    generateStep,
    editStep,
    previewStep,
    saveStep
  ];
};

/**
 * 题目生成器主页面组件
 * 提供完整的题目生成、编辑、预览和保存流程
 */
export const QuestionGenerator: React.FC = () => {
  // 主要状态管理
  const [generatorState, setGeneratorState] = useState<GeneratorState>({
    status: GenerationStatus.CONFIGURING,
    config: DEFAULT_GENERATION_CONFIG,
    progress: null,
    result: null,
    error: null,
    editState: null,
    selectedQuestionId: null,
    previewConfig: DEFAULT_PREVIEW_CONFIG,
    userAnswers: [],
    isPreviewMode: false,
    isSaved: false,
    lastSavedAt: null,
    autoSaveEnabled: true
  });

  // 当前步骤索引
  const [activeStep, setActiveStep] = useState(0);

  // 获取当前模式的步骤配置
  const currentSteps = getGenerationSteps(generatorState.config.mode);

  /**
   * 获取当前步骤信息
   */
  const getCurrentStep = () => currentSteps[activeStep];

  /**
   * 更新生成器状态
   */
  const updateGeneratorState = useCallback((updates: Partial<GeneratorState>) => {
    setGeneratorState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * 处理生成方式选择
   */
  const handleModeSelect = useCallback((mode: GenerationMode) => {
    updateGeneratorState({
      config: {
        ...generatorState.config,
        mode
      }
    });
    // 重置到第一步
    setActiveStep(0);
  }, [generatorState.config, updateGeneratorState]);

  /**
   * 处理配置更新
   */
  const handleConfigUpdate = useCallback((config: typeof generatorState.config) => {
    updateGeneratorState({ config });
  }, [updateGeneratorState]);

  /**
   * 开始生成题目
   */
  const handleStartGeneration = useCallback(async () => {
    updateGeneratorState({
      status: GenerationStatus.GENERATING,
      error: null
    });
    
    // 手动创建模式直接跳到编辑步骤
    if (generatorState.config.mode === GenerationMode.MANUAL_CREATE) {
      updateGeneratorState({
        status: GenerationStatus.EDITING,
        result: {
          questions: [],
          totalCount: 0,
          generationTime: 0
        }
      });
      setActiveStep(1); // 跳到编辑步骤（因为没有生成步骤）
      return;
    }
    
    setActiveStep(1); // 移动到生成/识别步骤
    
    try {
      // TODO: 实现实际的 AI 生成或OCR识别逻辑
      console.log('开始处理，配置：', generatorState.config);
      
      // 模拟处理过程
      // 在实际实现中，这里会调用相应的 API
      
    } catch (error) {
      updateGeneratorState({
        status: GenerationStatus.IDLE,
        error: error instanceof Error ? error.message : '处理失败'
      });
    }
  }, [generatorState.config, updateGeneratorState]);

  /**
   * 处理题目编辑
   */
  const handleQuestionEdit = useCallback((questionId: string, updatedQuestion: Question) => {
    if (!generatorState.result) return;

    const updatedQuestions = generatorState.result.questions.map(q =>
      q.id === questionId ? updatedQuestion : q
    );

    updateGeneratorState({
      result: {
        ...generatorState.result,
        questions: updatedQuestions
      }
    });
  }, [generatorState.result, updateGeneratorState]);

  /**
   * 进入预览模式
   */
  const handleEnterPreview = useCallback(() => {
    updateGeneratorState({
      isPreviewMode: true,
      status: GenerationStatus.PREVIEWING
    });
    setActiveStep(currentSteps.length - 2); // 移动到预览步骤
  }, [updateGeneratorState, currentSteps.length]);

  /**
   * 退出预览模式
   */
  const handleExitPreview = useCallback(() => {
    updateGeneratorState({
      isPreviewMode: false,
      status: GenerationStatus.EDITING,
      userAnswers: [] // 清空答题记录
    });
    setActiveStep(currentSteps.length - 3); // 回到编辑步骤
  }, [updateGeneratorState, currentSteps.length]);

  /**
   * 保存题目
   */
  const handleSaveQuestions = useCallback(async () => {
    if (!generatorState.result) return;

    updateGeneratorState({ status: GenerationStatus.SAVING });

    try {
      // TODO: 实现保存逻辑
      console.log('保存题目：', generatorState.result.questions);
      
      updateGeneratorState({
        status: GenerationStatus.COMPLETED,
        isSaved: true,
        lastSavedAt: new Date()
      });
      
      setActiveStep(currentSteps.length - 1); // 移动到保存步骤
      
    } catch (error) {
      updateGeneratorState({
        status: GenerationStatus.EDITING,
        error: error instanceof Error ? error.message : '保存失败'
      });
    }
  }, [generatorState.result, updateGeneratorState, currentSteps.length]);

  /**
   * 重置到初始状态
   */
  const handleReset = useCallback(() => {
    setGeneratorState({
      status: GenerationStatus.CONFIGURING,
      config: DEFAULT_GENERATION_CONFIG,
      progress: null,
      result: null,
      error: null,
      editState: null,
      selectedQuestionId: null,
      previewConfig: DEFAULT_PREVIEW_CONFIG,
      userAnswers: [],
      isPreviewMode: false,
      isSaved: false,
      lastSavedAt: null,
      autoSaveEnabled: true
    });
    setActiveStep(0);
  }, []);

  /**
   * 渲染当前步骤的内容
   */
  const renderStepContent = () => {
    const currentStep = getCurrentStep();
    
    switch (currentStep.id) {
      case 'configure': // 配置步骤
        return (
          <Box>
            <GenerationModeSelector
              selectedMode={generatorState.config.mode}
              onModeSelect={handleModeSelect}
            />
            <Divider sx={{ my: 3 }} />
            <ConfigurationPanel
              config={generatorState.config}
              onConfigUpdate={handleConfigUpdate}
              onStartGeneration={handleStartGeneration}
              disabled={generatorState.status === GenerationStatus.GENERATING}
            />
          </Box>
        );

      case 'generate': // 生成/识别步骤
        return (
          <GenerationProgress
            progress={generatorState.progress}
            status={generatorState.status}
            mode={generatorState.config.mode}
            onComplete={() => {
              // 根据模式调整步骤索引
              const nextStepIndex = generatorState.config.mode === GenerationMode.MANUAL_CREATE ? 1 : 2;
              setActiveStep(nextStepIndex);
              updateGeneratorState({ status: GenerationStatus.EDITING });
            }}
          />
        );

      case 'edit': // 编辑步骤
        return (
          <QuestionEditor
            questions={generatorState.result?.questions || []}
            onQuestionEdit={handleQuestionEdit}
            onPreview={handleEnterPreview}
            selectedQuestionId={generatorState.selectedQuestionId}
            onQuestionSelect={(id) => updateGeneratorState({ selectedQuestionId: id })}
            mode={generatorState.config.mode}
          />
        );

      case 'preview': // 预览步骤
        return (
          <PreviewMode
            questions={generatorState.result?.questions || []}
            config={generatorState.previewConfig}
            userAnswers={generatorState.userAnswers}
            onAnswerSubmit={(answers) => updateGeneratorState({ userAnswers: answers })}
            onConfigUpdate={(config) => updateGeneratorState({ previewConfig: config })}
            onExitPreview={handleExitPreview}
            onSave={handleSaveQuestions}
          />
        );

      case 'save': // 保存步骤
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" color="success.main" gutterBottom>
              题目已成功保存！
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              共保存了 {generatorState.result?.questions.length || 0} 道题目
            </Typography>
            <Button
              variant="contained"
              onClick={handleReset}
              size="large"
            >
              创建新的题目集
            </Button>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          AI 题目生成器
        </Typography>
        <Typography variant="body1" color="text.secondary">
          使用人工智能快速生成高质量的练习题目
        </Typography>
      </Box>

      {/* 错误提示 */}
      {generatorState.error && (
        <Fade in>
          <Alert
            severity="error"
            onClose={() => updateGeneratorState({ error: null })}
            sx={{ mb: 3 }}
          >
            {generatorState.error}
          </Alert>
        </Fade>
      )}

      {/* 主要内容区域 */}
      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        {/* 步骤指示器 */}
        <Box sx={{ p: 3, backgroundColor: 'background.default' }}>
          <Stepper activeStep={activeStep} orientation="horizontal">
            {currentSteps.map((step, index) => (
              <Step key={step.id}>
                <StepLabel
                  icon={step.icon}
                  optional={
                    index === activeStep && generatorState.status === GenerationStatus.GENERATING ? (
                      <CircularProgress size={16} />
                    ) : undefined
                  }
                >
                  <Typography variant="body2" fontWeight="medium">
                    {step.label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Divider />

        {/* 步骤内容 */}
        <Box sx={{ p: 3, minHeight: 400 }}>
          <Fade in key={activeStep}>
            <Box>
              {renderStepContent()}
            </Box>
          </Fade>
        </Box>
      </Paper>

      {/* 底部状态栏 */}
      {generatorState.lastSavedAt && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            最后保存时间: {generatorState.lastSavedAt.toLocaleString()}
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default QuestionGenerator;