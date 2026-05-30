const express = require("express");
const { connect } = require("../db");
const { cstDateStrToUtc, splitByDayCST } = require("../utils/timeUtil");
const { resolveDeptFilter } = require("../utils/deptUtil");
const { generateProneSessions, calculateQualityIndicators } = require("../utils/proneSessionUtils");
const { calculateDailySummary, calculateHospitalSummary } = require("../utils/proneQualityUtils");
const router = express.Router();

/**
 * 俯卧位质控报表 - 获取质控汇总数据
 * GET /api/prone/quality-summary
 * Query: startDate, endDate, deptCode (optional)
 */
router.get("/quality-summary", async (req, res) => {
  try {
    const db = await connect();
    const { startDate, endDate } = req.query;
    const dept = await resolveDeptFilter(db, req.query);

    // 1. 获取俯卧位 session 数据
    const sessions = await generateProneSessions(db, startDate, endDate, dept);

    // 2. 计算质控指标
    const indicators = calculateQualityIndicators(sessions);

    // 3. 按科室分组
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

    // 4. 计算每个科室的指标
    const deptResults = Object.values(byDept).map(dept => {
      const deptIndicators = calculateQualityIndicators(dept.sessions);
      return {
        deptCode: dept.deptCode,
        deptName: dept.deptName,
        ...deptIndicators
      };
    });

    // 5. 计算全院汇总
    const hospitalSummary = {
      deptCode: "TOTAL",
      deptName: "全院汇总",
      isTotal: true,
      ...indicators
    };

    res.json({
      code: 0,
      data: {
        hospitalSummary,
        deptDetails: deptResults,
        dateRange: { startDate, endDate }
      }
    });
  } catch (e) {
    console.error("Error in quality-summary:", e);
    res.status(500).json({ code: 1, msg: e.message });
  }
});

/**
 * 俯卧位质控报表 - 获取俯卧位治疗明细
 * GET /api/prone/session-details
 * Query: startDate, endDate, deptCode (optional), isAbnormal (optional)
 */
router.get("/session-details", async (req, res) => {
  try {
    const db = await connect();
    const { startDate, endDate, isAbnormal } = req.query;
    const dept = await resolveDeptFilter(db, req.query);

    // 1. 获取俯卧位 session 数据
    const sessions = await generateProneSessions(db, startDate, endDate, dept);

    // 2. 过滤异常状态
    let filteredSessions = sessions;
    if (isAbnormal === "true") {
      filteredSessions = sessions.filter(s => s.isAbnormal);
    } else if (isAbnormal === "false") {
      filteredSessions = sessions.filter(s => !s.isAbnormal);
    }

    // 3. 获取患者详细信息
    const pidList = [...new Set(filteredSessions.map(s => s.pid))];
    const patients = await db.collection("patient")
      .find({ _id: { $in: pidList.map(id => require("mongodb").ObjectId.createFromHexString(id)) } })
      .project({ name: 1, mrn: 1, hisBed: 1, bedDoctor: 1, deptCode: 1, dept: 1 })
      .toArray();

    const patientMap = {};
    for (const p of patients) {
      patientMap[p._id.toString()] = p;
    }

    // 4. 组装返回数据
    const details = filteredSessions.map(session => {
      const patient = patientMap[session.pid] || {};
      return {
        ...session,
        patientName: patient.name || "-",
        mrn: patient.mrn,
        bed: patient.hisBed,
        bedDoctor: patient.bedDoctor,
        deptCode: patient.deptCode,
        deptName: patient.dept
      };
    });

    res.json({
      code: 0,
      data: {
        total: details.length,
        details
      }
    });
  } catch (e) {
    console.error("Error in session-details:", e);
    res.status(500).json({ code: 1, msg: e.message });
  }
});

/**
 * 俯卧位质控报表 - 获取每日趋势数据
 * GET /api/prone/daily-trend
 * Query: startDate, endDate, deptCode (optional)
 */
