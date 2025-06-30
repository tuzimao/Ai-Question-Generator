// frontend/src/components/Settings/ModelSettings.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  Grid,
  Divider,
  CircularProgress,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Psychology,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error,
  AttachMoney,
  Language,
  Speed
} from '@mui/icons-material';

import { AIConfigManager, AIModelConfig } from '@/utils/aiConfig';

/**
 * 支持的AI模型配置
 */
interface ModelProvider {
  id: string;
  name: string;
  models: string[];
  baseUrl: string;
  description: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
  costLevel: 'low' | 'medium' | 'high';
  chineseOptimized: boolean;
}

// /**
//  * AI模型配置
//  */
// interface AIModelConfig {
//   provider: string;
//   model: string;
//   apiKey: string;
//   baseUrl: string;
//   temperature: number;
// }

/**
 * 模型提供商配置
 */
const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    baseUrl: 'https://api.deepseek.com/v1',
    description: '国产大模型，中文优化，性价比极高',
    pros: ['价格便宜', '中文优秀', '访问稳定', '响应快速'],
    cons: ['创新性一般'],
    recommended: true,
    costLevel: 'low',
    chineseOptimized: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    baseUrl: 'https://api.openai.com/v1',
    description: '最知名的AI模型，质量顶级',
    pros: ['质量最高', '功能强大', '生态完善'],
    cons: ['价格昂贵', '需要代理'],
    recommended: false,
    costLevel: 'high',
    chineseOptimized: false
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    baseUrl: 'https://api.moonshot.cn/v1',
    description: '月之暗面大模型，长文本处理能力强',
    pros: ['长文本', '中文优秀', '访问稳定'],
    cons: ['价格中等'],
    recommended: false,
    costLevel: 'medium',
    chineseOptimized: true
  },
  {
    id: 'zhipu',
    name: '智谱AI (GLM)',
    models: ['glm-4', 'glm-3-turbo'],
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    description: '清华智谱AI，教育场景友好',
    pros: ['教育优化', '中文强', '价格合理'],
    cons: ['生态较小'],
    recommended: false,
    costLevel: 'medium',
    chineseOptimized: true
  }
];

/**
 * AI模型设置组件
 */
