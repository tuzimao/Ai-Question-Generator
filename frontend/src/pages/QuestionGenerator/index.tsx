// frontend/src/pages/QuestionGenerator/index.tsx (修复数据流传递)

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
  QuestionEditor,  // ✅ 确保导入简化版
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

  if (mode === GenerationMode.MANUAL_CREATE) {
    return [baseSteps[0], editStep, previewStep, saveStep];
  }

  return [...baseSteps, generateStep, editStep, previewStep, saveStep];
};

/**
 * 题目生成器主页面组件
 */
export const QuestionGenerator: React.FC = () => {
  // ✅ 主要状态管理
  const [generatorState, setGeneratorState] = useState<GeneratorState>({
    status: GenerationStatus.CONFIGURING,
    config: DEFAULT_GENERATION_CONFIG,
    progress: null,
    result: null,  // ✅ 这里会存储AI生成的题目
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
    console.log('🚀 开始生成题目，当前配置:', generatorState.config);
    
    if (!generatorState.config) {
      updateGeneratorState({
        error: '生成配置缺失，请重新配置参数'
      });
      return;
    }

    updateGeneratorState({
      status: GenerationStatus.GENERATING,
      error: null,
      result: null  // ✅ 清空之前的结果
    });
    
    if (generatorState.config.mode === GenerationMode.MANUAL_CREATE) {
      updateGeneratorState({
        status: GenerationStatus.EDITING,
        result: {
          questions: [],
          totalCount: 0,
          generationTime: 0
        }
      });
      setActiveStep(1);
      return;
    }
    
    setActiveStep(1); // 移动到生成步骤
  }, [generatorState.config, updateGeneratorState]);

  /**
   * ✅ 关键：处理AI生成完成
   */
  const handleGenerationComplete = useCallback((result: any) => {
    console.log('🎉 AI生成完成，收到结果:', result);
    
    // ✅ 确保result包含questions数组
    const questions = result?.questions || [];
    console.log('📝 题目数量:', questions.length);
    
    if (questions.length === 0) {
      updateGeneratorState({
        error: '生成结果为空，请重试',
        status: GenerationStatus.CONFIGURING
      });
      setActiveStep(0);
      return;
    }

    // ✅ 更新状态并进入编辑模式
    updateGeneratorState({
      status: GenerationStatus.EDITING,
      result: {
        questions: questions,
        totalCount: questions.length,
        generationTime: result.generationTime || 0
      },
      error: null
    });
    
    // ✅ 移动到编辑步骤
    const editStepIndex = generatorState.config.mode === GenerationMode.MANUAL_CREATE ? 1 : 2;
    setActiveStep(editStepIndex);
    
    console.log('✅ 状态更新完成，进入编辑模式');
  }, [generatorState.config.mode, updateGeneratorState]);

  /**
   * 处理题目编辑
   */
  const handleQuestionEdit = useCallback((questionId: string, updatedQuestion: Question) => {
    console.log('📝 编辑题目:', questionId, updatedQuestion.content?.title);
    
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
    console.log('👀 进入预览模式');
    updateGeneratorState({
      isPreviewMode: true,
      status: GenerationStatus.PREVIEWING
    });
    setActiveStep(currentSteps.length - 2);
  }, [updateGeneratorState, currentSteps.length]);

  /**
   * 退出预览模式
   */
  const handleExitPreview = useCallback(() => {
    updateGeneratorState({
      isPreviewMode: false,
      status: GenerationStatus.EDITING,
      userAnswers: []
    });
    setActiveStep(currentSteps.length - 3);
  }, [updateGeneratorState, currentSteps.length]);

  /**
   * 保存题目
   */
  const handleSaveQuestions = useCallback(async () => {
    if (!generatorState.result) return;

    updateGeneratorState({ status: GenerationStatus.SAVING });

    try {
      console.log('💾 保存题目:', generatorState.result.questions);
      
      updateGeneratorState({
        status: GenerationStatus.COMPLETED,
        isSaved: true,
        lastSavedAt: new Date()
      });
      
      setActiveStep(currentSteps.length - 1);
      
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
   * ✅ 渲染当前步骤的内容
   */
  const renderStepContent = () => {
    const currentStep = getCurrentStep();
    
    console.log('🎨 渲染步骤:', currentStep.id, '状态:', generatorState.status);
    
    switch (currentStep.id) {
      case 'configure':
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

      case 'generate':
        return (
          <GenerationProgress
            progress={generatorState.progress}
            status={generatorState.status}
            mode={generatorState.config.mode}
            config={generatorState.config}
            onComplete={handleGenerationComplete}  // ✅ 关键回调
            onCancel={() => {
              updateGeneratorState({ status: GenerationStatus.CONFIGURING });
              setActiveStep(0);
            }}
            onRetry={() => {
              updateGeneratorState({ 
                status: GenerationStatus.GENERATING,
                error: null,
                result: null
              });
              setActiveStep(1);
            }}
            onBack={() => {
              updateGeneratorState({ status: GenerationStatus.CONFIGURING });
              setActiveStep(0);
            }}
          />
        );

      case 'edit':
        // ✅ 关键：确保传递正确的题目数据
        const questionsToEdit = generatorState.result?.questions || [];
        console.log('📋 传递给编辑器的题目:', questionsToEdit.length, '道题目');
        
        if (questionsToEdit.length === 0) {
          return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                暂无题目数据
              </Typography>
              <Button 
                variant="outlined" 
                onClick={() => setActiveStep(0)}
                sx={{ mt: 2 }}
              >
                返回重新生成
              </Button>
            </Box>
          );
        }

        return (
          <QuestionEditor
            questions={questionsToEdit}  // ✅ 传递题目数据
            onQuestionEdit={handleQuestionEdit}
            onPreview={handleEnterPreview}
            selectedQuestionId={generatorState.selectedQuestionId}
            onQuestionSelect={(id) => updateGeneratorState({ selectedQuestionId: id })}
            mode={generatorState.config.mode}
          />
        );

      case 'preview':
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

      case 'save':
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

      {/* ✅ 调试信息（开发模式下显示） */}
      {process.env.NODE_ENV === 'development' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="caption">
            🛠️ <strong>调试信息：</strong> 
            当前步骤: {getCurrentStep().id} | 
            状态: {generatorState.status} | 
            题目数量: {generatorState.result?.questions?.length || 0}
          </Typography>
        </Alert>
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