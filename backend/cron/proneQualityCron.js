const { connect } = require("../db");
const { generateProneSessions, calculateQualityIndicators } = require("../utils/proneSessionUtils");
const { calculateDailySummary, calculateHospitalSummary, saveDailySummaries } = require("../utils/proneQualityUtils");

/**
 * 俯卧位质控每日计算任务
 * 每日凌晨 2:00 执行，计算前一日数据
 */
async function runDailyQualityCalculation() {
  console.log("开始执行俯卧位质控每日计算任务...");

  try {
    const db = await connect();

    // 1. 计算昨日日期
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().substring(0, 10);

    console.log(`计算日期: ${dateStr}`);

    // 2. 生成俯卧位治疗记录（增量更新）
    const startDate = dateStr;
    const endDate = dateStr;
    const sessions = await generateProneSessions(db, startDate, endDate);
    console.log(`生成俯卧位治疗记录数量: ${sessions.length}`);

    // 3. 保存俯卧位治疗记录到 prone_session 集合
    const sessionCollection = db.collection("prone_session");
    let insertedCount = 0;
    let updatedCount = 0;

    for (const session of sessions) {
      try {
        const filter = { startEventId: session.startEventId };
        const update = {
          $set: {
            ...session,
            updateTime: new Date()
          },
          $setOnInsert: {
            createTime: new Date()
          }
        };
        const options = { upsert: true };

        const result = await sessionCollection.updateOne(filter, update, options);

        if (result.upsertedCount > 0) {
          insertedCount++;
        } else if (result.modifiedCount > 0) {
          updatedCount++;
        }
      } catch (e) {
        console.error(`保存俯卧位治疗记录失败: ${session.startEventId}`, e.message);
      }
    }

    console.log(`俯卧位治疗记录保存完成: 新增 ${insertedCount}, 更新 ${updatedCount}`);

    // 4. 计算每日汇总
    const dailySummaries = await calculateDailySummary(db, dateStr);
    console.log(`生成科室汇总数量: ${dailySummaries.length}`);

    // 5. 计算全院汇总
    const hospitalSummary = await calculateHospitalSummary(db, dateStr);
    dailySummaries.push(hospitalSummary);
    console.log("生成全院汇总完成");

    // 6. 保存汇总数据
    const saveResult = await saveDailySummaries(db, dailySummaries);
    console.log(`汇总保存完成: 新增 ${saveResult.inserted}, 更新 ${saveResult.updated}`);

    if (saveResult.errors.length > 0) {
      console.error("保存汇总时发生错误:", saveResult.errors);
    }

    console.log("俯卧位质控每日计算任务完成");
    return {
      success: true,
      date: dateStr,
      sessionsCount: sessions.length,
      summariesCount: dailySummaries.length,
      saveResult
    };
  } catch (e) {
    console.error("俯卧位质控每日计算任务失败:", e);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * 手动触发质控计算（用于测试或补算）
 * @param {string} date - 日期（YYYY-MM-DD）
 */
async function runManualQualityCalculation(date) {
  console.log(`开始手动执行俯卧位质控计算任务，日期: ${date}`);

  try {
    const db = await connect();

    // 1. 生成俯卧位治疗记录
    const sessions = await generateProneSessions(db, date, date);
    console.log(`生成俯卧位治疗记录数量: ${sessions.length}`);

    // 2. 保存俯卧位治疗记录
    const sessionCollection = db.collection("prone_session");
    let insertedCount = 0;
    let updatedCount = 0;

    for (const session of sessions) {
      try {
        const filter = { startEventId: session.startEventId };
        const update = {
          $set: {
            ...session,
            updateTime: new Date()
          },
          $setOnInsert: {
            createTime: new Date()
          }
        };
        const options = { upsert: true };

        const result = await sessionCollection.updateOne(filter, update, options);

        if (result.upsertedCount > 0) {
          insertedCount++;
        } else if (result.modifiedCount > 0) {
          updatedCount++;
        }
      } catch (e) {
        console.error(`保存俯卧位治疗记录失败: ${session.startEventId}`, e.message);
      }
    }

    console.log(`俯卧位治疗记录保存完成: 新增 ${insertedCount}, 更新 ${updatedCount}`);

    // 3. 计算每日汇总
    const dailySummaries = await calculateDailySummary(db, date);
    console.log(`生成科室汇总数量: ${dailySummaries.length}`);

    // 4. 计算全院汇总
    const hospitalSummary = await calculateHospitalSummary(db, date);
    dailySummaries.push(hospitalSummary);
    console.log("生成全院汇总完成");

    // 5. 保存汇总数据
    const saveResult = await saveDailySummaries(db, dailySummaries);
    console.log(`汇总保存完成: 新增 ${saveResult.inserted}, 更新 ${saveResult.updated}`);

    if (saveResult.errors.length > 0) {
      console.error("保存汇总时发生错误:", saveResult.errors);
    }

    console.log("俯卧位质控手动计算任务完成");
    return {
      success: true,
      date,
      sessionsCount: sessions.length,
      summariesCount: dailySummaries.length,
      saveResult
    };
  } catch (e) {
    console.error("俯卧位质控手动计算任务失败:", e);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * 批量计算历史数据
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 */
async function runBatchQualityCalculation(startDate, endDate) {
  console.log(`开始批量计算俯卧位质控数据，范围: ${startDate} 至 ${endDate}`);

  const results = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().substring(0, 10);
    console.log(`处理日期: ${dateStr}`);

    const result = await runManualQualityCalculation(dateStr);
    results.push({
      date: dateStr,
      ...result
    });

    // 避免过快执行，给数据库一些喘息时间
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("批量计算完成");
  return results;
}

module.exports = {
  runDailyQualityCalculation,
  runManualQualityCalculation,
  runBatchQualityCalculation
};
