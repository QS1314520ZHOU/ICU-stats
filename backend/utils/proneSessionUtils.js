const { cstDateStrToUtc } = require("./timeUtil");

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  durationThreshold: 16,      // 单次时长达标阈值（小时）
  indicationThreshold: 150,   // 适应症 PF 阈值（mmHg）
  effectiveThreshold: 20,     // 治疗有效 PF 提升阈值（%）
  preBgaWindowHours: 6,       // 治疗前血气时间窗口（小时）
  postBgaWindowHours: 4,      // 治疗后血气时间窗口（小时）
  abnormalDurationMin: 2,     // 异常时长下限（小时）
  abnormalDurationMax: 24,    // 异常时长上限（小时）
  unclosedTimeoutHours: 24    // 未闭合超时（小时）
};

/**
 * 配置化参数（可从环境变量或配置文件读取）
 */
const config = {
  durationThreshold: parseInt(process.env.PRONE_DURATION_THRESHOLD) || DEFAULT_CONFIG.durationThreshold,
  indicationThreshold: parseInt(process.env.PRONE_INDICATION_THRESHOLD) || DEFAULT_CONFIG.indicationThreshold,
  effectiveThreshold: parseInt(process.env.PRONE_EFFECTIVE_THRESHOLD) || DEFAULT_CONFIG.effectiveThreshold,
  preBgaWindowHours: parseInt(process.env.PRONE_PRE_BGA_WINDOW) || DEFAULT_CONFIG.preBgaWindowHours,
  postBgaWindowHours: parseInt(process.env.PRONE_POST_BGA_WINDOW) || DEFAULT_CONFIG.postBgaWindowHours,
  abnormalDurationMin: parseInt(process.env.PRONE_ABNORMAL_DURATION_MIN) || DEFAULT_CONFIG.abnormalDurationMin,
  abnormalDurationMax: parseInt(process.env.PRONE_ABNORMAL_DURATION_MAX) || DEFAULT_CONFIG.abnormalDurationMax,
  unclosedTimeoutHours: parseInt(process.env.PRONE_UNCLOSED_TIMEOUT) || DEFAULT_CONFIG.unclosedTimeoutHours
};

/**
 * 生成俯卧位治疗记录（配对开始/结束事件）
 * @param {Object} db - MongoDB 数据库连接
 * @param {string} startDate - 开始日期（YYYY-MM-DD）
 * @param {string} endDate - 结束日期（YYYY-MM-DD）
 * @param {Object} dept - 科室过滤条件（可选）
 * @returns {Array} 配对后的俯卧位治疗记录列表
 */
async function generateProneSessions(db, startDate, endDate, dept = null) {
  const rangeStart = cstDateStrToUtc(startDate, false);
  const rangeEnd = cstDateStrToUtc(endDate, true);

  // 1. 获取所有有效的俯卧位事件
  const matchStage = {
    code: "param_TiWei",
    strVal: { $in: ["俯卧位开始", "俯卧位结束"] },
    valid: true
  };

  if (rangeStart || rangeEnd) {
    matchStage.time = {};
    if (rangeStart) matchStage.time.$gte = rangeStart;
    if (rangeEnd) matchStage.time.$lte = rangeEnd;
  }

  let pipeline = [
    { $match: matchStage },
    { $sort: { pid: 1, time: 1 } }
  ];

  // 如果需要按科室过滤
  if (dept) {
    pipeline.push(
      { $addFields: { pidObj: { $toObjectId: "$pid" } } },
      { $lookup: { from: "patient", localField: "pidObj", foreignField: "_id", as: "patient" } },
      { $match: { "patient.deptCode": dept.code } }
    );
  }

  const events = await db.collection("bedside").aggregate(pipeline).toArray();

  // 2. 按 pid 分组
  const byPid = {};
  for (const event of events) {
    if (!byPid[event.pid]) {
      byPid[event.pid] = [];
    }
    byPid[event.pid].push(event);
  }

  // 3. 配对逻辑
  const sessions = [];
  for (const [pid, pidEvents] of Object.entries(byPid)) {
    const pairedSessions = pairEvents(pid, pidEvents);
    sessions.push(...pairedSessions);
  }

  // 4. 获取患者信息和血气数据
  const enrichedSessions = await enrichSessionsWithBga(db, sessions);

  // 5. 计算质控指标
  const finalSessions = enrichedSessions.map(session => {
    return calculateSessionIndicators(session);
  });

  return finalSessions;
}

