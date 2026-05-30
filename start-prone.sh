#!/bin/bash

# 快速启动俯卧位质控服务

echo "启动俯卧位质控服务..."

cd backend

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
fi

# 启动服务
echo "服务地址: http://localhost:3000"
echo "俯卧位质控报表: http://localhost:3000/prone.html"
echo ""
echo "按 Ctrl+C 停止服务"
npm start
