// frontend/src/pages/QuestionGenerator/components/FileUploadZone.tsx

import React, { useCallback, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  PictureAsPdf,
  Description,
  Slideshow,
  Delete,
  CheckCircle,
  Error,
  Upload
} from '@mui/icons-material';
import { UploadedFile } from '@/types/generator';

/**
 * 文件上传区域组件的 Props 接口
 */
interface FileUploadZoneProps {
  onFileUpload: (files: UploadedFile[]) => void; // 文件上传回调
  disabled?: boolean;                     // 是否禁用
  acceptedTypes?: string[];               // 接受的文件类型
  maxFileSize?: number;                   // 最大文件大小（字节）
  maxFiles?: number;                      // 最大文件数量
}

/**
 * 获取文件类型图标
 */
const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return <PictureAsPdf color="error" />;
    case 'doc':
    case 'docx':
      return <Description color="primary" />;
    case 'ppt':
    case 'pptx':
      return <Slideshow color="warning" />;
    case 'txt':
      return <InsertDriveFile color="action" />;
    default:
      return <InsertDriveFile color="action" />;
  }
};

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 验证文件类型
 */
const validateFileType = (file: File, acceptedTypes: string[]): boolean => {
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  return acceptedTypes.includes(extension);
};

/**
 * 文件上传区域组件
 * 提供拖拽上传和点击上传功能
 */
export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFileUpload,
  disabled = false,
  acceptedTypes = ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5
}) => {
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  // 上传中的文件
  const [uploadingFiles, setUploadingFiles] = useState<UploadedFile[]>([]);
  // 错误信息
  const [error, setError] = useState<string | null>(null);

  /**
   * 处理文件选择
   */
  const handleFileSelect = useCallback(async (files: FileList) => {
    setError(null);
    
    const selectedFiles = Array.from(files);
    
    // 验证文件数量
    if (selectedFiles.length > maxFiles) {
      setError(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    // 验证文件
    const validFiles: File[] = [];
    for (const file of selectedFiles) {
      // 检查文件类型
      if (!validateFileType(file, acceptedTypes)) {
        setError(`不支持的文件类型: ${file.name}`);
        continue;
      }
      
      // 检查文件大小
      if (file.size > maxFileSize) {
        setError(`文件 ${file.name} 太大，最大支持 ${formatFileSize(maxFileSize)}`);
        continue;
      }
      
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // 创建上传文件对象
    const uploadFiles: UploadedFile[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadProgress: 0,
      status: 'uploading'
    }));

    setUploadingFiles(prev => [...prev, ...uploadFiles]);

    // 模拟上传过程
    for (const uploadFile of uploadFiles) {
      try {
        await simulateFileUpload(uploadFile, (progress) => {
          setUploadingFiles(prev => 
            prev.map(f => 
              f.id === uploadFile.id 
                ? { ...f, uploadProgress: progress }
                : f
            )
          );
        });

        // 上传完成
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'completed', uploadProgress: 100 }
              : f
          )
        );

        // 模拟内容解析
        const fileContent = await simulateFileContentExtraction(uploadFile.name);
        
        const completedFile: UploadedFile = {
          ...uploadFile,
          content: fileContent,
          status: 'completed'
        };

        // 通知父组件
        onFileUpload([completedFile]);
        
      } catch (error) {
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'error', error: '上传失败' }
              : f
          )
        );
      }
    }

    // 清理上传状态
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(f => f.status === 'uploading'));
    }, 2000);
  }, [acceptedTypes, maxFileSize, maxFiles, onFileUpload]);

  /**
   * 模拟文件上传过程
   */
  const simulateFileUpload = (file: UploadedFile, onProgress: (progress: number) => void): Promise<void> => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          resolve();
        }
        onProgress(progress);
      }, 200);
    });
  };

  /**
   * 模拟文件内容提取
   */
  const simulateFileContentExtraction = (fileName: string): Promise<string> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模拟提取的文本内容
        resolve(`这是从文件 "${fileName}" 中提取的示例内容。在实际应用中，这里会是真实的文档内容，包括文本、公式、图表说明等。AI将基于这些内容生成相关的练习题目。`);
      }, 1000);
    });
  };

  /**
   * 处理拖拽事件
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (!disabled && e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [disabled, handleFileSelect]);

  /**
   * 处理文件输入点击
   */
  const handleFileInputClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = acceptedTypes.join(',');
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        handleFileSelect(target.files);
      }
    };
    input.click();
  };

  /**
   * 删除上传中的文件
   */
  const handleRemoveUploadingFile = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <Box>
      {/* 主上传区域 */}
      <Paper
        elevation={isDragging ? 4 : 1}
        sx={{
          p: 4,
          textAlign: 'center',
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragging ? 'primary.main' : 'divider',
          backgroundColor: isDragging ? 'action.hover' : 'background.paper',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease-in-out',
          '&:hover': disabled ? {} : {
            borderColor: 'primary.main',
            backgroundColor: 'action.hover'
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={disabled ? undefined : handleFileInputClick}
      >
        <CloudUpload 
          sx={{ 
            fontSize: 48, 
            color: isDragging ? 'primary.main' : 'text.secondary',
            mb: 2 
          }} 
        />
        
        <Typography variant="h6" gutterBottom>
          {isDragging ? '释放文件开始上传' : '拖拽文件到此处或点击上传'}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          支持 {acceptedTypes.join(', ')} 格式，单个文件最大 {formatFileSize(maxFileSize)}
        </Typography>
        
        <Button
          variant="outlined"
          startIcon={<Upload />}
          disabled={disabled}
          sx={{ pointerEvents: 'none' }}
        >
          选择文件
        </Button>
      </Paper>

      {/* 错误提示 */}
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mt: 2 }}
        >
          {error}
        </Alert>
      )}

      </Box>)}