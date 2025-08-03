// src/controllers/DocumentController.ts - 使用原生流式API

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
          id: 'test-user-dev',
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

      // 🔧 使用 Fastify 原生流式 API 处理 multipart 数据
      console.log('📋 开始解析 multipart 数据...');
      
      const parts = await (request as any).files();
      const fields: Record<string, string> = {};
      let fileObject: any = null;

      console.log('📋 处理 multipart parts...');

      // 遍历所有 parts（文件和字段）
      for await (const part of parts) {
        console.log(`📋 处理 part: ${part.fieldname}, 类型: ${part.type}`);
        
        if (part.type === 'file') {
          // 这是文件
          console.log('📁 找到文件 part:', {
            fieldname: part.fieldname,
            filename: part.filename,
            mimetype: part.mimetype,
            encoding: part.encoding
          });

          if (part.fieldname === 'file' || !fileObject) {
            fileObject = part;
            console.log('✅ 使用此文件作为主文件');
          } else {
            // 跳过额外的文件
            console.log('⏭️ 跳过额外文件');
            await part.file.resume(); // 消费流以避免内存泄漏
          }
        } else {
          // 这是普通字段
          console.log(`📝 处理字段: ${part.fieldname}`);
          const value = await part.value;
          fields[part.fieldname] = value;
          console.log(`📝 字段值: ${part.fieldname} = ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
        }
      }

      console.log('📋 解析完成，字段数量:', Object.keys(fields).length);
      console.log('📋 字段名称:', Object.keys(fields));

      // 验证是否找到文件
      if (!fileObject) {
        console.log('❌ 未找到文件');
        const response: BaseResponse = {
          success: false,
          error: '未提供文件',
          message: '请选择要上传的文件（字段名：file）',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(400).send(response);
        return;
      }

      // 验证文件信息
      if (!fileObject.filename) {
        console.log('❌ 文件缺少文件名');
        await fileObject.file.resume(); // 清理流
        const response: BaseResponse = {
          success: false,
          error: '文件缺少文件名',
          message: '上传的文件必须包含文件名信息',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(400).send(response);
        return;
      }

      console.log('✅ 文件信息验证通过:', {
        filename: fileObject.filename,
        mimetype: fileObject.mimetype,
        fieldname: fileObject.fieldname,
        encoding: fileObject.encoding
      });

      // 解析可选参数
      let metadata: Record<string, any> = {};
      let parseConfig: Record<string, any> = {};
      let chunkConfig: Record<string, any> = {};

      try {
        if (fields.metadata) {
          metadata = JSON.parse(fields.metadata);
          console.log('✅ 解析 metadata 成功，键数量:', Object.keys(metadata).length);
        }
        if (fields.parseConfig) {
          parseConfig = JSON.parse(fields.parseConfig);
          console.log('✅ 解析 parseConfig 成功，键数量:', Object.keys(parseConfig).length);
        }
        if (fields.chunkConfig) {
          chunkConfig = JSON.parse(fields.chunkConfig);
          console.log('✅ 解析 chunkConfig 成功，键数量:', Object.keys(chunkConfig).length);
        }
      } catch (error) {
        console.log('❌ JSON 解析失败:', error);
        await fileObject.file.resume(); // 清理流
        const response: BaseResponse = {
          success: false,
          error: '参数格式错误',
          message: `JSON 格式无效: ${getErrorMessage(error)}`,
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(400).send(response);
        return;
      }

      // 构建文件流信息
      const fileStreamInfo: FileStreamInfo = {
        filename: fileObject.filename,
        mimetype: fileObject.mimetype || 'application/octet-stream',
        encoding: fileObject.encoding || 'binary',
        fieldname: fileObject.fieldname || 'file',
        file: fileObject.file // 这是原生的文件流
      };

      console.log(`📁 开始处理文件: ${fileObject.filename} (${fileObject.mimetype})`);
      console.log(`📋 元数据字段数量: ${Object.keys(metadata).length}`);

      // 🔧 修复：使用新的基础验证方法（不验证文件大小）
      const basicValidation = FileUploadService.validateFileWithoutSize(
        fileStreamInfo.filename,
        fileStreamInfo.mimetype,
        FileUploadService.getDefaultConfig()
      );

      if (!basicValidation.isValid) {
        console.log('❌ 基础文件验证失败:', basicValidation.error);
        await fileObject.file.resume(); // 清理流
        const response: BaseResponse = {
          success: false,
          error: '文件验证失败',
          message: basicValidation.error || '文件格式不支持',
          timestamp: new Date().toISOString(),
          requestId: request.id
        };
        reply.status(400).send(response);
        return;
      }

      console.log('✅ 基础文件验证通过，开始上传...');

      // 上传文件到存储服务（文件大小验证在内部进行）
      const uploadResult = await FileUploadService.uploadFile(
        fileStreamInfo,
        request.appUser!.id
      );

      // 创建文档记录
      const createRequest: CreateDocumentServiceRequest = {
        userId: request.appUser!.id,
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
      reply.status(302).redirect(document.downloadUrl);

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
}

// 导出控制器类
export default DocumentController;