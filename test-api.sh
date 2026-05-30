#!/bin/bash

# 俯卧位质控 API 测试脚本

BASE_URL="http://localhost:3000"
API_BASE="$BASE_URL/api/prone"

echo "=== 俯卧位质控 API 测试 ==="
echo ""

# 检查服务是否运行
echo "检查服务状态..."
if ! curl -s "$BASE_URL" > /dev/null; then
    echo "❌ 服务未运行，请先启动服务"
    echo "运行: ./start-prone.sh 或 start-prone.bat"
    exit 1
fi

echo "✅ 服务运行正常"
echo ""

# 测试质控汇总接口
echo "1. 测试质控汇总接口"
echo "GET $API_BASE/quality-summary"
echo "参数: startDate=2026-04-01, endDate=2026-04-30"
echo ""

RESPONSE=$(curl -s "$API_BASE/quality-summary?startDate=2026-04-01&endDate=2026-04-30")
echo "响应: $RESPONSE" | head -c 500
echo ""
echo ""

# 测试 Session 明细接口
echo "2. 测试 Session 明细接口"
echo "GET $API_BASE/session-details"
echo "参数: startDate=2026-04-01, endDate=2026-04-30"
echo ""

RESPONSE=$(curl -s "$API_BASE/session-details?startDate=2026-04-01&endDate=2026-04-30")
echo "响应: $RESPONSE" | head -c 500
echo ""
echo ""

# 测试每日趋势接口
echo "3. 测试每日趋势接口"
echo "GET $API_BASE/daily-trend"
echo "参数: startDate=2026-04-01, endDate=2026-04-30"
echo ""

RESPONSE=$(curl -s "$API_BASE/daily-trend?startDate=2026-04-01&endDate=2026-04-30")
echo "响应: $RESPONSE" | head -c 500
echo ""
echo ""

# 测试导出接口
echo "4. 测试导出接口"
echo "GET $API_BASE/export"
echo "参数: startDate=2026-04-01, endDate=2026-04-30"
echo ""

RESPONSE=$(curl -s -I "$API_BASE/export?startDate=2026-04-01&endDate=2026-04-30")
echo "响应头: $RESPONSE"
echo ""

echo "=== API 测试完成 ==="
echo ""
echo "前端页面: $BASE_URL/prone.html"