router.get("/daily-trend", async (req, res) => {
  try {
    const db = await connect();
    const { startDate, endDate } = req.query;
    const dept = await resolveDeptFilter(db, req.query);

    // 1. 获取俯卧位 session 数据
    const sessions = await generateProneSessions(db, startDate, endDate, dept);

    // 2. 按日期分组
    const byDate = {};
    for (const session of sessions) {
      const date = session.belongDate;
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(session);
    }

    // 3. 按天生成完整日期列表，用真实数据 left-join 覆盖
    const dateMap = {};
    for (const [date, dateSessions] of Object.entries(byDate)) {
      dateMap[date] = calculateQualityIndicators(dateSessions);
    }

    const trend = [];
    const cur = new Date(startDate + "T00:00:00+08:00");
    const end = new Date(endDate + "T00:00:00+08:00");
    while (cur <= end) {
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, "0");
      const dd = String(cur.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const indicators = dateMap[dateStr];
      trend.push({
        date: dateStr,
        dailySessionCount: indicators ? indicators.totalSessions : 0,
        durationMetRate: indicators ? indicators.durationMetRate : null,
        indicationMetRate: indicators ? indicators.indicationMetRate : null,
        effectiveRate: indicators ? indicators.effectiveRate : null,
        ...(indicators || {})
      });

      cur.setDate(cur.getDate() + 1);
    }

    res.json({
      code: 0,
      data: {
        trend,
        dateRange: { startDate, endDate }
      }
    });
  } catch (e) {
    console.error("Error in daily-trend:", e);
    res.status(500).json({ code: 1, msg: e.message });
  }
});

/**
 * 俯卧位质控报表 - 导出 Excel
 * GET /api/prone/export
 * Query: startDate, endDate, deptCode (optional)
 */
router.get("/export", async (req, res) => {
  try {
    const db = await connect();
    const { startDate, endDate } = req.query;
    const dept = await resolveDeptFilter(db, req.query);

    // 1. 获取俯卧位 session 数据
    const sessions = await generateProneSessions(db, startDate, endDate, dept);

    // 2. 按科室分组计算指标
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

    const deptResults = Object.values(byDept).map(dept => {
      const indicators = calculateQualityIndicators(dept.sessions);
      return {
        deptCode: dept.deptCode,
        deptName: dept.deptName,
        ...indicators
      };
    });

    // 3. 计算全院汇总
    const hospitalSummary = {
      deptCode: "TOTAL",
      deptName: "全院汇总",
      ...calculateQualityIndicators(sessions)
    };

    // 4. 生成 CSV 内容
    const headers = [
      "科室名称",
      "俯卧位实施例次",
      "有效例次",
      "异常例次",
      "单次时长达标率(%)",
      "适应症符合率(%)",
      "治疗有效率(%)",
      "累计俯卧位时长(h)",
      "异常数据率(%)"
    ];

    const rows = [hospitalSummary, ...deptResults].map(item => [
      item.deptName,
      item.totalSessions,
      item.validSessions,
      item.abnormalSessions,
      item.durationMetRate != null ? item.durationMetRate.toFixed(2) : "-",
      item.indicationMetRate != null ? item.indicationMetRate.toFixed(2) : "-",
      item.effectiveRate != null ? item.effectiveRate.toFixed(2) : "-",
      item.totalDurationHours != null ? item.totalDurationHours.toFixed(2) : "-",
      item.abnormalRate != null ? item.abnormalRate.toFixed(2) : "-"
    ]);

    // 5. 生成 CSV 字符串
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // 6. 返回 CSV 文件
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=prone_quality_${startDate}_${endDate}.csv`);
    res.send("﻿" + csvContent); // 添加 BOM 头以支持中文
  } catch (e) {
    console.error("Error in export:", e);
    res.status(500).json({ code: 1, msg: e.message });
  }
});

module.exports = router;
