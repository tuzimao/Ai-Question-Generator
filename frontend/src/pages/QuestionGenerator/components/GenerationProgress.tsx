// frontend/src/pages/QuestionGenerator/components/GenerationProgress.tsx (修复数据传递)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress, Button, Alert, Grid, List, ListItem,
  ListItemIcon, ListItemText, Fade, CircularProgress
} from '@mui/material';
import {
  AutoAwesome, Schedule, Psychology, Stop, Pause, PlayArrow, Refresh, ArrowBack, Speed,
  TrendingUp, Error as ErrorIcon, Warning
} from '@mui/icons-material';

import { GenerationMode, GenerationStatus } from '@/types/generator';
import { AIGenerationService, ProgressUpdate, Question } from '@/services/aiGenerationService';

interface GenerationProgressProps {
  progress: any;
  status: GenerationStatus;
  mode: GenerationMode;
  config: any;
  onComplete: (result: any) => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onBack?: () => void;
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  status,
  mode,
  config,
  onComplete,
  onCancel,
  onRetry,
  onBack
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [generationLogs, setGenerationLogs] = useState<LogEntry[]>([]);
  const [currentProgress, setCurrentProgress] = useState<ProgressUpdate | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  
  // ✅ 使用refs来避免闭包问题
  const generationServiceRef = useRef<AIGenerationService | null>(null);
  const isGeneratingRef = useRef(false);
  const questionsRef = useRef<Question[]>([]); // 保存题目引用
  const hasStartedRef = useRef(false); // 防止重复启动

  // 同步questions到ref
  useEffect(() => {
    questionsRef.current = questions;
    console.log('📋 更新questionsRef:', questions.length, '道题目');
  }, [questions]);

