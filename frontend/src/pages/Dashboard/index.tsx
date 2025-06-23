// frontend/src/pages/Dashboard/index.tsx

import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Chip,
  IconButton,
  Avatar,
  Divider
} from '@mui/material';
import {
  Quiz,
  Assignment,
  TrendingUp,
  Add,
  Visibility,
  Edit,
  School,
  AccessTime
} from '@mui/icons-material';
import { User, UserRole } from '@/types/auth';

/**
 * Dashboard 组件的 Props 接口
 */
interface DashboardProps {
  user: User;                    // 当前用户信息
  onNavigateToGenerate: () => void; // 导航到题目生成页面
  onNavigateToExercises: () => void; // 导航到练习页面
}

/**
 * 统计卡片组件
 */
interface StatCardProps {
  title: string;               // 标题
  value: string | number;      // 数值
  icon: React.ReactNode;       // 图标
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error'; // 颜色主题
  description?: string;        // 描述文本
  action?: React.ReactNode;    // 操作按钮
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  description,
  action
}) => (
  <Card 
    elevation={2}
    sx={{ 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: 4
      }
    }}
  >
    <CardContent sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Avatar 
          sx={{ 
            bgcolor: `${color}.main`,
            width: 48, 
            height: 48,
            mr: 2 
          }}
        >
          {icon}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" component="div" fontWeight="bold">
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
        </Box>
      </Box>
      
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}
      
      {action && (
        <Box sx={{ mt: 'auto' }}>
          {action}
        </Box>
      )}
    </CardContent>
  </Card>
);

/**
 * 最近活动项目组件
 */
interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  type: 'question' | 'exercise' | 'result';
  status?: 'completed' | 'pending' | 'in-progress';
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  title,
  description,
  time,
  type,
  status
}) => {
  const getTypeIcon = () => {
    switch (type) {
      case 'question': return <Quiz color="primary" />;
      case 'exercise': return <Assignment color="secondary" />;
      case 'result': return <TrendingUp color="success" />;
      default: return <Quiz />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'in-progress': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
      <Avatar sx={{ width: 32, height: 32, mr: 2 }}>
        {getTypeIcon()}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1" fontWeight="medium" noWrap>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {description}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <AccessTime sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
            {time}
          </Typography>
          {status && (
            <Chip 
              label={status} 
              size="small" 
              color={getStatusColor() as any}
              variant="outlined"
            />
          )}
        </Box>
      </Box>
      <IconButton size="small" sx={{ ml: 1 }}>
        <Visibility fontSize="small" />
      </IconButton>
    </Box>
  );
};

/**
 * 仪表板页面组件
 * 显示用户的概览信息、统计数据和最近活动
 */
export const Dashboard: React.FC<DashboardProps> = ({
  user,
  onNavigateToGenerate,
  onNavigateToExercises
}) => {
  // 模拟数据 - 在实际应用中应该从 API 获取
  const mockStats = {
    teacher: {
      questionsCreated: 156,
      exercisesAssigned: 23,
      studentsManaged: 45,
      averageScore: 85.2
    },
    student: {
      exercisesCompleted: 34,
      averageScore: 87.5,
      timeSpent: '12.5h',
      ranking: 8
    }
  };

  const mockActivities = [
    {
      title: '数学练习题集 - 三角函数',
      description: '创建了15道关于三角函数的练习题',
      time: '2小时前',
      type: 'question' as const,
      status: 'completed' as const
    },
    {
      title: '英语阅读理解练习',
      description: '学生完成了阅读理解练习，平均分78分',
      time: '4小时前',
      type: 'result' as const,
      status: 'completed' as const
    },
    {
      title: '物理力学测验',
      description: '分配给高一(3)班的力学测验',
      time: '1天前',
      type: 'exercise' as const,
      status: 'in-progress' as const
    }
  ];

  /**
   * 根据用户角色获取统计数据
   */
  const getStatsForRole = () => {
    if (user.role === UserRole.TEACHER) {
      return [
        {
          title: '创建题目',
          value: mockStats.teacher.questionsCreated,
          icon: <Quiz />,
          color: 'primary' as const,
          description: '本月新增题目',
          action: (
            <Button 
              size="small" 
              variant="outlined" 
              startIcon={<Add />}
              onClick={onNavigateToGenerate}
            >
              创建题目
            </Button>
          )
        },
        {
          title: '分配练习',
          value: mockStats.teacher.exercisesAssigned,
          icon: <Assignment />,
          color: 'secondary' as const,
          description: '本月分配的练习',
          action: (
            <Button 
              size="small" 
              variant="outlined" 
              startIcon={<Add />}
              onClick={onNavigateToExercises}
            >
              创建练习
            </Button>
          )
        },
        {
          title: '管理学生',
          value: mockStats.teacher.studentsManaged,
          icon: <School />,
          color: 'success' as const,
          description: '当前管理的学生数量'
        },
        {
          title: '平均成绩',
          value: `${mockStats.teacher.averageScore}%`,
          icon: <TrendingUp />,
          color: 'warning' as const,
          description: '学生平均完成率'
        }
      ];
    } else {
      return [
        {
          title: '完成练习',
          value: mockStats.student.exercisesCompleted,
          icon: <Assignment />,
          color: 'primary' as const,
          description: '本月完成的练习',
          action: (
            <Button 
              size="small" 
              variant="outlined"
              onClick={onNavigateToExercises}
            >
              查看练习
            </Button>
          )
        },
        {
          title: '平均成绩',
          value: `${mockStats.student.averageScore}%`,
          icon: <TrendingUp />,
          color: 'success' as const,
          description: '近期平均成绩'
        },
        {
          title: '学习时长',
          value: mockStats.student.timeSpent,
          icon: <AccessTime />,
          color: 'secondary' as const,
          description: '本月累计学习时间'
        },
        {
          title: '班级排名',
          value: `#${mockStats.student.ranking}`,
          icon: <School />,
          color: 'warning' as const,
          description: '当前班级排名'
        }
      ];
    }
  };

  const stats = getStatsForRole();

  return (
    <Box>
      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          欢迎回来，{user.displayName}！
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {user.role === UserRole.TEACHER 
            ? '管理您的题库和学生练习' 
            : '继续您的学习之旅'
          }
        </Typography>
      </Box>

      {/* 统计卡片网格 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      {/* 内容区域 */}
      <Grid container spacing={3}>
        {/* 最近活动 */}
        <Grid item xs={12} md={8}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                最近活动
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {mockActivities.map((activity, index) => (
                <ActivityItem key={index} {...activity} />
              ))}
              
              <Button 
                fullWidth 
                variant="text" 
                sx={{ mt: 2 }}
              >
                查看全部活动
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* 快速操作 */}
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                快速操作
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Add />}
                  onClick={onNavigateToGenerate}
                >
                  生成新题目
                </Button>
                
                {user.role === UserRole.TEACHER && (
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<Assignment />}
                    onClick={onNavigateToExercises}
                  >
                    创建练习
                  </Button>
                )}
                
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Visibility />}
                >
                  查看题库
                </Button>
                
                <Button
                  variant="text"
                  fullWidth
                  startIcon={<TrendingUp />}
                >
                  查看统计
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;