// frontend/src/pages/QuestionGenerator/components/QuestionEditor/hooks/useQuestionEditorState.ts

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Question, QuestionType, Difficulty } from '@/types/question';

/**
 * 编辑器状态接口
 */
interface EditorState {
  questions: Question[];                    // 当前题目列表
  hasUnsavedChanges: boolean;              // 是否有未保存的更改
  lastSavedAt: Date | null;                // 最后保存时间
  isLoading: boolean;                      // 是否加载中
}

/**
 * 过滤选项接口
 */
interface FilterOptions {
  types: QuestionType[];                   // 题目类型过滤
  difficulties: Difficulty[];              // 难度过滤
  modifiedOnly: boolean;                   // 仅显示已修改
  invalidOnly: boolean;                    // 仅显示有错误的
  tags: string[];                          // 标签过滤
}

/**
 * 统计信息接口
 */
interface Statistics {
  total: number;                           // 总题目数
  valid: number;                           // 有效题目数
  invalid: number;                         // 无效题目数
  modified: number;                        // 已修改题目数
  byType: Record<QuestionType, number>;    // 按类型统计
  byDifficulty: Record<Difficulty, number>; // 按难度统计
}

/**
 * Hook配置选项
 */
interface UseQuestionEditorStateOptions {
  autoSave?: boolean;                      // 自动保存
  autoSaveInterval?: number;               // 自动保存间隔(ms)
  onQuestionEdit?: (questionId: string, updatedQuestion: Question) => void;
}

/**
 * 题目编辑器状态管理Hook
 */
