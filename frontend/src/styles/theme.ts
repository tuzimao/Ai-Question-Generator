// frontend/src/styles/theme.ts

import { createTheme, ThemeOptions } from '@mui/material/styles';

/**
 * 自定义调色板
 * 定义应用的主要颜色方案
 */
const palette = {
  primary: {
    main: '#1976d2',        // 主色调 - 蓝色
    light: '#42a5f5',       // 浅色变体
    dark: '#1565c0',        // 深色变体
    contrastText: '#ffffff'  // 对比文字颜色
  },
  secondary: {
    main: '#9c27b0',        // 次要色调 - 紫色
    light: '#ba68c8',       // 浅色变体
    dark: '#7b1fa2',        // 深色变体
    contrastText: '#ffffff'  // 对比文字颜色
  },
  success: {
    main: '#2e7d32',        // 成功色 - 绿色
    light: '#4caf50',
    dark: '#1b5e20'
  },
  warning: {
    main: '#ed6c02',        // 警告色 - 橙色
    light: '#ff9800',
    dark: '#e65100'
  },
  error: {
    main: '#d32f2f',        // 错误色 - 红色
    light: '#f44336',
    dark: '#c62828'
  },
  background: {
    default: '#fafafa',     // 默认背景色
    paper: '#ffffff'        // 纸张背景色
  },
  text: {
    primary: '#212121',     // 主要文字颜色
    secondary: '#757575'    // 次要文字颜色
  }
};

/**
 * 自定义排版设置
 * 定义字体、字号等排版规则
 */
const typography = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif'
  ].join(','),
  h1: {
    fontSize: '2.5rem',
    fontWeight: 600,
    lineHeight: 1.2
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.3
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.4
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 500,
    lineHeight: 1.4
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 500,
    lineHeight: 1.5
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.6
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.6
  }
};

/**
 * 自定义组件样式
 * 覆盖默认的 Material-UI 组件样式
 */
const components = {
  // 按钮组件自定义
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none' as const, // 禁用大写转换
        borderRadius: 8,                // 圆角
        fontWeight: 500,                // 字体粗细
        padding: '8px 16px'             // 内边距
      },
      contained: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)', // 阴影
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }
      }
    }
  },
  // 卡片组件自定义
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,               // 圆角
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)', // 阴影
        border: '1px solid #f0f0f0'     // 边框
      }
    }
  },
  // 输入框组件自定义
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 8             // 圆角
        }
      }
    }
  },
  // 应用栏组件自定义
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)' // 阴影
      }
    }
  }
};

/**
 * 主题配置选项
 */
const themeOptions: ThemeOptions = {
  palette,
  typography,
  components,
  spacing: 8,                    // 间距单位（8px）
  shape: {
    borderRadius: 8              // 默认圆角
  },
  breakpoints: {
    values: {
      xs: 0,                     // 超小屏幕
      sm: 600,                   // 小屏幕
      md: 960,                   // 中等屏幕
      lg: 1280,                  // 大屏幕
      xl: 1920                   // 超大屏幕
    }
  }
};

/**
 * 创建并导出主题
 */
export const theme = createTheme(themeOptions);

/**
 * 暗色主题（可选）
 * 可以在后续添加暗色模式时使用
 */
export const darkTheme = createTheme({
  ...themeOptions,
  palette: {
    ...palette,
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1e1e1e'
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3'
    }
  }
});