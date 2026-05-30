const express = require("express");
const { connect } = require("../db");
const { cstDateStrToUtc } = require("../utils/timeUtil");
const { generateProneSessions, calculateQualityIndicators } = require("../utils/proneSessionUtils");
const router = express.Router();

/**
 * GET /api/dashboard/summary?deptCode=xxx
 * 返回仪表盘 KPI 数据，支持按科室过滤
 */
router.get("/summary", async (req, res) => {
  try {
    const db = await connect();
    const { deptCode } = req.query;
    const patientFilter = deptCode ? { deptCode } : {};

    // 1. 当前在科患者数
    const admittedCount = await db.collection("patient")
      .countDocuments({ status: "admitted", ...patientFilter });

    // 2. 进行中俯卧位数量
    const now = new Date();
    let activeProneCount = 0;
    try {
      // 先查出目标科室的在科患者 pid 列表
      const admittedPids = await getAdmittedPids(db, deptCode);
      if (admittedPids.length > 0) {
        const unclosedProne = await db.collection("bedside").aggregate([
          { $match: {
            code: "param_TiWei",
            strVal: { $in: ["俯卧位开始", "俯卧位结束"] },
            valid: true,
            pid: { $in: admittedPids }
          }},
          { $sort: { pid: 1, time: 1 } },
          { $group: {
            _id: "$pid",
            events: { $push: { strVal: "$strVal", time: "$time" } }
          }},
          { $project: {
            hasUnclosed: {
              $let: {
                vars: {
                  lastEvent: { $arrayElemAt: ["$events", { $subtract: [{ $size: "$events" }, 1] }] }
                },
                in: { $eq: ["$$lastEvent.strVal", "俯卧位开始"] }
              }
            }
          }},
          { $match: { hasUnclosed: true } },
          { $count: "count" }
        ]).toArray();
        activeProneCount = unclosedProne[0]?.count || 0;
      }
    } catch (e) {
      console.error("Dashboard: activeProne query error:", e.message);
    }

    // 3. 今日微泵记录数
    const todayStart = cstDateStrToUtc(formatDate(now), false);
    const todayEnd = cstDateStrToUtc(formatDate(now), true);
    let todayDrugCount = 0;
    if (deptCode) {
      // 需要先查出该科室患者的 pid
      const pids = await getAdmittedPids(db, deptCode);
      if (pids.length > 0) {
        todayDrugCount = await db.collection("drugExe")
          .countDocuments({ pid: { $in: pids }, startTime: { $gte: todayStart, $lte: todayEnd } });
      }
    } else {
      todayDrugCount = await db.collection("drugExe")
        .countDocuments({ startTime: { $gte: todayStart, $lte: todayEnd } });
    }

    // 4. 本月俯卧位例次 + 异常数
    const monthStart = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = formatDate(now);
    let monthProneCount = 0;
    let monthAbnormalCount = 0;
    try {
      const dept = deptCode ? { code: deptCode } : null;
      const sessions = await generateProneSessions(db, monthStart, monthEnd, dept);
      monthProneCount = sessions.length;
      monthAbnormalCount = sessions.filter(s => s.isAbnormal).length;
    } catch (e) {
      console.error("Dashboard: prone session query error:", e.message);
    }

    res.json({
      code: 0,
      data: {
        admittedCount,
        activeProneCount,
        todayDrugCount,
        monthAbnormalCount,
        monthProneCount
      }
    });
  } catch (e) {
    console.error("Error in dashboard/summary:", e);
    res.status(500).json({ code: 1, msg: e.message });
  }
});

/**
 * GET /api/dashboard/alerts?deptCode=xxx
 * 返回最近 24h 异常事件（未闭合超时的俯卧位）
 */
router.get("/alerts", async (req, res) => {
  try {
    const db = await connect();
    const { deptCode } = req.query;
    const now = new Date();
    const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 查目标科室的在科患者
    const admittedPids = await getAdmittedPids(db, deptCode);
    if (admittedPids.length === 0) {
      return res.json({ code: 0, data: [] });
    }

    // 查最近 24h 内的"俯卧位开始"事件
    const recentStarts = await db.collection("bedside").find({
      code: "param_TiWei",
      strVal: "俯卧位开始",
      valid: true,
      time: { $gte: h24Ago },
      pid: { $in: admittedPids }
    }).toArray();

    if (recentStarts.length === 0) {
      return res.json({ code: 0, data: [] });
    }

    // 检查哪些没有对应的"俯卧位结束"
    const alerts = [];
    for (const start of recentStarts) {
      const unclosedHours = (now.getTime() - start.time.getTime()) / (1000 * 60 * 60);
      if (unclosedHours <= 24) {
        const endEvent = await db.collection("bedside").findOne({
          pid: start.pid,
          code: "param_TiWei",
          strVal: "俯卧位结束",
          valid: true,
          time: { $gt: start.time }
        });
        if (!endEvent) {
          alerts.push({
            pid: start.pid,
            startTime: start.time,
            unclosedHours: Math.round(unclosedHours * 10) / 10
          });
        }
      }
    }

    // 关联患者信息
    if (alerts.length > 0) {
      const { ObjectId } = require("mongodb");
      const pidList = [...new Set(alerts.map(a => a.pid))];
      const patients = await db.collection("patient")
        .find({ _id: { $in: pidList.map(id => ObjectId.createFromHexString(id)) } })
        .project({ name: 1, hisBed: 1, mrn: 1 })
        .toArray();
      const pMap = {};
      for (const p of patients) pMap[p._id.toString()] = p;

      for (const a of alerts) {
        const p = pMap[a.pid];
        a.patientName = p?.name || "-";
        a.bed = p?.hisBed || "-";
        a.mrn = p?.mrn || "-";
      }
    }

    alerts.sort((a, b) => b.unclosedHours - a.unclosedHours);

    res.json({ code: 0, data: alerts });
  } catch (e) {
    console.error("Error in dashboard/alerts:", e);
    res.status(500).json({ code: 1, msg: e.message });
  }
});

/**
 * 获取在科患者 pid 列表（可选按科室过滤）
 */
async function getAdmittedPids(db, deptCode) {
  const filter = { status: "admitted" };
  if (deptCode) filter.deptCode = deptCode;
  const patients = await db.collection("patient")
    .find(filter)
    .project({ _id: 1 })
    .toArray();
  return patients.map(p => p._id.toString());
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

module.exports = router;
