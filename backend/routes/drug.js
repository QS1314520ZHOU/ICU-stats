const express = require("express");
const { connect } = require("../db");
const { splitByDayCST, cstDateStrToUtc, clipRange } = require("../utils/timeUtil");
const { resolveDeptFilter, resolvePatientPid } = require("../utils/deptUtil");
const router = express.Router();

function normalizeDrugName(name = "") {
  return String(name)
    .replace(/^[●*·\s]+/, "")
    .replace(/^[（(][^)）]+[）)]/, "")
    .replace(/[\s]*\d+(?:\.\d+)?\s*(?:mg|g|ml|iu|IU|ug|μg|支|袋|瓶|片|粒|单位)\s*$/i, "")
    .trim();
}

function toDateOrNull(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setSeconds(0, 0);
  return d;
}

function actionTime(action, row) {
  const t = toDateOrNull(action.time);
  if (t) return t;

  const name = String(action.action || "").toLowerCase();
  if (name === "start" || name === "recovery") return toDateOrNull(row.startTime);
  if (name === "pause" || name === "stop") return toDateOrNull(row.endTime);
  return null;
}

function firstDrugTime(row) {
  const times = [
    toDateOrNull(row.startTime),
    ...(Array.isArray(row.drugActionList) ? row.drugActionList.map(action => actionTime(action, row)) : [])
  ].filter(Boolean);
  return times.length ? Math.min(...times.map(t => t.getTime())) : 0;
}

function buildDrugIntervals(row, inferredEnd) {
  const fallbackStart = toDateOrNull(row.startTime);
  const fallbackEnd = toDateOrNull(row.endTime) || toDateOrNull(inferredEnd);
  const actions = Array.isArray(row.drugActionList) ? row.drugActionList : [];
  const timedActions = actions
    .map((action, index) => ({ ...action, index, time: actionTime(action, row) }))
    .filter(action => action.time)
    .sort((a, b) => a.time - b.time || a.index - b.index);

  if (!timedActions.length) {
    return fallbackStart && fallbackEnd && fallbackEnd > fallbackStart
      ? [{ startTime: fallbackStart, endTime: fallbackEnd, inferredEnd: !row.endTime, source: "fallback" }]
      : [];
  }

  const intervals = [];
  let runningStart = null;
  let hasStartAction = false;
  for (const action of timedActions) {
    const name = String(action.action || "").toLowerCase();
    if (name === "start" || name === "recovery") {
      hasStartAction = true;
      if (!runningStart) runningStart = action.time;
      continue;
    }
    if (name === "pause" || name === "stop") {
      if (!runningStart && !hasStartAction && intervals.length === 0 && fallbackStart && fallbackStart < action.time) {
        runningStart = fallbackStart;
      }
      if (runningStart && action.time > runningStart) {
        intervals.push({ startTime: runningStart, endTime: action.time, inferredEnd: false, source: "drugActionList" });
      }
      runningStart = null;
    }
  }

  const end = fallbackEnd || timedActions[timedActions.length - 1]?.time;
  if (runningStart && end && end > runningStart) {
    intervals.push({ startTime: runningStart, endTime: end, inferredEnd: !row.endTime, source: "drugActionList" });
  }

  return intervals;
}

/**
 * GET /api/drug/duration
 *   query: pid, dept, startDate=YYYY-MM-DD, endDate=YYYY-MM-DD
 */
router.get("/duration", async (req, res) => {
  try {
    const db = await connect();
    const { startDate, endDate } = req.query;
    const pid = await resolvePatientPid(db, req.query);
    const dept = await resolveDeptFilter(db, req.query);
    const rangeStart = cstDateStrToUtc(startDate, false);
    const rangeEnd = cstDateStrToUtc(endDate, true);

    const match = {
      methodCode: { $in: ["43", "77"] },
      $or: [{ startTime: { $ne: null } }, { "drugActionList.time": { $ne: null } }],
      "drugList.0": { $exists: true },
      status: { $ne: "invalid" },
      statsu: { $ne: "invalid" }
    };
    if (pid) match.pid = pid;
    if (rangeStart || rangeEnd) {
      match.$and = [];
      if (rangeStart) {
        match.$and.push({
          $or: [
            { endTime: { $gte: rangeStart } },
            { endTime: null },
            { "drugActionList.time": { $gte: rangeStart } }
          ]
        });
      }
      if (rangeEnd) {
        match.$and.push({
          $or: [
            { startTime: { $lte: rangeEnd } },
            { startTime: null },
            { "drugActionList.time": { $lte: rangeEnd } }
          ]
        });
      }
    }

    let pipeline = [{ $match: match }];

    if (dept) {
      pipeline.push(
        { $addFields: { pidObj: { $toObjectId: "$pid" } } },
        { $lookup: { from: "patient", localField: "pidObj", foreignField: "_id", as: "patient" } },
        { $match: { "patient.deptCode": dept.code } }
      );
    }

    pipeline.push({
      $addFields: {
        drugName: { $arrayElemAt: ["$drugList.name", 0] },
        drugSpec: { $arrayElemAt: ["$drugList.specs", 0] }
      }
    });
    pipeline.push({ $project: { pid: 1, drugName: 1, drugSpec: 1, startTime: 1, endTime: 1, drugActionList: 1, methodCode: 1, frequency: 1, orderUser: 1 } });

    const records = await db.collection("drugExe").aggregate(pipeline).toArray();

    const rawBucket = {};
    for (const r of records) {
      const displayName = normalizeDrugName(r.drugName) || r.drugName;
      const key = `${r.pid}|${displayName}`;
      if (!rawBucket[key]) {
        rawBucket[key] = {
          pid: r.pid, drugName: displayName, drugSpec: r.drugSpec,
          rows: []
        };
      }
      rawBucket[key].rows.push(r);
    }

    const list = Object.values(rawBucket).map(b => {
      const rows = b.rows.sort((a, c) => firstDrugTime(a) - firstDrugTime(c));
      const intervals = [];
      const recordsForPid = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const next = rows[i + 1];
        const inferredEnd = r.endTime || next?.startTime;
        for (const interval of buildDrugIntervals(r, inferredEnd)) {
          const clipped = clipRange(interval.startTime, interval.endTime, rangeStart, rangeEnd);
          if (!clipped) continue;
          const [s, e] = clipped;
          intervals.push([s, e]);
          if (pid) recordsForPid.push({
            drugName: r.drugName,
            startTime: s, endTime: e, durationSec: Math.round((e - s) / 1000),
            inferredEnd: interval.inferredEnd,
            source: interval.source,
            methodCode: r.methodCode, frequency: r.frequency, orderUser: r.orderUser
          });
        }
      }
      const dailyMap = {};
      let totalSec = 0;
      for (const [s, e] of intervals) {
        const segs = splitByDayCST(s, e);
        const sec = segs.reduce((a, x) => a + x.durationSec, 0);
        totalSec += sec;
        for (const sg of segs) dailyMap[sg.date] = (dailyMap[sg.date] || 0) + sg.durationSec;
      }
      return {
        pid: b.pid, drugName: b.drugName, drugSpec: b.drugSpec,
        totalSec,
        totalHours: +(totalSec / 3600).toFixed(2),
        segCount: intervals.length,
        daily: Object.entries(dailyMap).sort(([a],[c]) => a.localeCompare(c))
          .map(([date, sec]) => ({ date, sec, hours: +(sec / 3600).toFixed(2) })),
        records: recordsForPid
      };
    });

    res.json({ code: 0, data: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 1, msg: e.message });
  }
});

module.exports = router;