/**
 * 配对俯卧位开始/结束事件
 * @param {string} pid - 患者ID
 * @param {Array} events - 事件列表（已按 time 排序）
 * @returns {Array} 配对后的俯卧位治疗记录列表
 */
function pairEvents(pid, events) {
  const sessions = [];
  let pendingStart = null;

  for (const event of events) {
    if (event.strVal === "俯卧位开始") {
      // 如果有未闭合的开始，标记为未闭合异常
      if (pendingStart) {
        sessions.push(createUnclosedSession(pid, pendingStart));
      }
      pendingStart = event;
    } else if (event.strVal === "俯卧位结束") {
      if (pendingStart) {
        // 配对成功
        sessions.push(createPairedSession(pid, pendingStart, event));
        pendingStart = null;
      } else {
        // 孤立结束
        sessions.push(createOrphanEndSession(pid, event));
      }
    }
  }

  // 处理最后一个未闭合的开始
  if (pendingStart) {
    sessions.push(createUnclosedSession(pid, pendingStart));
  }

  return sessions;
}

/**
 * 创建配对成功的俯卧位治疗记录
 */
function createPairedSession(pid, startEvent, endEvent) {
  const startTime = new Date(startEvent.time);
  const endTime = new Date(endEvent.time);
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  // 判断顺序异常
  const isSequenceAbnormal = durationHours < 0;

  return {
    pid,
    startEventId: startEvent._id.toString(),
    endEventId: endEvent._id.toString(),
    startTime,
    endTime: isSequenceAbnormal ? null : endTime,
    durationHours: isSequenceAbnormal ? null : Math.abs(durationHours),
    isUnclosed: false,
    isOrphanEnd: false,
    isSequenceAbnormal,
    belongDate: formatDateCST(startTime),
    belongMonth: formatMonthCST(startTime),
    history: startEvent.history || [],
    version: 1
  };
}

/**
 * 创建未闭合的俯卧位治疗记录
 */
function createUnclosedSession(pid, startEvent) {
  const startTime = new Date(startEvent.time);

  // 未闭合超时判断（仅适用于实时场景）
  const now = new Date();
  const elapsedHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  const isUnclosedTimeout = elapsedHours > config.unclosedTimeoutHours;

  return {
    pid,
    startEventId: startEvent._id.toString(),
    endEventId: null,
    startTime,
    endTime: null,
    durationHours: null,
    isUnclosed: true,
    isOrphanEnd: false,
    isSequenceAbnormal: false,
    isUnclosedTimeout,
    belongDate: formatDateCST(startTime),
    belongMonth: formatMonthCST(startTime),
    history: startEvent.history || [],
    version: 1
  };
}

/**
 * 创建孤立结束的俯卧位治疗记录
 */
function createOrphanEndSession(pid, endEvent) {
  return {
    pid,
    startEventId: null,
    endEventId: endEvent._id.toString(),
    startTime: null,
    endTime: new Date(endEvent.time),
    durationHours: null,
    isUnclosed: false,
    isOrphanEnd: true,
    isSequenceAbnormal: false,
    belongDate: formatDateCST(new Date(endEvent.time)),
    belongMonth: formatMonthCST(new Date(endEvent.time)),
    history: endEvent.history || [],
    version: 1
  };
}

