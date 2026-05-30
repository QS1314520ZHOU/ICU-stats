@echo off
REM 俯卧位质控 API 测试脚本 (Windows)

echo === 俯卧位质控 API 测试 ===
echo.

set BASE_URL=http://localhost:3000
set API_BASE=%BASE_URL%/api/prone

REM 检查服务是否运行
echo 检查服务状态...
curl -s "%BASE_URL%" >nul 2>&1
if errorlevel 1 (
    echo ❌ 服务未运行，请先启动服务
    echo 运行: start-prone.bat
    pause
    exit /b 1
)

echo ✅ 服务运行正常
echo.

REM 测试质控汇总接口
echo 1. 测试质控汇总接口
echo GET %API_BASE%/quality-summary
echo 参数: startDate=2026-04-01, endDate=2026-04-30
echo.

curl -s "%API_BASE%/quality-summary?startDate=2026-04-01&endDate=2026-04-30"
echo.
echo.

REM 测试 Session 明细接口
echo 2. 测试 Session 明细接口
echo GET %API_BASE%/session-details
echo 参数: startDate=2026-04-01, endDate=2026-04-30
echo.

curl -s "%API_BASE%/session-details?startDate=2026-04-01&endDate=2026-04-30"
echo.
echo.

REM 测试每日趋势接口
echo 3. 测试每日趋势接口
echo GET %API_BASE%/daily-trend
echo 参数: startDate=2026-04-01, endDate=2026-04-30
echo.

curl -s "%API_BASE%/daily-trend?startDate=2026-04-01&endDate=2026-04-30"
echo.
echo.

REM 测试导出接口
echo 4. 测试导出接口
echo GET %API_BASE%/export
echo 参数: startDate=2026-04-01, endDate=2026-04-30
echo.

curl -s -I "%API_BASE%/export?startDate=2026-04-01&endDate=2026-04-30"
echo.

echo === API 测试完成 ===
echo.
echo 前端页面: %BASE_URL%/prone.html
pause
