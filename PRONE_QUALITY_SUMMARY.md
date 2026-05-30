# ICU 俯卧位质控报表 - 项目总结

## 项目概述

本项目实现了 ICU 俯卧位治疗的质控数据统计和报表展示功能，基于现有的 SmartCare 数据库，通过分析俯卧位事件记录和血气数据，计算各项质控指标。

## 实现的功能

### 1. 核心质控指标

| 指标 | 计算逻辑 | 数据来源 |
|------|----------|----------|
| 俯卧位实施例次 | 统计有效"俯卧位开始"事件数量 | bedside 集合 |
| 单次时长达标率 | 单次时长 ≥ 16小时的例次 / 有效例次 | bedside 集合 |
| 适应症符合率 | 治疗前 PF < 150 的例次 / 有效例次 | bedside + bGATemp |
| 治疗有效率 | PF 提升 ≥ 20% 的例次 / 有效例次 | bedside + bGATemp |
| 累计俯卧位时长 | 所有有效俯卧位的总时长 | bedside 集合 |
| 异常数据率 | 异常例次 / 总例次 | bedside 集合 |

### 2. 数据处理流程

```
原始数据 → 事件配对 → 血气关联 → 指标计算 → 汇总统计
   ↓           ↓           ↓           ↓           ↓
 bedside    pairEvents   enrichWith   calculate   aggregate
   ↓           ↓         BGA          Indicators   ↓
 patient    sessions     PF值         ↓         daily_summary
   ↓                                    ↓
 bGATemp                           quality_report
```

### 3. 技术实现

#### 后端架构

- **Node.js + Express** - Web 框架
- **MongoDB** - 数据库
- **node-cron** - 定时任务

#### 核心模块

1. **proneSessionUtils.js** - 俯卧位治疗记录配对和指标计算
   - `generateProneSessions()` - 生成俯卧位治疗记录
   - `pairEvents()` - 配对开始/结束事件
   - `enrichSessionsWithBga()` - 关联血气数据
   - `calculateSessionIndicators()` - 计算单个俯卧位治疗记录指标
   - `calculateQualityIndicators()` - 计算汇总指标

2. **proneQualityUtils.js** - 质控汇总计算
   - `calculateDailySummary()` - 计算每日汇总
   - `calculateHospitalSummary()` - 计算全院汇总
   - `saveDailySummaries()` - 保存汇总数据
   - `getQualityReport()` - 获取报表数据

3. **prone.js** - API 路由
   - `GET /api/prone/quality-summary` - 获取质控汇总
   - `GET /api/prone/session-details` - 获取俯卧位治疗明细
   - `GET /api/prone/daily-trend` - 获取每日趋势
   - `GET /api/prone/export` - 导出 Excel

4. **scheduler.js** - 定时任务调度
   - 每日凌晨 2:00 执行质控计算
   - 支持手动触发和批量计算

#### 前端架构

- **HTML + CSS + JavaScript** - 原生实现
- **响应式设计** - 支持多终端访问
- **动态图表** - 趋势可视化

### 4. 数据库设计

#### 新增集合

1. **prone_session** - 俯卧位治疗记录
   - 存储配对后的俯卧位会话记录
   - 包含患者信息、血气数据、质控指标
   - 支持异常标识和原因记录

2. **prone_quality_daily** - 每日质控汇总
   - 存储按科室+日期汇总的质控指标
   - 支持全院汇总和科室明细
   - 便于历史数据查询和趋势分析

#### 索引设计

```javascript
// prone_session 索引
{ pid: 1, startTime: 1 }           // 患者查询
{ mrn: 1, startTime: 1 }           // 病案号查询
{ deptCode: 1, belongDate: 1 }     // 科室+日期查询
{ startEventId: 1 }                // 唯一索引，防止重复配对

// prone_quality_daily 索引
{ reportDate: 1, deptCode: 1 }     // 唯一索引，按日期+科室
{ reportMonth: 1, deptCode: 1 }    // 月度查询
```