export const useQuestionEditorState = (
  initialQuestions: Question[],
  options: UseQuestionEditorStateOptions = {}
) => {
  const {
    autoSave = false,
    autoSaveInterval = 30000, // 30秒
    onQuestionEdit
  } = options;

  // ============================= 状态管理 =============================
  
  const [editorState, setEditorState] = useState<EditorState>({
    questions: initialQuestions,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    isLoading: false
  });

  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    types: [],
    difficulties: [],
    modifiedOnly: false,
    invalidOnly: false,
    tags: []
  });

  // ============================= 计算属性 =============================

  /**
   * 题目验证
   */
  const validateQuestion = useCallback((question: Question): string[] => {
    const errors: string[] = [];
    
    // 检查基本字段
    if (!question.content?.title?.trim()) {
      errors.push('题目内容不能为空');
    }
    
    // 检查选择题选项
    if ([QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE].includes(question.type)) {
      if (!question.options || question.options.length < 2) {
        errors.push('选择题至少需要2个选项');
      }
      
      if (!question.correctAnswer || 
          (Array.isArray(question.correctAnswer) && question.correctAnswer.length === 0)) {
        errors.push('请设置正确答案');
      }
    }
    
    // 检查判断题
    if (question.type === QuestionType.TRUE_FALSE) {
      if (!question.correctAnswer || 
          !['true', 'false'].includes(question.correctAnswer as string)) {
        errors.push('判断题必须设置正确或错误');
      }
    }
    
    // 检查简答题
    if (question.type === QuestionType.SHORT_ANSWER) {
      if (!question.correctAnswer || 
          (typeof question.correctAnswer === 'string' && !question.correctAnswer.trim())) {
        errors.push('简答题需要参考答案');
      }
    }
    
    return errors;
  }, []);

  /**
   * 过滤题目
   */
  const filteredQuestions = useMemo(() => {
    let filtered = editorState.questions;
    
    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(question => 
        question.content?.title?.toLowerCase().includes(query) ||
        question.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        question.knowledgePoints?.some(kp => kp.toLowerCase().includes(query))
      );
    }
    
    // 类型过滤
    if (filterOptions.types.length > 0) {
      filtered = filtered.filter(question => 
        filterOptions.types.includes(question.type)
      );
    }
    
    // 难度过滤
    if (filterOptions.difficulties.length > 0) {
      filtered = filtered.filter(question => 
        filterOptions.difficulties.includes(question.difficulty)
      );
    }
    
    // 标签过滤
    if (filterOptions.tags.length > 0) {
      filtered = filtered.filter(question => 
        question.tags?.some(tag => filterOptions.tags.includes(tag))
      );
    }
    
    // 修改状态过滤
    if (filterOptions.modifiedOnly) {
      filtered = filtered.filter(question => 
        question.updatedAt && question.updatedAt > question.createdAt
      );
    }
    
    // 错误状态过滤
    if (filterOptions.invalidOnly) {
      filtered = filtered.filter(question => 
        validateQuestion(question).length > 0
      );
    }
    
    return filtered;
  }, [editorState.questions, searchQuery, filterOptions, validateQuestion]);

  /**
   * 统计信息
   */
  const statistics = useMemo((): Statistics => {
    const validQuestions = editorState.questions.filter(q => validateQuestion(q).length === 0);
    const modifiedQuestions = editorState.questions.filter(q => 
      q.updatedAt && q.updatedAt > q.createdAt
    );
    
    const byType = editorState.questions.reduce((acc, question) => {
      acc[question.type] = (acc[question.type] || 0) + 1;
      return acc;
    }, {} as Record<QuestionType, number>);
    
    const byDifficulty = editorState.questions.reduce((acc, question) => {
      acc[question.difficulty] = (acc[question.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<Difficulty, number>);
    
    return {
      total: editorState.questions.length,
      valid: validQuestions.length,
      invalid: editorState.questions.length - validQuestions.length,
      modified: modifiedQuestions.length,
      byType,
      byDifficulty
    };
  }, [editorState.questions, validateQuestion]);

  /**
   * 验证错误列表
   */
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    editorState.questions.forEach((question, index) => {
      const questionErrors = validateQuestion(question);
      questionErrors.forEach(error => {
        errors.push(`题目 ${index + 1}: ${error}`);
      });
    });
    return errors;
  }, [editorState.questions, validateQuestion]);

  // ============================= 操作方法 =============================

  /**
   * 更新题目
   */
  const updateQuestion = useCallback((questionId: string, updates: Partial<Question>) => {
    setEditorState(prev => {
      const newQuestions = prev.questions.map(q => 
        q.id === questionId 
          ? { ...q, ...updates, updatedAt: new Date() }
          : q
      );
      
      return {
        ...prev,
        questions: newQuestions,
        hasUnsavedChanges: true
      };
    });
    
    // 触发外部回调
    if (onQuestionEdit) {
      const updatedQuestion = editorState.questions.find(q => q.id === questionId);
      if (updatedQuestion) {
        onQuestionEdit(questionId, { ...updatedQuestion, ...updates });
      }
    }
  }, [editorState.questions, onQuestionEdit]);

  /**
   * 选择题目
   */
  const selectQuestion = useCallback((questionId: string | null) => {
    setSelectedQuestionId(questionId);
  }, []);

  /**
   * 批量选择题目
   */
  const selectMultipleQuestions = useCallback((questionIds: string[], selected: boolean) => {
    setSelectedQuestions(prev => {
      if (selected) {
        return [...new Set([...prev, ...questionIds])];
      } else {
        return prev.filter(id => !questionIds.includes(id));
      }
    });
  }, []);

  /**
   * 全选题目
   */
  const selectAllQuestions = useCallback(() => {
    setSelectedQuestions(filteredQuestions.map(q => q.id));
  }, [filteredQuestions]);

  /**
   * 清除选择
   */
  const clearSelection = useCallback(() => {
    setSelectedQuestions([]);
  }, []);

  /**
   * 删除题目
   */
  const deleteQuestions = useCallback((questionIds: string[]) => {
    setEditorState(prev => ({
      ...prev,
      questions: prev.questions.filter(q => !questionIds.includes(q.id)),
      hasUnsavedChanges: true
    }));
    
    // 清除相关选择
    setSelectedQuestions(prev => prev.filter(id => !questionIds.includes(id)));
    if (selectedQuestionId && questionIds.includes(selectedQuestionId)) {
      setSelectedQuestionId(null);
    }
  }, [selectedQuestionId]);

  /**
   * 复制题目
   */
  const duplicateQuestion = useCallback((questionId: string) => {
    const originalQuestion = editorState.questions.find(q => q.id === questionId);
    if (!originalQuestion) return;
    
    const duplicatedQuestion: Question = {
      ...originalQuestion,
      id: `${questionId}_copy_${Date.now()}`,
      content: {
        ...originalQuestion.content,
        title: `${originalQuestion.content?.title} (副本)`
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setEditorState(prev => ({
      ...prev,
      questions: [...prev.questions, duplicatedQuestion],
      hasUnsavedChanges: true
    }));
  }, [editorState.questions]);

  /**
   * 添加标签
   */
  const addTag = useCallback((questionId: string, tag: string) => {
    updateQuestion(questionId, {
      tags: [
        ...(editorState.questions.find(q => q.id === questionId)?.tags || []),
        tag
      ]
    });
  }, [updateQuestion, editorState.questions]);

  /**
   * 删除标签
   */
  const removeTag = useCallback((questionId: string, tag: string) => {
    const question = editorState.questions.find(q => q.id === questionId);
    if (!question) return;
    
    updateQuestion(questionId, {
      tags: question.tags?.filter(t => t !== tag) || []
    });
  }, [updateQuestion, editorState.questions]);

  /**
   * 保存更改
   */
  const saveChanges = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      hasUnsavedChanges: false,
      lastSavedAt: new Date()
    }));
    
    // 这里可以添加实际的保存逻辑，比如调用API
    console.log('保存题目更改:', editorState.questions);
  }, [editorState.questions]);

  /**
   * 导出题目
   */
  const exportQuestions = useCallback((questions: Question[]) => {
    const dataStr = JSON.stringify(questions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `questions_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * 重置编辑器
   */
  const resetEditor = useCallback(() => {
    setEditorState({
      questions: initialQuestions,
      hasUnsavedChanges: false,
      lastSavedAt: null,
      isLoading: false
    });
    setSelectedQuestions([]);
    setSelectedQuestionId(null);
    setSearchQuery('');
    setFilterOptions({
      types: [],
      difficulties: [],
      modifiedOnly: false,
      invalidOnly: false,
      tags: []
    });
  }, [initialQuestions]);

  // ============================= 副作用 =============================

  /**
   * 监听题目变化，自动保存
   */
  useEffect(() => {
    if (!autoSave || !editorState.hasUnsavedChanges) return;
    
    const timer = setTimeout(saveChanges, autoSaveInterval);
    return () => clearTimeout(timer);
  }, [autoSave, autoSaveInterval, editorState.hasUnsavedChanges, saveChanges]);

  /**
   * 初始化时选择第一个题目
   */
  useEffect(() => {
    if (editorState.questions.length > 0 && !selectedQuestionId) {
      setSelectedQuestionId(editorState.questions[0].id);
    }
  }, [editorState.questions, selectedQuestionId]);

  // ============================= 返回值 =============================

  return {
    // 状态
    editorState,
    selectedQuestions,
    filteredQuestions,
    selectedQuestionId,
    searchQuery,
    filterOptions,
    statistics,
    validationErrors,
    
    // 操作方法
    updateQuestion,
    selectQuestion,
    selectMultipleQuestions,
    selectAllQuestions,
    clearSelection,
    deleteQuestions,
    duplicateQuestion,
    addTag,
    removeTag,
    setSearchQuery,
    setFilterOptions,
    saveChanges,
    exportQuestions,
    resetEditor
  };
};