async function enrichSessionsWithBga(db, sessions) {
  if (sessions.length === 0) return sessions;

  // 1. 获取所有相关患者
  const pidList = [...new Set(sessions.map(s => s.pid))];
  const { ObjectId } = require("mongodb");
  const patients = await db.collection("patient")
    .find({ _id: { $in: pidList.map(id => ObjectId.createFromHexString(id)) } })
    .project({ _id: 1, mrn: 1, deptCode: 1, dept: 1, name: 1, hisBed: 1, bedDoctor: 1 })
    .toArray();

  const patientMap = {};
  for (const p of patients) {
    patientMap[p._id.toString()] = p;
  }

  // 2. 获取动脉血气记录（PaO2 + 预算PF），bedsides 只保留 PaO2 相关 + PF 比值
  const mrnList = [...new Set(patients.map(p => p.mrn).filter(Boolean))];
  const bgaRecords = await db.collection("bGATemp")
    .find({
      mrn: { $in: mrnList },
      "eventExe.code": "event_blood_gas_A",
      "eventExe.valid": true
    })
    .project({
      mrn: 1,
      "eventExe.startTime": 1,
      bedsides: {
        $filter: {
          input: "$bedsides",
          as: "b",
          cond: {
            $in: ["$$b.code", ["param_bg_po2", "param_bg_po2_T", "param_bg_P/Fratio"]]
          }
        }
      }
    })
    .toArray();

  // 3. 按 mrn 分组血气数据
  const bgaByMrn = {};
  for (const bga of bgaRecords) {
    if (!bgaByMrn[bga.mrn]) bgaByMrn[bga.mrn] = [];
    bgaByMrn[bga.mrn].push(bga);
  }

  // 4. 获取 bedside 集合的 FiO2 数据
  const fio2Records = await db.collection("bedside")
    .find({
      pid: { $in: pidList },
      code: "param_FiO2",
      valid: true
    })
    .project({ pid: 1, time: 1, strVal: 1 })
    .toArray();

  // 5. 按 pid 分组 FiO2
  const fio2ByPid = {};
  for (const fio2 of fio2Records) {
    if (!fio2ByPid[fio2.pid]) fio2ByPid[fio2.pid] = [];
    fio2ByPid[fio2.pid].push(fio2);
  }

  // 6. 为每个 session 添加血气数据
  const enrichedSessions = [];
  for (const session of sessions) {
    const patient = patientMap[session.pid];
    if (!patient) continue;

    const mrn = patient.mrn;
    const bgaList = bgaByMrn[mrn] || [];
    const fio2List = fio2ByPid[session.pid] || [];

    // 查找治疗前血气：开始前 N 小时内最近一次，且能算出有效 PF
    let preBga = null;
    let prePFRatio = null;
    if (session.startTime) {
      const preWindowStart = new Date(session.startTime.getTime() - config.preBgaWindowHours * 60 * 60 * 1000);
      const preWindowEnd = session.startTime;

      const candidates = bgaList
        .filter(bga => {
          const t = new Date(bga.eventExe.startTime);
          return t >= preWindowStart && t <= preWindowEnd;
        })
        .sort((a, b) => new Date(b.eventExe.startTime) - new Date(a.eventExe.startTime));

      for (const cand of candidates) {
        const pf = extractPFRatio(cand, fio2List, preWindowStart, preWindowEnd);
        if (pf != null) {
          preBga = cand;
          prePFRatio = pf;
          break;
        }
      }
    }

    // 查找治疗后血气：结束后 N 小时内最近一次，且能算出有效 PF
    let postBga = null;
    let postPFRatio = null;
    if (session.endTime && !session.isUnclosed) {
      const postWindowStart = session.endTime;
      const postWindowEnd = new Date(session.endTime.getTime() + config.postBgaWindowHours * 60 * 60 * 1000);

      const candidates = bgaList
        .filter(bga => {
          const t = new Date(bga.eventExe.startTime);
          return t >= postWindowStart && t <= postWindowEnd;
        })
        .sort((a, b) => new Date(a.eventExe.startTime) - new Date(b.eventExe.startTime));

      for (const cand of candidates) {
        const pf = extractPFRatio(cand, fio2List, postWindowStart, postWindowEnd);
        if (pf != null) {
          postBga = cand;
          postPFRatio = pf;
          break;
        }
      }
    }

    enrichedSessions.push({
      ...session,
      mrn,
      patientName: patient.name || "-",
      deptCode: patient.deptCode,
      deptName: patient.dept,
      bed: patient.hisBed,
      bedDoctor: patient.bedDoctor,
      preBgaId: preBga ? preBga._id.toString() : null,
      preBgaTime: preBga ? new Date(preBga.eventExe.startTime) : null,
      prePFRatio,
      postBgaId: postBga ? postBga._id.toString() : null,
      postBgaTime: postBga ? new Date(postBga.eventExe.startTime) : null,
      postPFRatio
    });
  }

  return enrichedSessions;
}

/**
 * 从单条血气记录中提取 PF 比值
 * 优先级 1：bGATemp 预算值 param_bg_P/Fratio
 * 优先级 2：PaO2（param_bg_po2，回退 param_bg_po2_T）+ FiO2（从 bedside 集合 param_FiO2）
 * @param {Object} bga - 血气记录（bGATemp）
 * @param {Array} fio2List - 该患者的 FiO2 列表（bedside 集合）
 * @param {Date} timeStart - 时间窗口起点
 * @param {Date} timeEnd - 时间窗口终点
 * @returns {number|null} PF 比值，无法计算时返回 null
 */
