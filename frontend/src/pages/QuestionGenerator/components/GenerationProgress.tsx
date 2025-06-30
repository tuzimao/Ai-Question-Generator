// frontend/src/pages/QuestionGenerator/components/GenerationProgress.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  Chip,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Fade,
  CircularProgress,
  Divider
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
  Visibility,
  Speed,
  TrendingUp
} from '@mui/icons-material';

import { GenerationMode, GenerationStatus, GenerationProgress as ProgressType } from '@/types/generator';
import { QuestionType } from '@/types/question';

/**
 * 生成进度组件的 Props 接口
 */
interface GenerationProgressProps {
  progress: ProgressType | null;          // 当前进度
  status: GenerationStatus;               // 生成状态
  mode: GenerationMode;                   // 生成模式
  onComplete: () => void;                 // 完成回调
  onCancel?: () => void;                  // 取消回调
  onRetry?: () => void;                   // 重试回调
  onBack?: () => void;                    // 返回回调
}

/**
 * 模拟的生成阶段配置
 */
const GENERATION_PHASES = {
  [GenerationMode.TEXT_DESCRIPTION]: [
    { id: 'analyzing', label: '分析需求描述', duration: 2000 },
    { id: 'planning', label: '规划题目结构', duration: 3000 },
    { id: 'generating', label: '生成题目内容', duration: 8000 },
    { id: 'reviewing', label: '优化和校验', duration: 3000 },
    { id: 'formatting', label: '格式化输出', duration: 1000 }
  ],
  [GenerationMode.FILE_UPLOAD]: [
    { id: 'parsing', label: '解析上传文件', duration: 3000 },
    { id: 'extracting', label: '提取关键内容', duration: 4000 },
    { id: 'analyzing', label: '分析知识结构', duration: 3000 },
    { id: 'generating', label: '生成题目内容', duration: 8000 },
    { id: 'reviewing', label: '优化和校验', duration: 3000 }
  ],
  [GenerationMode.IMAGE_IMPORT]: [
    { id: 'ocr', label: 'OCR图像识别', duration: 5000 },
    { id: 'parsing', label: '解析题目结构', duration: 4000 },
    { id: 'extracting', label: '提取题目内容', duration: 3000 },
    { id: 'formatting', label: '标准化格式', duration: 2000 },
    { id: 'validating', label: '验证完整性', duration: 2000 }
  ],
  [GenerationMode.MANUAL_CREATE]: []
};

/**
 * 模拟生成的题目类型进度
 */
interface QuestionTypeProgress {
  type: QuestionType;
  total: number;
  completed: number;
  current?: string;
}

/**
 * AI生成进度组件
 * 实时显示题目生成过程，支持控制操作
 */
