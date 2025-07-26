// src/controllers/DocumentController.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import DocumentService, {
  CreateDocumentServiceRequest,
  DocumentListRequest,
  UpdateDocumentStatusRequest
} from '@/services/DocumentService';
import FileUploadService, { FileStreamInfo } from '@/services/FileUploadService';
import { DocumentIngestStatus } from '@/models/Document';
import { BaseResponse } from '@/types/base';
import { getErrorMessage } from '@/utils/typescript-helpers';

/**
 * 文档控制器类
 * 提供文档相关的HTTP API处理逻辑
 */
export class DocumentController {
  /**
   * 上传文档处理器
   */
  public static async uploadDocument(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      console.log('📤 收到文档上传请求');

      // 验证用户认证
      if (!request.appUser) {
        console.log('🚧 测试模式：创建默认用户');
        request.appUser = {
          id: 'test-user-' + Date.now(),
          email: 'test@example.com',
          username: 'testuser',
          display_name: 'Test User',
          password_hash: 'fake-hash',
          role: 'teacher' as any,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        } as any;
      }

      // 获取上传的文件
      const { file } = request.body as any;
      
      if (!file) {
        const response: BaseResponse = {
          success: false,
          error: '未提供文件',
          message: '请选择要上传的文件',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(400).send(response);
        return;
      }

      // 解析可选参数
      let metadata: Record<string, any> = {};
      let parseConfig: Record<string, any> = {};
      let chunkConfig: Record<string, any> = {};

      try {
        // 从 multipart 数据中解析字段
        const fields = await this.extractMultipartFields(request);
        
        if (fields.metadata) {
          metadata = JSON.parse(fields.metadata);
        }
        if (fields.parseConfig) {
          parseConfig = JSON.parse(fields.parseConfig);
        }
        if (fields.chunkConfig) {
          chunkConfig = JSON.parse(fields.chunkConfig);
        }
      } catch (error) {
        const response: BaseResponse = {
          success: false,
          error: '参数格式错误',
          message: 'metadata、parseConfig、chunkConfig 必须是有效的JSON格式',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(400).send(response);
        return;
      }

      // 构建文件流信息
      const fileStreamInfo: FileStreamInfo = {
        filename: file.filename,
        mimetype: file.mimetype,
        encoding: file.encoding,
        fieldname: file.fieldname,
        file: file.file
      };

      // 上传文件到存储服务
      console.log(`📁 开始处理文件: ${file.filename} (${file.mimetype})`);
      const uploadResult = await FileUploadService.uploadFile(
        fileStreamInfo,
        request.appUser.id
      );

      // 创建文档记录
      const createRequest: CreateDocumentServiceRequest = {
        userId: request.appUser.id,
        uploadResult,
        metadata,
        parseConfig,
        chunkConfig
      };

      const result = await DocumentService.createDocument(createRequest);

      // 构建响应
      const responseData = {
        doc_id: result.document.doc_id,
        filename: result.document.filename,
        status: result.document.ingest_status,
        size_bytes: result.document.size_bytes,
        mime_type: result.document.mime_type,
        content_hash: result.document.content_hash,
        existingDocument: result.existingDocument || false,
        processing_job_id: result.processingJob?.job_id,
        created_at: result.document.created_at
      };

      const response: BaseResponse = {
        success: true,
        message: result.message,
        data: responseData,
        timestamp: new Date().toISOString(),
        requestId: request.id
      };

      console.log(`✅ 文档上传成功: ${result.document.doc_id}`);
      reply.status(200).send(response);

    } catch (error) {
      console.error('文档上传失败:', error);
      const response: BaseResponse = {
        success: false,
        error: '文档上传失败',
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
        requestId: request.id
      };
      reply.status(500).send(response);
    }
  }

  /**
   * 获取文档列表处理器
   */
  public static async getDocumentList(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      if (!request.appUser) {
        const response: BaseResponse = {
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(401).send(response);
        return;
      }

      // 解析查询参数
      const query = request.query as any;
      const listRequest: DocumentListRequest = {
        userId: request.appUser.id,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        status: query.status,
        mimeType: query.mimeType,
        sortBy: query.sortBy || 'created_at',
        sortOrder: query.sortOrder || 'desc'
      };

      // 获取文档列表
      const result = await DocumentService.getDocumentList(listRequest);

      const response: BaseResponse = {
        success: true,
        message: '获取文档列表成功',
        data: result,
        timestamp: new Date().toISOString(),
        requestId: request.id
      };

      reply.status(200).send(response);

    } catch (error) {
      console.error('获取文档列表失败:', error);
      const response: BaseResponse = {
        success: false,
        error: '获取文档列表失败',
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
        requestId: request.id
      };
      reply.status(500).send(response);
    }
  }

  /**
   * 获取文档详情处理器
   */
  public static async getDocumentDetail(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      if (!request.appUser) {
        const response: BaseResponse = {
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(401).send(response);
        return;
      }

      const params = request.params as any;
      const { docId } = params;

      // 获取文档详情
      const document = await DocumentService.getDocumentDetail(
        docId,
        request.appUser.id,
        true
      );

      if (!document) {
        const response: BaseResponse = {
          success: false,
          error: '文档未找到',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(404).send(response);
        return;
      }

      const response: BaseResponse = {
        success: true,
        message: '获取文档详情成功',
        data: document,
        timestamp: new Date().toISOString(),
        requestId: request.id
      };

      reply.status(200).send(response);

    } catch (error) {
      console.error('获取文档详情失败:', error);
      
      // 检查是否是权限错误
      const statusCode = getErrorMessage(error).includes('无权限') ? 403 : 500;
      
      const response: BaseResponse = {
        success: false,
        error: statusCode === 403 ? '权限不足' : '获取文档详情失败',
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
        requestId: request.id
      };
      reply.status(statusCode).send(response);
    }
  }

  /**
   * 获取文档状态处理器
   */
  public static async getDocumentStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      if (!request.appUser) {
        const response: BaseResponse = {
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(401).send(response);
        return;
      }

      const params = request.params as any;
      const { docId } = params;

      // 获取文档处理进度
      const progress = await DocumentService.getDocumentProgress(
        docId,
        request.appUser.id
      );

      const response: BaseResponse = {
        success: true,
        message: '获取文档状态成功',
        data: progress,
        timestamp: new Date().toISOString(),
        requestId: request.id
      };

      reply.status(200).send(response);

    } catch (error) {
      console.error('获取文档状态失败:', error);
      
      const statusCode = getErrorMessage(error).includes('无权限') ? 403 : 
                         getErrorMessage(error).includes('不存在') ? 404 : 500;
      
      const response: BaseResponse = {
        success: false,
        error: statusCode === 403 ? '权限不足' : 
               statusCode === 404 ? '文档未找到' : '获取文档状态失败',
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
        requestId: request.id
      };
      reply.status(statusCode).send(response);
    }
  }

  /**
   * 删除文档处理器
   */
  public static async deleteDocument(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      if (!request.appUser) {
        const response: BaseResponse = {
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(401).send(response);
        return;
      }

      const params = request.params as any;
      const query = request.query as any;
      const { docId } = params;
      const permanent = query.permanent === 'true';

      // 删除文档
      const success = await DocumentService.deleteDocument(
        docId,
        request.appUser.id,
        permanent
      );

      if (!success) {
        const response: BaseResponse = {
          success: false,
          error: '删除文档失败',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(500).send(response);
        return;
      }

      const response: BaseResponse = {
        success: true,
        message: permanent ? '文档已永久删除' : '文档已删除',
        timestamp: new Date().toISOString(),
        requestId: request.id
      };

      reply.status(200).send(response);

    } catch (error) {
      console.error('删除文档失败:', error);
      
      const statusCode = getErrorMessage(error).includes('无权限') ? 403 : 
                         getErrorMessage(error).includes('不存在') ? 404 : 500;
      
      const response: BaseResponse = {
        success: false,
        error: statusCode === 403 ? '权限不足' : 
               statusCode === 404 ? '文档未找到' : '删除文档失败',
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
        requestId: request.id
      };
      reply.status(statusCode).send(response);
    }
  }

  /**
   * 重新处理文档处理器
   */
  public static async reprocessDocument(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      if (!request.appUser) {
        const response: BaseResponse = {
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(401).send(response);
        return;
      }

      const params = request.params as any;
      const { docId } = params;

      // 重新处理文档
      const jobs = await DocumentService.reprocessDocument(
        docId,
        request.appUser.id
      );

      const response: BaseResponse = {
        success: true,
        message: '文档重新处理已启动',
        data: {
          jobs: jobs.map(job => ({
            job_id: job.job_id,
            job_type: job.job_type,
            status: job.status,
            created_at: job.created_at
          }))
        },
        timestamp: new Date().toISOString(),
        requestId: request.id
      };

      reply.status(200).send(response);

    } catch (error) {
      console.error('重新处理文档失败:', error);
      
      const statusCode = getErrorMessage(error).includes('无权限') ? 403 : 
                         getErrorMessage(error).includes('不存在') ? 404 : 
                         getErrorMessage(error).includes('正在处理') ? 409 : 500;
      
      const response: BaseResponse = {
        success: false,
        error: statusCode === 403 ? '权限不足' : 
               statusCode === 404 ? '文档未找到' : 
               statusCode === 409 ? '文档正在处理中' : '重新处理文档失败',
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
        requestId: request.id
      };
      reply.status(statusCode).send(response);
    }
  }

  /**
   * 下载文档处理器
   */
  public static async downloadDocument(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      if (!request.appUser) {
        const response: BaseResponse = {
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(401).send(response);
        return;
      }

      const params = request.params as any;
      const { docId } = params;

      // 获取文档详情
      const document = await DocumentService.getDocumentDetail(
        docId,
        request.appUser.id,
        false
      );

      if (!document) {
        const response: BaseResponse = {
          success: false,
          error: '文档未找到',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(404).send(response);
        return;
      }

      if (!document.canDownload || !document.downloadUrl) {
        const response: BaseResponse = {
          success: false,
          error: '文档不可下载',
          message: '文档处理失败或尚未完成处理',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(403).send(response);
        return;
      }

      // 重定向到下载URL
      reply.redirect(302, document.downloadUrl);

    } catch (error) {
      console.error('下载文档失败:', error);
      
      const statusCode = getErrorMessage(error).includes('无权限') ? 403 : 
                         getErrorMessage(error).includes('不存在') ? 404 : 500;
      
      const response: BaseResponse = {
        success: false,
        error: statusCode === 403 ? '权限不足' : 
               statusCode === 404 ? '文档未找到' : '下载文档失败',
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
        requestId: request.id
      };
      reply.status(statusCode).send(response);
    }
  }

  /**
   * 从 multipart 请求中提取字段
   * @param request FastifyRequest 对象
   * @returns 提取的字段
   */
  private static async extractMultipartFields(request: FastifyRequest): Promise<Record<string, string>> {
    const fields: Record<string, string> = {};
    
    // Fastify multipart 插件会将非文件字段添加到 request.body 中
    // 但由于我们移除了 body schema，需要手动处理
    if (request.body && typeof request.body === 'object') {
      const body = request.body as any;
      Object.keys(body).forEach(key => {
        if (typeof body[key] === 'string') {
          fields[key] = body[key];
        }
      });
    }
    
    return fields;
  }
}

// 导出控制器类
export default DocumentController;