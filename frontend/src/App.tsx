// frontend/src/App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from '@/styles/theme';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import { User, UserRole } from '@/types/auth';

/**
 * App 主组件
 * 应用的根组件，负责路由配置、主题提供和全局状态管理
 */
export const App: React.FC = () => {
  // 模拟用户状态 - 在实际应用中应该来自认证状态管理
  // TODO: 替换为真实的用户认证状态
  const [user, setUser] = React.useState<User | null>({
    id: '1',
    username: 'teacher_demo',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    displayName: '张老师',
    createdAt: new Date(),
    isActive: true
  });

  /**
   * 处理用户退出登录
   */
  const handleLogout = () => {
    setUser(null);
    // TODO: 清除本地存储的认证信息
    // TODO: 重定向到登录页面
    console.log('用户退出登录');
  };

  /**
   * 处理导航到题目生成页面
   */
  const handleNavigateToGenerate = () => {
    // TODO: 使用 react-router 导航
    console.log('导航到题目生成页面');
  };

  /**
   * 处理导航到练习页面
   */
  const handleNavigateToExercises = () => {
    // TODO: 使用 react-router 导航
    console.log('导航到练习页面');
  };

  return (
    <ThemeProvider theme={theme}>
      {/* Material-UI 基础样式重置 */}
      <CssBaseline />
      
      <Router>
        <Layout 
          user={user} 
          onLogout={handleLogout}
          showSidebar={!!user} // 只有登录用户才显示侧边栏
        >
          <Routes>
            {/* 首页重定向 */}
            <Route 
              path="/" 
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* 仪表板页面 */}
            <Route 
              path="/dashboard" 
              element={
                user ? (
                  <Dashboard
                    user={user}
                    onNavigateToGenerate={handleNavigateToGenerate}
                    onNavigateToExercises={handleNavigateToExercises}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* 题目生成页面 - 待实现 */}
            <Route 
              path="/questions/generate" 
              element={
                user ? (
                  <div>题目生成页面 - 待实现</div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* 题库管理页面 - 待实现 */}
            <Route 
              path="/questions/library" 
              element={
                user ? (
                  <div>题库管理页面 - 待实现</div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* 练习管理页面 - 待实现 */}
            <Route 
              path="/exercises/*" 
              element={
                user ? (
                  <div>练习管理页面 - 待实现</div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* 个人资料页面 - 待实现 */}
            <Route 
              path="/profile" 
              element={
                user ? (
                  <div>个人资料页面 - 待实现</div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* 设置页面 - 待实现 */}
            <Route 
              path="/settings" 
              element={
                user ? (
                  <div>设置页面 - 待实现</div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            
            {/* 登录页面 - 待实现 */}
            <Route 
              path="/login" 
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <div>登录页面 - 待实现</div>
                )
              } 
            />
            
            {/* 404 页面 */}
            <Route 
              path="*" 
              element={
                <div>
                  <h1>页面未找到</h1>
                  <p>您访问的页面不存在</p>
                </div>
              } 
            />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
};

export default App;