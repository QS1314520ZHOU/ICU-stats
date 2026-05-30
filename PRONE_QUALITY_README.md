# ICU 俯卧位质控报表功能说明

## 功能概述

本功能实现了 ICU 俯卧位治疗的质控数据统计和报表展示，包括以下核心指标：

1. **俯卧位实施例次** - 统计时间范围内的俯卧位治疗次数
2. **单次时长达标率** - 单次俯卧位时长 ≥ 16 小时的比例
3. **适应症符合率** - 俯卧位开始前 PF < 150 的比例
4. **治疗启动及时性** - PF < 150 到首次俯卧位开始的时间
5. **治疗有效率** - 结束后 4 小时内 PF 较治疗前提升 ≥ 20% 的比例
6. **累计俯卧位时长** - 所有有效俯卧位的总时长
7. **异常数据率** - 未闭合 session、时长 <2h 或 >24h 等异常数据的比例

## 技术架构

### 后端 (Node.js + Express + MongoDB)

```
backend/
├── routes/
│   └── prone.js              # 俯卧位质控 API 路由
├── utils/
│   ├── proneSessionUtils.js  # 俯卧位治疗记录配对和指标计算
│   └── proneQualityUtils.js  # 质控汇总计算
├── cron/
│   ├── proneQualityCron.js   # 定时任务逻辑
│   └── scheduler.js          # 任务调度器
└── test-prone.js             # 测试脚本
```

### 前端 (HTML + JavaScript)

```
frontend/
└── prone.html                # 俯卧位质控报表页面
```

### 数据库集合

```
SmartCare/
├── bedside                   # 体位记录（原始数据）
├── patient                   # 患者信息
├── bGATemp                   # 血气结果
├── prone_session             # 配对后的俯卧位治疗记录（新增）
└── prone_quality_daily       # 每日质控汇总（新增）
```

## API 接口

### 1. 获取质控汇总数据

**请求：**
```
GET /api/prone/quality-summary
```

**参数：**
- `startDate` (必填) - 开始日期，格式：YYYY-MM-DD
- `endDate` (必填) - 结束日期，格式：YYYY-MM-DD
- `deptCode` (可选) - 科室编码

**响应：**
```json
{
  "code": 0,
  "data": {
    "hospitalSummary": {
      "totalSessions": 100,
      "validSessions": 95,
      "abnormalSessions": 5,
      "durationMetRate": 85.5,
      "indicationMetRate": 90.2,
      "effectiveRate": 75.8,
      "totalDurationHours": 1500.5,
      "abnormalRate": 5.0
    },
    "deptDetails": [...],
    "dateRange": { "startDate": "2026-01-01", "endDate": "2026-05-30" }
  }
}
```

### 2. 获取俯卧位治疗明细

**请求：**
```
GET /api/prone/session-details
```

**参数：**
- `startDate` (必填) - 开始日期
- `endDate` (必填) - 结束日期
- `deptCode` (可选) - 科室编码
- `isAbnormal` (可选) - 是否只显示异常数据（true/false）

**响应：**
```json
{
  "code": 0,
  "data": {
    "total": 50,
    "details": [
      {
        "pid": "69ee2b40d9c3b55906192b69",
        "patientName": "张***",
        "mrn": "1557147",
        "bed": "14",
        "bedDoctor": "秦***",
        "startTime": "2026-04-27T08:00:00Z",
        "endTime": "2026-04-28T02:00:00Z",
        "durationHours": 18.0,
        "prePFRatio": 120,
        "postPFRatio": 180,
        "pfImprovementRate": 50.0,
        "isAbnormal": false
      }
    ]
  }
}
```

### 3. 获取每日趋势

**请求：**
```
GET /api/prone/daily-trend
```

**参数：**
- `startDate` (必填) - 开始日期
- `endDate` (必填) - 结束日期
- `deptCode` (可选) - 科室编码

**响应：**
```json
{
  "code": 0,
  "data": {
    "trend": [
      {
        "date": "2026-04-01",
        "totalSessions": 5,
        "validSessions": 5,
        "durationMetRate": 80.0
      }
    ],
    "dateRange": { "startDate": "2026-04-01", "endDate": "2026-04-30" }
  }
}
```

### 4. 导出 Excel

**请求：**
```
GET /api/prone/export
```

**参数：**
- `startDate` (必填) - 开始日期
- `endDate` (必填) - 结束日期
- `deptCode` (可选) - 科室编码

**响应：**
- Content-Type: text/csv; charset=utf-8
- 文件名：prone_quality_{startDate}_{endDate}.csv

## 业务规则

### 配对规则

1. **一次俯卧位定义**：同一 pid 下一组有效"俯卧位开始"和"俯卧位结束"按 time 升序配对形成的 session
2. **配对逻辑**：
   - 按 pid 分组，组内按 time 升序排序
   - 遇到"俯卧位开始"记录为 pending_start
   - 遇到"俯卧位结束"时，如果有 pending_start 则配对成功
   - 遍历结束后，如果仍有 pending_start 则标记为"未闭合"

