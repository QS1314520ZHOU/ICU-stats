#!/bin/bash

# 俯卧位质控功能部署脚本

set -e

echo "开始部署俯卧位质控功能..."

# 1. 检查 Node.js 环境
echo "检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js 版本: $NODE_VERSION"

# 2. 检查 MongoDB 连接
echo "检查 MongoDB 连接..."
if ! mongosh "mongodb://localhost:27017" --quiet --eval "db.adminCommand({ping:1})" &> /dev/null; then
    echo "❌ MongoDB 连接失败，请检查 MongoDB 服务"
    exit 1
fi

echo "✅ MongoDB 连接正常"

# 3. 检查 SmartCare 数据库
echo "检查 SmartCare 数据库..."
if ! mongosh "mongodb://localhost:27017" --quiet --eval "show dbs" | grep -q "SmartCare"; then
    echo "❌ SmartCare 数据库不存在"
    exit 1
fi

echo "✅ SmartCare 数据库存在"

# 4. 安装依赖
echo "安装依赖..."
cd backend
npm install

echo "✅ 依赖安装完成"

# 5. 验证集合结构
echo "验证集合结构..."
node validate-schema.js

echo "✅ 集合结构验证完成"

# 6. 运行测试
echo "运行功能测试..."
node test-prone.js

echo "✅ 功能测试完成"

# 7. 启动服务
echo "启动服务..."
echo "服务地址: http://localhost:3000"
echo "俯卧位质控报表: http://localhost:3000/prone.html"
echo ""
echo "按 Ctrl+C 停止服务"
npm start
