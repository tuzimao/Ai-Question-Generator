// frontend/src/main.tsx

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/styles/globals.css'

/**
 * 应用入口文件
 * 负责将 React 应用挂载到 DOM 上
 */

// 获取根元素
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('无法找到根元素。请确保 HTML 中存在 id="root" 的元素。');
}

// 创建 React 根节点并渲染应用
const root = ReactDOM.createRoot(rootElement);

root.render(
  
    <App />
  
);