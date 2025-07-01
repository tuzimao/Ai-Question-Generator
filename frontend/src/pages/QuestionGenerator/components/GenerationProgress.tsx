import React, { useState, useEffect, useCallback } from 'react';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationService] = useState(() => new AIGenerationService());
  const [isComplete, setIsComplete] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);

  // addLog 必须在 useEffect 之前定义！
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const id = `${Date.now()}-${Math.random()}`;
    setGenerationLogs(prev => [...prev, { id, timestamp, message, type }]);
  }, []);

  // 实时题目推送
  useEffect(() => {
    generationService.onQuestionReceived((q: Question) => {
      setQuestions(prev => [...prev, q]);
      addLog(`✅ 已生成题目：${q.content?.title?.slice(0, 20) ?? ''}...`, 'success');
    });
    // eslint-disable-next-line
  }, [generationService, addLog]);

  // 启动生成
  const startRealGeneration = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setStartTime(new Date());
    setError(null);
    setCurrentProgress(null);
    setQuestions([]); // 新增：每次重新生成时清空题目列表
    addLog('🚀 开始AI题目生成...', 'info');

    try {
      if (mode !== GenerationMode.TEXT_DESCRIPTION) {
        throw new Error('当前版本仅支持文字描述生成模式');
      }
      const generator = generationService.generateQuestions(config);
      let finalResult: any = null;

      for await (const update of generator) {
        if (isPaused) {
          addLog('⏸️ 生成已暂停', 'warning');
          continue;
        }
        setCurrentProgress(update);

        switch (update.type) {
          case 'progress':
            addLog(update.message || `${update.stage} (${Math.round(update.percentage)}%)`, 'info');
            break;
          case 'question':
            // 题目在 onQuestionReceived 已处理，无需重复 addLog
            break;

            // 
            case 'completed':
            addLog('🎉 所有题目生成完成！', 'success');
            setIsGenerating(false);
            setIsComplete(true);
            setFinalResult({ questions, totalCount: questions.length, generationTime: elapsedTime });
            return;
          case 'error':
            const errorMsg = update.error || '生成过程中发生错误';
            setError(errorMsg);
            addLog(`❌ 生成失败: ${errorMsg}`, 'error');
            setIsGenerating(false);
            return;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setError(errorMessage);
      addLog(`❌ 生成失败: ${errorMessage}`, 'error');
      setIsGenerating(false);
      if (process.env.NODE_ENV === 'development') {
        console.error('AI生成详细错误:', { error, config, mode, timestamp: new Date().toISOString() });
      }
    }
    // eslint-disable-next-line
  }, [isGenerating, mode, config, generationService, addLog, isPaused, elapsedTime, onComplete, questions]);

  useEffect(() => {
    if (status === GenerationStatus.GENERATING && !isGenerating && !startTime) {
      startRealGeneration();
    }
    // eslint-disable-next-line
  }, [status, isGenerating, startTime, startRealGeneration]);

  useEffect(() => {
    if (startTime && isGenerating && !isPaused) {
      const timer = setInterval(() => {
        setElapsedTime(Date.now() - startTime.getTime());
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [startTime, isGenerating, isPaused]);

  // 控制按钮相关
  const handlePauseResume = useCallback(() => {
    setIsPaused(!isPaused);
    addLog(isPaused ? '▶️ 继续生成' : '⏸️ 生成已暂停', 'warning');
  }, [isPaused, addLog]);
  const handleStop = useCallback(() => {
    generationService.cancelGeneration();
    setIsGenerating(false);
    setIsPaused(false);
    addLog('⏹️ 生成已停止', 'warning');
    onCancel?.();
  }, [generationService, addLog, onCancel]);
  const handleRetry = useCallback(() => {
    setCurrentProgress(null);
    setIsGenerating(false);
    setStartTime(null);
    setElapsedTime(0);
    setError(null);
    setIsPaused(false);
    setGenerationLogs([]);
    setQuestions([]); // 重新生成时清空题目
    addLog('🔄 重新开始生成...', 'info');
    onRetry?.();
  }, [addLog, onRetry]);
  const handleBack = useCallback(() => {
    if (isGenerating) {
      generationService.cancelGeneration();
    }
    onBack?.();
  }, [isGenerating, generationService, onBack]);

  // 其它工具函数
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
  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'success.main';
      case 'warning': return 'warning.main';
      case 'error': return 'error.main';
      default: return 'text.primary';
    }
  };
  const getCurrentStageDescription = () => {
    if (error) return '生成失败';
    if (!isGenerating && currentProgress?.type === 'completed') return '生成完成';
    if (!isGenerating) return '准备生成';
    if (isPaused) return '生成已暂停';
    return currentProgress?.stage || '正在生成';
  };
  const getModeDisplayName = () => {
    switch (mode) {
      case GenerationMode.TEXT_DESCRIPTION: return '文字描述生成';
      case GenerationMode.FILE_UPLOAD: return '文件上传生成';
      case GenerationMode.IMAGE_IMPORT: return 'AI识别题目';
      case GenerationMode.MANUAL_CREATE: return '手动创建';
      default: return '未知模式';
    }
  };

  // 实时预览组件
  const RealTimePreview = () => (
    <Card elevation={1} sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          AI 实时生成题目预览 🪄
        </Typography>
        <Box sx={{ height: 300, overflowY: 'auto', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          {questions.map((q, index) => (
            <Box key={q.id || index} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {index + 1}.【
                {q.type === 'single_choice'
                  ? '单选题'
                  : q.type === 'multiple_choice'
                  ? '多选题'
                  : q.type === 'true_false'
                  ? '判断题'
                  : '简答题'}】 ({q.difficulty})
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {q.content?.title}
              </Typography>
              {Array.isArray(q.options) && q.options.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {q.options.map((opt, idx) => (
                    <Typography key={idx} variant="body2">
                      {String.fromCharCode(65 + idx)}. {typeof opt === 'string' ? opt : opt.text || ''}
                    </Typography>
                  ))}
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                答案: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
              </Typography>
              {typeof q.explanation === 'string' ? (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  解析: {q.explanation.slice(0, 60)}...
                </Typography>
              ) : q.explanation?.text && (
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
              <Typography variant="h6" color="primary.main" fontWeight="bold">{Math.round(getTotalProgress())}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={getTotalProgress()} sx={{
              height: 12, borderRadius: 6, backgroundColor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 6,
                background: error
                  ? 'linear-gradient(45deg, #f44336, #ff5722)'
                  : 'linear-gradient(45deg, #1976d2, #42a5f5)'
              }
            }} />
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
          <Alert severity={error ? "error" : isPaused ? "warning" : "info"}
            icon={error ? <ErrorIcon /> : isPaused ? <Warning /> : <Psychology />}
            sx={{ mb: 2 }}>
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
              disabled={!isGenerating || error !== null}
            >
              {isPaused ? '继续' : '暂停'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Stop />}
              onClick={handleStop}
              disabled={!isGenerating && !error}
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
      {isComplete && (
        <Box sx={{ textAlign: 'center', my: 2 }}>
            <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => onComplete(finalResult)}
            sx={{ px: 6, fontWeight: 700, borderRadius: 2 }}
            >
            编辑和完善题目
            </Button>
        </Box>
        )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                生成详情
              </Typography>
              <List dense>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Psychology color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="AI模型" secondary={`DeepSeek (${config?.provider || '默认'})`} />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <AutoAwesome color="secondary" />
                  </ListItemIcon>
                  <ListItemText primary="生成模式" secondary={getModeDisplayName()} />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Speed color="info" />
                  </ListItemIcon>
                  <ListItemText primary="进度状态"
                    secondary={`${currentProgress?.currentStep || 0}/${currentProgress?.totalSteps || 10} 步骤`} />
                </ListItem>
                {isGenerating && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CircularProgress size={20} />
                    </ListItemIcon>
                    <ListItemText primary="生成状态" secondary="正在处理中..." />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                生成日志
              </Typography>
              <Box sx={{
                height: 240, overflow: 'auto', backgroundColor: 'action.hover',
                borderRadius: 1, p: 1, fontFamily: 'monospace'
              }}>
                {generationLogs.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    等待生成开始...
                  </Typography>
                ) : (
                  generationLogs.map((log) => (
                    <Fade in key={log.id}>
                      <Typography variant="caption" component="div"
                        sx={{ mb: 0.5, color: getLogColor(log.type) }}>
                        [{log.timestamp}] {log.message}
                      </Typography>
                    </Fade>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>💡 生成提示：</strong>
          正在使用真实的AI API生成题目。生成过程中可以随时暂停或停止。
          生成完成后将自动进入编辑模式，您可以对题目进行进一步完善。
          {process.env.NODE_ENV === 'development' && (
            <>
              <br />
              <strong>🛠️ 开发模式：</strong>
              详细错误信息会显示在浏览器控制台中。
            </>
          )}
        </Typography>
      </Alert>
    </Box>
  );
};

export default GenerationProgress;