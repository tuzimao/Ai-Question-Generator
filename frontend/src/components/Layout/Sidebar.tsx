// frontend/src/components/Layout/Sidebar.tsx

import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Chip,
  Collapse
} from '@mui/material';
import {
  Dashboard,
  Quiz,
  Assignment,
  History,
  Settings,
  School,
  ExpandLess,
  ExpandMore,
  Add,
  List as ListIcon,
  Analytics
} from '@mui/icons-material';
import { UserRole } from '@/types/auth';

/**
 * 导航菜单项接口
 */
interface NavItem {
  id: string;              // 菜单项唯一标识
  label: string;           // 显示文本
  icon: React.ReactNode;   // 图标
  path?: string;           // 路由路径
  children?: NavItem[];    // 子菜单
  badge?: string;          // 徽章文本
  roles?: UserRole[];      // 允许访问的用户角色
}

/**
 * Sidebar 组件的 Props 接口
 */
interface SidebarProps {
  currentPath: string;           // 当前路径
  userRole: UserRole;           // 用户角色
  onNavigate: (path: string) => void; // 导航回调
  isCollapsed?: boolean;        // 是否折叠（为未来响应式设计预留）
}

/**
 * 定义导航菜单结构
 * 根据用户角色显示不同的菜单项
 */
const getNavItems = (userRole: UserRole): NavItem[] => {
  const commonItems: NavItem[] = [
    {
      id: 'dashboard',
      label: '仪表板',
      icon: <Dashboard />,
      path: '/dashboard'
    },
    {
      id: 'questions',
      label: '题目管理',
      icon: <Quiz />,
      children: [
        {
          id: 'generate',
          label: '生成题目',
          icon: <Add />,
          path: '/questions/generate'
        },
        {
          id: 'library',
          label: '题库管理',
          icon: <ListIcon />,
          path: '/questions/library'
        }
      ]
    }
  ];

  // 教师专用菜单
  const teacherItems: NavItem[] = [
    {
      id: 'exercises',
      label: '练习管理',
      icon: <Assignment />,
      children: [
        {
          id: 'create-exercise',
          label: '创建练习',
          icon: <Add />,
          path: '/exercises/create'
        },
        {
          id: 'exercise-list',
          label: '练习列表',
          icon: <ListIcon />,
          path: '/exercises/list'
        },
        {
          id: 'student-results',
          label: '学生成绩',
          icon: <Analytics />,
          path: '/exercises/results'
        }
      ]
    },
    {
      id: 'students',
      label: '学生管理',
      icon: <School />,
      path: '/students'
    }
  ];

  // 学生专用菜单
  const studentItems: NavItem[] = [
    {
      id: 'my-exercises',
      label: '我的练习',
      icon: <Assignment />,
      path: '/my-exercises'
    },
    {
      id: 'my-results',
      label: '成绩记录',
      icon: <Analytics />,
      path: '/my-results'
    }
  ];

  // 通用菜单
  const generalItems: NavItem[] = [
    {
      id: 'history',
      label: '历史记录',
      icon: <History />,
      path: '/history'
    },
    {
      id: 'settings',
      label: '设置',
      icon: <Settings />,
      path: '/settings'
    }
  ];

  // 根据用户角色组合菜单
  let items = [...commonItems];
  
  if (userRole === UserRole.TEACHER) {
    items = [...items, ...teacherItems];
  } else if (userRole === UserRole.STUDENT) {
    items = [...items, ...studentItems];
  }
  
  items = [...items, ...generalItems];
  
  return items;
};

/**
 * 侧边栏组件
 * 提供应用的主要导航功能
 */
export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  userRole,
  onNavigate,
  isCollapsed = false
}) => {
  // 管理展开的菜单项
  const [expandedItems, setExpandedItems] = React.useState<string[]>(['questions']);

  // 获取当前用户角色的菜单项
  const navItems = getNavItems(userRole);

  /**
   * 切换子菜单展开状态
   */
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  /**
   * 检查路径是否处于激活状态
   */
  const isPathActive = (path?: string) => {
    if (!path) return false;
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  /**
   * 递归渲染菜单项
   */
  const renderNavItem = (item: NavItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const isActive = isPathActive(item.path);

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              if (hasChildren) {
                toggleExpanded(item.id);
              } else if (item.path) {
                onNavigate(item.path);
              }
            }}
            selected={isActive}
            sx={{
              pl: 2 + level * 2, // 根据层级缩进
              minHeight: 48,
              borderRadius: 1,
              mx: 1,
              mb: 0.5,
              '&.Mui-selected': {
                backgroundColor: 'primary.light',
                color: 'primary.contrastText',
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText'
                }
              },
              '&:hover': {
                backgroundColor: isActive ? 'primary.light' : 'action.hover'
              }
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                color: isActive ? 'inherit' : 'text.secondary'
              }}
            >
              {item.icon}
            </ListItemIcon>
            
            <ListItemText
              primary={item.label}
              sx={{
                '& .MuiListItemText-primary': {
                  fontWeight: isActive ? 600 : 400,
                  fontSize: level > 0 ? '0.875rem' : '1rem'
                }
              }}
            />
            
            {/* 徽章显示 */}
            {item.badge && (
              <Chip
                label={item.badge}
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
            )}
            
            {/* 子菜单展开/收起图标 */}
            {hasChildren && (
              isExpanded ? <ExpandLess /> : <ExpandMore />
            )}
          </ListItemButton>
        </ListItem>

        {/* 子菜单 */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderNavItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <Box
      sx={{
        width: isCollapsed ? 70 : 280,
        flexShrink: 0,
        backgroundColor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto'
      }}
    >
      {/* 侧边栏头部 */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" color="primary" fontWeight={600}>
          {isCollapsed ? 'AI' : '快速操作'}
        </Typography>
      </Box>

      {/* 导航菜单 */}
      <Box sx={{ py: 1 }}>
        <List component="nav">
          {navItems.map(item => renderNavItem(item))}
        </List>
      </Box>

      {/* 侧边栏底部信息 */}
      {!isCollapsed && (
        <Box sx={{ p: 2, mt: 'auto', borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            当前角色: {userRole === UserRole.TEACHER ? '教师' : '学生'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            版本 v1.0.0
          </Typography>
        </Box>
      )}
    </Box>)}