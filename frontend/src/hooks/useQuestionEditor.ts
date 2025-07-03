// frontend/src/hooks/useQuestionEditor.ts

import { useState, useCallback, useEffect, useRef } from 'react';
import { Question, QuestionType, Difficulty } from '@/types/question';
import { 
  EditableQuestion, 
  QuestionEditorState, 
  ValidationResult,
  ValidationError,
  EditorAction,
  DEFAULT_EDITOR_CONFIG,
  QuestionEditorConfig
} from '@/types/editor';

/**
 * 题目编辑器主Hook
 * 管理编辑器的所有状态和操作
 */
export const useQuestionEditor = (
  initialQuestions: Question[] = [],
  config: QuestionEditorConfig = DEFAULT_EDITOR_CONFIG
) => {
  // 编辑器状态
  const [editorState, setEditorState] = useState<QuestionEditorState>({
    questions: [],
    selectedQuestionId: null,
    searchQuery: '',
    filterOptions: {
      types: [],
      difficulties: [],
      tags: [],
      modifiedOnly: false
    },
    bulkSelectedIds: [],
    autoSaveEnabled: config.autoSave.enabled,
    hasUnsavedChanges: false,
    lastSavedAt: null
  });

  // 自动保存定时器
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * 初始化题目数据
   * 将普通Question转换为EditableQuestion
   */
  const initializeQuestions = useCallback((questions: Question[]) => {
    const editableQuestions: EditableQuestion[] = questions.map(question => ({
      ...question,
      editState: {
        isModified: false,
        isValid: true,
        lastModified: new Date(),
        validationErrors: [],
        hasUnsavedChanges: false
      }
    }));

    setEditorState(prev => ({
      ...prev,
      questions: editableQuestions,
      selectedQuestionId: editableQuestions.length > 0 ? editableQuestions[0].id : null
    }));

    // 保存到localStorage
    saveToLocalStorage(editableQuestions);
  }, []);

  /**
   * 从localStorage恢复数据
   */
  const loadFromLocalStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem('question_editor_data');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.questions && Array.isArray(data.questions)) {
          setEditorState(prev => ({
            ...prev,
            questions: data.questions,
            selectedQuestionId: data.selectedQuestionId || 
              (data.questions.length > 0 ? data.questions[0].id : null),
            lastSavedAt: data.lastSavedAt ? new Date(data.lastSavedAt) : null
          }));
          return true;
        }
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
    return false;
  }, []);

  /**
   * 保存到localStorage
   */
  const saveToLocalStorage = useCallback((questions: EditableQuestion[]) => {
    try {
      const dataToSave = {
        questions,
        selectedQuestionId: editorState.selectedQuestionId,
        lastSavedAt: new Date().toISOString()
      };
      localStorage.setItem('question_editor_data', JSON.stringify(dataToSave));
      
      setEditorState(prev => ({
        ...prev,
        hasUnsavedChanges: false,
        lastSavedAt: new Date()
      }));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [editorState.selectedQuestionId]);

  /**
   * 验证单个题目
   */
  const validateQuestion = useCallback((question: EditableQuestion): ValidationResult => {
    const errors: ValidationError[] = [];

    // 验证题目内容
    if (!question.content?.title?.trim()) {
      errors.push({
        field: 'content',
        message: '题目内容不能为空',
        severity: 'error'
      });
    }

    // 验证选择题选项
    if (question.type === QuestionType.SINGLE_CHOICE || question.type === QuestionType.MULTIPLE_CHOICE) {
      if (!question.options || question.options.length < 2) {
        errors.push({
          field: 'options',
          message: '选择题至少需要2个选项',
          severity: 'error'
        });
      }

      // 验证是否有正确答案
      if (!question.correctAnswer || 
          (Array.isArray(question.correctAnswer) ? question.correctAnswer.length === 0 : !question.correctAnswer)) {
        errors.push({
          field: 'correctAnswer',
          message: '必须设置正确答案',
          severity: 'error'
        });
      }
    }

    // 验证解析
    if (!question.explanation?.text?.trim()) {
      errors.push({
        field: 'explanation',
        message: '建议添加答案解析',
        severity: 'warning'
      });
    }

    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors
    };
  }, []);

  /**
   * 更新题目
   */
  const updateQuestion = useCallback((questionId: string, updates: Partial<Question>) => {
    setEditorState(prev => {
      const newQuestions = prev.questions.map(q => {
        if (q.id === questionId) {
          const updatedQuestion = { ...q, ...updates };
          const validation = validateQuestion(updatedQuestion);
          
          return {
            ...updatedQuestion,
            editState: {
              ...q.editState,
              isModified: true,
              isValid: validation.isValid,
              validationErrors: validation.errors.map(e => e.message),
              lastModified: new Date(),
              hasUnsavedChanges: true
            }
          };
        }
        return q;
      });

      return {
        ...prev,
        questions: newQuestions,
        hasUnsavedChanges: true
      };
    });

    // 触发自动保存
    if (config.autoSave.enabled) {
      scheduleAutoSave();
    }
  }, [validateQuestion, config.autoSave.enabled]);

  /**
   * 选择题目
   */
  const selectQuestion = useCallback((questionId: string | null) => {
    setEditorState(prev => ({
      ...prev,
      selectedQuestionId: questionId
    }));
  }, []);

  /**
   * 删除题目
   */
  const deleteQuestion = useCallback((questionId: string) => {
    setEditorState(prev => {
      const newQuestions = prev.questions.filter(q => q.id !== questionId);
      const newSelectedId = prev.selectedQuestionId === questionId 
        ? (newQuestions.length > 0 ? newQuestions[0].id : null)
        : prev.selectedQuestionId;

      return {
        ...prev,
        questions: newQuestions,
        selectedQuestionId: newSelectedId,
        hasUnsavedChanges: true
      };
    });
  }, []);

  /**
   * 复制题目
   */
  const duplicateQuestion = useCallback((questionId: string) => {
    setEditorState(prev => {
      const original = prev.questions.find(q => q.id === questionId);
      if (!original) return prev;

      const duplicated: EditableQuestion = {
        ...original,
        id: `${original.id}_copy_${Date.now()}`,
        content: {
          ...original.content,
          title: `${original.content.title} (副本)`
        },
        editState: {
          isModified: true,
          isValid: true,
          lastModified: new Date(),
          validationErrors: [],
          hasUnsavedChanges: true
        }
      };

      const newQuestions = [...prev.questions, duplicated];
      
      return {
        ...prev,
        questions: newQuestions,
        selectedQuestionId: duplicated.id,
        hasUnsavedChanges: true
      };
    });
  }, []);

  /**
   * 添加标签
   */
  const addTag = useCallback((questionId: string, tag: string) => {
    updateQuestion(questionId, {
      tags: [...(editorState.questions.find(q => q.id === questionId)?.tags || []), tag]
    });
  }, [updateQuestion, editorState.questions]);

  /**
   * 删除标签
   */
  const removeTag = useCallback((questionId: string, tagToRemove: string) => {
    const question = editorState.questions.find(q => q.id === questionId);
    if (question) {
      updateQuestion(questionId, {
        tags: question.tags?.filter(tag => tag !== tagToRemove) || []
      });
    }
  }, [updateQuestion, editorState.questions]);

  /**
   * 批量操作
   */
  const bulkUpdate = useCallback((questionIds: string[], updates: Partial<Question>) => {
    questionIds.forEach(id => updateQuestion(id, updates));
  }, [updateQuestion]);

  /**
   * 搜索和过滤
   */
  const setSearchQuery = useCallback((query: string) => {
    setEditorState(prev => ({
      ...prev,
      searchQuery: query
    }));
  }, []);

  const setFilterOptions = useCallback((filters: Partial<QuestionEditorState['filterOptions']>) => {
    setEditorState(prev => ({
      ...prev,
      filterOptions: { ...prev.filterOptions, ...filters }
    }));
  }, []);

  /**
   * 计算过滤后的题目列表
   */
  const filteredQuestions = useCallback(() => {
    let filtered = editorState.questions;

    // 搜索过滤
    if (editorState.searchQuery) {
      const query = editorState.searchQuery.toLowerCase();
      filtered = filtered.filter(q => 
        q.content.title.toLowerCase().includes(query) ||
        q.explanation?.text?.toLowerCase().includes(query) ||
        q.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // 类型过滤
    if (editorState.filterOptions.types.length > 0) {
      filtered = filtered.filter(q => 
        editorState.filterOptions.types.includes(q.type)
      );
    }

    // 难度过滤
    if (editorState.filterOptions.difficulties.length > 0) {
      filtered = filtered.filter(q => 
        editorState.filterOptions.difficulties.includes(q.difficulty)
      );
    }

    // 标签过滤
    if (editorState.filterOptions.tags.length > 0) {
      filtered = filtered.filter(q => 
        q.tags?.some(tag => editorState.filterOptions.tags.includes(tag))
      );
    }

    // 只显示已修改的
    if (editorState.filterOptions.modifiedOnly) {
      filtered = filtered.filter(q => q.editState.isModified);
    }

    return filtered;
  }, [editorState]);

  /**
   * 安排自动保存
   */
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      if (editorState.hasUnsavedChanges) {
        saveToLocalStorage(editorState.questions);
      }
    }, config.autoSave.interval);
  }, [editorState.hasUnsavedChanges, editorState.questions, config.autoSave.interval, saveToLocalStorage]);

  /**
   * 手动保存
   */
  const saveChanges = useCallback(() => {
    saveToLocalStorage(editorState.questions);
  }, [editorState.questions, saveToLocalStorage]);

  /**
   * 获取当前选中的题目
   */
  const selectedQuestion = editorState.selectedQuestionId 
    ? editorState.questions.find(q => q.id === editorState.selectedQuestionId)
    : null;

  /**
   * 获取统计信息
   */
  const statistics = {
    total: editorState.questions.length,
    modified: editorState.questions.filter(q => q.editState.isModified).length,
    invalid: editorState.questions.filter(q => !q.editState.isValid).length,
    byType: editorState.questions.reduce((acc, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byDifficulty: editorState.questions.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  // 组件挂载时初始化
  useEffect(() => {
    if (initialQuestions.length > 0) {
      // 尝试从localStorage恢复，如果失败则使用初始数据
      if (!loadFromLocalStorage()) {
        initializeQuestions(initialQuestions);
      }
    }
  }, [initialQuestions, loadFromLocalStorage, initializeQuestions]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);

  return {
    // 状态
    editorState,
    selectedQuestion,
    filteredQuestions: filteredQuestions(),
    statistics,
    
    // 操作
    updateQuestion,
    selectQuestion,
    deleteQuestion,
    duplicateQuestion,
    addTag,
    removeTag,
    bulkUpdate,
    
    // 搜索和过滤
    setSearchQuery,
    setFilterOptions,
    
    // 保存
    saveChanges,
    loadFromLocalStorage,
    
    // 工具方法
    validateQuestion
  };
};