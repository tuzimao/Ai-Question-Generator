// src/services/DocumentService.ts

import { Knex } from 'knex';
import DocumentModel, { 
  Document, 
  DocumentIngestStatus, 
  CreateDocumentRequest,
  DocumentQueryOptions 
} from '@/models/Document';
import ProcessingJobModel, { 
  ProcessingJob, 
  JobType, 
  CreateJobRequest 
} from '@/models/ProcessingJob';
import UserModel from '@/models/User';
import { Database } from '@/utils/database';
import { FileUploadResult } from '@/services/FileUploadService';
import { getErrorMessage } from '@/utils/typescript-helpers';
import { JobStatus } from '../models/ProcessingJob';


/**
 * 文档创建请求接口
 */
export interface CreateDocumentServiceRequest {
  userId: string;
  uploadResult: FileUploadResult;
  metadata?: Record<string, any>;
  parseConfig?: Record<string, any>;
  chunkConfig?: Record<string, any>;
}

/**
 * 文档创建结果接口
 */
export interface CreateDocumentServiceResult {
  document: Document;
  existingDocument?: boolean;
  processingJob?: ProcessingJob;
  message: string;
}

/**
 * 文档状态更新请求接口
 */
export interface UpdateDocumentStatusRequest {
  docId: string;
  status: DocumentIngestStatus;
  errorMessage?: string;
  metadata?: Record<string, any>;
  parseResults?: {
    pageCount?: number;
    language?: string;
    textLength?: number;
    tokenEstimate?: number;
  };
}

/**
 * 文档查询请求接口
 */
export interface DocumentListRequest {
  userId: string;
  status?: DocumentIngestStatus;
  mimeType?: string;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'updated_at' | 'filename' | 'size_bytes';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 文档列表响应接口
 */
export interface DocumentListResponse {
  documents: Document[];
  pagination: {
    current: number;
    total: number;
    pages: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  statistics: {
    total: number;
    byStatus: Record<DocumentIngestStatus, number>;
    totalSize: number;
  };
}

/**
 * 文档详情响应接口
 */
export interface DocumentDetailResponse extends Document {
  downloadUrl?: string | undefined;
  processingJobs?: ProcessingJob[];
  canDownload: boolean;
  canDelete: boolean;
  canReprocess: boolean;
}

/**
 * 文档服务类
 * 提供文档相关的业务逻辑处理
 */
export class DocumentService {
  /**
   * 创建文档记录
   * @param request 创建请求
   * @returns 创建结果
   */
  public static async createDocument(
    request: CreateDocumentServiceRequest
  ): Promise<CreateDocumentServiceResult> {
    return await Database.transaction(async (trx: Knex.Transaction) => {
      try {
        console.log(`📄 开始创建文档记录: ${request.uploadResult.originalName} (用户: ${request.userId})`);

        // 验证用户是否存在
        const user = await UserModel.findById(request.userId);
        if (!user) {
          throw new Error('用户不存在');
        }

        // 检查是否已存在相同内容的文档（去重逻辑）
        const existingDocument = await DocumentModel.findByUserAndHash(
          request.userId,
          request.uploadResult.contentHash
        );

        if (existingDocument) {
          console.log(`♻️ 发现重复文档: ${existingDocument.doc_id} (${existingDocument.filename})`);
          
          // 如果是已删除的文档，恢复它
          if (existingDocument.deleted_at) {
            const restoredDocument = await DocumentModel.restore(existingDocument.doc_id, trx);
            return {
              document: restoredDocument,
              existingDocument: true,
              message: '文档已存在，已从回收站恢复'
            };
          }

          // 返回现有文档
          return {
            document: existingDocument,
            existingDocument: true,
            message: '文档已存在，返回现有文档'
          };
        }

        // 准备文档数据
        const createDocumentRequest: CreateDocumentRequest = {
          user_id: request.userId,
          filename: request.uploadResult.originalName,
          content_hash: request.uploadResult.contentHash,
          mime_type: request.uploadResult.mimeType,
          size_bytes: request.uploadResult.size,
          storage_path: request.uploadResult.storagePath,
          storage_bucket: request.uploadResult.storageBucket,
          metadata: {
            upload_timestamp: new Date().toISOString(),
            original_upload_name: request.uploadResult.originalName,
            file_id: request.uploadResult.fileId,
            ...request.metadata
          },
          parse_config: request.parseConfig ?? {},
          chunk_config: {
            target_tokens: 400,
            max_tokens: 500,
            overlap_tokens: 60,
            respect_boundaries: true,
            ...request.chunkConfig
          }
        };

        // 创建文档记录
        const document = await DocumentModel.create(createDocumentRequest, trx);

        // 创建处理作业
        const processingJob = await this.createProcessingJob(document, trx);

        console.log(`✅ 文档创建成功: ${document.doc_id} (${document.filename})`);

        return {
          document,
          existingDocument: false,
          processingJob,
          message: '文档创建成功，已加入处理队列'
        };

      } catch (error) {
        console.error('创建文档失败:', error);
        throw new Error(`创建文档失败: ${getErrorMessage(error)}`);
      }
    });
  }

