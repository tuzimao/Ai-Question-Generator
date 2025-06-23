// frontend/src/components/Layout/Header.tsx

import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Chip
} from '@mui/material';
import {
  AccountCircle,
  Settings,
  Logout,
  Notifications,
  Help
} from '@mui/icons-material';
import { User, UserRole } from '@/types/auth';

/**
 * Header 组件的 Props 接口
 */
interface HeaderProps {
  user: User | null;              // 当前用户信息
  onLogout: () => void;          // 退出登录回调
  onProfile: () => void;         // 查看个人资料回调
  onSettings: () => void;        // 打开设置回调
}

/**
 * 获取用户角色对应的显示文本和颜色
 */
const getRoleDisplay = (role: UserRole) => {
  switch (role) {
    case UserRole.TEACHER:
      return { label: '教师', color: 'primary' as const };
    case UserRole.STUDENT:
      return { label: '学生', color: 'secondary' as const };
    case UserRole.ADMIN:
      return { label: '管理员', color: 'error' as const };
    default:
      return { label: '用户', color: 'default' as const };
  }
};

/**
 * 顶部导航栏组件
 * 包含应用标题、用户信息和操作菜单
 */
export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onProfile,
  onSettings
}) => {
  // 用户菜单的锚点元素状态
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  
  // 菜单是否打开
  const isMenuOpen = Boolean(anchorEl);

  /**
   * 打开用户菜单
   */
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * 关闭用户菜单
   */
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  /**
   * 处理菜单项点击
   */
  const handleMenuItemClick = (action: () => void) => {
    handleMenuClose();
    action();
  };

  return (
    <AppBar 
      position="sticky" 
      elevation={1}
      sx={{ 
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {/* 左侧：应用标题和Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography 
            variant="h6" 
            component="h1"
            sx={{ 
              fontWeight: 600,
              background: 'linear-gradient(45deg, #1976d2, #9c27b0)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            AI 练习题生成器
          </Typography>
        </Box>

        {/* 右侧：用户信息和操作按钮 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {user ? (
            <>
              {/* 通知按钮 */}
              <IconButton 
                color="inherit" 
                size="small"
                sx={{ mr: 1 }}
              >
                <Notifications />
              </IconButton>

              {/* 帮助按钮 */}
              <IconButton 
                color="inherit" 
                size="small"
                sx={{ mr: 1 }}
              >
                <Help />
              </IconButton>

              {/* 用户角色标签 */}
              <Chip 
                label={getRoleDisplay(user.role).label}
                color={getRoleDisplay(user.role).color}
                size="small"
                variant="outlined"
              />

              {/* 用户头像和菜单 */}
              <IconButton
                onClick={handleMenuOpen}
                sx={{ p: 0.5 }}
              >
                <Avatar 
                  src={user.avatar}
                  sx={{ width: 32, height: 32 }}
                >
                  {user.displayName.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>

              {/* 用户下拉菜单 */}
              <Menu
                anchorEl={anchorEl}
                open={isMenuOpen}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                sx={{ mt: 1 }}
              >
                {/* 用户信息显示 */}
                <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" fontWeight="medium">
                    {user.displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>

                {/* 菜单项 */}
                <MenuItem onClick={() => handleMenuItemClick(onProfile)}>
                  <AccountCircle sx={{ mr: 1 }} fontSize="small" />
                  个人资料
                </MenuItem>
                
                <MenuItem onClick={() => handleMenuItemClick(onSettings)}>
                  <Settings sx={{ mr: 1 }} fontSize="small" />
                  设置
                </MenuItem>
                
                <MenuItem 
                  onClick={() => handleMenuItemClick(onLogout)}
                  sx={{ color: 'error.main' }}
                >
                  <Logout sx={{ mr: 1 }} fontSize="small" />
                  退出登录
                </MenuItem>
              </Menu>
            </>
          ) : (
            /* 未登录状态显示登录按钮 */
            <Button 
              variant="contained" 
              size="small"
              startIcon={<AccountCircle />}
            >
              登录
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;