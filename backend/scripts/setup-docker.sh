#!/bin/bash
# scripts/setup-docker.sh
# Docker基础设施设置脚本

set -e

echo "🐳 开始设置AI题目生成器基础设施..."

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p data/qdrant
mkdir -p data/redis  
mkdir -p data/minio
mkdir -p logs

# 设置目录权限
echo "🔐 设置目录权限..."
chmod 755 data/qdrant
chmod 755 data/redis
chmod 755 data/minio

# 启动服务
echo "🚀 启动Docker服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🏥 检查服务健康状态..."

check_service() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo "检查 $service_name..."
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo "✅ $service_name 启动成功"
            return 0
        fi
        echo "⏳ $service_name 启动中... (尝试 $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name 启动失败"
    return 1
}

# 检查各个服务
check_service "Qdrant" "http://localhost:6333/collections"

# Redis 特殊检查（使用 docker exec）
check_redis() {
    local max_attempts=30
    local attempt=1
    
    echo "检查 Redis..."
    while [ $attempt -le $max_attempts ]; do
        if docker exec -i ai-generator-redis redis-cli ping > /dev/null 2>&1; then
            echo "✅ Redis 启动成功"
            return 0
        fi
        echo "⏳ Redis 启动中... (尝试 $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Redis 启动失败"
    return 1
}

check_redis
check_service "MinIO" "http://localhost:9000/minio/health/live"

# 显示服务访问信息
echo ""
echo "🎉 基础设施设置完成！"
echo ""
echo "📊 服务访问地址："
echo "  Qdrant向量数据库: http://localhost:6333"
echo "  Redis缓存:       redis://localhost:6379"
echo "  MinIO对象存储:   http://localhost:9000"
echo "  MinIO管理界面:   http://localhost:9001 (minioadmin/minioadmin123)"
echo ""
echo "🔧 常用命令："
echo "  查看日志: docker-compose logs -f [service_name]"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart [service_name]"
echo ""

# 创建MinIO存储桶
echo "🪣 创建MinIO存储桶..."
docker-compose exec -T minio mc alias set local http://localhost:9000 minioadmin minioadmin123 || true
docker-compose exec -T minio mc mb local/documents || echo "存储桶已存在"
docker-compose exec -T minio mc mb local/uploads || echo "存储桶已存在"

echo "✅ 设置完成！可以开始开发了。"