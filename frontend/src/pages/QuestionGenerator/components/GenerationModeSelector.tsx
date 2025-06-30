// frontend/src/pages/QuestionGenerator/components/GenerationModeSelector.tsx

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Radio,
  FormControlLabel,
  RadioGroup,
  Paper,
  useTheme,
  alpha
} from '@mui/material';
import {
  Description,
  CloudUpload,
  Create,
  AutoAwesome,
  Speed,
  Palette
} from '@mui/icons-material';
import { GenerationMode } from '@/types/generator';

/**
 * 生成方式选择器组件的 Props 接口
 */
interface GenerationModeSelectorProps {
  selectedMode: GenerationMode;           // 当前选中的生成方式
  onModeSelect: (mode: GenerationMode) => void; // 选择回调
  disabled?: boolean;                     // 是否禁用
}

/**
 * 生成方式配置
 * 定义每种生成方式的显示信息和特点
 */
const MODE_CONFIG = {
  [GenerationMode.TEXT_DESCRIPTION]: {
    title: '文字描述生成',
    description: '通过文字描述您的需求，AI将为您生成相应的题目',
    icon: <Description fontSize="large" />,
    features: [
      '快速便捷，只需文字描述',
      '适合明确知识点的题目生成',
      '支持详细的生成要求定制'
    ],
    color: 'primary' as const,
    recommended: false
  },
  [GenerationMode.FILE_UPLOAD]: {
    title: '文件上传生成',
    description: '上传学习材料，AI将基于文件内容生成题目',
    icon: <CloudUpload fontSize="large" />,
    features: [
      '基于真实教学材料',
      '支持PDF、Word、TXT等格式',
      '自动提取关键知识点'
    ],
    color: 'secondary' as const,
    recommended: true
  },
  [GenerationMode.IMAGE_IMPORT]: {
    title: '图片导入题目',
    description: '上传题目图片或截图，AI将识别并导入现有题目',
    icon: <Palette fontSize="large" />,
    features: [
      'OCR智能识别题目内容',
      '支持JPG、PNG、PDF格式',
      '自动识别数学公式和表格'
    ],
    color: 'warning' as const,
    recommended: false
  },
  [GenerationMode.MANUAL_CREATE]: {
    title: '手动创建题目',
    description: '完全手动创建题目，适合有明确题目要求的场景',
    icon: <Create fontSize="large" />,
    features: [
      '完全自主控制题目内容',
      '在编辑器中选择题目类型',
      '可参考AI建议优化'
    ],
    color: 'success' as const,
    recommended: false
  }
};

/**
 * 模式卡片组件
 */
interface ModeCardProps {
  mode: GenerationMode;
  config: typeof MODE_CONFIG[GenerationMode];
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

const ModeCard: React.FC<ModeCardProps> = ({
  mode,
  config,
  selected,
  onSelect,
  disabled = false
}) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: '100%',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease-in-out',
        border: 2,
        borderColor: selected 
          ? `${config.color}.main` 
          : 'transparent',
        backgroundColor: selected 
          ? alpha(theme.palette[config.color].main, 0.05)
          : 'background.paper',
        '&:hover': disabled ? {} : {
          transform: 'translateY(-2px)',
          boxShadow: 4,
          borderColor: `${config.color}.main`
        },
        opacity: disabled ? 0.6 : 1
      }}
      onClick={disabled ? undefined : onSelect}
    >
      <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 卡片头部 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              backgroundColor: `${config.color}.main`,
              color: 'white',
              mr: 2
            }}
          >
            {config.icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" component="h3" fontWeight="bold">
                {config.title}
              </Typography>
              {config.recommended && (
                <Box
                  sx={{
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor: 'warning.main',
                    color: 'warning.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  <AutoAwesome fontSize="small" />
                  <Typography variant="caption" fontWeight="bold">
                    推荐
                  </Typography>
                </Box>
              )}
            </Box>
            <FormControlLabel
              control={
                <Radio
                  checked={selected}
                  value={mode}
                  color={config.color}
                  disabled={disabled}
                />
              }
              label=""
              sx={{ m: 0, height: 0, width: 0, overflow: 'hidden' }}
            />
          </Box>
        </Box>

        {/* 描述文本 */}
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ mb: 3, flex: 1 }}
        >
          {config.description}
        </Typography>

        {/* 特性列表 */}
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            特点：
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {config.features.map((feature, index) => (
              <Typography
                key={index}
                component="li"
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                {feature}
              </Typography>
            ))}
          </Box>
        </Box>

        {/* 选中状态指示器 */}
        {selected && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: `${config.color}.main`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 2
            }}
          >
            <AutoAwesome fontSize="small" />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * 生成方式选择器组件
 * 允许用户选择不同的题目生成方式
 */
export const GenerationModeSelector: React.FC<GenerationModeSelectorProps> = ({
  selectedMode,
  onModeSelect,
  disabled = false
}) => {
  return (
    <Box>
      {/* 标题区域 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
          选择生成方式
        </Typography>
        <Typography variant="body1" color="text.secondary">
          选择最适合您需求的题目生成方式，开始创建高质量的练习题目
        </Typography>
      </Box>

      {/* 方式选择卡片 */}
      <RadioGroup
        value={selectedMode}
        onChange={(e) => onModeSelect(e.target.value as GenerationMode)}
      >
        <Grid container spacing={3}>
          {Object.entries(MODE_CONFIG).map(([mode, config]) => (
            <Grid item xs={12} md={3} key={mode}>
              <ModeCard
                mode={mode as GenerationMode}
                config={config}
                selected={selectedMode === mode}
                onSelect={() => onModeSelect(mode as GenerationMode)}
                disabled={disabled}
              />
            </Grid>
          ))}
        </Grid>
      </RadioGroup>

      {/* 使用提示 */}
      <Paper 
        elevation={1} 
        sx={{ 
          mt: 3, 
          p: 2, 
          backgroundColor: 'info.light',
          borderLeft: 4,
          borderColor: 'info.main'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Speed color="info" />
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" color="info.dark">
              使用建议
            </Typography>
            <Typography variant="body2" color="info.dark">
              {selectedMode === GenerationMode.TEXT_DESCRIPTION && 
                '在描述中尽量具体说明知识点、难度要求和题目风格，这样AI能生成更符合您期望的题目。'}
              {selectedMode === GenerationMode.FILE_UPLOAD && 
                '支持上传PDF、Word、PowerPoint等格式的教学材料。文件内容越丰富，生成的题目质量越高。'}
              {selectedMode === GenerationMode.IMAGE_IMPORT && 
                '支持上传JPG、PNG、PDF格式的题目图片。AI将智能识别图片中的题目内容，包括文字、公式和表格。'}
              {selectedMode === GenerationMode.MANUAL_CREATE && 
                '可以先创建题目框架，然后使用AI助手来优化题目表述和生成解析内容。'}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default GenerationModeSelector;