  // addLog 回调
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const id = `${Date.now()}-${Math.random()}`;
    setGenerationLogs(prev => [...prev, { id, timestamp, message, type }]);
  }, []);

  // ✅ 初始化服务实例
  useEffect(() => {
    if (!generationServiceRef.current) {
      console.log('🔧 初始化AI生成服务');
      generationServiceRef.current = new AIGenerationService();
      
      // 设置题目接收回调
      generationServiceRef.current.onQuestionReceived((q: Question) => {
        console.log('📝 接收到新题目:', q.id, q.content?.title?.substring(0, 30));
        
        setQuestions(prev => {
          // 检查是否已存在相同ID的题目
          if (prev.find(existing => existing.id === q.id)) {
            console.log('⚠️ 题目已存在，跳过:', q.id);
            return prev;
          }
          
          console.log('✅ 添加新题目到列表:', q.id);
          const newQuestions = [...prev, q];
          return newQuestions;
        });
        
        addLog(`✅ 已生成题目：${q.content?.title?.slice(0, 20) ?? ''}...`, 'success');
      });
    }

    return () => {
      if (generationServiceRef.current) {
        generationServiceRef.current.cancelGeneration();
      }
    };
  }, [addLog]);

  // ✅ 启动生成函数
  const startRealGeneration = useCallback(async () => {
    console.log('🚀 startRealGeneration 被调用', {
      isGenerating: isGeneratingRef.current,
      hasStarted: hasStartedRef.current,
      status,
      hasService: !!generationServiceRef.current
    });

    // 防止重复调用
    if (isGeneratingRef.current || hasStartedRef.current) {
      console.log('⚠️ 已在生成中或已启动过，跳过重复调用');
      return;
    }

    if (!generationServiceRef.current) {
      console.error('❌ 生成服务未初始化');
      return;
    }

    // 标记为已启动
    hasStartedRef.current = true;
    isGeneratingRef.current = true;
    setStartTime(new Date());
    setError(null);
    setCurrentProgress(null);
    setQuestions([]); // 清空题目列表
    questionsRef.current = []; // 同步清空ref
    setIsComplete(false);
    
    addLog('🚀 开始AI题目生成...', 'info');

    try {
      if (config.mode !== GenerationMode.TEXT_DESCRIPTION) {
        throw new Error('当前版本仅支持文字描述生成模式');
      }

      console.log('📡 开始调用AI生成服务:', config);
      const generator = generationServiceRef.current.generateQuestions(config);

      for await (const update of generator) {
        if (isPaused) {
          addLog('⏸️ 生成已暂停', 'warning');
          continue;
        }

        console.log('📊 收到生成更新:', update.type, update.percentage);
        setCurrentProgress(update);

        switch (update.type) {
          case 'progress':
            addLog(update.message || `${update.stage} (${Math.round(update.percentage)}%)`, 'info');
            break;
          
          case 'question':
            // 题目在回调中已处理
            console.log('📝 题目更新事件已在回调中处理');
            break;
          
          case 'completed':
            console.log('🎉 生成完成！当前题目数量:', questionsRef.current.length);
            addLog('🎉 所有题目生成完成！', 'success');
            
            // ✅ 重置生成状态
            isGeneratingRef.current = false;
            setIsComplete(true);
            
            // ✅ 重要：使用最新的题目数据，并稍微延迟以确保状态同步
            setTimeout(() => {
              const finalQuestions = questionsRef.current;
              console.log('📤 准备传递给父组件的题目:', finalQuestions.length, '道');
              
              const result = {
                questions: finalQuestions,
                totalCount: finalQuestions.length,
                generationTime: Date.now() - (startTime?.getTime() || Date.now())
              };
              
              console.log('📋 最终结果:', result);
              
              // 确保有题目才调用完成回调
              if (finalQuestions.length > 0) {
                onComplete(result);
              } else {
                setError('生成的题目为空，请重试');
              }
            }, 500); // 延迟500ms确保状态同步
            
            return;
          
          case 'error':
            const errorMsg = update.error || '生成过程中发生错误';
            setError(errorMsg);
            addLog(`❌ 生成失败: ${errorMsg}`, 'error');
            isGeneratingRef.current = false;
            hasStartedRef.current = false; // 重置启动状态
            return;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setError(errorMessage);
      addLog(`❌ 生成失败: ${errorMessage}`, 'error');
      isGeneratingRef.current = false;
      hasStartedRef.current = false; // 重置启动状态
      
      console.error('💥 AI生成详细错误:', { 
        error, 
        config, 
        mode, 
        timestamp: new Date().toISOString() 
      });
    }
  }, [addLog, isPaused, startTime, config, onComplete]);

  // ✅ 检查是否需要启动生成
  useEffect(() => {
    console.log('🎯 检查是否需要启动生成:', {
      status,
      hasService: !!generationServiceRef.current,
      isGenerating: isGeneratingRef.current,
      hasStarted: hasStartedRef.current
    });

    if (status === GenerationStatus.GENERATING && 
        generationServiceRef.current && 
        !isGeneratingRef.current && 
        !hasStartedRef.current) {
      console.log('✅ 满足启动条件，开始生成');
      startRealGeneration();
    }
  }, [status, startRealGeneration]);

  // 计时器更新
  useEffect(() => {
    if (startTime && isGeneratingRef.current && !isPaused) {
      const timer = setInterval(() => {
        setElapsedTime(Date.now() - startTime.getTime());
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [startTime, isPaused]);

  // 控制按钮回调函数
  const handlePauseResume = useCallback(() => {
    setIsPaused(!isPaused);
    addLog(isPaused ? '▶️ 继续生成' : '⏸️ 生成已暂停', 'warning');
  }, [isPaused, addLog]);

  const handleStop = useCallback(() => {
    if (generationServiceRef.current) {
      generationServiceRef.current.cancelGeneration();
    }
    isGeneratingRef.current = false;
    hasStartedRef.current = false;
    setIsPaused(false);
    addLog('⏹️ 生成已停止', 'warning');
    onCancel?.();
  }, [addLog, onCancel]);

  const handleRetry = useCallback(() => {
    console.log('🔄 重试按钮被点击');
    
    // 重置所有状态
    setCurrentProgress(null);
    isGeneratingRef.current = false;
    hasStartedRef.current = false; // 重置启动状态
    setStartTime(null);
    setElapsedTime(0);
    setError(null);
    setIsPaused(false);
    setGenerationLogs([]);
    setQuestions([]);
    questionsRef.current = [];
    setIsComplete(false);
    
    addLog('🔄 重新开始生成...', 'info');
    onRetry?.();
  }, [addLog, onRetry]);

  const handleBack = useCallback(() => {
    if (isGeneratingRef.current && generationServiceRef.current) {
      generationServiceRef.current.cancelGeneration();
      isGeneratingRef.current = false;
      hasStartedRef.current = false;
    }
    onBack?.();
  }, [onBack]);

  const handleComplete = useCallback(() => {
    const result = {
      questions: questionsRef.current,
      totalCount: questionsRef.current.length,
      generationTime: elapsedTime
    };
    
    console.log('✅ 手动完成按钮被点击，传递结果:', result);
    onComplete(result);
  }, [elapsedTime, onComplete]);

  // 工具函数
  const getTotalProgress = () => currentProgress?.percentage || 0;
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const getEstimatedRemaining = () => {
    const progress = getTotalProgress();
    if (progress === 0 || progress >= 100) return 0;
    const estimatedTotal = (elapsedTime / progress) * 100;
    return Math.max(0, estimatedTotal - elapsedTime);
  };

  const getCurrentStageDescription = () => {
    if (error) return '生成失败';
    if (!isGeneratingRef.current && currentProgress?.type === 'completed') return '生成完成';
    if (!isGeneratingRef.current) return '准备生成';
    if (isPaused) return '生成已暂停';
    return currentProgress?.stage || '正在生成';
  };

  // 实时预览组件
  const RealTimePreview = () => (
    <Card elevation={1} sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          AI 实时生成题目预览 🪄
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          当前题目数量: {questions.length} 道
        </Typography>
        <Box sx={{ height: 300, overflowY: 'auto', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          {questions.map((q, index) => (
            <Box key={`${q.id}-${index}`} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {index + 1}.【
                {q.type === 'single_choice' ? '单选题' :
                 q.type === 'multiple_choice' ? '多选题' :
                 q.type === 'true_false' ? '判断题' : '简答题'}】 ({q.difficulty})
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {q.content?.title}
              </Typography>
              {Array.isArray(q.options) && q.options.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {q.options.map((opt, idx) => (
                    <Typography key={idx} variant="body2">
                      {opt.id}. {typeof opt === 'string' ? opt : opt.text || ''}
                    </Typography>
                  ))}
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                答案: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
              </Typography>
              {q.explanation?.text && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  解析: {q.explanation.text.slice(0, 60)}...
                </Typography>
              )}
            </Box>
          ))}
          {questions.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              正在等待题目生成...
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {mode === GenerationMode.IMAGE_IMPORT ? 'AI识别题目中' : 'AI生成题目中'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          正在使用人工智能{mode === GenerationMode.IMAGE_IMPORT ? '识别' : '生成'}高质量的题目内容
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" onClick={handleRetry}>重试</Button>}>
          <Typography variant="body2">
            <strong>生成失败：</strong>{error}
          </Typography>
        </Alert>
      )}

      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" fontWeight="bold">总体进度</Typography>
              <Typography variant="h6" color="primary.main" fontWeight="bold">
                {Math.round(getTotalProgress())}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={getTotalProgress()} 
              sx={{
                height: 12, 
                borderRadius: 6, 
                backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 6,
                  background: error
                    ? 'linear-gradient(45deg, #f44336, #ff5722)'
                    : 'linear-gradient(45deg, #1976d2, #42a5f5)'
                }
              }} 
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                <Schedule sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                已用时间: {formatTime(elapsedTime)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                <TrendingUp sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                预计剩余: {formatTime(getEstimatedRemaining())}
              </Typography>
            </Box>
          </Box>
          
          <Alert 
            severity={error ? "error" : isPaused ? "warning" : "info"}
            icon={error ? <ErrorIcon /> : isPaused ? <Warning /> : <Psychology />}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2" fontWeight="bold">
              当前状态: {getCurrentStageDescription()}
            </Typography>
            {currentProgress?.message && !error && (
              <Typography variant="body2">{currentProgress.message}</Typography>
            )}
          </Alert>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={isPaused ? <PlayArrow /> : <Pause />}
              onClick={handlePauseResume}
              disabled={!isGeneratingRef.current || error !== null}
            >
              {isPaused ? '继续' : '暂停'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Stop />}
              onClick={handleStop}
              disabled={!isGeneratingRef.current && !error}
            >
              停止
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={handleBack}
            >
              重新配置
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRetry}
            >
              重新生成
            </Button>
          </Box>
        </CardContent>
      </Card>

      <RealTimePreview />
      
      {/* ✅ 完成按钮 - 使用题目数量而不是isComplete状态 */}
      {questions.length > 0 && !isGeneratingRef.current && (
        <Box sx={{ textAlign: 'center', my: 2 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleComplete}
            sx={{ px: 6, fontWeight: 700, borderRadius: 2 }}
          >
            编辑和完善题目 ({questions.length} 道题目)
          </Button>
        </Box>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>💡 生成提示：</strong>
          正在使用真实的AI API生成题目。生成完成后将自动进入编辑模式，您可以对题目进行进一步完善。
          {process.env.NODE_ENV === 'development' && (
            <>
              <br />
              <strong>🛠️ 开发模式：</strong>
              详细错误信息会显示在浏览器控制台中。当前题目数量: {questions.length}
            </>
          )}
        </Typography>
      </Alert>
    </Box>
  );
};

export default GenerationProgress;