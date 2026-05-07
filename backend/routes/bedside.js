const express = require("express");
const { connect } = require("../db");
const { splitByDayCST, cstDateStrToUtc, clipRange } = require("../utils/timeUtil");
const { resolveDeptFilter, resolvePatientPid } = require("../utils/deptUtil");
const router = express.Router();
const MAX_BEDSIDE_SEG_MS = 60 * 60 * 1000;

router.get("/duration", async (req, res) => {
  try {
    const db = await connect();
    const { startDate, endDate } = req.query;
    const pid = await resolvePatientPid(db, req.query);
    const queryCode = String(req.query.code || "");
    const code = req.query.bedsideCode || req.query.itemCode || (queryCode.startsWith("param_") ? queryCode : "param_XiYangTuJing");
    const dept = await resolveDeptFilter(db, req.query);
    const rangeStart = cstDateStrToUtc(startDate, false);
    const rangeEnd = cstDateStrToUtc(endDate, true);

    const match = { code, valid: true, strVal: { $ne: null } };
    if (pid) match.pid = pid;
    if (rangeStart || rangeEnd) {
      match.time = {};
      if (rangeStart) match.time.$gte = new Date(rangeStart.getTime() - MAX_BEDSIDE_SEG_MS);
      if (rangeEnd) match.time.$lte = new Date(rangeEnd.getTime() + MAX_BEDSIDE_SEG_MS);
    }

    let pipeline = [{ $match: match }, { $sort: { pid: 1, time: 1 } }];

    if (dept) {
      pipeline.push(
        { $addFields: { pidObj: { $toObjectId: "$pid" } } },
        { $lookup: { from: "patient", localField: "pidObj", foreignField: "_id", as: "patient" } },
        { $match: { "patient.deptCode": dept.code } }
      );
    }
    pipeline.push({ $project: { pid: 1, strVal: 1, time: 1 } });

    const docs = await db.collection("bedside").aggregate(pipeline).toArray();

    const byPid = {};
    for (const d of docs) (byPid[d.pid] = byPid[d.pid] || []).push(d);

    const bucket = {};

    for (const [p, arr] of Object.entries(byPid)) {
      for (let i = 0; i < arr.length; i++) {
        const cur = arr[i], next = arr[i + 1];
        if (!next) continue;
        const segStart = cur.time;
        const cappedEnd = new Date(cur.time.getTime() + MAX_BEDSIDE_SEG_MS);
        const segEnd = new Date(Math.min(next.time.getTime(), cappedEnd.getTime()));
        const clipped = clipRange(segStart, segEnd, rangeStart, rangeEnd);
        if (!clipped) continue;
        const [s, e] = clipped;
        const key = `${p}|${cur.strVal}`;
        if (!bucket[key]) {
          bucket[key] = { pid: p, strVal: cur.strVal, totalSec: 0, segCount: 0, dailyMap: {}, records: [] };
        }
        const segs = splitByDayCST(s, e);
        const segSec = segs.reduce((a, x) => a + x.durationSec, 0);
        bucket[key].totalSec += segSec;
        bucket[key].segCount += 1;
        for (const sg of segs) bucket[key].dailyMap[sg.date] = (bucket[key].dailyMap[sg.date] || 0) + sg.durationSec;
        if (pid) bucket[key].records.push({ startTime: s, endTime: e, durationSec: segSec, isOpen: !next });
      }
    }

    const list = Object.values(bucket).map(b => ({
      pid: b.pid, strVal: b.strVal,
      totalSec: b.totalSec,
      totalHours: +(b.totalSec / 3600).toFixed(2),
      segCount: b.segCount,
      daily: Object.entries(b.dailyMap).sort(([a],[c]) => a.localeCompare(c))
        .map(([date, sec]) => ({ date, sec, hours: +(sec / 3600).toFixed(2) })),
      records: b.records
    }));

    res.json({ code: 0, data: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 1, msg: e.message });
  }
});

module.exports = router;
