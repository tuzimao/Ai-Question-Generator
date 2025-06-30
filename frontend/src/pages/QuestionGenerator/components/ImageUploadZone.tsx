// frontend/src/pages/QuestionGenerator/components/ImageUploadZone.tsx

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
  Chip,
  Grid,
  Card,
  CardMedia,
  CardContent
} from '@mui/material';
import {
  PhotoCamera,
  Image,
  PictureAsPdf,
  Delete,
  CheckCircle,
  Error,
  Upload,
  Visibility,
  CropFree
} from '@mui/icons-material';
import { UploadedFile } from '@/types/generator';

/**
 * 图片上传区域组件的 Props 接口
 */
interface ImageUploadZoneProps {
  onImageUpload: (images: UploadedFile[]) => void; // 图片上传回调
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
    case 'jpg':
    case 'jpeg':
    case 'png':
      return <Image color="primary" />;
    default:
      return <Image color="action" />;
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
 * 创建图片预览URL
 */
const createImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
};

/**
 * 图片上传区域组件
 * 专门用于上传题目图片，支持预览和OCR识别
 */
export const ImageUploadZone: React.FC<ImageUploadZoneProps> = ({
  onImageUpload,
  disabled = false,
  acceptedTypes = ['.jpg', '.jpeg', '.png', '.pdf'],
  maxFileSize = 20 * 1024 * 1024, // 20MB
  maxFiles = 10
}) => {
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  // 上传中的文件
  const [uploadingImages, setUploadingImages] = useState<UploadedFile[]>([]);
  // 错误信息
  const [error, setError] = useState<string | null>(null);
  // 图片预览
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  /**
   * 处理图片选择
   */
  const handleImageSelect = useCallback(async (files: FileList) => {
    setError(null);
    
    const selectedFiles = Array.from(files);
    
    // 验证文件数量
    if (selectedFiles.length > maxFiles) {
      setError(`最多只能上传 ${maxFiles} 张图片`);
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
    const uploadImages: UploadedFile[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadProgress: 0,
      status: 'uploading'
    }));

    setUploadingImages(prev => [...prev, ...uploadImages]);

    // 创建图片预览
    for (const [index, file] of validFiles.entries()) {
      if (file.type.startsWith('image/')) {
        const previewUrl = await createImagePreview(file);
        setImagePreviews(prev => ({
          ...prev,
          [uploadImages[index].id]: previewUrl
        }));
      }
    }

    // 模拟上传和OCR识别过程
    for (const uploadImage of uploadImages) {
      try {
        await simulateImageUpload(uploadImage, (progress) => {
          setUploadingImages(prev => 
            prev.map(f => 
              f.id === uploadImage.id 
                ? { ...f, uploadProgress: progress }
                : f
            )
          );
        });

        // 上传完成，开始OCR识别
        setUploadingImages(prev => 
          prev.map(f => 
            f.id === uploadImage.id 
              ? { ...f, status: 'completed', uploadProgress: 100 }
              : f
          )
        );

        // 模拟OCR识别
        const ocrContent = await simulateOCRRecognition(uploadImage.name);
        
        const completedImage: UploadedFile = {
          ...uploadImage,
          content: ocrContent,
          status: 'completed'
        };

        // 通知父组件
        onImageUpload([completedImage]);
        
      } catch (error) {
        setUploadingImages(prev => 
          prev.map(f => 
            f.id === uploadImage.id 
              ? { ...f, status: 'error', error: 'OCR识别失败' }
              : f
          )
        );
      }
    }

    // 清理上传状态
    setTimeout(() => {
      setUploadingImages(prev => prev.filter(f => f.status === 'uploading'));
    }, 2000);
  }, [acceptedTypes, maxFileSize, maxFiles, onImageUpload]);

  /**
   * 模拟图片上传过程
   */
  const simulateImageUpload = (image: UploadedFile, onProgress: (progress: number) => void): Promise<void> => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          resolve();
        }
        onProgress(progress);
      }, 300);
    });
  };

  /**
   * 模拟OCR识别过程
   */
  const simulateOCRRecognition = (fileName: string): Promise<string> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模拟识别的题目内容
        resolve(`从图片 "${fileName}" 中识别出的题目：

1. 【单选题】下列函数中，在定义域内单调递增的是（）
   A. y = -x²
   B. y = 2x + 1  
   C. y = 1/x
   D. y = |x|

2. 【解答题】已知函数 f(x) = 2x³ - 3x² + 1
   (1) 求 f'(x)
   (2) 求函数 f(x) 在区间 [0,2] 上的最值

注：这是OCR识别的示例结果，实际应用中会根据真实图片内容进行识别。`);
      }, 2000);
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
      handleImageSelect(e.dataTransfer.files);
    }
  }, [disabled, handleImageSelect]);

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
        handleImageSelect(target.files);
      }
    };
    input.click();
  };

  /**
   * 删除上传中的图片
   */
  const handleRemoveUploadingImage = (imageId: string) => {
    setUploadingImages(prev => prev.filter(f => f.id !== imageId));
    setImagePreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[imageId];
      return newPreviews;
    });
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
          borderColor: isDragging ? 'warning.main' : 'divider',
          backgroundColor: isDragging ? 'warning.light' : 'background.paper',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease-in-out',
          '&:hover': disabled ? {} : {
            borderColor: 'warning.main',
            backgroundColor: 'warning.light'
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={disabled ? undefined : handleFileInputClick}
      >
        <PhotoCamera 
          sx={{ 
            fontSize: 48, 
            color: isDragging ? 'warning.main' : 'text.secondary',
            mb: 2 
          }} 
        />
        
        <Typography variant="h6" gutterBottom>
          {isDragging ? '释放图片开始识别' : '拖拽题目图片到此处或点击上传'}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          支持 JPG、PNG、PDF 格式，单个文件最大 {formatFileSize(maxFileSize)}
          <br />
          AI将自动识别图片中的题目内容、公式和表格
        </Typography>
        
        <Button
          variant="outlined"
          startIcon={<Upload />}
          disabled={disabled}
          sx={{ pointerEvents: 'none' }}
          color="warning"
        >
          选择图片
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

      {/* 上传进度和预览 */}
      {uploadingImages.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            图片处理进度
          </Typography>
          <Grid container spacing={2}>
            {uploadingImages.map(image => (
              <Grid item xs={12} sm={6} md={4} key={image.id}>
                <Card elevation={2}>
                  {imagePreviews[image.id] && (
                    <CardMedia
                      component="img"
                      height="140"
                      image={imagePreviews[image.id]}
                      alt={image.name}
                      sx={{ objectFit: 'cover' }}
                    />
                  )}
                  <CardContent sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      {image.status === 'completed' ? (
                        <CheckCircle color="success" sx={{ mr: 1 }} />
                      ) : image.status === 'error' ? (
                        <Error color="error" sx={{ mr: 1 }} />
                      ) : (
                        <CropFree color="primary" sx={{ mr: 1 }} />
                      )}
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {image.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveUploadingImage(image.id)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatFileSize(image.size)}
                      {image.status === 'uploading' && ` • 识别中 ${Math.round(image.uploadProgress)}%`}
                      {image.status === 'completed' && ' • 识别完成'}
                      {image.status === 'error' && ` • ${image.error}`}
                    </Typography>
                    
                    {image.status === 'uploading' && (
                      <LinearProgress
                        variant="determinate"
                        value={image.uploadProgress}
                        sx={{ mt: 1 }}
                        color="warning"
                      />
                    )}
                    
                    {image.status === 'completed' && (
                      <Chip 
                        label="已识别" 
                        color="success" 
                        size="small" 
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* 使用提示 */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          识别功能：
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {[
            { feature: '文字识别', desc: '自动识别图片中的文字内容', color: 'primary' },
            { feature: '公式识别', desc: '智能识别数学公式', color: 'secondary' },
            { feature: '表格识别', desc: '准确识别表格结构', color: 'success' },
            { feature: '版面分析', desc: '理解题目结构和布局', color: 'warning' }
          ].map(item => (
            <Chip
              key={item.feature}
              label={item.feature}
              size="small"
              variant="outlined"
              color={item.color as any}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default ImageUploadZone;