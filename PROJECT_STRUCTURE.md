# ICU 俯卧位质控报表 - 项目结构

## 目录结构

```
icu-stats/
├── backend/                          # 后端代码
│   ├── routes/                       # API 路由
│   │   ├── patient.js                # 患者相关接口
│   │   ├── drug.js                   # 微泵药相关接口
│   │   ├── bedside.js                # 体位/氧疗相关接口
│   │   ├── report.js                 # 报表相关接口
│   │   └── prone.js                  # 俯卧位质控接口 (新增)
│   │
│   ├── utils/                        # 工具函数
│   │   ├── timeUtil.js               # 时间处理工具
│   │   ├── deptUtil.js               # 科室处理工具
│   │   ├── proneSessionUtils.js      # 俯卧位治疗记录工具 (新增)
│   │   └── proneQualityUtils.js      # 俯卧位质控工具 (新增)
│   │
│   ├── cron/                         # 定时任务
│   │   ├── proneQualityCron.js       # 俯卧位质控定时任务 (新增)
│   │   └── scheduler.js              # 任务调度器 (新增)
│   │
│   ├── db.js                         # 数据库连接和索引
│   ├── server.js                     # Express 服务器
│   ├── package.json                  # 依赖配置
│   ├── test-prone.js                 # 功能测试脚本 (新增)
│   └── validate-schema.js            # 集合结构验证 (新增)
│
│   frontend/                         # 前端代码
│   ├── css/                          # 样式文件
│   │   └── style.css                 # 全局样式
│   │
│   ├── js/                           # JavaScript 文件
│   │   └── list.js                   # 列表页脚本
│   │
│   ├── vendor/                       # 第三方库
│   │
│   ├── index.html                    # 首页
│   ├── detail.html                   # 详情页
│   └── prone.html                    # 俯卧位质控页面 (新增)
│
│   scripts/                          # 脚本文件
│   ├── deploy-prone.sh               # Linux/Mac 部署脚本 (新增)
│   ├── deploy-prone.bat              # Windows 部署脚本 (新增)
│   ├── start-prone.sh                # Linux/Mac 快速启动 (新增)
│   ├── start-prone.bat               # Windows 快速启动 (新增)
│   ├── test-api.sh                   # Linux/Mac API 测试 (新增)
│   └── test-api.bat                  # Windows API 测试 (新增)
│
│   packaging/                        # 打包配置
│   │
│   icu-stats/                        # 打包输出目录
│   │
│   .claude/                          # Claude 配置
│   │
│   PRONE_QUALITY_README.md           # 功能说明文档 (新增)
│   PRONE_QUALITY_SUMMARY.md          # 项目总结文档 (新增)
│   PROJECT_STRUCTURE.md              # 项目结构说明 (新增)
│   .gitignore                        # Git 忽略文件
│   .dockerignore                     # Docker 忽略文件
│   .env.example                      # 环境变量示例
│   Dockerfile.oel8                   # Docker 配置
│   README.md                         # 项目说明
│   start.bat                         # Windows 启动脚本
│   build-oel8-binary.ps1             # 打包脚本
│   build-oel8-binary.sh              # 打包脚本
│   start-test.out.log                # 启动日志
│   start-test.err.log                # 错误日志
│   icu-stats.tar                     # 打包文件
└── README.md                         # 项目总说明
```

## 文件说明

### 后端文件

#### 路由文件 (routes/)