function extractPFRatio(bga, fio2List, timeStart, timeEnd) {
  if (!bga || !Array.isArray(bga.bedsides)) return null;

  let pao2 = null;
  let pao2T = null;
  let pfRatio = null;

  for (const bedside of bga.bedsides) {
    if (bedside.code === "param_bg_P/Fratio") {
      pfRatio = parseBedsideValue(bedside);
    } else if (bedside.code === "param_bg_po2") {
      pao2 = parseBedsideValue(bedside);
    } else if (bedside.code === "param_bg_po2_T") {
      pao2T = parseBedsideValue(bedside);
    }
  }

  // 优先级 1：直接用预算的 PF 比值
  if (pfRatio != null && pfRatio > 0) return pfRatio;

  // 优先级 2：PaO2 + FiO2 手动计算
  const effectivePaO2 = pao2 != null ? pao2 : pao2T;
  if (effectivePaO2 == null) return null;

  // 从 bedside 集合查找时间窗口内最近的 FiO2
  const fio2 = findNearestFiO2(fio2List, timeStart, timeEnd);
  if (fio2 == null || fio2 <= 0) return null;

  // FiO2 单位归一化：≤1 视为小数（0.4），>1 视为百分数（40）
  const fio2Decimal = fio2 <= 1 ? fio2 : fio2 / 100;
  if (fio2Decimal <= 0 || fio2Decimal > 1) return null;

  return effectivePaO2 / fio2Decimal;
}

/**
 * 从 bedside 元素中提取数值，优先 fVal，回退 strVal
 */
function parseBedsideValue(bedside) {
  if (bedside == null) return null;
  if (typeof bedside.fVal === "number" && !isNaN(bedside.fVal)) {
    return bedside.fVal;
  }
  if (bedside.strVal != null) {
    const v = parseFloat(bedside.strVal);
    if (!isNaN(v)) return v;
  }
  return null;
}

/**
 * 在时间窗口内查找最近的 FiO2 值
 * @param {Array} fio2List - FiO2 记录列表
 * @param {Date} timeStart - 窗口起点
 * @param {Date} timeEnd - 窗口终点
 * @returns {number|null} FiO2 值
 */
function findNearestFiO2(fio2List, timeStart, timeEnd) {
  if (!fio2List || fio2List.length === 0) return null;

  let best = null;
  for (const rec of fio2List) {
    const t = new Date(rec.time);
    if (t >= timeStart && t <= timeEnd) {
      const val = rec.strVal != null ? parseFloat(rec.strVal) : null;
      if (val != null && !isNaN(val) && val > 0) {
        if (!best || t > new Date(best.time)) {
          best = rec;
        }
      }
    }
  }
  return best ? parseFloat(best.strVal) : null;
}

/**
 * 计算单个俯卧位治疗的质控指标
 * @param {Object} session - 俯卧位治疗记录
 * @returns {Object} 计算后的俯卧位治疗记录
 */
function calculateSessionIndicators(session) {
  const abnormalReasons = [];

  // 1. 判断时长异常
  let isDurationAbnormal = false;
  if (session.durationHours != null) {
    if (session.durationHours < config.abnormalDurationMin) {
      isDurationAbnormal = true;
      abnormalReasons.push("时长过短(<" + config.abnormalDurationMin + "h)");
    }
    if (session.durationHours > config.abnormalDurationMax) {
      isDurationAbnormal = true;
      abnormalReasons.push("时长过长(>" + config.abnormalDurationMax + "h)");
    }
  }

  // 2. 判断未闭合超时
  if (session.isUnclosed && session.isUnclosedTimeout) {
    abnormalReasons.push("未闭合超时(>" + config.unclosedTimeoutHours + "h)");
  }

  // 3. 判断顺序异常
  if (session.isSequenceAbnormal) {
    abnormalReasons.push("顺序异常(结束早于开始)");
  }

  // 4. 判断孤立结束
  if (session.isOrphanEnd) {
    abnormalReasons.push("孤立结束(无对应开始)");
  }

  // 5. 判断未闭合
  if (session.isUnclosed) {
    abnormalReasons.push("未闭合(无对应结束)");
  }

  // 6. 综合异常判断
  const isAbnormal = session.isUnclosed || session.isOrphanEnd || session.isSequenceAbnormal || isDurationAbnormal;

  // 7. 判断适应症是否符合（PF < 150）
  const isIndicationMet = session.prePFRatio != null && session.prePFRatio < config.indicationThreshold;

  // 8. 判断时长是否达标（≥ 16小时）
  const isDurationMet = session.durationHours != null && session.durationHours >= config.durationThreshold;

  // 9. 计算 PF 提升率
  let pfImprovementRate = null;
  let isEffective = null;
  if (session.prePFRatio != null && session.postPFRatio != null && session.prePFRatio > 0) {
    pfImprovementRate = ((session.postPFRatio - session.prePFRatio) / session.prePFRatio) * 100;
    isEffective = pfImprovementRate >= config.effectiveThreshold;
  }

  return {
    ...session,
    isDurationAbnormal,
    isAbnormal,
    abnormalReasons,
    isIndicationMet,
    isDurationMet,
    pfImprovementRate,
    isEffective
  };
}

