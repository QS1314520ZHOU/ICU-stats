const { MongoClient } = require("mongodb");
const url = process.env.MONGO_URL || "mongodb://localhost:27017";
const dbName = process.env.MONGO_DB || "SmartCare";
let db;
let indexesReady;

async function ensureIndexes(database) {
  if (indexesReady) return indexesReady;
  indexesReady = Promise.all([
    database.collection("patient").createIndexes([
      { key: { hisPid: 1, deptCode: 1 }, name: "hisPid_deptCode" },
      { key: { deptCode: 1, admissionTime: -1 }, name: "deptCode_admissionTime" },
      { key: { admissionTime: -1 }, name: "admissionTime_desc" }
    ]),
    database.collection("drugExe").createIndexes([
      { key: { pid: 1, methodCode: 1, startTime: 1, endTime: 1 }, name: "pid_method_start_end" },
      { key: { methodCode: 1, startTime: 1, endTime: 1 }, name: "method_start_end" }
    ]),
    database.collection("bedside").createIndexes([
      { key: { pid: 1, code: 1, valid: 1, time: 1 }, name: "pid_code_valid_time" },
      { key: { code: 1, valid: 1, time: 1 }, name: "code_valid_time" }
    ]),
    database.collection("department").createIndexes([
      { key: { code: 1 }, name: "dept_code" },
      { key: { name: 1 }, name: "dept_name" }
    ]),
    // 俯卧位质控相关索引
    database.collection("prone_session").createIndexes([
      { key: { pid: 1, startTime: 1 }, name: "pid_startTime" },
      { key: { mrn: 1, startTime: 1 }, name: "mrn_startTime" },
      { key: { deptCode: 1, belongDate: 1 }, name: "deptCode_belongDate" },
      { key: { belongDate: 1 }, name: "belongDate" },
      { key: { isAbnormal: 1, abnormalReasons: 1 }, name: "isAbnormal_abnormalReasons" },
      { key: { startEventId: 1 }, name: "startEventId_unique", unique: true },
      { key: { deptCode: 1, isAbnormal: 1, belongDate: 1 }, name: "deptCode_isAbnormal_belongDate" }
    ]),
    database.collection("prone_quality_daily").createIndexes([
      { key: { reportDate: 1, deptCode: 1 }, name: "reportDate_deptCode_unique", unique: true },
      { key: { reportMonth: 1, deptCode: 1 }, name: "reportMonth_deptCode" },
      { key: { deptCode: 1, reportDate: 1 }, name: "deptCode_reportDate" },
      { key: { reportDate: 1, isTotal: 1 }, name: "reportDate_isTotal" }
    ])
  ]).catch((e) => {
    indexesReady = null;
    console.error("Failed to create MongoDB indexes:", e);
  });
  return indexesReady;
}

async function connect() {
  if (db) return db;
  const client = new MongoClient(url);
  await client.connect();
  db = client.db(dbName);
  await ensureIndexes(db);
  console.log("MongoDB connected:", dbName);
  return db;
}
module.exports = { connect };
