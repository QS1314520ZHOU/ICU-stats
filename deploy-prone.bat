@echo off
REM 俯卧位质控功能部署脚本 (Windows)

echo 开始部署俯卧位质控功能...

REM 1. 检查 Node.js 环境
echo 检查 Node.js 环境...
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装 Node.js
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js 版本: %NODE_VERSION%

REM 2. 检查 MongoDB 连接
echo 检查 MongoDB 连接...
npx mongosh "mongodb://localhost:27017" --quiet --eval "db.adminCommand({ping:1})" >nul 2>&1
if errorlevel 1 (
    echo ❌ MongoDB 连接失败，请检查 MongoDB 服务
    pause
    exit /b 1
)

echo ✅ MongoDB 连接正常

REM 3. 检查 SmartCare 数据库
echo 检查 SmartCare 数据库...
npx mongosh "mongodb://localhost:27017" --quiet --eval "show dbs" | findstr "SmartCare" >nul 2>&1
if errorlevel 1 (
    echo ❌ SmartCare 数据库不存在
    pause
    exit /b 1
)

echo ✅ SmartCare 数据库存在

REM 4. 安装依赖
echo 安装依赖...
cd backend
call npm install

echo ✅ 依赖安装完成

REM 5. 验证集合结构
echo 验证集合结构...
node validate-schema.js

echo ✅ 集合结构验证完成

REM 6. 运行测试
echo 运行功能测试...
node test-prone.js

echo ✅ 功能测试完成

REM 7. 启动服务
echo 启动服务...
echo 服务地址: http://localhost:3000
echo 俯卧位质控报表: http://localhost:3000/prone.html
echo.
echo 按 Ctrl+C 停止服务
npm start