### 5. 业务规则实现

#### 配对规则

```javascript
// 状态机配对算法
for (event of events) {
  if (event.strVal === "俯卧位开始") {
    if (pendingStart) {
      // 标记未闭合异常
      sessions.push(createUnclosedSession(pendingStart));
    }
    pendingStart = event;
  } else if (event.strVal === "俯卧位结束") {
    if (pendingStart) {
      // 配对成功
      sessions.push(createPairedSession(pendingStart, event));
      pendingStart = null;
    } else {
      // 孤立结束
      sessions.push(createOrphanEndSession(event));
    }
  }
}
```

#### 异常规则

| 异常类型 | 判断条件 | 处理方式 |
|----------|----------|----------|
| 未闭合 | 有开始无结束 | 不纳入达标率分子分母 |
| 时长过短 | < 2小时 | 纳入异常数据率 |
| 时长过长 | > 24小时 | 纳入异常数据率 |
| 顺序异常 | 结束早于开始 | 纳入异常数据率 |
| 孤立结束 | 无对应开始 | 纳入异常数据率 |

#### 血气关联规则

```javascript
// 关联路径
bedside.pid → patient._id → patient.mrn → bGATemp.mrn

// 时间窗口
治疗前 PF: 开始前 6 小时内最近一次动脉血气
治疗后 PF: 结束后 4 小时内最近一次动脉血气

// PF 计算
PF = PaO2 / (FiO2 / 100)
```

### 6. 配置化设计

所有关键参数均可通过环境变量配置：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| PRONE_DURATION_THRESHOLD | 16 | 时长达标阈值（小时） |
| PRONE_INDICATION_THRESHOLD | 150 | 适应症 PF 阈值（mmHg） |
| PRONE_EFFECTIVE_THRESHOLD | 20 | 有效性 PF 提升阈值（%） |
| PRONE_PRE_BGA_WINDOW | 6 | 治疗前血气窗口（小时） |
| PRONE_POST_BGA_WINDOW | 4 | 治疗后血气窗口（小时） |
| PRONE_ABNORMAL_DURATION_MIN | 2 | 异常时长下限（小时） |
| PRONE_ABNORMAL_DURATION_MAX | 24 | 异常时长上限（小时） |
| PRONE_UNCLOSED_TIMEOUT | 24 | 未闭合超时（小时） |

## 文件清单

### 后端文件

```
backend/
├── routes/
│   └── prone.js                    # 俯卧位质控 API 路由
├── utils/
│   ├── proneSessionUtils.js        # 俯卧位治疗记录配对和指标计算
│   └── proneQualityUtils.js        # 质控汇总计算
├── cron/
│   ├── proneQualityCron.js         # 定时任务逻辑
│   └── scheduler.js                # 任务调度器
├── test-prone.js                   # 测试脚本
└── validate-schema.js              # 集合结构验证
```

### 前端文件

```
frontend/
└── prone.html                      # 俯卧位质控报表页面
```

### 文档文件

```
├── PRONE_QUALITY_README.md         # 功能说明文档
└── PRONE_QUALITY_SUMMARY.md        # 项目总结文档
```

### 部署脚本

```
├── deploy-prone.sh                 # Linux/Mac 部署脚本
├── deploy-prone.bat                # Windows 部署脚本
├── start-prone.sh                  # Linux/Mac 快速启动
└── start-prone.bat                 # Windows 快速启动
```

## 测试验证

### 1. 单元测试

```bash
# 运行功能测试
cd backend
node test-prone.js
```

### 2. 集合验证

```bash
# 验证集合结构
node validate-schema.js
```

### 3. API 测试

```bash
# 测试质控汇总接口
curl "http://localhost:3000/api/prone/quality-summary?startDate=2026-04-01&endDate=2026-04-30"

# 测试俯卧位治疗明细接口
curl "http://localhost:3000/api/prone/session-details?startDate=2026-04-01&endDate=2026-04-30"

# 测试每日趋势接口
curl "http://localhost:3000/api/prone/daily-trend?startDate=2026-04-01&endDate=2026-04-30"
```

