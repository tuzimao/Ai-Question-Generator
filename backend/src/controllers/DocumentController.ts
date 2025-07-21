// src/controllers/DocumentController.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import DocumentService, {
  CreateDocumentServiceRequest,
  DocumentListRequest,
  UpdateDocumentStatusRequest
} from '@/services/DocumentService';
import FileUploadService, { FileStreamInfo } from '@/services/FileUploadService';
import { DocumentIngestStatus } from '@/models/Document';
import { BaseResponse } from '@/types/base';
import { getErrorMessage } from '@/utils/typescript-helpers';
import SwaggerConfig from '@/config/SwaggerConfig';

/**
 * 文档上传请求体接口
 */
interface DocumentUploadRequest {
  Body: {
    metadata?: string; // JSON字符串
    parseConfig?: string; // JSON字符串
    chunkConfig?: string; // JSON字符串
  };
}

/**
 * 文档列表查询参数接口
 */
interface DocumentListQuery {
  Querystring: {
    page?: string;
    limit?: string;
    status?: DocumentIngestStatus;
    mimeType?: string;
    sortBy?: 'created_at' | 'updated_at' | 'filename' | 'size_bytes';
    sortOrder?: 'asc' | 'desc';
  };
}

/**
 * 文档详情参数接口
 */
interface DocumentDetailParams {
  Params: {
    docId: string;
  };
}

/**
 * 文档状态更新请求接口
 */
interface DocumentStatusUpdateRequest {
  Params: {
    docId: string;
  };
  Body: {
    status: DocumentIngestStatus;
    errorMessage?: string;
    metadata?: Record<string, any>;
    parseResults?: {
      pageCount?: number;
      language?: string;
      textLength?: number;
      tokenEstimate?: number;
    };
  };
}



/**
 * 文档控制器类
 * 提供文档相关的HTTP API端点，包含完整的Swagger文档
 */