export const ModelSettings: React.FC = () => {
  // 当前配置状态
  const [config, setConfig] = useState<AIModelConfig>(
    AIConfigManager.getCurrentConfig()
  );

  // UI状态
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');

  // 组件加载时获取保存的配置
  useEffect(() => {
    const savedConfig = AIConfigManager.getCurrentConfig();
    setConfig(savedConfig);
  }, []);

  /**
   * 获取当前选择的提供商信息
   */
  const getCurrentProvider = () => {
    return MODEL_PROVIDERS.find(p => p.id === config.provider) || MODEL_PROVIDERS[0];
  };

  /**
   * 处理提供商切换
   */
  const handleProviderChange = (providerId: string) => {
    const provider = MODEL_PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setConfig({
        ...config,
        provider: providerId,
        model: provider.models[0],
        baseUrl: provider.baseUrl,
        apiKey: '' // 清空API密钥
      });
      setTestResult(null);
    }
  };

  /**
   * 测试API连接
   */
  const handleTestConnection = async () => {
    if (!config.apiKey.trim()) {
      setTestResult('error');
      setTestMessage('请先输入API密钥');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await AIConfigManager.testConnection(config);
      
      if (result.success) {
        setTestResult('success');
        setTestMessage(`${result.message} (延迟: ${result.latency}ms)`);
      } else {
        setTestResult('error');
        setTestMessage(result.message);
      }
    } catch (error) {
      setTestResult('error');
      setTestMessage('连接测试失败，请检查网络和密钥');
    } finally {
      setTesting(false);
    }
  };

  /**
   * 保存配置
   */
  const handleSaveConfig = () => {
    try {
      AIConfigManager.saveConfig(config);
      setTestMessage('配置已保存到本地');
      setTestResult('success');
    } catch (error) {
      setTestMessage('保存配置失败');
      setTestResult('error');
    }
  };

  const currentProvider = getCurrentProvider();

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          AI 模型设置
        </Typography>
        <Typography variant="body2" color="text.secondary">
          配置用于生成题目的AI模型，建议优先选择DeepSeek以获得最佳性价比
        </Typography>
      </Box>

      {/* 模型选择卡片 */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            选择AI模型提供商
          </Typography>

          <Grid container spacing={2}>
            {MODEL_PROVIDERS.map((provider) => (
              <Grid item xs={12} sm={6} key={provider.id}>
                <Card
                  variant={config.provider === provider.id ? "elevation" : "outlined"}
                  sx={{
                    cursor: 'pointer',
                    border: config.provider === provider.id ? 2 : 1,
                    borderColor: config.provider === provider.id ? 'primary.main' : 'divider',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-1px)'
                    }
                  }}
                  onClick={() => handleProviderChange(provider.id)}
                >
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
                        {provider.name}
                      </Typography>
                      {provider.recommended && (
                        <Chip label="推荐" color="primary" size="small" />
                      )}
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {provider.description}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                      <Chip
                        icon={<AttachMoney />}
                        label={provider.costLevel === 'low' ? '低成本' : provider.costLevel === 'medium' ? '中等成本' : '高成本'}
                        size="small"
                        color={provider.costLevel === 'low' ? 'success' : provider.costLevel === 'medium' ? 'warning' : 'error'}
                        variant="outlined"
                      />
                      {provider.chineseOptimized && (
                        <Chip
                          icon={<Language />}
                          label="中文优化"
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      )}
                      <Chip
                        icon={<Speed />}
                        label="稳定快速"
                        size="small"
                        variant="outlined"
                      />
                    </Box>

                    <Box>
                      <Typography variant="caption" color="success.main">
                        优点: {provider.pros.join('、')}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* 详细配置 */}
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            模型详细配置
          </Typography>

          <Grid container spacing={3}>
            {/* 模型选择 */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>具体模型</InputLabel>
                <Select
                  value={config.model}
                  label="具体模型"
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                >
                  {currentProvider.models.map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* 温度参数 */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="创造性温度 (0-1)"
                type="number"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) || 0.7 })}
                inputProps={{ min: 0, max: 1, step: 0.1 }}
                helperText="0=保守准确，1=创新多样，推荐0.7"
              />
            </Grid>

            {/* API密钥 */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API 密钥"
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder={`请输入${currentProvider.name}的API密钥`}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowApiKey(!showApiKey)}
                        edge="end"
                      >
                        {showApiKey ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                helperText={`在${currentProvider.name}官网申请API密钥，每次使用时需要输入`}
              />
            </Grid>

            {/* API基础URL */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API 基础URL"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                helperText="一般情况下不需要修改"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* 测试结果显示 */}
          {testResult && (
            <Alert 
              severity={testResult} 
              icon={testResult === 'success' ? <CheckCircle /> : <Error />}
              sx={{ mb: 2 }}
            >
              {testMessage}
            </Alert>
          )}

          {/* 操作按钮 */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={testing || !config.apiKey.trim()}
              startIcon={testing ? <CircularProgress size={16} /> : <Psychology />}
            >
              {testing ? '测试中...' : '测试连接'}
            </Button>

            <Button
              variant="contained"
              onClick={handleSaveConfig}
              disabled={!config.apiKey.trim()}
              startIcon={<CheckCircle />}
            >
              保存配置
            </Button>
          </Box>

          {/* 使用提示 */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>💡 使用提示：</strong>
              <br />
              • API密钥会保存在浏览器本地存储中，请妥善保管
              <br />
              • DeepSeek推荐用于中文题目生成，成本低且效果好
              <br />
              • 生成前会自动验证API密钥有效性
              <br />
              • 如需删除配置，可清除浏览器数据
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ModelSettings;