/**
 * 计算质控指标汇总
 * @param {Array} sessions - 俯卧位治疗记录列表
 * @returns {Object} 质控指标汇总
 */
function calculateQualityIndicators(sessions) {
  const totalSessions = sessions.length;
  const validSessions = sessions.filter(s => !s.isAbnormal).length;
  const abnormalSessions = sessions.filter(s => s.isAbnormal).length;

  // 时长指标
  const validSessionsWithDuration = sessions.filter(s => !s.isAbnormal && s.durationHours != null);
  const durationMetCount = validSessionsWithDuration.filter(s => s.isDurationMet).length;
  const durationMetRate = validSessionsWithDuration.length > 0
    ? (durationMetCount / validSessionsWithDuration.length) * 100
    : null;

  // 累计时长
  const totalDurationHours = validSessionsWithDuration.reduce((sum, s) => sum + s.durationHours, 0);
  const avgDurationHours = validSessionsWithDuration.length > 0
    ? totalDurationHours / validSessionsWithDuration.length
    : null;

  // 适应症指标
  const validSessionsWithPrePF = sessions.filter(s => !s.isAbnormal && s.prePFRatio != null);
  const indicationMetCount = validSessionsWithPrePF.filter(s => s.isIndicationMet).length;
  const indicationMetRate = validSessionsWithPrePF.length > 0
    ? (indicationMetCount / validSessionsWithPrePF.length) * 100
    : null;

  // 有效性指标
  const validSessionsWithBothPF = sessions.filter(s => !s.isAbnormal && s.isEffective != null);
  const effectiveCount = validSessionsWithBothPF.filter(s => s.isEffective).length;
  const effectiveRate = validSessionsWithBothPF.length > 0
    ? (effectiveCount / validSessionsWithBothPF.length) * 100
    : null;

  // 异常指标
  const unclosedCount = sessions.filter(s => s.isUnclosed).length;
  const durationAbnormalCount = sessions.filter(s => s.isDurationAbnormal).length;
  const sequenceAbnormalCount = sessions.filter(s => s.isSequenceAbnormal).length;
  const orphanEndCount = sessions.filter(s => s.isOrphanEnd).length;
  const abnormalRate = totalSessions > 0
    ? (abnormalSessions / totalSessions) * 100
    : null;

  // 数据完整性指标
  const durationDataCompleteness = totalSessions > 0
    ? (validSessionsWithDuration.length / totalSessions) * 100
    : null;
  const indicationDataCompleteness = totalSessions > 0
    ? (validSessionsWithPrePF.length / totalSessions) * 100
    : null;
  const effectiveDataCompleteness = totalSessions > 0
    ? (validSessionsWithBothPF.length / totalSessions) * 100
    : null;

  return {
    totalSessions,
    validSessions,
    abnormalSessions,
    // 时长指标
    durationMetCount,
    durationMetDenominator: validSessionsWithDuration.length,
    durationMetRate,
    durationDataCompleteness,
    totalDurationHours,
    avgDurationHours,
    // 适应症指标
    indicationMetCount,
    indicationMetDenominator: validSessionsWithPrePF.length,
    indicationMetRate,
    indicationDataCompleteness,
    // 有效性指标
    effectiveCount,
    effectiveDenominator: validSessionsWithBothPF.length,
    effectiveRate,
    effectiveDataCompleteness,
    // 异常指标
    unclosedCount,
    durationAbnormalCount,
    sequenceAbnormalCount,
    orphanEndCount,
    abnormalRate
  };
}

/**
 * 格式化日期为 CST 时区字符串
 * @param {Date} date - 日期对象
 * @returns {string} YYYY-MM-DD 格式字符串
 */
function formatDateCST(date) {
  const cstDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return cstDate.toISOString().substring(0, 10);
}

/**
 * 格式化月份为 CST 时区字符串
 * @param {Date} date - 日期对象
 * @returns {string} YYYY-MM 格式字符串
 */
function formatMonthCST(date) {
  const cstDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return cstDate.toISOString().substring(0, 7);
}

module.exports = {
  generateProneSessions,
  calculateQualityIndicators,
  calculateSessionIndicators,
  extractPFRatio,
  config
};
