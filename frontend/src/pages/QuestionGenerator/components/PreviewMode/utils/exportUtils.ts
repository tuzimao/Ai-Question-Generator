// frontend/src/pages/QuestionGenerator/components/PreviewMode/utils/exportUtils.ts

import { Question, QuestionType } from '@/types/question';
import { ExportOptions, ExportFormat } from '../components/ExportDialog';

/**
 * 导出工具类
 * 提供各种格式的题目导出功能
 */
export class ExportUtils {
  /**
   * 主导出方法
   */
  static async exportQuestions(
    questions: Question[], 
    format: ExportFormat, 
    options: ExportOptions
  ): Promise<void> {
    switch (format) {
      case 'pdf-complete':
        return this.exportToPDF(questions, options, true);
      case 'pdf-questions-only':
        return this.exportToPDF(questions, options, false);
      case 'json':
        return this.exportToJSON(questions, options);
      case 'print':
        return this.exportToPrint(questions, options);
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 导出为PDF
   */
  private static async exportToPDF(
    questions: Question[], 
    options: ExportOptions, 
    includeAnswers: boolean
  ): Promise<void> {
    // 生成HTML内容
    const htmlContent = this.generateHTMLContent(questions, {
      ...options,
      includeAnswers: includeAnswers && options.includeAnswers,
      includeExplanations: includeAnswers && options.includeExplanations
    });

    // 创建临时窗口进行打印
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('无法打开打印窗口，请检查浏览器设置');
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // 等待内容加载完成后触发打印
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  }

  /**
   * 导出为JSON
   */
  private static async exportToJSON(questions: Question[], options: ExportOptions): Promise<void> {
    const exportData = {
      metadata: {
        title: options.title,
        subtitle: options.subtitle,
        exportTime: new Date().toISOString(),
        questionCount: questions.length,
        options: {
          includeAnswers: options.includeAnswers,
          includeExplanations: options.includeExplanations,
          includeKnowledgePoints: options.includeKnowledgePoints
        }
      },
      questions: questions.map(q => this.formatQuestionForExport(q, options))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 创建下载链接
    const link = document.createElement('a');
    link.href = url;
    link.download = `${options.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 浏览器打印
   */
  private static async exportToPrint(questions: Question[], options: ExportOptions): Promise<void> {
    const htmlContent = this.generateHTMLContent(questions, options);
    
    // 创建临时容器
    const printContainer = document.createElement('div');
    printContainer.innerHTML = htmlContent;
    printContainer.style.display = 'none';
    document.body.appendChild(printContainer);

    // 应用打印样式
    const printStyles = this.generatePrintStyles();
    const styleElement = document.createElement('style');
    styleElement.textContent = printStyles;
    document.head.appendChild(styleElement);

    // 触发打印
    window.print();

    // 清理
    document.body.removeChild(printContainer);
    document.head.removeChild(styleElement);
  }

  /**
   * 生成HTML内容
   */
  private static generateHTMLContent(questions: Question[], options: ExportOptions): string {
    const header = this.generateHTMLHeader(options, questions.length);
    const questionHTML = questions.map((q, index) => 
      this.generateQuestionHTML(q, index, options)
    ).join(options.pageBreaks ? '<div class="page-break"></div>' : '');

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${options.title}</title>
          ${this.generateHTMLStyles(options)}
        </head>
        <body>
          <div class="document">
            ${header}
            <div class="questions">
              ${questionHTML}
            </div>
            <div class="footer">
              <p>导出时间: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * 生成HTML样式
   */
  private static generateHTMLStyles(options: ExportOptions): string {
    return `
      <style>
        * { box-sizing: border-box; }
        body { 
          font-family: 'Microsoft YaHei', 'SimSun', sans-serif; 
          line-height: 1.6; 
          margin: 0; 
          padding: 20px;
          font-size: ${options.compactMode ? '12px' : '14px'};
        }
        .document { 
          max-width: 800px; 
          margin: 0 auto; 
          background: white;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .title { 
          font-size: 24px; 
          font-weight: bold; 
          margin-bottom: 10px; 
        }
        .subtitle { 
          font-size: 16px; 
          color: #666; 
          margin-bottom: 5px;
        }
        .question { 
          margin-bottom: ${options.compactMode ? '20px' : '30px'}; 
          padding: ${options.compactMode ? '15px' : '20px'}; 
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fafafa;
        }
        .question-header { 
          display: flex; 
          align-items: center; 
          margin-bottom: 15px;
          gap: 10px;
        }
        .question-number { 
          font-weight: bold; 
          font-size: 18px; 
          color: #1976d2;
        }
        .question-type { 
          background: #1976d2; 
          color: white; 
          padding: 2px 8px; 
          border-radius: 4px; 
          font-size: 12px;
        }
        .question-difficulty { 
          background: #ff9800; 
          color: white; 
          padding: 2px 8px; 
          border-radius: 4px; 
          font-size: 12px;
        }
        .question-content { 
          font-size: 16px; 
          font-weight: 500; 
          margin-bottom: 15px; 
          line-height: 1.8;
        }
        .options { 
          margin-left: 20px; 
          margin-bottom: 15px;
        }
        .option { 
          margin-bottom: 8px; 
          display: flex; 
          align-items: flex-start;
          gap: 8px;
        }
        .option-id { 
          font-weight: bold; 
          min-width: 20px;
        }
        .option-text { 
          flex: 1;
        }
        .correct-answer { 
          background: #4caf50; 
          color: white; 
          font-weight: bold;
        }
        .answer-section { 
          background: #e8f5e8; 
          border: 1px solid #4caf50; 
          border-radius: 4px; 
          padding: 10px; 
          margin-top: 10px;
        }
        .answer-label { 
          font-weight: bold; 
          color: #2e7d32; 
          margin-bottom: 5px;
        }
        .explanation-section { 
          background: #e3f2fd; 
          border: 1px solid #2196f3; 
          border-radius: 4px; 
          padding: 10px; 
          margin-top: 10px;
        }
        .explanation-label { 
          font-weight: bold; 
          color: #1565c0; 
          margin-bottom: 5px;
        }
        .knowledge-points { 
          margin-top: 10px; 
          padding: 8px; 
          background: #fff3e0; 
          border-radius: 4px;
        }
        .knowledge-label { 
          font-weight: bold; 
          color: #ef6c00; 
          font-size: 12px;
        }
        .tags { 
          display: flex; 
          gap: 5px; 
          flex-wrap: wrap; 
          margin-top: 5px;
        }
        .tag { 
          background: #f5f5f5; 
          padding: 2px 6px; 
          border-radius: 3px; 
          font-size: 11px; 
          color: #666;
        }
        .footer { 
          text-align: center; 
          margin-top: 40px; 
          padding-top: 20px; 
          border-top: 1px solid #ddd; 
          color: #666; 
          font-size: 12px;
        }
        .page-break { 
          page-break-before: always; 
        }
        @media print {
          body { padding: 0; }
          .page-break { page-break-before: always; }
          .question { 
            border: 1px solid #000; 
            break-inside: avoid;
          }
        }
      </style>
    `;
  }

  /**
   * 生成HTML头部
   */
  private static generateHTMLHeader(options: ExportOptions, questionCount: number): string {
    return `
      <div class="header">
        <div class="title">${options.title}</div>
        ${options.subtitle ? `<div class="subtitle">${options.subtitle}</div>` : ''}
        <div class="subtitle">共${questionCount}道题目</div>
      </div>
    `;
  }

  /**
   * 生成单个题目的HTML
   */
  private static generateQuestionHTML(question: Question, index: number, options: ExportOptions): string {
    const typeLabels = {
      'single_choice': '单选题',
      'multiple_choice': '多选题',
      'true_false': '判断题',
      'short_answer': '简答题'
    };

    const difficultyLabels = {
      'easy': '简单',
      'medium': '中等',  
      'hard': '困难'
    };

    let html = `
      <div class="question">
        <div class="question-header">
          ${options.includeQuestionNumbers ? `<span class="question-number">${index + 1}.</span>` : ''}
          <span class="question-type">${typeLabels[question.type] || question.type}</span>
          <span class="question-difficulty">${difficultyLabels[question.difficulty] || question.difficulty}</span>
          <span class="question-type">${question.score || 5}分</span>
        </div>
        
        <div class="question-content">${question.content?.title || ''}</div>
    `;

    // 添加选项
    if (question.options && question.options.length > 0) {
      html += '<div class="options">';
      question.options.forEach(option => {
        const isCorrect = options.includeAnswers && option.isCorrect;
        html += `
          <div class="option ${isCorrect ? 'correct-answer' : ''}">
            <span class="option-id">${option.id}.</span>
            <span class="option-text">${option.text}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    // 添加正确答案（简答题）
    if (options.includeAnswers && question.type === QuestionType.SHORT_ANSWER && question.correctAnswer) {
      html += `
        <div class="answer-section">
          <div class="answer-label">参考答案：</div>
          <div>${question.correctAnswer}</div>
        </div>
      `;
    }

    // 添加解析
    if (options.includeExplanations && question.explanation?.text) {
      html += `
        <div class="explanation-section">
          <div class="explanation-label">答案解析：</div>
          <div>${question.explanation.text}</div>
        </div>
      `;
    }

    // 添加知识点和标签
    if (options.includeKnowledgePoints) {
      const hasKnowledgePoints = question.knowledgePoints && question.knowledgePoints.length > 0;
      const hasTags = question.tags && question.tags.length > 0;
      
      if (hasKnowledgePoints || hasTags) {
        html += '<div class="knowledge-points">';
        
        if (hasKnowledgePoints) {
          html += `
            <div class="knowledge-label">知识点：</div>
            <div class="tags">
              ${question.knowledgePoints!.map(point => `<span class="tag">${point}</span>`).join('')}
            </div>
          `;
        }
        
        if (hasTags) {
          html += `
            <div class="knowledge-label" style="margin-top: 5px;">标签：</div>
            <div class="tags">
              ${question.tags!.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
          `;
        }
        
        html += '</div>';
      }
    }

    html += '</div>';
    return html;
  }

  /**
   * 格式化题目用于导出
   */
  private static formatQuestionForExport(question: Question, options: ExportOptions): any {
    const exported: any = {
      id: question.id,
      type: question.type,
      difficulty: question.difficulty,
      content: question.content,
      score: question.score || 5,
      estimatedTime: question.estimatedTime
    };

    // 选择性包含选项
    if (question.options) {
      exported.options = question.options;
    }

    // 选择性包含答案
    if (options.includeAnswers) {
      exported.correctAnswer = question.correctAnswer;
    }

    // 选择性包含解析
    if (options.includeExplanations && question.explanation) {
      exported.explanation = question.explanation;
    }

    // 选择性包含知识点
    if (options.includeKnowledgePoints) {
      if (question.knowledgePoints) {
        exported.knowledgePoints = question.knowledgePoints;
      }
      if (question.tags) {
        exported.tags = question.tags;
      }
    }

    // 包含元数据
    exported.metadata = {
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      creatorId: question.creatorId
    };

    return exported;
  }

  /**
   * 生成打印样式
   */
  private static generatePrintStyles(): string {
    return `
      @media print {
        * { 
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body { 
          font-size: 12pt !important;
          line-height: 1.4 !important;
        }
        .question { 
          page-break-inside: avoid !important;
          margin-bottom: 20pt !important;
        }
        .page-break { 
          page-break-before: always !important;
        }
      }
    `;
  }
}

/**
 * 保存到题库的Mock实现
 * 为未来的数据库集成做准备
 */
export class LibraryUtils {
  /**
   * 保存题目到本地存储（Mock实现）
   */
  static async saveToLibrary(questions: Question[], metadata: any): Promise<string> {
    try {
      // 生成唯一ID
      const libraryId = `lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 准备保存数据
      const saveData = {
        id: libraryId,
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          questionCount: questions.length
        },
        questions: questions.map(q => ({
          ...q,
          libraryId, // 关联到题库
          savedAt: new Date().toISOString()
        }))
      };

      // 保存到localStorage（Mock数据库）
      const existingLibrary = JSON.parse(localStorage.getItem('questionLibrary') || '[]');
      existingLibrary.push(saveData);
      localStorage.setItem('questionLibrary', JSON.stringify(existingLibrary));

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('题目已保存到本地题库:', saveData);
      
      return libraryId;
    } catch (error) {
      console.error('保存到题库失败:', error);
      throw new Error('保存失败，请重试');
    }
  }

  /**
   * 从题库获取题目列表（Mock实现）
   */
  static async getLibraryList(): Promise<any[]> {
    try {
      const library = JSON.parse(localStorage.getItem('questionLibrary') || '[]');
      return library.map((item: any) => ({
        id: item.id,
        title: item.metadata.title,
        description: item.metadata.description,
        questionCount: item.metadata.questionCount,
        subject: item.metadata.subject,
        grade: item.metadata.grade,
        category: item.metadata.category,
        tags: item.metadata.tags,
        createdAt: item.metadata.createdAt
      }));
    } catch (error) {
      console.error('获取题库列表失败:', error);
      return [];
    }
  }

  /**
   * 从题库删除题目集（Mock实现）
   */
  static async deleteFromLibrary(libraryId: string): Promise<void> {
    try {
      const library = JSON.parse(localStorage.getItem('questionLibrary') || '[]');
      const filtered = library.filter((item: any) => item.id !== libraryId);
      localStorage.setItem('questionLibrary', JSON.stringify(filtered));
      
      console.log('题目集已从题库删除:', libraryId);
    } catch (error) {
      console.error('删除题目集失败:', error);
      throw new Error('删除失败，请重试');
    }
  }
}