export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  progress,
  status,
  mode,
  onComplete,
  onCancel,
  onRetry,
  onBack
}) => {
  // 生成状态
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTotal, setEstimatedTotal] = useState(0);

  // 模拟题目类型进度
  const [questionProgress, setQuestionProgress] = useState<QuestionTypeProgress[]>([
    { type: QuestionType.SINGLE_CHOICE, total: 5, completed: 0 },
    { type: QuestionType.MULTIPLE_CHOICE, total: 3, completed: 0 },
    { type: QuestionType.TRUE_FALSE, total: 2, completed: 0 },
    { type: QuestionType.SHORT_ANSWER, total: 2, completed: 0 }
  ]);

  // 生成日志
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);

  // 获取当前模式的阶段配置
  const phases = GENERATION_PHASES[mode] || [];

  /**
   * 启动模拟生成过程
   */
  useEffect(() => {
    if (status === GenerationStatus.GENERATING && !startTime) {
      setStartTime(new Date());
      setEstimatedTotal(phases.reduce((sum, phase) => sum + phase.duration, 0));
      simulateGeneration();
    }
  }, [status, startTime]);

  /**
   * 更新已用时间
   */
  useEffect(() => {
    if (startTime && status === GenerationStatus.GENERATING && !isPaused) {
      const timer = setInterval(() => {
        setElapsedTime(Date.now() - startTime.getTime());
      }, 100);
      return () => clearInterval(timer);
    }
  }, [startTime, status, isPaused]);

  /**
   * 模拟生成过程
   */
  const simulateGeneration = async () => {
    for (let i = 0; i < phases.length; i++) {
      if (isPaused) return;
      
      setCurrentPhase(i);
      addLog(`开始${phases[i].label}...`);
      
      // 模拟阶段处理时间
      await sleep(phases[i].duration);
      
      addLog(`✅ ${phases[i].label}完成`);
      
      // 随机更新题目进度
      if (phases[i].id === 'generating') {
        await simulateQuestionGeneration();
      }
    }
    
    // 生成完成
    addLog('🎉 所有题目生成完成！');
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  /**
   * 模拟题目逐个生成
   */
  const simulateQuestionGeneration = async () => {
    for (const typeProgress of questionProgress) {
      for (let i = 0; i < typeProgress.total; i++) {
        if (isPaused) return;
        
        setQuestionProgress(prev => 
          prev.map(p => 
            p.type === typeProgress.type 
              ? { ...p, completed: i + 1, current: `正在生成第${i + 1}题...` }
              : p
          )
        );
        
        addLog(`生成${getQuestionTypeLabel(typeProgress.type)}第${i + 1}题`);
        await sleep(800 + Math.random() * 1200); // 随机耗时
      }
    }
  };

  /**
   * 添加日志
   */
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setGenerationLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  /**
   * 暂停/继续生成
   */
  const handlePauseResume = () => {
    setIsPaused(!isPaused);
    addLog(isPaused ? '⏸️ 生成已暂停' : '▶️ 继续生成');
  };

  /**
   * 停止生成
   */
  const handleStop = () => {
    addLog('⏹️ 生成已停止');
    onCancel?.();
  };

  /**
   * 获取题目类型标签
   */
  const getQuestionTypeLabel = (type: QuestionType): string => {
    const labels = {
      [QuestionType.SINGLE_CHOICE]: '单选题',
      [QuestionType.MULTIPLE_CHOICE]: '多选题',
      [QuestionType.TRUE_FALSE]: '判断题',
      [QuestionType.SHORT_ANSWER]: '简答题'
    };
    return labels[type];
  };

  /**
   * 获取总体进度百分比
   */
  const getTotalProgress = (): number => {
    if (phases.length === 0) return 0;
    
    const phaseProgress = (currentPhase / phases.length) * 60; // 阶段进度占60%
    const questionTotal = questionProgress.reduce((sum, p) => sum + p.total, 0);
    const questionCompleted = questionProgress.reduce((sum, p) => sum + p.completed, 0);
    const questionProgressPercent = questionTotal > 0 ? (questionCompleted / questionTotal) * 40 : 0; // 题目进度占40%
    
    return Math.min(phaseProgress + questionProgressPercent, 100);
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
    if (progress === 0) return estimatedTotal;
    
    const estimatedFinish = (elapsedTime / progress) * 100;
    return Math.max(0, estimatedFinish - elapsedTime);
  };

  // 工具函数
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
                  background: 'linear-gradient(45deg, #1976d2, #42a5f5)'
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
          {phases.length > 0 && currentPhase < phases.length && (
            <Alert 
              severity="info" 
              icon={<Psychology />}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2" fontWeight="bold">
                当前阶段: {phases[currentPhase]?.label}
              </Typography>
            </Alert>
          )}

          {/* 控制按钮 */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={isPaused ? <PlayArrow /> : <Pause />}
              onClick={handlePauseResume}
              disabled={status !== GenerationStatus.GENERATING}
            >
              {isPaused ? '继续' : '暂停'}
            </Button>
            
            <Button
              variant="outlined"
              color="error"
              startIcon={<Stop />}
              onClick={handleStop}
            >
              停止
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={onBack}
            >
              重新配置
            </Button>
            
            {onRetry && (
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={onRetry}
              >
                重新生成
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* 详细进度网格 */}
      <Grid container spacing={3}>
        {/* 题目类型进度 */}
        <Grid item xs={12} md={6}>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                题目生成进度
              </Typography>
              <List dense>
                {questionProgress.map((progress) => (
                  <ListItem key={progress.type} sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {progress.completed === progress.total ? (
                        <CheckCircle color="success" />
                      ) : progress.completed > 0 ? (
                        <CircularProgress size={20} />
                      ) : (
                        <Schedule color="action" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" fontWeight="medium">
                            {getQuestionTypeLabel(progress.type)}
                          </Typography>
                          <Chip
                            label={`${progress.completed}/${progress.total}`}
                            size="small"
                            color={progress.completed === progress.total ? 'success' : 'primary'}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={progress.current}
                    />
                  </ListItem>
                ))}
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
                {generationLogs.map((log, index) => (
                  <Fade in key={index}>
                    <Typography
                      variant="caption"
                      component="div"
                      sx={{
                        mb: 0.5,
                        color: log.includes('✅') ? 'success.main' : 
                               log.includes('⏸️') || log.includes('⏹️') ? 'warning.main' :
                               log.includes('🎉') ? 'primary.main' : 'text.primary'
                      }}
                    >
                      {log}
                    </Typography>
                  </Fade>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 提示信息 */}
      <Alert severity="success" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>💡 生成提示：</strong>
          生成过程中可以随时暂停或停止。生成完成后将自动进入编辑模式，您可以对题目进行进一步完善。
        </Typography>
      </Alert>
    </Box>
  );
};

export default GenerationProgress;