| 文件 | 说明 | 主要接口 |
|------|------|----------|
| `patient.js` | 患者相关接口 | GET /api/patients |
| `drug.js` | 微泵药相关接口 | GET /api/drug |
| `bedside.js` | 体位/氧疗相关接口 | GET /api/bedside |
| `report.js` | 报表相关接口 | GET /api/report |
| `prone.js` | 俯卧位质控接口 | GET /api/prone/* |

#### 工具文件 (utils/)

| 文件 | 说明 | 主要功能 |
|------|------|----------|
| `timeUtil.js` | 时间处理工具 | CST 时间转换、日期格式化 |
| `deptUtil.js` | 科室处理工具 | 科室过滤、患者查询 |
| `proneSessionUtils.js` | 俯卧位治疗记录工具 | 事件配对、指标计算 |
| `proneQualityUtils.js` | 俯卧位质控工具 | 汇总计算、报表生成 |

#### 定时任务 (cron/)

| 文件 | 说明 | 主要功能 |
|------|------|----------|
| `proneQualityCron.js` | 俯卧位质控定时任务 | 每日计算、手动触发 |
| `scheduler.js` | 任务调度器 | 任务注册、状态管理 |

#### 核心文件

| 文件 | 说明 |
|------|------|
| `db.js` | 数据库连接和索引管理 |
| `server.js` | Express 服务器配置和启动 |
| `package.json` | 依赖配置和脚本定义 |
| `test-prone.js` | 功能测试脚本 |
| `validate-schema.js` | 集合结构验证脚本 |

### 前端文件

| 文件 | 说明 |
|------|------|
| `index.html` | 首页（微泵/氧疗统计） |
| `detail.html` | 详情页 |
| `prone.html` | 俯卧位质控页面 |
| `css/style.css` | 全局样式 |
| `js/list.js` | 列表页脚本 |

### 脚本文件

| 文件 | 说明 |
|------|------|
| `deploy-prone.sh` | Linux/Mac 部署脚本 |
| `deploy-prone.bat` | Windows 部署脚本 |
| `start-prone.sh` | Linux/Mac 快速启动 |
| `start-prone.bat` | Windows 快速启动 |
| `test-api.sh` | Linux/Mac API 测试 |
| `test-api.bat` | Windows API 测试 |

### 文档文件

| 文件 | 说明 |
|------|------|
| `PRONE_QUALITY_README.md` | 功能说明文档 |
| `PRONE_QUALITY_SUMMARY.md` | 项目总结文档 |
| `PROJECT_STRUCTURE.md` | 项目结构说明 |
| `README.md` | 项目总说明 |

## 数据库集合

### 现有集合

| 集合名 | 说明 | 主要字段 |
|--------|------|----------|
| `patient` | 患者信息 | _id, mrn, deptCode, name, bed, bedDoctor |
| `bedside` | 体位记录 | pid, code, time, strVal, valid |
| `bGATemp` | 血气结果 | mrn, eventExe.*, bedsides[] |
| `department` | 科室字典 | code, name |
| `configParam` | 参数配置 | code, name, unit |

### 新增集合

| 集合名 | 说明 | 主要字段 |
|--------|------|----------|
| `prone_session` | 俯卧位治疗记录 | pid, mrn, startTime, endTime, durationHours, prePFRatio, postPFRatio |
| `prone_quality_daily` | 每日质控汇总 | reportDate, deptCode, totalSessions, durationMetRate, effectiveRate |

## API 接口

### 现有接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/patients` | GET | 患者列表 |
| `/api/drug` | GET | 微泵药统计 |
| `/api/bedside` | GET | 体位/氧疗统计 |
| `/api/report` | GET | 报表数据 |

### 新增接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/prone/quality-summary` | GET | 质控汇总数据 |
| `/api/prone/session-details` | GET | 俯卧位治疗明细 |
| `/api/prone/daily-trend` | GET | 每日趋势 |
| `/api/prone/export` | GET | 导出 Excel |

## 依赖关系

### 后端依赖

```json
{
  "dependencies": {
    "express": "^4.19.2",
    "mongodb": "^6.5.0",
    "cors": "^2.8.5",
    "exceljs": "^4.4.0",
    "dotenv": "^16.4.5",
    "node-cron": "^3.0.3"
  }
}
```

### 模块依赖关系

```
server.js
├── db.js
├── routes/
│   ├── patient.js
│   ├── drug.js
│   ├── bedside.js
│   ├── report.js
│   └── prone.js
│       ├── utils/proneSessionUtils.js
│       └── utils/proneQualityUtils.js
└── cron/
    └── scheduler.js
        └── proneQualityCron.js
            ├── utils/proneSessionUtils.js
            └── utils/proneQualityUtils.js
```

## 数据流向

### 实时查询流程

```
用户请求 → Express Router → Service Logic → MongoDB 查询 → 返回数据
```

### 定时计算流程

```
定时触发 → proneQualityCron → proneSessionUtils → MongoDB 读写 → 存储结果
```

### 前端交互流程

```
用户操作 → JavaScript → API 请求 → 后端处理 → 返回数据 → 渲染页面
```

## 配置管理

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MONGO_URL` | mongodb://localhost:27017 | MongoDB 连接地址 |
| `MONGO_DB` | SmartCare | 数据库名称 |
| `PORT` | 3000 | 服务端口 |
| `PRONE_DURATION_THRESHOLD` | 16 | 时长达标阈值 |
| `PRONE_INDICATION_THRESHOLD` | 150 | 适应症 PF 阈值 |
| `PRONE_EFFECTIVE_THRESHOLD` | 20 | 有效性 PF 提升阈值 |

### 配置文件

| 文件 | 说明 |
|------|------|
| `.env` | 环境变量配置 |
| `.env.example` | 环境变量示例 |
| `package.json` | 依赖配置 |

## 测试文件

| 文件 | 说明 |
|------|------|
| `test-prone.js` | 功能测试脚本 |
| `validate-schema.js` | 集合结构验证 |
| `test-api.sh` | API 接口测试 (Linux/Mac) |
| `test-api.bat` | API 接口测试 (Windows) |

## 部署文件

| 文件 | 说明 |
|------|------|
| `deploy-prone.sh` | 完整部署脚本 (Linux/Mac) |
| `deploy-prone.bat` | 完整部署脚本 (Windows) |
| `start-prone.sh` | 快速启动脚本 (Linux/Mac) |
| `start-prone.bat` | 快速启动脚本 (Windows) |
| `Dockerfile.oel8` | Docker 配置 |
| `build-oel8-binary.sh` | 打包脚本 (Linux/Mac) |
| `build-oel8-binary.ps1` | 打包脚本 (Windows) |
