// src/routes/DocumentRoutes.ts

import { FastifyInstance, RouteHandlerMethod } from 'fastify';
import { DocumentController } from '@/controllers/DocumentController';
import { DocumentIngestStatus } from '@/models/Document';

/**
 * 文档路由注册类
 * 负责注册所有文档相关的路由和 Schema 定义
 */
export class DocumentRoutes {
  /**
   * 注册所有文档路由
   * @param server Fastify服务器实例
   */
  public static async registerRoutes(server: FastifyInstance): Promise<void> {
    // 📤 文档上传API - 修复后的版本
    server.post('/v1/documents', {
      schema: {
        description: '上传文档文件',
        summary: '上传PDF、Markdown或文本文件',
        tags: ['Documents'],
        security: [{ bearerAuth: [] }],
        // 🔧 关键修复：使用 OpenAPI 3.0 的 requestBody 而不是 body
          body: {
          type: 'object',
          required: ['file'],
          properties: {
            file: { isFile: true },          // ⬅︎ 关键
            filename: { type: 'string' },
            metadata: { type: 'string' }
          }
        },
        response: {
          200: {
            description: '文档上传成功',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  doc_id: { type: 'string', format: 'uuid' },
                  filename: { type: 'string' },
                  status: { type: 'string', enum: Object.values(DocumentIngestStatus) },
                  size_bytes: { type: 'integer' },
                  mime_type: { type: 'string' },
                  content_hash: { type: 'string' },
                  existingDocument: { type: 'boolean' },
                  processing_job_id: { type: 'string', format: 'uuid' },
                  created_at: { type: 'string', format: 'date-time' }
                }
              },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' }
            }
          },
          ...this.getCommonErrorResponses()
        }
      }
    }, DocumentController.uploadDocument as RouteHandlerMethod);

    // 📋 获取文档列表API
    server.get('/v1/documents', {
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
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  documents: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        doc_id: { type: 'string', format: 'uuid' },
                        filename: { type: 'string' },
                        size_bytes: { type: 'integer' },
                        mime_type: { type: 'string' },
                        ingest_status: { type: 'string', enum: Object.values(DocumentIngestStatus) },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      current: { type: 'integer' },
                      total: { type: 'integer' },
                      pages: { type: 'integer' },
                      limit: { type: 'integer' },
                      hasNext: { type: 'boolean' },
                      hasPrev: { type: 'boolean' }
                    }
                  }
                }
              },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' }
            }
          },
          ...this.getCommonErrorResponses()
        }
      }
    }, DocumentController.getDocumentList as RouteHandlerMethod);

    // 📄 获取文档详情API
    server.get('/v1/documents/:docId', {
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
              description: '文档唯一标识符'
            }
          },
          required: ['docId']
        },
        response: {
          200: {
            description: '获取文档详情成功',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  doc_id: { type: 'string', format: 'uuid' },
                  filename: { type: 'string' },
                  size_bytes: { type: 'integer' },
                  mime_type: { type: 'string' },
                  ingest_status: { type: 'string', enum: Object.values(DocumentIngestStatus) },
                  downloadUrl: { type: 'string', format: 'uri' },
                  canDownload: { type: 'boolean' },
                  canDelete: { type: 'boolean' },
                  canReprocess: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' }
                }
              },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' }
            }
          },
          ...this.getCommonErrorResponses()
        }
      }
    }, DocumentController.getDocumentDetail as RouteHandlerMethod);

    // 📊 获取文档处理状态API
    server.get('/v1/documents/:docId/status', {
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
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  document: {
                    type: 'object',
                    properties: {
                      doc_id: { type: 'string', format: 'uuid' },
                      filename: { type: 'string' },
                      ingest_status: { type: 'string', enum: Object.values(DocumentIngestStatus) }
                    }
                  },
                  progress: {
                    type: 'object',
                    properties: {
                      stage: { type: 'string' },
                      percentage: { type: 'integer', minimum: 0, maximum: 100 },
                      message: { type: 'string' }
                    }
                  }
                }
              },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' }
            }
          },
          ...this.getCommonErrorResponses()
        }
      }
    }, DocumentController.getDocumentStatus as RouteHandlerMethod);

    // 🗑️ 删除文档API
    server.delete('/v1/documents/:docId', {
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
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' }
            }
          },
          ...this.getCommonErrorResponses()
        }
      }
    }, DocumentController.deleteDocument as RouteHandlerMethod);

    // 🔄 重新处理文档API
    server.post('/v1/documents/:docId/reprocess', {
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
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  jobs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        job_id: { type: 'string', format: 'uuid' },
                        job_type: { type: 'string' },
                        status: { type: 'string' },
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
          ...this.getCommonErrorResponses()
        }
      }
    }, DocumentController.reprocessDocument as RouteHandlerMethod);

    // 📥 下载文档API
    server.get('/v1/documents/:docId/download', {
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
          ...this.getCommonErrorResponses()
        }
      }
    }, DocumentController.downloadDocument as RouteHandlerMethod);

    console.log('✅ 文档路由注册完成（包含完整Swagger文档）');
  }

  /**
   * 获取通用错误响应Schema
   * @returns 错误响应定义
   */
  private static getCommonErrorResponses() {
    return {
      400: {
        description: '请求参数错误',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' }
        }
      },
      401: {
        description: '用户未认证',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' }
        }
      },
      403: {
        description: '权限不足',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' }
        }
      },
      404: {
        description: '资源不存在',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' }
        }
      },
      500: {
        description: '服务器内部错误',
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          message: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' }
        }
      }
    };
  }
}

export default DocumentRoutes;