const { connect } = require("../db");
const { cstDateStrToUtc } = require("./timeUtil");

/**
 * 计算每日质控汇总
 * @param {Object} db - MongoDB 数据库连接
 * @param {string} date - 日期（YYYY-MM-DD）
 * @returns {Array} 按科室分组的汇总列表
 */
async function calculateDailySummary(db, date) {
  const startDate = cstDateStrToUtc(date, false);
  const endDate = cstDateStrToUtc(date, true);

  // 获取该日期的所有俯卧位 session
  const sessions = await db.collection("prone_session")
    .find({
      startTime: { $gte: startDate, $lte: endDate }
    })
    .toArray();

  // 按科室分组
  const byDept = {};
  for (const session of sessions) {
    const deptCode = session.deptCode || "unknown";
    if (!byDept[deptCode]) {
      byDept[deptCode] = {
        deptCode,
        deptName: session.deptName || "未知科室",
        sessions: []
      };
    }
    byDept[deptCode].sessions.push(session);
  }

  // 计算每个科室的指标
  const results = [];
  for (const [deptCode, deptData] of Object.entries(byDept)) {
    const indicators = calculateDailyIndicators(deptData.sessions);
    results.push({
      reportDate: date,
      reportMonth: date.substring(0, 7),
      deptCode,
      deptName: deptData.deptName,
      isTotal: false,
      ...indicators,
      createTime: new Date(),
      updateTime: new Date()
    });
  }

  return results;
}

/**
 * 计算全院汇总
 * @param {Object} db - MongoDB 数据库连接
 * @param {string} date - 日期（YYYY-MM-DD）
 * @returns {Object} 全院汇总
 */
async function calculateHospitalSummary(db, date) {
  const startDate = cstDateStrToUtc(date, false);
  const endDate = cstDateStrToUtc(date, true);

  // 获取该日期的所有俯卧位 session
  const sessions = await db.collection("prone_session")
    .find({
      startTime: { $gte: startDate, $lte: endDate }
    })
    .toArray();

  const indicators = calculateDailyIndicators(sessions);

  return {
    reportDate: date,
    reportMonth: date.substring(0, 7),
    deptCode: "TOTAL",
    deptName: "全院汇总",
    isTotal: true,
    ...indicators,
    createTime: new Date(),
    updateTime: new Date()
  };
}

/**
 * 计算每日指标
 * @param {Array} sessions - 俯卧位治疗记录列表
 * @returns {Object} 指标汇总
 */
function calculateDailyIndicators(sessions) {
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

  return {
    totalSessions,
    validSessions,
    abnormalSessions,
    durationMetCount,
    durationMetRate,
    totalDurationHours,
    avgDurationHours,
    indicationMetCount,
    indicationMetRate,
    effectiveCount,
    effectiveRate,
    unclosedCount,
    durationAbnormalCount,
    sequenceAbnormalCount,
    orphanEndCount,
    abnormalRate
  };
}

/**
 * 保存每日汇总到 prone_quality_daily 集合
 * @param {Object} db - MongoDB 数据库连接
 * @param {Array} dailySummaries - 每日汇总列表
 * @returns {Object} 保存结果
 */
async function saveDailySummaries(db, dailySummaries) {
  const collection = db.collection("prone_quality_daily");

  const results = {
    inserted: 0,
    updated: 0,
    errors: []
  };

  for (const summary of dailySummaries) {
    try {
      const filter = {
        reportDate: summary.reportDate,
        deptCode: summary.deptCode
      };

      const update = {
        $set: {
          ...summary,
          updateTime: new Date()
        },
        $setOnInsert: {
          createTime: new Date()
        }
      };

      const options = { upsert: true };

      const result = await collection.updateOne(filter, update, options);

      if (result.upsertedCount > 0) {
        results.inserted++;
      } else if (result.modifiedCount > 0) {
        results.updated++;
      }
    } catch (e) {
      results.errors.push({
        deptCode: summary.deptCode,
        error: e.message
      });
    }
  }

  return results;
}

/**
 * 获取质控报表数据
 * @param {Object} db - MongoDB 数据库连接
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @param {string} deptCode - 科室编码（可选）
 * @returns {Object} 报表数据
 */
async function getQualityReport(db, startDate, endDate, deptCode = null) {
  const filter = {
    reportDate: { $gte: startDate, $lte: endDate }
  };

  if (deptCode) {
    filter.deptCode = deptCode;
  }

  const collection = db.collection("prone_quality_daily");
  const records = await collection.find(filter).sort({ reportDate: 1, deptCode: 1 }).toArray();

  // 按科室分组
  const byDept = {};
  for (const record of records) {
    const dept = record.deptCode;
    if (!byDept[dept]) {
      byDept[dept] = {
        deptCode: dept,
        deptName: record.deptName,
        records: []
      };
    }
    byDept[dept].records.push(record);
  }

  // 计算汇总
  const summary = {
    totalSessions: 0,
    validSessions: 0,
    abnormalSessions: 0,
    durationMetCount: 0,
    indicationMetCount: 0,
    effectiveCount: 0,
    totalDurationHours: 0,
    unclosedCount: 0,
    durationAbnormalCount: 0,
    sequenceAbnormalCount: 0,
    orphanEndCount: 0
  };

  for (const record of records) {
    if (record.isTotal) continue; // 跳过已有的全院汇总
    summary.totalSessions += record.totalSessions || 0;
    summary.validSessions += record.validSessions || 0;
    summary.abnormalSessions += record.abnormalSessions || 0;
    summary.durationMetCount += record.durationMetCount || 0;
    summary.indicationMetCount += record.indicationMetCount || 0;
    summary.effectiveCount += record.effectiveCount || 0;
    summary.totalDurationHours += record.totalDurationHours || 0;
    summary.unclosedCount += record.unclosedCount || 0;
    summary.durationAbnormalCount += record.durationAbnormalCount || 0;
    summary.sequenceAbnormalCount += record.sequenceAbnormalCount || 0;
    summary.orphanEndCount += record.orphanEndCount || 0;
  }

  // 计算比率
  summary.durationMetRate = summary.validSessions > 0
    ? (summary.durationMetCount / summary.validSessions) * 100
    : null;
  summary.indicationMetRate = summary.validSessions > 0
    ? (summary.indicationMetCount / summary.validSessions) * 100
    : null;
  summary.effectiveRate = summary.validSessions > 0
    ? (summary.effectiveCount / summary.validSessions) * 100
    : null;
  summary.abnormalRate = summary.totalSessions > 0
    ? (summary.abnormalSessions / summary.totalSessions) * 100
    : null;

  return {
    dateRange: { startDate, endDate },
    summary,
    deptDetails: Object.values(byDept)
  };
}

module.exports = {
  calculateDailySummary,
  calculateHospitalSummary,
  calculateDailyIndicators,
  saveDailySummaries,
  getQualityReport
};
