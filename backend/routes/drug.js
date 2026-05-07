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
      startTime: { $ne: null },
      "drugList.0": { $exists: true },
      status: { $ne: "invalid" },
      statsu: { $ne: "invalid" }
    };
    if (pid) match.pid = pid;
    if (rangeStart || rangeEnd) {
      match.$and = [];
      if (rangeStart) match.$and.push({ $or: [{ endTime: { $gte: rangeStart } }, { endTime: null }] });
      if (rangeEnd)   match.$and.push({ startTime: { $lte: rangeEnd } });
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
    pipeline.push({ $project: { pid: 1, drugName: 1, drugSpec: 1, startTime: 1, endTime: 1, methodCode: 1, frequency: 1, orderUser: 1 } });

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
      const rows = b.rows.sort((a, c) => a.startTime - c.startTime);
      const intervals = [];
      const recordsForPid = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const next = rows[i + 1];
        const inferredEnd = r.endTime || next?.startTime;
        if (!inferredEnd) continue;
        const clipped = clipRange(r.startTime, inferredEnd, rangeStart, rangeEnd);
        if (!clipped) continue;
        const [s, e] = clipped;
        intervals.push([s, e]);
        if (pid) recordsForPid.push({
          drugName: r.drugName,
          startTime: s, endTime: e, durationSec: Math.round((e - s) / 1000),
          inferredEnd: !r.endTime,
          methodCode: r.methodCode, frequency: r.frequency, orderUser: r.orderUser
        });
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
