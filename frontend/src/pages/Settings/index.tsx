// frontend/src/pages/Settings/index.tsx

import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import {
  Psychology,
  Settings as SettingsIcon,
  Info
} from '@mui/icons-material';

import { ModelSettings } from '@/components/Settings/ModelSettings';

/**
 * 设置标签页配置
 */
interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType;
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'model',
    label: 'AI模型',
    icon: <Psychology />,
    component: ModelSettings
  },
  {
    id: 'general',
    label: '通用设置',
    icon: <SettingsIcon />,
    component: () => (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          通用设置功能即将上线
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          将包含界面主题、语言设置、默认配置等功能
        </Typography>
      </Box>
    )
  },
  {
    id: 'about',
    label: '关于',
    icon: <Info />,
    component: () => (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          AI 题目生成器
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          版本：v1.0.0-beta
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          一个智能的题目生成和管理平台，支持多种AI模型，帮助教师和学生快速创建高质量的练习题目。
        </Typography>
        <Typography variant="body2" color="text.secondary">
          技术栈：React + TypeScript + Material-UI + Node.js
        </Typography>
      </Box>
    )
  }
];

/**
 * 设置页面组件
 */
export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('model');

  /**
   * 获取当前活动标签的组件
   */
  const getCurrentTabComponent = () => {
    const tab = SETTINGS_TABS.find(t => t.id === activeTab);
    if (!tab) return null;
    
    const Component = tab.component;
    return <Component />;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          系统设置
        </Typography>
        <Typography variant="body1" color="text.secondary">
          配置AI模型、界面选项和其他系统参数
        </Typography>
      </Box>

      {/* 设置内容 */}
      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        {/* 标签页导航 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="设置标签页"
            sx={{ px: 2 }}
          >
            {SETTINGS_TABS.map((tab) => (
              <Tab
                key={tab.id}
                value={tab.id}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                sx={{ minHeight: 64 }}
              />
            ))}
          </Tabs>
        </Box>

        {/* 标签页内容 */}
        <Box sx={{ p: 3 }}>
          {getCurrentTabComponent()}
        </Box>
      </Paper>
    </Container>
  );
};

export default Settings;