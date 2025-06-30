// frontend/src/utils/aiConfig.ts

import React from 'react';

/**
 * AI模型配置接口
 */
export interface AIModelConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
}

/**
 * 默认AI模型配置
 */
export const DEFAULT_AI_CONFIG: AIModelConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  temperature: 0.7
};

/**
 * AI配置管理工具类
 */
export class AIConfigManager {
  private static readonly STORAGE_KEY = 'ai_model_config';

  /**
   * 获取当前AI配置
   */
  static getCurrentConfig(): AIModelConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        // 验证配置完整性
        if (this.validateConfig(config)) {
          return config;
        }
      }
    } catch (error) {
      console.warn('Failed to load AI config from storage:', error);
    }
    
    return { ...DEFAULT_AI_CONFIG };
  }

  /**
   * 保存AI配置
   */
  static saveConfig(config: AIModelConfig): void {
    try {
      if (this.validateConfig(config)) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
      } else {
        throw new Error('Invalid AI configuration');
      }
    } catch (error) {
      console.error('Failed to save AI config:', error);
      throw error;
    }
  }

  /**
   * 验证配置有效性
   */
  static validateConfig(config: any): config is AIModelConfig {
    return (
      typeof config === 'object' &&
      typeof config.provider === 'string' &&
      typeof config.model === 'string' &&
      typeof config.apiKey === 'string' &&
      typeof config.baseUrl === 'string' &&
      typeof config.temperature === 'number' &&
      config.temperature >= 0 &&
      config.temperature <= 1
    );
  }

  /**
   * 检查是否已配置
   */
  static isConfigured(): boolean {
    const config = this.getCurrentConfig();
    return config.apiKey.trim() !== '';
  }

  /**
   * 清除配置
   */
  static clearConfig(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * 获取API请求头
   */
  static getAuthHeaders(config?: AIModelConfig): Record<string, string> {
    const currentConfig = config || this.getCurrentConfig();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // 根据不同提供商设置认证头
    switch (currentConfig.provider) {
      case 'openai':
      case 'deepseek':
      case 'moonshot':
        headers['Authorization'] = `Bearer ${currentConfig.apiKey}`;
        break;
      case 'zhipu':
        headers['Authorization'] = `Bearer ${currentConfig.apiKey}`;
        break;
      default:
        headers['Authorization'] = `Bearer ${currentConfig.apiKey}`;
    }

    return headers;
  }

  /**
   * 构建API请求URL
   */
  static buildApiUrl(endpoint: string, config?: AIModelConfig): string {
    const currentConfig = config || this.getCurrentConfig();
    const baseUrl = currentConfig.baseUrl.endsWith('/') 
      ? currentConfig.baseUrl.slice(0, -1) 
      : currentConfig.baseUrl;
    
    return `${baseUrl}${endpoint}`;
  }

  /**
   * 测试API连接
   */
  static async testConnection(config: AIModelConfig): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const headers = this.getAuthHeaders(config);
      const url = this.buildApiUrl('/chat/completions', config);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'user',
              content: '测试连接'
            }
          ],
          max_tokens: 10,
          temperature: 0.1
        })
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          message: '连接测试成功！',
          latency
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `连接失败: ${errorData.error?.message || response.statusText}`,
          latency
        };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        message: `连接失败: ${error instanceof Error ? error.message : '网络错误'}`,
        latency
      };
    }
  }
}

/**
 * React Hook: 使用AI配置
 */
export const useAIConfig = () => {
  const [config, setConfigState] = React.useState<AIModelConfig>(
    AIConfigManager.getCurrentConfig()
  );

  const setConfig = (newConfig: AIModelConfig) => {
    AIConfigManager.saveConfig(newConfig);
    setConfigState(newConfig);
  };

  const isConfigured = AIConfigManager.isConfigured();

  return {
    config,
    setConfig,
    isConfigured,
    testConnection: (testConfig?: AIModelConfig) => 
      AIConfigManager.testConnection(testConfig || config)
  };
};