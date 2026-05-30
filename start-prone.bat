@echo off
REM 快速启动俯卧位质控服务 (Windows)

echo 启动俯卧位质控服务...

cd backend

REM 检查依赖是否安装
if not exist "node_modules" (
    echo 安装依赖...
    call npm install
)

REM 启动服务
echo 服务地址: http://localhost:3000
echo 俯卧位质控报表: http://localhost:3000/prone.html
echo.
echo 按 Ctrl+C 停止服务
npm start
