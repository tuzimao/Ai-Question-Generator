// frontend/src/pages/QuestionGenerator/components/GenerationProgress.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Fade,
  CircularProgress
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  Schedule,
  Psychology,
  Stop,
  Pause,
  PlayArrow,
  Refresh,
  ArrowBack,
  Speed,
  TrendingUp,
  Error as ErrorIcon,
  Warning
} from '@mui/icons-material';

import { GenerationMode, GenerationStatus } from '@/types/generator';
import { AIGenerationService, ProgressUpdate } from '@/services/aiGenerationService';

/**
 * 生成进度组件的 Props 接口
 */
interface GenerationProgressProps {
  progress: any;                         // 进度信息 (暂时用any)
  status: GenerationStatus;              // 生成状态
  mode: GenerationMode;                  // 生成模式
  config: any;                          // 生成配置
  onComplete: (result: any) => void;    // 完成回调
  onCancel?: () => void;                // 取消回调
  onRetry?: () => void;                 // 重试回调
  onBack?: () => void;                  // 返回回调
}

/**
 * 生成日志条目接口
 */
interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

/**
 * AI生成进度组件
 * 使用真实的AI API进行题目生成
 */
export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  status,
  mode,
  config,
  onComplete,
  onCancel,
  onRetry,
  onBack
}) => {
  // 生成状态
  const [currentProgress, setCurrentProgress] = useState<ProgressUpdate | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationService] = useState(() => new AIGenerationService());

  // 生成日志
  const [generationLogs, setGenerationLogs] = useState<LogEntry[]>([]);

  /**
   * 添加日志条目
   */
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const id = `${Date.now()}-${Math.random()}`;
    
    setGenerationLogs(prev => [...prev, { id, timestamp, message, type }]);
  }, []);

  /**
   * 启动真实AI生成过程
   */
  const startRealGeneration = useCallback(async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    setStartTime(new Date());
    setError(null);
    setCurrentProgress(null);
    addLog('🚀 开始AI题目生成...', 'info');
    
    try {
      // 验证配置
      if (mode !== GenerationMode.TEXT_DESCRIPTION) {
        throw new Error('当前版本仅支持文字描述生成模式');
      }

      // 开始生成
      const generator = generationService.generateQuestions(config);
      let finalResult: any = null;
      
      for await (const update of generator) {
        // 检查是否已暂停或取消
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
            if (update.question) {
              const titlePreview = update.question.content.title.substring(0, 30);
              addLog(`✅ 生成题目: ${titlePreview}...`, 'success');
            }
            break;
            
          case 'completed':
            addLog('🎉 所有题目生成完成！', 'success');
            setIsGenerating(false);
            
            // 如果有最终结果，传递给父组件
            if (finalResult) {
              setTimeout(() => {
                onComplete(finalResult);
              }, 1000);
            } else {
              // 创建默认结果
              setTimeout(() => {
                onComplete({
                  questions: [],
                  totalCount: 0,
                  generationTime: elapsedTime
                });
              }, 1000);
            }
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
      
      // 开发模式下显示详细错误
      if (process.env.NODE_ENV === 'development') {
        console.error('AI生成详细错误:', {
          error,
          config,
          mode,
          timestamp: new Date().toISOString()
        });
      }
    }
  }, [isGenerating, mode, config, generationService, addLog, isPaused, elapsedTime, onComplete]);

  /**
   * 启动生成过程 - 仅在状态变为GENERATING时触发
   */
  useEffect(() => {
    if (status === GenerationStatus.GENERATING && !isGenerating && !startTime) {
      startRealGeneration();
    }
  }, [status, isGenerating, startTime, startRealGeneration]);

  /**
   * 更新已用时间
   */
  useEffect(() => {
    if (startTime && isGenerating && !isPaused) {
      const timer = setInterval(() => {
        setElapsedTime(Date.now() - startTime.getTime());
      }, 1000); // 每秒更新一次
      
      return () => clearInterval(timer);
    }
  }, [startTime, isGenerating, isPaused]);

  /**
   * 暂停/继续生成
   */
  const handlePauseResume = useCallback(() => {
    setIsPaused(!isPaused);
    addLog(isPaused ? '▶️ 继续生成' : '⏸️ 生成已暂停', 'warning');
  }, [isPaused, addLog]);

  /**
   * 停止生成
   */
  const handleStop = useCallback(() => {
    generationService.cancelGeneration();
    setIsGenerating(false);
    setIsPaused(false);
    addLog('⏹️ 生成已停止', 'warning');
    onCancel?.();
  }, [generationService, addLog, onCancel]);

  /**
   * 重试生成
   */
  const handleRetry = useCallback(() => {
    // 重置所有状态
    setCurrentProgress(null);
    setIsGenerating(false);
    setStartTime(null);
    setElapsedTime(0);
    setError(null);
    setIsPaused(false);
    setGenerationLogs([]);
    
    addLog('🔄 重新开始生成...', 'info');
    onRetry?.();
  }, [addLog, onRetry]);

  /**
   * 返回配置页面
   */
  const handleBack = useCallback(() => {
    // 如果正在生成，先停止
    if (isGenerating) {
      generationService.cancelGeneration();
    }
    onBack?.();
  }, [isGenerating, generationService, onBack]);

  /**
   * 获取总体进度百分比
   */
  const getTotalProgress = (): number => {
    return currentProgress?.percentage || 0;
  };

  /**
   * 格式化时间
   */
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  /**
   * 获取预计剩余时间
   */
  const getEstimatedRemaining = (): number => {
    const progress = getTotalProgress();
    if (progress === 0 || progress >= 100) return 0;
    
    const estimatedTotal = (elapsedTime / progress) * 100;
    return Math.max(0, estimatedTotal - elapsedTime);
  };

  /**
   * 获取日志颜色
   */
  const getLogColor = (type: LogEntry['type']): string => {
    switch (type) {
      case 'success': return 'success.main';
      case 'warning': return 'warning.main';
      case 'error': return 'error.main';
      default: return 'text.primary';
    }
  };

  /**
   * 获取当前阶段描述
   */
  const getCurrentStageDescription = (): string => {
    if (error) return '生成失败';
    if (!isGenerating && currentProgress?.type === 'completed') return '生成完成';
    if (!isGenerating) return '准备生成';
    if (isPaused) return '生成已暂停';
    return currentProgress?.stage || '正在生成';
  };

  /**
   * 获取模式显示名称
   */
  const getModeDisplayName = (): string => {
    switch (mode) {
      case GenerationMode.TEXT_DESCRIPTION: return '文字描述生成';
      case GenerationMode.FILE_UPLOAD: return '文件上传生成';
      case GenerationMode.IMAGE_IMPORT: return 'AI识别题目';
      case GenerationMode.MANUAL_CREATE: return '手动创建';
      default: return '未知模式';
    }
  };

  return (
    <Box>
      {/* 标题区域 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {mode === GenerationMode.IMAGE_IMPORT ? 'AI识别题目中' : 'AI生成题目中'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          正在使用人工智能{mode === GenerationMode.IMAGE_IMPORT ? '识别' : '生成'}高质量的题目内容
        </Typography>
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              重试
            </Button>
          }
        >
          <Typography variant="body2">
            <strong>生成失败：</strong>{error}
          </Typography>
        </Alert>
      )}

      {/* 主进度卡片 */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          {/* 总体进度 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" fontWeight="bold">
                总体进度
              </Typography>
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
                  background: error ? 
                    'linear-gradient(45deg, #f44336, #ff5722)' :
                    'linear-gradient(45deg, #1976d2, #42a5f5)'
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

          {/* 当前状态 */}
          <Alert 
            severity={error ? "error" : isPaused ? "warning" : "info"}
            icon={error ? <ErrorIcon /> : isPaused ? <Warning /> : <Psychology />}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2" fontWeight="bold">
              当前状态: {getCurrentStageDescription()}
            </Typography>
            {currentProgress?.message && !error && (
              <Typography variant="body2">
                {currentProgress.message}
              </Typography>
            )}
          </Alert>

          {/* 控制按钮 */}
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

      {/* 详细信息 */}
      <Grid container spacing={3}>
        {/* 生成详情 */}
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
                  <ListItemText
                    primary="AI模型"
                    secondary={`DeepSeek (${config?.provider || '默认'})`}
                  />
                </ListItem>
                
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <AutoAwesome color="secondary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="生成模式"
                    secondary={getModeDisplayName()}
                  />
                </ListItem>
                
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Speed color="info" />
                  </ListItemIcon>
                  <ListItemText
                    primary="进度状态"
                    secondary={`${currentProgress?.currentStep || 0}/${currentProgress?.totalSteps || 10} 步骤`}
                  />
                </ListItem>

                {isGenerating && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CircularProgress size={20} />
                    </ListItemIcon>
                    <ListItemText
                      primary="生成状态"
                      secondary="正在处理中..."
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* 生成日志 */}
        <Grid item xs={12} md={6}>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                生成日志
              </Typography>
              <Box
                sx={{
                  height: 240,
                  overflow: 'auto',
                  backgroundColor: 'action.hover',
                  borderRadius: 1,
                  p: 1,
                  fontFamily: 'monospace'
                }}
              >
                {generationLogs.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    等待生成开始...
                  </Typography>
                ) : (
                  generationLogs.map((log) => (
                    <Fade in key={log.id}>
                      <Typography
                        variant="caption"
                        component="div"
                        sx={{
                          mb: 0.5,
                          color: getLogColor(log.type)
                        }}
                      >
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

      {/* 提示信息 */}
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