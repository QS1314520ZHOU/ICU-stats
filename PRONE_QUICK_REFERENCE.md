# ICU 俯卧位质控 - 快速参考

## 快速开始

### 1. 启动服务

```bash
# Linux/Mac
./start-prone.sh

# Windows
start-prone.bat

# 或手动启动
cd backend
npm install
npm start
```

### 2. 访问报表

```
http://localhost:3000/prone.html
```

### 3. 测试 API

```bash
# Linux/Mac
./test-api.sh

# Windows
test-api.bat
```

## API 速查

### 质控汇总

```bash
GET /api/prone/quality-summary?startDate=2026-04-01&endDate=2026-04-30
```

### 俯卧位治疗明细

```bash
GET /api/prone/session-details?startDate=2026-04-01&endDate=2026-04-30
```

### 每日趋势

```bash
GET /api/prone/daily-trend?startDate=2026-04-01&endDate=2026-04-30
```

### 导出 Excel

```bash
GET /api/prone/export?startDate=2026-04-01&endDate=2026-04-30
```

## 核心指标

| 指标 | 计算公式 | 默认阈值 |
|------|----------|----------|
| 时长达标率 | 时长≥16h的例次 / 有效例次 | ≥16小时 |
| 适应症符合率 | 治疗前PF<150的例次 / 有效例次 | <150 mmHg |
| 治疗有效率 | PF提升≥20%的例次 / 有效例次 | ≥20% |
| 异常数据率 | 异常例次 / 总例次 | - |

## 配对规则

```
俯卧位开始 + 俯卧位结束 → 一次俯卧位治疗

异常情况：
- 只有开始，没有结束 → 未闭合异常
- 时长 < 2小时 → 时长过短异常
- 时长 > 24小时 → 时长过长异常
- 结束早于开始 → 顺序异常
```

## 血气关联

```
bedside.pid → patient._id → patient.mrn → bGATemp.mrn

治疗前 PF: 开始前 6 小时内最近一次
治疗后 PF: 结束后 4 小时内最近一次

PF = PaO2 / (FiO2 / 100)
```

## 配置参数

```env
# .env 文件
PRONE_DURATION_THRESHOLD=16        # 时长达标阈值（小时）
PRONE_INDICATION_THRESHOLD=150     # 适应症 PF 阈值（mmHg）
PRONE_EFFECTIVE_THRESHOLD=20       # 有效性 PF 提升阈值（%）
PRONE_PRE_BGA_WINDOW=6             # 治疗前血气窗口（小时）
PRONE_POST_BGA_WINDOW=4            # 治疗后血气窗口（小时）
PRONE_ABNORMAL_DURATION_MIN=2      # 异常时长下限（小时）
PRONE_ABNORMAL_DURATION_MAX=24     # 异常时长上限（小时）
PRONE_UNCLOSED_TIMEOUT=24          # 未闭合超时（小时）
```

## 数据库查询

### 查看俯卧位事件

```javascript
db.bedside.find({
  code: "param_TiWei",
  strVal: { $in: ["俯卧位开始", "俯卧位结束"] },
  valid: true
}).limit(10)
```

### 查看血气数据

```javascript
db.bGATemp.find({
  "eventExe.code": "event_blood_gas_A",
  "eventExe.valid": true
}).limit(10)
```

### 查看俯卧位治疗数据

```javascript
db.prone_session.find().limit(10)
```

### 查看每日汇总

```javascript
db.prone_quality_daily.find().limit(10)
```

## 故障排查

### 数据不显示

1. 检查日期范围是否正确
2. 检查科室编码是否存在
3. 检查 bedside 集合是否有数据
4. 检查 bGATemp 集合是否有数据

### PF 计算错误

1. 检查 PaO2 编码是否为 `param_bg_po2`
2. 检查 FiO2 编码是否为 `param_bg_FiO2`
3. 检查 FiO2 值是否为百分比（40 = 40%）
4. 检查 PaO2 和 FiO2 是否来自同一条记录

### 配对异常

1. 检查是否有孤立的开始或结束事件
2. 检查事件时间是否正确排序
3. 检查 valid 字段是否为 true

### 服务启动失败

1. 检查 MongoDB 是否运行
2. 检查端口 3000 是否被占用
3. 检查依赖是否安装完整
4. 查看错误日志

## 常用命令

### 启动服务

```bash
cd backend
npm start
```

### 运行测试

```bash
cd backend
node test-prone.js
```

### 验证集合

```bash
cd backend
node validate-schema.js
```

### 手动计算

```bash
cd backend
node -e "
const { runManualQualityCalculation } = require('./cron/proneQualityCron');
runManualQualityCalculation('2026-04-15');
"
```

### 批量计算

```bash
cd backend
node -e "
const { runBatchQualityCalculation } = require('./cron/proneQualityCron');
runBatchQualityCalculation('2026-04-01', '2026-04-30');
"
```

## 文件位置

| 文件 | 位置 | 说明 |
|------|------|------|
| API 路由 | backend/routes/prone.js | 俯卧位质控接口 |
| 俯卧位治疗记录工具 | backend/utils/proneSessionUtils.js | 配对和计算 |
| 质控工具 | backend/utils/proneQualityUtils.js | 汇总和报表 |
| 定时任务 | backend/cron/proneQualityCron.js | 每日计算 |
| 前端页面 | frontend/prone.html | 报表界面 |
| 测试脚本 | backend/test-prone.js | 功能测试 |
| 验证脚本 | backend/validate-schema.js | 集合验证 |

## 联系支持

如有问题，请查看：
- `PRONE_QUALITY_README.md` - 详细说明
- `PRONE_QUALITY_SUMMARY.md` - 项目总结
- `PROJECT_STRUCTURE.md` - 项目结构