## 部署说明

### 1. 环境要求

- Node.js >= 18.0.0
- MongoDB >= 6.0
- 操作系统：Windows/Linux/Mac

### 2. 部署步骤

#### Linux/Mac

```bash
# 1. 克隆代码
git clone <repository-url>
cd icu-stats

# 2. 运行部署脚本
chmod +x deploy-prone.sh
./deploy-prone.sh
```

#### Windows

```batch
# 1. 克隆代码
git clone <repository-url>
cd icu-stats

# 2. 运行部署脚本
deploy-prone.bat
```

### 3. 配置环境变量

创建 `.env` 文件：

```env
# 俯卧位质控配置
PRONE_DURATION_THRESHOLD=16
PRONE_INDICATION_THRESHOLD=150
PRONE_EFFECTIVE_THRESHOLD=20
PRONE_PRE_BGA_WINDOW=6
PRONE_POST_BGA_WINDOW=4
PRONE_ABNORMAL_DURATION_MIN=2
PRONE_ABNORMAL_DURATION_MAX=24
PRONE_UNCLOSED_TIMEOUT=24
```

### 4. 启动服务

```bash
# 快速启动
./start-prone.sh  # Linux/Mac
start-prone.bat   # Windows

# 或手动启动
cd backend
npm start
```

### 5. 访问报表

打开浏览器访问：`http://localhost:3000/prone.html`

## 性能优化

### 1. 索引优化

- 为常用查询字段创建复合索引
- 使用唯一索引防止重复数据
- 定期分析查询计划，优化索引策略

### 2. 查询优化

- 使用聚合管道减少数据传输
- 分页查询避免一次性加载大量数据
- 缓存常用配置和字典数据

### 3. 计算优化

- 增量计算，避免全量重算
- 异步处理大批量数据
- 使用定时任务预计算汇总数据

## 扩展计划

### 1. 短期扩展

- [ ] 添加更多质控指标
- [ ] 支持自定义报表模板
- [ ] 添加数据导出功能（PDF、Excel）
- [ ] 支持多院区数据对比

### 2. 中期扩展

- [ ] 实现实时数据推送
- [ ] 添加预警功能
- [ ] 支持移动端访问
- [ ] 集成 BI 工具

### 3. 长期扩展

- [ ] 机器学习预测模型
- [ ] 智能推荐治疗方案
- [ ] 多中心数据协作
- [ ] 医疗质量改进闭环

## 风险与应对

### 1. 数据风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 血气数据缺失 | 无法计算 PF | 返回 null，报表显示"-" |
| 事件不配对 | 影响时长计算 | 标记异常，纳入异常数据率 |
| 历史数据修改 | 指标需重算 | 基于 version 增量更新 |

### 2. 性能风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 大数据量查询 | 响应慢 | 分页查询、索引优化 |
| 复杂聚合计算 | CPU 占用高 | 异步处理、定时预计算 |
| 并发访问 | 数据库压力 | 连接池、缓存机制 |

### 3. 安全风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 数据泄露 | 隐私问题 | 脱敏处理、权限控制 |
| SQL 注入 | 数据破坏 | 参数化查询、输入验证 |
| 未授权访问 | 数据篡改 | 身份认证、操作审计 |

## 总结

本项目成功实现了 ICU 俯卧位质控报表功能，具有以下特点：

1. **功能完整** - 覆盖所有核心质控指标
2. **架构清晰** - 模块化设计，易于维护和扩展
3. **性能优化** - 索引优化、增量计算、异步处理
4. **配置灵活** - 所有关键参数可配置
5. **文档完善** - 详细的使用说明和部署指南

项目已通过测试验证，可以投入生产使用。后续将根据实际使用情况持续优化和扩展功能。
