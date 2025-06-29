// frontend/src/pages/QuestionGenerator/components/QuestionTypeConfig.tsx

import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  FormControlLabel,
  Switch,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Slider,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  RadioButtonChecked,
  CheckBox,
  ToggleOff,
  ShortText,
  Info,
  Add,
  Remove
} from '@mui/icons-material';

import { QuestionType, Difficulty } from '@/types/question';
import { GenerationConfig } from '@/types/generator';

/**
 * 题目类型配置组件的 Props 接口
 */
interface QuestionTypeConfigProps {
  config: GenerationConfig['questionTypes'];  // 当前配置
  onUpdate: (type: QuestionType, updates: Partial<GenerationConfig['questionTypes'][QuestionType]>) => void; // 更新回调
  disabled?: boolean;                          // 是否禁用
}

/**
 * 题目类型的显示配置
 */
const QUESTION_TYPE_CONFIG = {
  [QuestionType.SINGLE_CHOICE]: {
    label: '单选题',
    icon: <RadioButtonChecked />,
    description: '从多个选项中选择一个正确答案',
    color: 'primary' as const,
    recommended: true,
    maxCount: 20,
    minCount: 1
  },
  [QuestionType.MULTIPLE_CHOICE]: {
    label: '多选题',
    icon: <CheckBox />,
    description: '从多个选项中选择多个正确答案',
    color: 'secondary' as const,
    recommended: true,
    maxCount: 15,
    minCount: 1
  },
  [QuestionType.TRUE_FALSE]: {
    label: '判断题',
    icon: <ToggleOff />,
    description: '判断题目描述是否正确',
    color: 'success' as const,
    recommended: false,
    maxCount: 10,
    minCount: 1
  },
  [QuestionType.SHORT_ANSWER]: {
    label: '简答题',
    icon: <ShortText />,
    description: '需要文字回答的开放性问题',
    color: 'warning' as const,
    recommended: false,
    maxCount: 10,
    minCount: 1
  }
};

/**
 * 难度级别配置
 */
const DIFFICULTY_CONFIG = {
  [Difficulty.EASY]: {
    label: '简单',
    color: 'success' as const,
    description: '基础概念和简单应用'
  },
  [Difficulty.MEDIUM]: {
    label: '中等',
    color: 'warning' as const,
    description: '综合运用和分析'
  },
  [Difficulty.HARD]: {
    label: '困难',
    color: 'error' as const,
    description: '深度思考和创新应用'
  }
};

/**
 * 单个题目类型配置卡片
 */
interface TypeConfigCardProps {
  type: QuestionType;
  config: GenerationConfig['questionTypes'][QuestionType];
  typeConfig: typeof QUESTION_TYPE_CONFIG[QuestionType];
  onUpdate: (updates: Partial<GenerationConfig['questionTypes'][QuestionType]>) => void;
  disabled?: boolean;
}