export class DocumentController {
  /**
   * 注册文档相关路由
   * @param server Fastify服务器实例
   */
  public static async registerRoutes(server: FastifyInstance): Promise<void> {

    
    // 📤 文档上传API
    server.post('/v1/documents', {
      //preHandler: [server.authenticate],
      preHandler: [(req, reply, done) => done()],
      schema: {
        description: '上传文档文件',
        summary: '上传PDF、Markdown或文本文件',
        tags: ['Documents'],
        consumes: ['multipart/form-data'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              format: 'binary',
              description: '要上传的文件（PDF、Markdown、Text）'
            },
            metadata: {
              type: 'string',
              description: '文档元数据（JSON字符串）',
              example: '{"tags":["教育","数学"],"description":"高中数学教材"}'
            },
            parseConfig: {
              type: 'string', 
              description: '解析配置（JSON字符串）',
              example: '{"extractImages":false,"preserveFormatting":true}'
            },
            chunkConfig: {
              type: 'string',
              description: '分块配置（JSON字符串）', 
              example: '{"targetTokens":400,"overlapTokens":60}'
            }
          },
          required: ['file']
        },
        response: {
          200: {
            description: '文档上传成功',
            ...SwaggerConfig.getSwaggerOptions().openapi.components!.schemas!.DocumentUploadResponse
          },
          400: SwaggerConfig.getErrorResponseSchema(400, '请求参数错误或文件格式不支持'),
          401: SwaggerConfig.getErrorResponseSchema(401, '用户未认证'),
          413: SwaggerConfig.getErrorResponseSchema(413, '文件大小超过限制（50MB）'),
          500: SwaggerConfig.getErrorResponseSchema(500, '服务器内部错误')
        }
      }
    }, this.uploadDocument.bind(this));

    // 📋 获取文档列表API
    server.get('/v1/documents', {
      //preHandler: [server.authenticate],
      preHandler: [(req, reply, done) => done()],
      schema: {
        description: '获取用户的文档列表',
        summary: '分页获取当前用户的所有文档',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { 
              type: 'integer', 
              minimum: 1, 
              default: 1, 
              description: '页码，从1开始' 
            },
            limit: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 100, 
              default: 20, 
              description: '每页记录数，最大100' 
            },
            status: { 
              type: 'string', 
              enum: Object.values(DocumentIngestStatus),
              description: '按文档状态过滤'
            },
            mimeType: { 
              type: 'string',
              enum: ['application/pdf', 'text/markdown', 'text/plain'],
              description: '按文件类型过滤'
            },
            sortBy: { 
              type: 'string', 
              enum: ['created_at', 'updated_at', 'filename', 'size_bytes'],
              default: 'created_at',
              description: '排序字段'
            },
            sortOrder: { 
              type: 'string', 
              enum: ['asc', 'desc'],
              default: 'desc', 
              description: '排序方向'
            }
          }
        },
        response: {
          200: {
            description: '获取文档列表成功',
            ...SwaggerConfig.getSwaggerOptions().openapi.components!.schemas!.DocumentListResponse
          },
          401: SwaggerConfig.getErrorResponseSchema(401, '用户未认证'),
          500: SwaggerConfig.getErrorResponseSchema(500, '服务器内部错误')
        }
      }
    }, this.getDocumentList.bind(this));

    // 📄 获取文档详情API
    server.get('/v1/documents/:docId', {
      //preHandler: [server.authenticate],
      preHandler: [(req, reply, done) => done()],
      schema: {
        description: '获取指定文档的详细信息',
        summary: '查看文档详情、处理作业和权限信息',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            docId: { 
              type: 'string', 
              format: 'uuid',
              description: '文档唯一标识符',
              example: '550e8400-e29b-41d4-a716-446655440000'
            }
          },
          required: ['docId']
        },
        response: {
          200: {
            description: '获取文档详情成功',
            ...SwaggerConfig.getSwaggerOptions().openapi.components!.schemas!.DocumentDetailResponse
          },
          401: SwaggerConfig.getErrorResponseSchema(401, '用户未认证'),
          403: SwaggerConfig.getErrorResponseSchema(403, '无权限访问该文档'),
          404: SwaggerConfig.getErrorResponseSchema(404, '文档不存在'),
          500: SwaggerConfig.getErrorResponseSchema(500, '服务器内部错误')
        }
      }
    }, this.getDocumentDetail.bind(this));

    // 📊 获取文档处理状态API
    server.get('/v1/documents/:docId/status', {
      //preHandler: [server.authenticate],
      preHandler: [(req, reply, done) => done()],
      schema: {
        description: '获取文档处理状态和进度',
        summary: '实时查看文档解析、分块等处理进度',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            docId: { 
              type: 'string', 
              format: 'uuid',
              description: '文档唯一标识符'
            }
          },
          required: ['docId']
        },
        response: {
          200: {
            description: '获取文档状态成功',
            ...SwaggerConfig.getSwaggerOptions().openapi.components!.schemas!.DocumentProgressResponse
          },
          401: SwaggerConfig.getErrorResponseSchema(401, '用户未认证'),
          403: SwaggerConfig.getErrorResponseSchema(403, '无权限查看该文档'),
          404: SwaggerConfig.getErrorResponseSchema(404, '文档不存在'),
          500: SwaggerConfig.getErrorResponseSchema(500, '服务器内部错误')
        }
      }
    }, this.getDocumentStatus.bind(this));

    // 🗑️ 删除文档API
    server.delete('/v1/documents/:docId', {
      //preHandler: [server.authenticate],
      preHandler: [(req, reply, done) => done()],
      schema: {
        description: '删除指定文档',
        summary: '软删除或永久删除文档及相关数据',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            docId: { 
              type: 'string', 
              format: 'uuid',
              description: '文档唯一标识符'
            }
          },
          required: ['docId']
        },
        querystring: {
          type: 'object',
          properties: {
            permanent: { 
              type: 'boolean', 
              default: false,
              description: '是否永久删除（包括存储文件）'
            }
          }
        },
        response: {
          200: {
            description: '删除文档成功',
            type: 'object',
            properties: {
              success: { type: 'boolean', enum: [true] },
              message: { 
                type: 'string',
                enum: ['文档已删除', '文档已永久删除']
              },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' }
            }
          },
          401: SwaggerConfig.getErrorResponseSchema(401, '用户未认证'),
          403: SwaggerConfig.getErrorResponseSchema(403, '无权限删除该文档'),
          404: SwaggerConfig.getErrorResponseSchema(404, '文档不存在'),
          500: SwaggerConfig.getErrorResponseSchema(500, '删除操作失败')
        }
      }
    }, this.deleteDocument.bind(this));

    // 🔄 重新处理文档API
    server.post('/v1/documents/:docId/reprocess', {
      //preHandler: [server.authenticate],
      preHandler: [(req, reply, done) => done()],
      schema: {
        description: '重新处理指定文档',
        summary: '重新启动文档解析和分块流程',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            docId: { 
              type: 'string', 
              format: 'uuid',
              description: '文档唯一标识符'
            }
          },
          required: ['docId']
        },
        response: {
          200: {
            description: '重新处理启动成功',
            type: 'object',
            properties: {
              success: { type: 'boolean', enum: [true] },
              message: { type: 'string', enum: ['文档重新处理已启动'] },
              data: {
                type: 'object',
                properties: {
                  jobs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        job_id: { type: 'string', format: 'uuid' },
                        job_type: { $ref: '#/components/schemas/JobType' },
                        status: { $ref: '#/components/schemas/JobStatus' },
                        created_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' }
            }
          },
          401: SwaggerConfig.getErrorResponseSchema(401, '用户未认证'),
          403: SwaggerConfig.getErrorResponseSchema(403, '无权限重新处理该文档'),
          404: SwaggerConfig.getErrorResponseSchema(404, '文档不存在'),
          409: SwaggerConfig.getErrorResponseSchema(409, '文档正在处理中，无法重新处理'),
          500: SwaggerConfig.getErrorResponseSchema(500, '重新处理失败')
        }
      }
    }, this.reprocessDocument.bind(this));

    // 📥 下载文档API
    server.get('/v1/documents/:docId/download', {
      //preHandler: [server.authenticate],
      preHandler: [(req, reply, done) => done()],
      schema: {
        description: '下载原始文档文件',
        summary: '获取文档的下载链接或直接下载',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            docId: { 
              type: 'string', 
              format: 'uuid',
              description: '文档唯一标识符'
            }
          },
          required: ['docId']
        },
        response: {
          302: {
            description: '重定向到下载URL',
            headers: {
              'Location': {
                type: 'string',
                format: 'uri',
                description: '文件下载地址'
              }
            }
          },
          401: SwaggerConfig.getErrorResponseSchema(401, '用户未认证'),
          403: SwaggerConfig.getErrorResponseSchema(403, '文档不可下载或无权限'),
          404: SwaggerConfig.getErrorResponseSchema(404, '文档不存在'),
          500: SwaggerConfig.getErrorResponseSchema(500, '生成下载链接失败')
        }
      }
    }, this.downloadDocument.bind(this));

    console.log('✅ 文档路由注册完成（包含完整Swagger文档）');
  }

  /**
   * 上传文档处理器
   */
  private static async uploadDocument(
    request: FastifyRequest<{ Body: { metadata?: string; parseConfig?: string; chunkConfig?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      console.log('📤 收到文档上传请求');

      // 验证用户认证
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

      // 获取上传的文件
      const file = await request.file();
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
        if (request.body?.metadata) {
          metadata = JSON.parse(request.body.metadata);
        }
        if (request.body?.parseConfig) {
          parseConfig = JSON.parse(request.body.parseConfig);
        }
        if (request.body?.chunkConfig) {
          chunkConfig = JSON.parse(request.body.chunkConfig);
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
  private static async getDocumentList(
    request: FastifyRequest<DocumentListQuery>,
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
      const listRequest: DocumentListRequest = {
        userId: request.appUser.id,
        page: request.query.page ? parseInt(request.query.page, 10) : 1,
        limit: request.query.limit ? parseInt(request.query.limit, 10) : 20,
        status: request.query.status,
        mimeType: request.query.mimeType,
        sortBy: request.query.sortBy || 'created_at',
        sortOrder: request.query.sortOrder || 'desc'
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
  private static async getDocumentDetail(
    request: FastifyRequest<DocumentDetailParams>,
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

      const { docId } = request.params;

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
  private static async getDocumentStatus(
    request: FastifyRequest<DocumentDetailParams>,
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

      const { docId } = request.params;

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
  private static async deleteDocument(
    request: FastifyRequest<DocumentDetailParams & { Querystring: { permanent?: string } }>,
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

      const { docId } = request.params;
      const permanent = request.query.permanent === 'true';

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
  private static async reprocessDocument(
    request: FastifyRequest<DocumentDetailParams>,
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

      const { docId } = request.params;

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
  private static async downloadDocument(
    request: FastifyRequest<DocumentDetailParams>,
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

      const { docId } = request.params;

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
}

// 导出控制器类
export default DocumentController;