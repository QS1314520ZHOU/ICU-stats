const express = require("express");
const { ObjectId } = require("mongodb");
const { connect } = require("../db");
const { resolveDeptFilter } = require("../utils/deptUtil");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db = await connect();
    const { keyword = "", hisPid = "", page = 1, size = 20 } = req.query;
    const dept = await resolveDeptFilter(db, req.query);
    const filter = {};
    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { hisPid: { $regex: keyword } },
        { mrn: { $regex: keyword } }
      ];
    }
    if (hisPid) filter.hisPid = String(hisPid).trim();
    if (dept) filter.deptCode = dept.code;

    const skip = (Number(page) - 1) * Number(size);
    const [list, total] = await Promise.all([
      db.collection("patient")
        .find(filter, {
          projection: {
            name: 1, hisPid: 1, mrn: 1, gender: 1, birthday: 1,
            dept: 1, deptCode: 1, hisBed: 1, admissionDiagnosis: 1, status: 1,
            admissionTime: 1, bedDoctor: 1
          }
        })
        .sort({ admissionTime: -1 })
        .skip(skip).limit(Number(size))
        .toArray(),
      db.collection("patient").countDocuments(filter)
    ]);
    res.json({ code: 0, data: { list, total } });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

router.get("/depts", async (_req, res) => {
  try {
    const db = await connect();
    const depts = await db.collection("department")
      .find(
        { code: { $nin: [null, ""] }, name: { $nin: [null, ""] } },
        { projection: { _id: 0, code: 1, name: 1 } }
      )
      .sort({ name: 1 })
      .toArray();
    res.json({ code: 0, data: depts });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const db = await connect();
    const doc = await db.collection("patient").findOne({ _id: new ObjectId(req.params.id) });
    res.json({ code: 0, data: doc });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

module.exports = router;