const TypeConfigCard: React.FC<TypeConfigCardProps> = ({
  type,
  config,
  typeConfig,
  onUpdate,
  disabled = false
}) => {
  /**
   * 更新数量
   */
  const handleCountChange = (delta: number) => {
    const newCount = Math.max(
      typeConfig.minCount,
      Math.min(typeConfig.maxCount, config.count + delta)
    );
    onUpdate({ count: newCount });
  };

  return (
    <Card
      elevation={config.enabled ? 2 : 1}
      sx={{
        height: '100%',
        opacity: disabled || !config.enabled ? 0.7 : 1,
        transition: 'all 0.2s ease-in-out',
        border: config.enabled ? 2 : 1,
        borderColor: config.enabled ? `${typeConfig.color}.main` : 'divider',
        '&:hover': disabled ? {} : {
          transform: 'translateY(-1px)',
          boxShadow: 3
        }
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* 卡片头部 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              backgroundColor: `${typeConfig.color}.main`,
              color: 'white',
              mr: 1.5,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {typeConfig.icon}
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {typeConfig.label}
              </Typography>
              {typeConfig.recommended && (
                <Chip 
                  label="推荐" 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              )}
            </Box>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={config.enabled}
                onChange={(e) => onUpdate({ enabled: e.target.checked })}
                color={typeConfig.color}
                disabled={disabled}
              />
            }
            label=""
            sx={{ m: 0 }}
          />
        </Box>

        {/* 描述 */}
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ mb: 2, minHeight: 40 }}
        >
          {typeConfig.description}
        </Typography>

        {/* 配置选项 */}
        {config.enabled && (
          <Box>
            {/* 题目数量 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                题目数量
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => handleCountChange(-1)}
                  disabled={disabled || config.count <= typeConfig.minCount}
                >
                  <Remove />
                </IconButton>
                
                <TextField
                  type="number"
                  value={config.count}
                  onChange={(e) => {
                    const value = Math.max(
                      typeConfig.minCount,
                      Math.min(typeConfig.maxCount, parseInt(e.target.value) || 0)
                    );
                    onUpdate({ count: value });
                  }}
                  size="small"
                  sx={{ width: 80 }}
                  inputProps={{
                    min: typeConfig.minCount,
                    max: typeConfig.maxCount,
                    style: { textAlign: 'center' }
                  }}
                  disabled={disabled}
                />
                
                <IconButton
                  size="small"
                  onClick={() => handleCountChange(1)}
                  disabled={disabled || config.count >= typeConfig.maxCount}
                >
                  <Add />
                </IconButton>
              </Box>
              
              <Typography variant="caption" color="text.secondary">
                范围: {typeConfig.minCount}-{typeConfig.maxCount}
              </Typography>
            </Box>

            {/* 难度选择 */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                难度级别
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={config.difficulty}
                  onChange={(e) => {
                    const difficulty = e.target.value as Difficulty;
                    onUpdate({ difficulty });
                  }}
                  disabled={disabled}
                >
                  {Object.entries(DIFFICULTY_CONFIG).map(([difficulty, diffConfig]) => (
                    <MenuItem key={difficulty} value={difficulty}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={diffConfig.label}
                          size="small"
                          color={diffConfig.color}
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {diffConfig.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * 题目类型配置主组件
 */
export const QuestionTypeConfig: React.FC<QuestionTypeConfigProps> = ({
  config,
  onUpdate,
  disabled = false
}) => {
  // 计算总题目数
  const totalQuestions = Object.values(config)
    .filter(typeConfig => typeConfig.enabled)
    .reduce((sum, typeConfig) => sum + typeConfig.count, 0);

  // 计算各难度题目数量
  const difficultyStats = Object.entries(config)
    .filter(([_, typeConfig]) => typeConfig.enabled)
    .reduce((stats, [_, typeConfig]) => {
      stats[typeConfig.difficulty] = (stats[typeConfig.difficulty] || 0) + typeConfig.count;
      return stats;
    }, {} as Record<Difficulty, number>);

  return (
    <Box>
      {/* 配置概览 */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            题目配置概览
          </Typography>
          <Chip
            label={`总计 ${totalQuestions} 题`}
            color="primary"
            variant="outlined"
          />
        </Box>

        {/* 难度分布 */}
        {totalQuestions > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.entries(difficultyStats).map(([difficulty, count]) => (
              <Chip
                key={difficulty}
                label={`${DIFFICULTY_CONFIG[difficulty as Difficulty].label}: ${count}题`}
                color={DIFFICULTY_CONFIG[difficulty as Difficulty].color}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </Box>

      {/* 题目类型配置网格 */}
      <Grid container spacing={2}>
        {Object.entries(QUESTION_TYPE_CONFIG).map(([type, typeConfig]) => (
          <Grid item xs={12} sm={6} md={3} key={type}>
            <TypeConfigCard
              type={type as QuestionType}
              config={config[type as QuestionType]}
              typeConfig={typeConfig}
              onUpdate={(updates) => onUpdate(type as QuestionType, updates)}
              disabled={disabled}
            />
          </Grid>
        ))}
      </Grid>

      {/* 使用提示 */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Info />
          <Box>
            <Typography variant="body2" fontWeight="bold">
              配置建议
            </Typography>
            <Typography variant="body2">
              • 建议单选题和多选题作为主要题型，简答题作为补充
              <br />
              • 根据学习目标合理分配各难度级别的题目数量
              <br />
              • 总题目数建议控制在 10-30 题之间，保证质量和完成时间
            </Typography>
          </Box>
        </Box>
      </Alert>
    </Box>
  );
};

export default QuestionTypeConfig;