### 异常规则

| 异常类型 | 判断条件 | 处理方式 |
|----------|----------|----------|
| 未闭合 | 有开始事件，无结束事件 | 标记 `isUnclosed=true`，不纳入达标率分子分母 |
| 时长过短 | `durationHours < 2` | 标记 `isDurationAbnormal=true`，纳入异常数据率 |
| 时长过长 | `durationHours > 24` | 标记 `isDurationAbnormal=true`，纳入异常数据率 |
| 顺序异常 | 结束时间早于开始时间 | 标记 `isSequenceAbnormal=true`，纳入异常数据率 |
| 孤立结束 | 有结束事件，无对应开始 | 标记 `isOrphanEnd=true`，纳入异常数据率 |

### 血气关联规则

**关联路径**：
```
bedside.pid → patient._id → patient.mrn → bGATemp.mrn
```

**时间窗口**：
- **治疗前 PF**：俯卧位开始前 6 小时内最近一次动脉血气
- **治疗后 PF**：俯卧位结束后 4 小时内最近一次动脉血气

**PF 计算公式**：
```javascript
pao2 = bedsides.find(b => b.code === "param_bg_po2")?.fVal
fio2 = bedsides.find(b => b.code === "param_bg_FiO2")?.fVal

if (fio2 > 0 && pao2 != null) {
  pfRatio = pao2 / (fio2 / 100)
} else {
  pfRatio = null
}
```

## 配置参数

可通过环境变量配置以下参数：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PRONE_DURATION_THRESHOLD` | 16 | 单次时长达标阈值（小时） |
| `PRONE_INDICATION_THRESHOLD` | 150 | 适应症 PF 阈值（mmHg） |
| `PRONE_EFFECTIVE_THRESHOLD` | 20 | 治疗有效 PF 提升阈值（%） |
| `PRONE_PRE_BGA_WINDOW` | 6 | 治疗前血气时间窗口（小时） |
| `PRONE_POST_BGA_WINDOW` | 4 | 治疗后血气时间窗口（小时） |
| `PRONE_ABNORMAL_DURATION_MIN` | 2 | 异常时长下限（小时） |
| `PRONE_ABNORMAL_DURATION_MAX` | 24 | 异常时长上限（小时） |
| `PRONE_UNCLOSED_TIMEOUT` | 24 | 未闭合超时（小时） |

## 定时任务

每日凌晨 2:00 自动执行以下任务：

1. 计算前一日的俯卧位治疗记录
2. 计算质控指标
3. 保存到 `prone_session` 和 `prone_quality_daily` 集合

## 使用说明

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 验证集合结构

```bash
node validate-schema.js
```

### 3. 运行测试

```bash
node test-prone.js
```

### 4. 启动服务

```bash
npm start
```

### 5. 访问报表

打开浏览器访问：`http://localhost:3000/prone.html`

## 数据库操作安全约束

### 只读操作（允许）

- `find` - 查询文档
- `findOne` - 查询单个文档
- `countDocuments` - 统计文档数量
- `aggregate` - 聚合查询
- `distinct` - 去重查询
- `getCollectionNames` - 获取集合列表
- `getCollectionInfos` - 获取集合信息
- `getIndexes` - 获取索引信息

### 写操作（需要二次确认）

- `insertOne` - 插入文档
- `updateOne` - 更新文档
- `deleteOne` - 删除文档
- `drop` - 删除集合
- `createCollection` - 创建集合
- `createIndex` - 创建索引

## 故障排查

### 1. 数据不显示

检查以下项目：
- 日期范围是否正确
- 科室编码是否存在
- bedside 集合中是否有 `code="param_TiWei"` 的记录
- bGATemp 集合中是否有 `eventExe.code="event_blood_gas_A"` 的记录

### 2. PF 比值计算错误

检查以下项目：
- PaO2 编码是否为 `param_bg_po2`
- FiO2 编码是否为 `param_bg_FiO2`
- FiO2 值是否为百分比（如 40 表示 40%）
- PaO2 和 FiO2 是否来自同一条血气记录

### 3. 配对异常

检查以下项目：
- 俯卧位事件是否有孤立的开始或结束
- 事件时间是否正确排序
- valid 字段是否为 true

## 扩展功能

### 1. 添加新的质控指标

在 `proneSessionUtils.js` 的 `calculateSessionIndicators` 函数中添加新的计算逻辑。

### 2. 修改配对规则

在 `proneSessionUtils.js` 的 `pairEvents` 函数中修改配对算法。

### 3. 调整时间窗口

通过环境变量或修改 `proneSessionUtils.js` 中的 `config` 对象。

## 联系方式

如有问题或建议，请联系开发团队。
