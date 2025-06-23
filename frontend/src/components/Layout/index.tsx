// frontend/src/components/Layout/index.tsx

import React from 'react';
import { Box, Container } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import {Sidebar} from './Sidebar';
import { User, UserRole } from '@/types/auth';

/**
 * Layout 组件的 Props 接口
 */
interface LayoutProps {
  children: React.ReactNode;     // 子组件内容
  user: User | null;            // 当前用户信息
  onLogout: () => void;         // 退出登录回调
  showSidebar?: boolean;        // 是否显示侧边栏
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false; // 内容最大宽度
}

/**
 * 主布局组件
 * 提供应用的整体布局结构，包含顶部导航栏、侧边栏和主内容区域
 */
export const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  onLogout,
  showSidebar = true,
  maxWidth = false
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * 处理导航跳转
   */
  const handleNavigate = (path: string) => {
    navigate(path);
  };

  /**
   * 处理查看个人资料
   */
  const handleProfile = () => {
    navigate('/profile');
  };

  /**
   * 处理打开设置
   */
  const handleSettings = () => {
    navigate('/settings');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 顶部导航栏 */}
      <Header
        user={user}
        onLogout={onLogout}
        onProfile={handleProfile}
        onSettings={handleSettings}
      />

      {/* 主体内容区域 */}
      <Box sx={{ display: 'flex', flex: 1 }}>
        {/* 侧边栏 */}
        {showSidebar && user && (
          <Sidebar
            currentPath={location.pathname}
            userRole={user.role}
            onNavigate={handleNavigate}
          />
        )}

        {/* 主内容区域 */}
        <Box
          component="main"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.default',
            minHeight: 'calc(100vh - 64px)', // 减去 Header 高度
            overflow: 'auto'
          }}
        >
          {maxWidth ? (
            <Container 
              maxWidth={maxWidth} 
              sx={{ 
                flex: 1, 
                py: 3,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {children}
            </Container>
          ) : (
            <Box sx={{ flex: 1, p: 3 }}>
              {children}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;