  /**
   * 获取文档详情
   * @param docId 文档ID
   * @param userId 用户ID
   * @param includeJobs 是否包含处理作业信息
   * @returns 文档详情
   */
  public static async getDocumentDetail(
    docId: string,
    userId: string,
    includeJobs: boolean = true
  ): Promise<DocumentDetailResponse | null> {
    try {
      // 获取文档基本信息
      const document = await DocumentModel.findById(docId);
      if (!document) {
        return null;
      }

      // 验证用户权限
      if (document.user_id !== userId) {
        throw new Error('无权限访问该文档');
      }

      // 获取处理作业信息
      let processingJobs: ProcessingJob[] = [];
      if (includeJobs) {
        processingJobs = await ProcessingJobModel.findByDocument(docId, {}, 10, 0);
      }

      // 获取下载URL（如果文档可下载）
      let downloadUrl: string | undefined;
      if (document.ingest_status !== DocumentIngestStatus.FAILED) {
        try {
          const { storageService } = await import('@/services/StorageService');
          downloadUrl = await storageService.getFileUrl(
            document.storage_bucket,
            document.storage_path,
            3600 // 1小时有效期
          );
        } catch (error) {
          console.warn('获取下载URL失败:', error);
        }
      }

      // 确定权限
      const canDownload = document.ingest_status !== DocumentIngestStatus.FAILED;
      const canDelete = true; // 用户始终可以删除自己的文档
      const canReprocess = [
        DocumentIngestStatus.FAILED,
        DocumentIngestStatus.PARSED,
        DocumentIngestStatus.CHUNKED,
        DocumentIngestStatus.READY
      ].includes(document.ingest_status);

      const documentDetail: DocumentDetailResponse = {
        ...document,
        downloadUrl,
        processingJobs,
        canDownload,
        canDelete,
        canReprocess
      };

      return documentDetail;

    } catch (error) {
      console.error('获取文档详情失败:', error);
      throw new Error(`获取文档详情失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 获取用户文档列表
   * @param request 查询请求
   * @returns 文档列表
   */
  public static async getDocumentList(
    request: DocumentListRequest
  ): Promise<DocumentListResponse> {
    try {
      const page = request.page || 1;
      const limit = Math.min(request.limit || 20, 100); // 最大100条
      const offset = (page - 1) * limit;

      // 构建查询选项
      const queryOptions: DocumentQueryOptions = {
        ...(request.status !== undefined ? { status: request.status } : {}),
        ...(request.mimeType !== undefined ? { mimeType: request.mimeType } : {}),
        sortBy: request.sortBy || 'created_at',
        sortOrder: request.sortOrder || 'desc'
      };

      // 获取文档列表
      const documents = await DocumentModel.findByUser(
        request.userId,
        queryOptions,
        limit,
        offset
      );

      // 获取总数（用于分页）
      const totalQuery = await DocumentModel.findByUser(
        request.userId,
        queryOptions,
        999999,
        0
      );
      const total = totalQuery.length;

      // 计算分页信息
      const pages = Math.ceil(total / limit);
      const pagination = {
        current: page,
        total,
        pages,
        limit,
        hasNext: page < pages,
        hasPrev: page > 1
      };

      // 获取统计信息
      const statistics = await DocumentModel.getStats(request.userId);

      return {
        documents,
        pagination,
        statistics
      };

    } catch (error) {
      console.error('获取文档列表失败:', error);
      throw new Error(`获取文档列表失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 更新文档状态
   * @param request 更新请求
   * @returns 更新后的文档
   */
  public static async updateDocumentStatus(
    request: UpdateDocumentStatusRequest
  ): Promise<Document | null> {
    try {
      // 准备更新数据
      const updateData: any = {
        ingest_status: request.status
      };

      // 添加解析结果
      if (request.parseResults) {
        Object.assign(updateData, request.parseResults);
      }

      // 添加元数据
      if (request.metadata) {
        const existingDoc = await DocumentModel.findById(request.docId);
        if (existingDoc) {
          updateData.metadata = {
            ...existingDoc.metadata,
            ...request.metadata
          };
        } else {
          updateData.metadata = request.metadata;
        }
      }

      // 更新文档状态
      const updatedDocument = await DocumentModel.update(request.docId, updateData);

      if (updatedDocument) {
        console.log(`📊 文档状态已更新: ${request.docId} -> ${request.status}`);
      }

      return updatedDocument;

    } catch (error) {
      console.error('更新文档状态失败:', error);
      throw new Error(`更新文档状态失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 删除文档
   * @param docId 文档ID
   * @param userId 用户ID
   * @param permanent 是否永久删除
   * @returns 是否删除成功
   */
  public static async deleteDocument(
    docId: string,
    userId: string,
    permanent: boolean = false
  ): Promise<boolean> {
    return await Database.transaction(async (trx: Knex.Transaction) => {
      try {
        // 验证文档存在且属于用户
        const document = await DocumentModel.findById(docId);
        if (!document) {
          throw new Error('文档不存在');
        }

        if (document.user_id !== userId) {
          throw new Error('无权限删除该文档');
        }

        if (permanent) {
          // 永久删除：删除存储文件和数据库记录
          const { storageService } = await import('@/services/StorageService');
          await storageService.deleteFile(document.storage_bucket, document.storage_path);

          // 删除相关的处理作业记录
          // TODO: 在实现了相关模型后取消注释
          // await ProcessingJobModel.deleteByDocument(docId, trx);

          // 删除数据库记录（这里需要真实删除，不是软删除）
          // TODO: 实现 hardDelete 方法
          console.log(`🗑️ 永久删除文档: ${docId}`);
        } else {
          // 软删除
          await DocumentModel.softDelete(docId, trx);
          console.log(`📦 软删除文档: ${docId}`);
        }

        return true;

      } catch (error) {
        console.error('删除文档失败:', error);
        throw new Error(`删除文档失败: ${getErrorMessage(error)}`);
      }
    });
  }

  /**
   * 重新处理文档
   * @param docId 文档ID
   * @param userId 用户ID
   * @param jobTypes 要重新执行的作业类型
   * @returns 创建的处理作业
   */
  public static async reprocessDocument(
    docId: string,
    userId: string,
    jobTypes?: JobType[]
  ): Promise<ProcessingJob[]> {
    return await Database.transaction(async (trx: Knex.Transaction) => {
      try {
        // 验证文档
        const document = await DocumentModel.findById(docId);
        if (!document) {
          throw new Error('文档不存在');
        }

        if (document.user_id !== userId) {
          throw new Error('无权限重新处理该文档');
        }

        // 检查文档状态
        if (document.ingest_status === DocumentIngestStatus.UPLOADING ||
            document.ingest_status === DocumentIngestStatus.PARSING ||
            document.ingest_status === DocumentIngestStatus.CHUNKING) {
          throw new Error('文档正在处理中，无法重新处理');
        }

        // 重置文档状态
        await DocumentModel.updateStatus(docId, DocumentIngestStatus.UPLOADED, undefined, trx);

        // 创建新的处理作业
        const processingJobs = await this.createProcessingJob(document, trx, jobTypes);

        console.log(`🔄 已创建重新处理作业: ${docId}`);

        return Array.isArray(processingJobs) ? processingJobs : [processingJobs];

      } catch (error) {
        console.error('重新处理文档失败:', error);
        throw new Error(`重新处理文档失败: ${getErrorMessage(error)}`);
      }
    });
  }

  /**
   * 获取文档处理进度
   * @param docId 文档ID
   * @param userId 用户ID
   * @returns 处理进度信息
   */
  public static async getDocumentProgress(
    docId: string,
    userId: string
  ): Promise<{
    document: Document;
    currentJob?: ProcessingJob;
    progress: {
      stage: string;
      percentage: number;
      message: string;
      estimatedTimeRemaining?: number;
    };
  }> {
    try {
      // 获取文档
      const document = await DocumentModel.findById(docId);
      if (!document) {
        throw new Error('文档不存在');
      }

      if (document.user_id !== userId) {
        throw new Error('无权限查看该文档进度');
      }

      // 获取当前处理作业
      const jobs = await ProcessingJobModel.findByDocument(docId, { 
        status: JobStatus.PROCESSING 
      }, 1, 0);
      const currentJob = jobs[0];

      // 计算进度
      const progress = this.calculateDocumentProgress(document, currentJob);

      return {
        document,
        ...(currentJob !== undefined ? { currentJob } : {}),
        progress
      };

    } catch (error) {
      console.error('获取文档进度失败:', error);
      throw new Error(`获取文档进度失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 创建处理作业
   * @param document 文档
   * @param trx 事务
   * @param jobTypes 指定的作业类型
   * @returns 创建的作业
   */
  private static async createProcessingJob(
    document: Document,
    trx: Knex.Transaction,
    jobTypes?: JobType[]
  ): Promise<ProcessingJob> {
    try {
      // 根据文档类型确定作业类型
      let jobType: JobType;
      if (jobTypes && jobTypes.length > 0 && jobTypes[0] !== undefined) {
        jobType = jobTypes[0] as JobType; // 目前只处理第一个作业类型
      } else {
        jobType = this.getJobTypeForDocument(document);
      }

      // 创建作业请求
      const createJobRequest: CreateJobRequest = {
        doc_id: document.doc_id,
        user_id: document.user_id,
        job_type: jobType,
        priority: 5,
        queue_name: 'document-processing',
        max_attempts: 3,
        retry_delay_seconds: 300, // 5分钟
        job_config: {
          timeout: 600000, // 10分钟超时
          preserveOriginal: true
        },
        input_params: {
          filePath: document.storage_path,
          bucket: document.storage_bucket,
          mimeType: document.mime_type,
          parseConfig: document.parse_config,
          chunkConfig: document.chunk_config
        },
        file_path: document.storage_path
      };

      // 创建作业
      const job = await ProcessingJobModel.create(createJobRequest, trx);

      console.log(`⚙️ 已创建处理作业: ${job.job_id} (类型: ${jobType})`);

      return job;

    } catch (error) {
      console.error('创建处理作业失败:', error);
      throw new Error(`创建处理作业失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 根据文档类型获取对应的作业类型
   * @param document 文档
   * @returns 作业类型
   */
  private static getJobTypeForDocument(document: Document): JobType {
    switch (document.mime_type) {
      case 'application/pdf':
        return JobType.PARSE_PDF;
      case 'text/markdown':
      case 'text/x-markdown':
        return JobType.PARSE_MARKDOWN;
      case 'text/plain':
        return JobType.PARSE_TEXT;
      default:
        return JobType.PARSE_PDF; // 默认使用PDF解析
    }
  }

  /**
   * 计算文档处理进度
   * @param document 文档
   * @param currentJob 当前作业
   * @returns 进度信息
   */
  private static calculateDocumentProgress(
    document: Document,
    currentJob?: ProcessingJob
  ): {
    stage: string;
    percentage: number;
    message: string;
    estimatedTimeRemaining?: number;
  } {
    // 状态到进度的映射
    const stageProgress: Record<DocumentIngestStatus, { stage: string; percentage: number; message: string }> = {
      [DocumentIngestStatus.UPLOADING]: { stage: '上传中', percentage: 5, message: '正在上传文件...' },
      [DocumentIngestStatus.UPLOADED]: { stage: '已上传', percentage: 10, message: '文件上传完成，等待处理...' },
      [DocumentIngestStatus.PARSING]: { stage: '解析中', percentage: 40, message: '正在解析文档内容...' },
      [DocumentIngestStatus.PARSED]: { stage: '解析完成', percentage: 60, message: '文档解析完成，准备分块...' },
      [DocumentIngestStatus.CHUNKING]: { stage: '分块中', percentage: 80, message: '正在进行文档分块...' },
      [DocumentIngestStatus.CHUNKED]: { stage: '分块完成', percentage: 90, message: '文档分块完成...' },
      [DocumentIngestStatus.EMBEDDING]: { stage: '向量化中', percentage: 95, message: '正在生成向量嵌入...' },
      [DocumentIngestStatus.READY]: { stage: '完成', percentage: 100, message: '文档处理完成，可用于检索' },
      [DocumentIngestStatus.FAILED]: { stage: '失败', percentage: 0, message: '处理失败，请重试' }
    };

    const baseProgress = stageProgress[document.ingest_status];

    // 如果有当前作业，使用更精确的进度
    if (currentJob && currentJob.progress_percentage > 0) {
      const jobProgress = currentJob.progress_percentage;
      const adjustedPercentage = Math.round(baseProgress.percentage + (jobProgress / 100) * 20);
      
      const estimatedTimeRemaining = this.estimateTimeRemaining(currentJob);
      return {
        stage: baseProgress.stage,
        percentage: Math.min(adjustedPercentage, 99), // 确保不超过99%
        message: currentJob.progress_message || baseProgress.message,
        ...(estimatedTimeRemaining !== undefined ? { estimatedTimeRemaining } : {})
      };
    }

    return baseProgress;
  }

  /**
   * 估算剩余处理时间
   * @param job 处理作业
   * @returns 估算的剩余时间（秒）
   */
  private static estimateTimeRemaining(job: ProcessingJob): number | undefined {
    if (!job.started_at || job.progress_percentage <= 0) {
      return undefined;
    }

    const elapsedMs = Date.now() - job.started_at.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const progressRatio = job.progress_percentage / 100;
    
    if (progressRatio > 0) {
      const totalEstimatedSeconds = elapsedSeconds / progressRatio;
      const remainingSeconds = Math.max(0, totalEstimatedSeconds - elapsedSeconds);
      return Math.round(remainingSeconds);
    }

    return undefined;
  }
}

// 导出服务类
export default DocumentService;