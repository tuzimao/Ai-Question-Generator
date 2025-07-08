// frontend/src/pages/QuestionGenerator/components/PreviewMode/hooks/usePreviewState.ts

import { useState, useCallback, useMemo } from 'react';
import { Question } from '@/types/question';
import { PreviewConfig } from '@/types/generator';

/**
 * 预览状态接口
 */
export interface PreviewState {
  // 显示配置
  showAnswers: boolean;
  showExplanations: boolean;
  showKnowledgePoints: boolean;
  compactMode: boolean;
  
  // 筛选和搜索
  searchQuery: string;
  filterByType: string[];
  filterByDifficulty: string[];
  
  // UI状态
  expandAll: boolean;
  showQuestionNumbers: boolean;
}

/**
 * 预览状态管理Hook
 * 管理预览模式的所有状态和交互逻辑
 */
export const usePreviewState = (questions: Question[], initialConfig: PreviewConfig) => {
  // ============================= 状态管理 =============================
  
  // 预览配置状态
  const [previewState, setPreviewState] = useState<PreviewState>({
    showAnswers: initialConfig.showAnswers,
    showExplanations: initialConfig.showExplanations,
    showKnowledgePoints: initialConfig.showKnowledgePoints,
    compactMode: false,
    searchQuery: '',
    filterByType: [],
    filterByDifficulty: [],
    expandAll: false,
    showQuestionNumbers: true
  });

  // 选中的题目ID集合
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());

  // ============================= 计算属性 =============================

  /**
   * 过滤后的题目列表
   */
  const filteredQuestions = useMemo(() => {
    let filtered = questions;

    // 搜索过滤
    if (previewState.searchQuery.trim()) {
      const query = previewState.searchQuery.toLowerCase();
      filtered = filtered.filter(q => 
        q.content?.title?.toLowerCase().includes(query) ||
        q.explanation?.text?.toLowerCase().includes(query) ||
        q.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // 题型过滤
    if (previewState.filterByType.length > 0) {
      filtered = filtered.filter(q => 
        previewState.filterByType.includes(q.type)
      );
    }

    // 难度过滤
    if (previewState.filterByDifficulty.length > 0) {
      filtered = filtered.filter(q => 
        previewState.filterByDifficulty.includes(q.difficulty)
      );
    }

    return filtered;
  }, [questions, previewState.searchQuery, previewState.filterByType, previewState.filterByDifficulty]);

  /**
   * 统计信息
   */
  const statistics = useMemo(() => {
    const stats = {
      total: questions.length,
      filtered: filteredQuestions.length,
      selected: selectedQuestions.size,
      byType: {} as Record<string, number>,
      byDifficulty: {} as Record<string, number>
    };

    questions.forEach(q => {
      // 按题型统计
      stats.byType[q.type] = (stats.byType[q.type] || 0) + 1;
      // 按难度统计
      stats.byDifficulty[q.difficulty] = (stats.byDifficulty[q.difficulty] || 0) + 1;
    });

    return stats;
  }, [questions, filteredQuestions.length, selectedQuestions.size]);

  // ============================= 操作方法 =============================

  /**
   * 更新预览配置
   */
  const handleConfigChange = useCallback((updates: Partial<PreviewState>) => {
    setPreviewState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * 切换题目选中状态
   */
  const handleQuestionSelect = useCallback((questionId: string, selected?: boolean) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      const shouldSelect = selected !== undefined ? selected : !newSet.has(questionId);
      
      if (shouldSelect) {
        newSet.add(questionId);
      } else {
        newSet.delete(questionId);
      }
      
      return newSet;
    });
  }, []);

  /**
   * 批量选择题目
   */
  const handleBatchSelect = useCallback((questionIds: string[], selected: boolean) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      questionIds.forEach(id => {
        if (selected) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
      });
      return newSet;
    });
  }, []);

  /**
   * 全选/取消全选
   */
  const handleSelectAll = useCallback(() => {
    setSelectedQuestions(prev => {
      // 如果当前已经全选，则取消全选；否则全选
      if (prev.size === filteredQuestions.length) {
        return new Set();
      } else {
        return new Set(filteredQuestions.map(q => q.id));
      }
    });
  }, [filteredQuestions]);

  /**
   * 重置选择
   */
  const resetSelection = useCallback(() => {
    setSelectedQuestions(new Set());
  }, []);

  /**
   * 切换显示配置
   */
  const toggleShowAnswers = useCallback(() => {
    setPreviewState(prev => ({ ...prev, showAnswers: !prev.showAnswers }));
  }, []);

  const toggleShowExplanations = useCallback(() => {
    setPreviewState(prev => ({ ...prev, showExplanations: !prev.showExplanations }));
  }, []);

  const toggleShowKnowledgePoints = useCallback(() => {
    setPreviewState(prev => ({ ...prev, showKnowledgePoints: !prev.showKnowledgePoints }));
  }, []);

  const toggleCompactMode = useCallback(() => {
    setPreviewState(prev => ({ ...prev, compactMode: !prev.compactMode }));
  }, []);

  const toggleExpandAll = useCallback(() => {
    setPreviewState(prev => ({ ...prev, expandAll: !prev.expandAll }));
  }, []);

  /**
   * 搜索和过滤
   */
  const handleSearchChange = useCallback((query: string) => {
    setPreviewState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const handleTypeFilterChange = useCallback((types: string[]) => {
    setPreviewState(prev => ({ ...prev, filterByType: types }));
  }, []);

  const handleDifficultyFilterChange = useCallback((difficulties: string[]) => {
    setPreviewState(prev => ({ ...prev, filterByDifficulty: difficulties }));
  }, []);

  /**
   * 导出相关方法
   */
  const getSelectedQuestions = useCallback(() => {
    return questions.filter(q => selectedQuestions.has(q.id));
  }, [questions, selectedQuestions]);

  const getAllQuestions = useCallback(() => {
    return questions;
  }, [questions]);

  const getFilteredQuestions = useCallback(() => {
    return filteredQuestions;
  }, [filteredQuestions]);

  // ============================= 便捷方法 =============================

  /**
   * 判断是否全选
   */
  const isAllSelected = selectedQuestions.size === filteredQuestions.length && filteredQuestions.length > 0;

  /**
   * 判断是否部分选中
   */
  const isIndeterminate = selectedQuestions.size > 0 && selectedQuestions.size < filteredQuestions.length;

  /**
   * 获取选中题目的统计信息
   */
  const selectedStatistics = useMemo(() => {
    const selectedQs = questions.filter(q => selectedQuestions.has(q.id));
    return {
      total: selectedQs.length,
      byType: selectedQs.reduce((acc, q) => {
        acc[q.type] = (acc[q.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byDifficulty: selectedQs.reduce((acc, q) => {
        acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }, [questions, selectedQuestions]);

  // ============================= 返回值 =============================

  return {
    // 状态
    previewState,
    selectedQuestions,
    filteredQuestions,
    statistics,
    selectedStatistics,
    
    // 选择状态
    isAllSelected,
    isIndeterminate,
    
    // 配置方法
    handleConfigChange,
    toggleShowAnswers,
    toggleShowExplanations,
    toggleShowKnowledgePoints,
    toggleCompactMode,
    toggleExpandAll,
    
    // 选择方法
    handleQuestionSelect,
    handleBatchSelect,
    handleSelectAll,
    resetSelection,
    
    // 筛选方法
    handleSearchChange,
    handleTypeFilterChange,
    handleDifficultyFilterChange,
    
    // 导出方法
    getSelectedQuestions,
    getAllQuestions,
    getFilteredQuestions
  };
};