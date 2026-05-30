/**
 * 俯卧位质控功能测试脚本
 * 用于验证核心功能是否正常工作
 */

const { connect } = require("./db");
const { generateProneSessions, calculateQualityIndicators, config } = require("./utils/proneSessionUtils");
const { calculateDailySummary, calculateHospitalSummary } = require("./utils/proneQualityUtils");

async function testProneSessionGeneration() {
  console.log("=== 测试俯卧位治疗记录生成 ===");

  try {
    const db = await connect();

    // 测试日期范围
    const startDate = "2026-04-01";
    const endDate = "2026-04-30";

    console.log(`测试日期范围: ${startDate} 至 ${endDate}`);
    console.log("配置参数:", JSON.stringify(config, null, 2));

    // 生成俯卧位治疗记录
    const sessions = await generateProneSessions(db, startDate, endDate);

    console.log(`\n生成俯卧位治疗记录数量: ${sessions.length}`);

    if (sessions.length > 0) {
      // 统计各类俯卧位治疗记录
      const normalSessions = sessions.filter(s => !s.isAbnormal);
      const abnormalSessions = sessions.filter(s => s.isAbnormal);
      const unclosedSessions = sessions.filter(s => s.isUnclosed);
      const orphanEndSessions = sessions.filter(s => s.isOrphanEnd);
      const durationAbnormalSessions = sessions.filter(s => s.isDurationAbnormal);

      console.log("\n俯卧位治疗记录统计:");
      console.log(`  - 正常记录: ${normalSessions.length}`);
      console.log(`  - 异常记录: ${abnormalSessions.length}`);
      console.log(`  - 未闭合记录: ${unclosedSessions.length}`);
      console.log(`  - 孤立结束记录: ${orphanEndSessions.length}`);
      console.log(`  - 时长异常记录: ${durationAbnormalSessions.length}`);

      // 计算质控指标
      const indicators = calculateQualityIndicators(sessions);

      console.log("\n质控指标:");
      console.log(`  - 俯卧位实施例次: ${indicators.totalSessions}`);
      console.log(`  - 有效例次: ${indicators.validSessions}`);
      console.log(`  - 异常例次: ${indicators.abnormalSessions}`);
      console.log(`  - 单次时长达标率: ${indicators.durationMetRate != null ? indicators.durationMetRate.toFixed(2) + '%' : '-'}`);
      console.log(`  - 适应症符合率: ${indicators.indicationMetRate != null ? indicators.indicationMetRate.toFixed(2) + '%' : '-'}`);
      console.log(`  - 治疗有效率: ${indicators.effectiveRate != null ? indicators.effectiveRate.toFixed(2) + '%' : '-'}`);
      console.log(`  - 累计俯卧位时长: ${indicators.totalDurationHours != null ? indicators.totalDurationHours.toFixed(2) + 'h' : '-'}`);
      console.log(`  - 异常数据率: ${indicators.abnormalRate != null ? indicators.abnormalRate.toFixed(2) + '%' : '-'}`);

      // 显示前 3 个俯卧位治疗记录详情
      console.log("\n前 3 个俯卧位治疗记录详情:");
      sessions.slice(0, 3).forEach((session, index) => {
        console.log(`\n  俯卧位治疗记录 ${index + 1}:`);
        console.log(`    - PID: ${session.pid}`);
        console.log(`    - 开始时间: ${session.startTime}`);
        console.log(`    - 结束时间: ${session.endTime || '未闭合'}`);
        console.log(`    - 时长: ${session.durationHours != null ? session.durationHours.toFixed(2) + 'h' : '-'}`);
        console.log(`    - 治疗前PF: ${session.prePFRatio != null ? session.prePFRatio.toFixed(0) : '-'}`);
        console.log(`    - 治疗后PF: ${session.postPFRatio != null ? session.postPFRatio.toFixed(0) : '-'}`);
        console.log(`    - 是否异常: ${session.isAbnormal ? '是' : '否'}`);
        if (session.isAbnormal) {
          console.log(`    - 异常原因: ${session.abnormalReasons.join(', ')}`);
        }
      });
    }

    console.log("\n=== 测试完成 ===");
    return sessions;
  } catch (e) {
    console.error("测试失败:", e);
    throw e;
  }
}

async function testDailySummary() {
  console.log("\n=== 测试每日汇总计算 ===");

  try {
    const db = await connect();

    // 测试日期
    const date = "2026-04-15";

    console.log(`测试日期: ${date}`);

    // 计算每日汇总
    const dailySummaries = await calculateDailySummary(db, date);

    console.log(`\n生成科室汇总数量: ${dailySummaries.length}`);

    if (dailySummaries.length > 0) {
      console.log("\n科室汇总详情:");
      dailySummaries.forEach(summary => {
        console.log(`\n  ${summary.deptName} (${summary.deptCode}):`);
        console.log(`    - 实施例次: ${summary.totalSessions}`);
        console.log(`    - 有效例次: ${summary.validSessions}`);
        console.log(`    - 时长达标率: ${summary.durationMetRate != null ? summary.durationMetRate.toFixed(2) + '%' : '-'}`);
        console.log(`    - 适应症符合率: ${summary.indicationMetRate != null ? summary.indicationMetRate.toFixed(2) + '%' : '-'}`);
        console.log(`    - 治疗有效率: ${summary.effectiveRate != null ? summary.effectiveRate.toFixed(2) + '%' : '-'}`);
      });
    }

    // 计算全院汇总
    const hospitalSummary = await calculateHospitalSummary(db, date);

    console.log("\n全院汇总:");
    console.log(`  - 实施例次: ${hospitalSummary.totalSessions}`);
    console.log(`  - 有效例次: ${hospitalSummary.validSessions}`);
    console.log(`  - 时长达标率: ${hospitalSummary.durationMetRate != null ? hospitalSummary.durationMetRate.toFixed(2) + '%' : '-'}`);
    console.log(`  - 适应症符合率: ${hospitalSummary.indicationMetRate != null ? hospitalSummary.indicationMetRate.toFixed(2) + '%' : '-'}`);
    console.log(`  - 治疗有效率: ${hospitalSummary.effectiveRate != null ? hospitalSummary.effectiveRate.toFixed(2) + '%' : '-'}`);

    console.log("\n=== 测试完成 ===");
    return { dailySummaries, hospitalSummary };
  } catch (e) {
    console.error("测试失败:", e);
    throw e;
  }
}

async function runTests() {
  console.log("开始俯卧位质控功能测试...\n");

  try {
    await testProneSessionGeneration();
    await testDailySummary();

    console.log("\n✅ 所有测试通过！");
    process.exit(0);
  } catch (e) {
    console.error("\n❌ 测试失败:", e);
    process.exit(1);
  }
}

// 运行测试
runTests();
