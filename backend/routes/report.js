const express = require("express");
const ExcelJS = require("exceljs");
const { connect } = require("../db");
const { resolveDeptFilter } = require("../utils/deptUtil");
const router = express.Router();

router.get("/export", async (req, res) => {
  try {
    const { startDate, endDate, hisPid } = req.query;
    const dept = await resolveDeptFilter(await connect(), req.query);
    const base = `http://localhost:${process.env.PORT || 3000}`;
    const qs = new URLSearchParams();
    if (startDate) qs.append("startDate", startDate);
    if (endDate) qs.append("endDate", endDate);
    if (dept) qs.append("deptCode", dept.code);
    if (hisPid) qs.append("hisPid", hisPid);
    const q = qs.toString();

    const [drugR, oxyR] = await Promise.all([
      fetch(`${base}/api/drug/duration?${q}`).then(r => r.json()),
      fetch(`${base}/api/bedside/duration?${q}`).then(r => r.json())
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "ICU Stats";

    const s1 = wb.addWorksheet("微泵时长");
    s1.columns = [
      { header: "病人ID", key: "pid", width: 28 },
      { header: "药品", key: "drugName", width: 32 },
      { header: "规格", key: "drugSpec", width: 24 },
      { header: "段数", key: "segCount", width: 8 },
      { header: "微泵总时长(小时)", key: "totalHours", width: 18 }
    ];
    (drugR.data || []).forEach(d => s1.addRow(d));
    s1.getRow(1).font = { bold: true };

    const s2 = wb.addWorksheet("氧疗途径时长");
    s2.columns = [
      { header: "病人ID", key: "pid", width: 28 },
      { header: "氧疗途径", key: "strVal", width: 18 },
      { header: "段数", key: "segCount", width: 8 },
      { header: "总时长(小时)", key: "totalHours", width: 14 }
    ];
    (oxyR.data || []).forEach(d => s2.addRow(d));
    s2.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=icu-stats-${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 1, msg: e.message });
  }
});

module.exports = router;
