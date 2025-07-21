// src/config/SwaggerConfig.ts

import { FastifyInstance } from 'fastify';
import { DocumentIngestStatus } from '@/models/Document';
import { JobType, JobStatus } from '@/models/ProcessingJob';

/**
 * Swagger/OpenAPI配置类
 * 提供完整的API文档配置和schema定义
 */
export class SwaggerConfig {
  /**
   * 获取Swagger配置
   * @returns Swagger配置对象
   */
  public static getSwaggerOptions() {
    return {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'AI Question Generator API',
          description: `
# AI题目生成器 API 文档

基于AI的智能题目生成系统后端API，提供文档上传、解析、向量化和问答生成功能。

## 功能特性
- 🔐 JWT用户认证
- 📄 多格式文档上传 (PDF, Markdown, Text)
- ⚙️ 异步文档解析
- 🔍 智能文档检索
- 🤖 AI问答生成
- 📊 实时处理进度

## 认证说明
所有需要认证的接口都需要在请求头中包含JWT token：
\`\`\`
Authorization: Bearer YOUR_JWT_TOKEN
\`\`\`

## 错误格式
所有错误响应都遵循统一格式：
\`\`\`json
{
  "success": false,
  "error": "错误类型",
  "message": "详细错误信息", 
  "timestamp": "2024-01-15T10:30:00.123Z",
  "requestId": "req-123"
}
\`\`\`
          `,
          version: process.env.npm_package_version || '1.0.0',
          contact: {
            name: 'API Support',
            email: 'support@ai-generator.com'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: process.env.API_BASE_URL || 'http://localhost:8000',
            description: process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT认证token，格式：Bearer {token}'
            }
          },
          schemas: {
            // 基础响应类型
            BaseResponse: {
              type: 'object',
              properties: {
                success: { 
                  type: 'boolean', 
                  description: '请求是否成功' 
                },
                message: { 
                  type: 'string', 
                  description: '响应消息' 
                },
                data: { 
                  description: '响应数据' 
                },
                error: { 
                  type: 'string', 
                  description: '错误信息' 
                },
                timestamp: { 
                  type: 'string', 
                  format: 'date-time', 
                  description: '响应时间戳' 
                },
                requestId: { 
                  type: 'string', 
                  description: '请求ID，用于追踪' 
                }
              },
              required: ['success', 'timestamp']
            },

            // 分页信息
            PaginationInfo: {
              type: 'object',
              properties: {
                current: { type: 'integer', description: '当前页码' },
                total: { type: 'integer', description: '总记录数' },
                pages: { type: 'integer', description: '总页数' },
                limit: { type: 'integer', description: '每页记录数' },
                hasNext: { type: 'boolean', description: '是否有下一页' },
                hasPrev: { type: 'boolean', description: '是否有上一页' }
              }
            },

            // 文档状态枚举
            DocumentIngestStatus: {
              type: 'string',
              enum: Object.values(DocumentIngestStatus),
              description: '文档处理状态',
              example: 'uploaded'
            },

            // 作业类型枚举  
            JobType: {
              type: 'string',
              enum: Object.values(JobType),
              description: '处理作业类型',
              example: 'parse_pdf'
            },

            // 作业状态枚举
            JobStatus: {
              type: 'string', 
              enum: Object.values(JobStatus),
              description: '作业执行状态',
              example: 'processing'
            },

            // 文档对象
            Document: {
              type: 'object',
              properties: {
                doc_id: { 
                  type: 'string', 
                  format: 'uuid', 
                  description: '文档唯一标识符' 
                },
                user_id: { 
                  type: 'string', 
                  format: 'uuid', 
                  description: '文档所有者用户ID' 
                },
                filename: { 
                  type: 'string', 
                  description: '原始文件名',
                  example: 'document.pdf'
                },
                content_hash: { 
                  type: 'string', 
                  description: '文件内容SHA256哈希值' 
                },
                mime_type: { 
                  type: 'string', 
                  description: 'MIME类型',
                  enum: ['application/pdf', 'text/markdown', 'text/plain']
                },
                size_bytes: { 
                  type: 'integer', 
                  description: '文件大小（字节）',
                  example: 2048576
                },
                storage_path: { 
                  type: 'string', 
                  description: '存储路径' 
                },
                storage_bucket: { 
                  type: 'string', 
                  description: '存储桶名称',
                  default: 'documents'
                },
                page_count: { 
                  type: 'integer', 
                  description: 'PDF页数（仅PDF文档）',
                  nullable: true 
                },
                language: { 
                  type: 'string', 
                  description: '文档语言',
                  example: 'zh-CN'
                },
                text_length: { 
                  type: 'integer', 
                  description: '提取的文本长度',
                  nullable: true 
                },
                token_estimate: { 
                  type: 'integer', 
                  description: '估算的token数量',
                  nullable: true 
                },
                ingest_status: { 
                  $ref: '#/components/schemas/DocumentIngestStatus' 
                },
                error_message: { 
                  type: 'string', 
                  description: '处理错误信息',
                  nullable: true 
                },
                metadata: { 
                  type: 'object', 
                  description: '文档元数据',
                  additionalProperties: true
                },
                created_at: { 
                  type: 'string', 
                  format: 'date-time', 
                  description: '创建时间' 
                },
                updated_at: { 
                  type: 'string', 
                  format: 'date-time', 
                  description: '更新时间' 
                }
              },
              required: ['doc_id', 'user_id', 'filename', 'content_hash', 'mime_type', 'size_bytes', 'ingest_status']
            },

            // 处理作业对象
            ProcessingJob: {
              type: 'object',
              properties: {
                job_id: { 
                  type: 'string', 
                  format: 'uuid', 
                  description: '作业唯一标识符' 
                },
                doc_id: { 
                  type: 'string', 
                  format: 'uuid', 
                  description: '关联的文档ID' 
                },
                user_id: { 
                  type: 'string', 
                  format: 'uuid', 
                  description: '作业发起用户ID' 
                },
                job_type: { 
                  $ref: '#/components/schemas/JobType' 
                },
                status: { 
                  $ref: '#/components/schemas/JobStatus' 
                },
                priority: { 
                  type: 'integer', 
                  description: '作业优先级（1-10）',
                  minimum: 1,
                  maximum: 10
                },
                progress_current: { 
                  type: 'integer', 
                  description: '当前进度' 
                },
                progress_total: { 
                  type: 'integer', 
                  description: '总进度' 
                },
                progress_percentage: { 
                  type: 'number', 
                  description: '进度百分比',
                  minimum: 0,
                  maximum: 100
                },
                progress_message: { 
                  type: 'string', 
                  description: '进度描述信息',
                  nullable: true
                },
                attempts: { 
                  type: 'integer', 
                  description: '已尝试次数' 
                },
                max_attempts: { 
                  type: 'integer', 
                  description: '最大重试次数' 
                },
                error_message: { 
                  type: 'string', 
                  description: '错误信息',
                  nullable: true 
                },
                created_at: { 
                  type: 'string', 
                  format: 'date-time', 
                  description: '创建时间' 
                },
                started_at: { 
                  type: 'string', 
                  format: 'date-time', 
                  description: '开始处理时间',
                  nullable: true 
                },
                completed_at: { 
                  type: 'string', 
                  format: 'date-time', 
                  description: '完成时间',
                  nullable: true 
                }
              }
            },

            // 文档上传响应
            DocumentUploadResponse: {
              allOf: [
                { $ref: '#/components/schemas/BaseResponse' },
                {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        doc_id: { type: 'string', format: 'uuid' },
                        filename: { type: 'string' },
                        status: { $ref: '#/components/schemas/DocumentIngestStatus' },
                        size_bytes: { type: 'integer' },
                        mime_type: { type: 'string' },
                        content_hash: { type: 'string' },
                        existingDocument: { type: 'boolean' },
                        processing_job_id: { type: 'string', format: 'uuid' },
                        created_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              ]
            },

            // 文档列表响应
            DocumentListResponse: {
              allOf: [
                { $ref: '#/components/schemas/BaseResponse' },
                {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        documents: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Document' }
                        },
                        pagination: { $ref: '#/components/schemas/PaginationInfo' },
                        statistics: {
                          type: 'object',
                          properties: {
                            total: { type: 'integer' },
                            byStatus: {
                              type: 'object',
                              additionalProperties: { type: 'integer' }
                            },
                            totalSize: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              ]
            },

            // 文档详情响应
            DocumentDetailResponse: {
              allOf: [
                { $ref: '#/components/schemas/BaseResponse' },
                {
                  type: 'object',
                  properties: {
                    data: {
                      allOf: [
                        { $ref: '#/components/schemas/Document' },
                        {
                          type: 'object',
                          properties: {
                            downloadUrl: { 
                              type: 'string', 
                              format: 'uri', 
                              description: '下载链接',
                              nullable: true 
                            },
                            processingJobs: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/ProcessingJob' }
                            },
                            canDownload: { 
                              type: 'boolean', 
                              description: '是否可以下载' 
                            },
                            canDelete: { 
                              type: 'boolean', 
                              description: '是否可以删除' 
                            },
                            canReprocess: { 
                              type: 'boolean', 
                              description: '是否可以重新处理' 
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              ]
            },

            // 文档处理进度响应
            DocumentProgressResponse: {
              allOf: [
                { $ref: '#/components/schemas/BaseResponse' },
                {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        document: { $ref: '#/components/schemas/Document' },
                        currentJob: { 
                          $ref: '#/components/schemas/ProcessingJob',
                          nullable: true 
                        },
                        progress: {
                          type: 'object',
                          properties: {
                            stage: { 
                              type: 'string', 
                              description: '当前处理阶段',
                              example: '解析中'
                            },
                            percentage: { 
                              type: 'integer', 
                              description: '完成百分比',
                              minimum: 0,
                              maximum: 100
                            },
                            message: { 
                              type: 'string', 
                              description: '进度描述',
                              example: '正在解析PDF第3页...'
                            },
                            estimatedTimeRemaining: { 
                              type: 'integer', 
                              description: '预计剩余时间（秒）',
                              nullable: true
                            }
                          }
                        }
                      }
                    }
                  }
                }
              ]
            },

            // 错误响应
            ErrorResponse: {
              allOf: [
                { $ref: '#/components/schemas/BaseResponse' },
                {
                  type: 'object',
                  properties: {
                    success: { 
                      type: 'boolean', 
                      enum: [false] 
                    },
                    error: { 
                      type: 'string', 
                      description: '错误类型' 
                    },
                    message: { 
                      type: 'string', 
                      description: '详细错误信息' 
                    }
                  },
                  required: ['success', 'error']
                }
              ]
            }
          }
        },
        tags: [
          {
            name: 'Health',
            description: '系统健康检查接口'
          },
          {
            name: 'Documents', 
            description: '文档管理接口'
          },
          {
            name: 'Authentication',
            description: '用户认证接口（计划中）'
          }
        ]
      },
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true
      },
      uiHooks: {
        onRequest: function (request: any, reply: any, next: any) {
          // 可以在这里添加自定义的UI钩子
          next();
        },
        preHandler: function (request: any, reply: any, next: any) {
          // 可以在这里添加预处理逻辑
          next();
        }
      },
      staticCSP: true,
      transformStaticCSP: (header: string) => header,
      exposeRoute: true,
      hiddenTag: 'X-HIDDEN',
      hideUntagged: false
    };
  }

  /**
   * 获取Swagger UI配置
   * @returns Swagger UI配置对象
   */
  public static getSwaggerUIOptions() {
    return {
      routePrefix: '/docs',
      theme: {
        title: 'AI Question Generator API Documentation'
      },
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        tryItOutEnabled: true,
        filter: true,
        layout: 'StandaloneLayout',
        defaultModelsExpandDepth: 1,
        showExtensions: true,
        showCommonExtensions: true,
        useUnsafeMarkdown: false
      },
      staticCSP: true,
      transformStaticCSP: (header: string) => header
    };
  }

  /**
   * 注册Swagger插件
   * @param server Fastify服务器实例
   */
  public static async registerSwagger(server: FastifyInstance): Promise<void> {
    try {
      // 注册Swagger生成插件
      await server.register(require('@fastify/swagger'), this.getSwaggerOptions());

      // 注册Swagger UI插件
      await server.register(require('@fastify/swagger-ui'), this.getSwaggerUIOptions());

      console.log('✅ Swagger文档插件注册完成');
      console.log(`📚 文档地址: ${process.env.API_BASE_URL || 'http://localhost:8000'}/docs`);
      
    } catch (error) {
      console.error('❌ Swagger插件注册失败:', error);
      throw error;
    }
  }

  /**
   * 生成通用错误响应schema
   * @param statusCode HTTP状态码
   * @param description 错误描述
   * @returns 错误响应schema
   */
  public static getErrorResponseSchema(statusCode: number, description: string) {
    return {
      description,
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [false] },
        error: { type: 'string' },
        message: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        requestId: { type: 'string' }
      },
      example: {
        success: false,
        error: this.getErrorTypeByStatusCode(statusCode),
        message: description,
        timestamp: new Date().toISOString(),
        requestId: 'req-12345'
      }
    };
  }

  /**
   * 根据状态码获取错误类型
   * @param statusCode HTTP状态码
   * @returns 错误类型字符串
   */
  private static getErrorTypeByStatusCode(statusCode: number): string {
    const errorTypes: Record<number, string> = {
      400: '请求参数错误',
      401: '身份验证失败', 
      403: '权限不足',
      404: '资源未找到',
      409: '资源冲突',
      429: '请求过于频繁',
      500: '服务器内部错误',
      503: '服务暂时不可用'
    };
    return errorTypes[statusCode] || '未知错误';
  }
}

// 导出配置类
export default SwaggerConfig;