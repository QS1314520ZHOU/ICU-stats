/**
 * 俯卧位质控集合结构验证脚本
 * 用于验证 prone_session 和 prone_quality_daily 集合结构
 */

const { connect } = require("./db");

async function validateProneSessionSchema() {
  console.log("=== 验证 prone_session 集合结构 ===");

  try {
    const db = await connect();
    const collection = db.collection("prone_session");

    // 检查集合是否存在
    const collections = await db.listCollections({ name: "prone_session" }).toArray();
    if (collections.length === 0) {
      console.log("⚠️  prone_session 集合不存在，需要创建");
      return false;
    }

    console.log("✅ prone_session 集合存在");

    // 检查索引
    const indexes = await collection.indexes();
    console.log("\n索引列表:");
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // 检查文档数量
    const count = await collection.countDocuments();
    console.log(`\n文档数量: ${count}`);

    // 如果有文档，检查结构
    if (count > 0) {
      const sample = await collection.findOne();
      console.log("\n样本文档结构:");
      console.log(JSON.stringify(sample, null, 2));
    }

    return true;
  } catch (e) {
    console.error("验证失败:", e);
    return false;
  }
}

async function validateProneQualityDailySchema() {
  console.log("\n=== 验证 prone_quality_daily 集合结构 ===");

  try {
    const db = await connect();
    const collection = db.collection("prone_quality_daily");

    // 检查集合是否存在
    const collections = await db.listCollections({ name: "prone_quality_daily" }).toArray();
    if (collections.length === 0) {
      console.log("⚠️  prone_quality_daily 集合不存在，需要创建");
      return false;
    }

    console.log("✅ prone_quality_daily 集合存在");

    // 检查索引
    const indexes = await collection.indexes();
    console.log("\n索引列表:");
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // 检查文档数量
    const count = await collection.countDocuments();
    console.log(`\n文档数量: ${count}`);

    // 如果有文档，检查结构
    if (count > 0) {
      const sample = await collection.findOne();
      console.log("\n样本文档结构:");
      console.log(JSON.stringify(sample, null, 2));
    }

    return true;
  } catch (e) {
    console.error("验证失败:", e);
    return false;
  }
}

async function createCollectionsWithValidation() {
  console.log("=== 创建集合并设置 Schema Validator ===");

  try {
    const db = await connect();

    // 创建 prone_session 集合
    const sessionCollections = await db.listCollections({ name: "prone_session" }).toArray();
    if (sessionCollections.length === 0) {
      console.log("创建 prone_session 集合...");
      await db.createCollection("prone_session", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["pid", "mrn", "deptCode", "startTime", "belongDate"],
            properties: {
              pid: { bsonType: "string", description: "患者ID" },
              mrn: { bsonType: "string", description: "病案号" },
              deptCode: { bsonType: "string", description: "科室编码" },
              startTime: { bsonType: "date", description: "俯卧位开始时间" },
              endTime: { bsonType: ["date", "null"], description: "俯卧位结束时间" },
              durationHours: { bsonType: ["number", "null"], minimum: 0, description: "持续时长（小时）" },
              prePFRatio: { bsonType: ["number", "null"], minimum: 0, description: "治疗前PF比值" },
              postPFRatio: { bsonType: ["number", "null"], minimum: 0, description: "治疗后PF比值" },
              isAbnormal: { bsonType: "bool", description: "是否异常" },
              abnormalReasons: { bsonType: "array", items: { bsonType: "string" }, description: "异常原因" },
              belongDate: { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "归属日期" },
              belongMonth: { bsonType: "string", pattern: "^\\d{4}-\\d{2}$", description: "归属月份" },
              version: { bsonType: "int", minimum: 1, description: "版本号" }
            }
          }
        }
      });
      console.log("✅ prone_session 集合创建成功");
    } else {
      console.log("✅ prone_session 集合已存在");
    }

    // 创建 prone_quality_daily 集合
    const dailyCollections = await db.listCollections({ name: "prone_quality_daily" }).toArray();
    if (dailyCollections.length === 0) {
      console.log("创建 prone_quality_daily 集合...");
      await db.createCollection("prone_quality_daily", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["reportDate", "deptCode", "totalSessions"],
            properties: {
              reportDate: { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "报表日期" },
              reportMonth: { bsonType: "string", pattern: "^\\d{4}-\\d{2}$", description: "报表月份" },
              deptCode: { bsonType: "string", description: "科室编码" },
              isTotal: { bsonType: "bool", description: "是否全院汇总" },
              totalSessions: { bsonType: "int", minimum: 0, description: "俯卧位实施例次" },
              validSessions: { bsonType: "int", minimum: 0, description: "有效例次" },
              abnormalSessions: { bsonType: "int", minimum: 0, description: "异常例次" },
              durationMetRate: { bsonType: ["number", "null"], minimum: 0, maximum: 100, description: "时长达标率" },
              indicationMetRate: { bsonType: ["number", "null"], minimum: 0, maximum: 100, description: "适应症符合率" },
              effectiveRate: { bsonType: ["number", "null"], minimum: 0, maximum: 100, description: "治疗有效率" },
              abnormalRate: { bsonType: ["number", "null"], minimum: 0, maximum: 100, description: "异常数据率" }
            }
          }
        }
      });
      console.log("✅ prone_quality_daily 集合创建成功");
    } else {
      console.log("✅ prone_quality_daily 集合已存在");
    }

    console.log("\n=== 集合创建完成 ===");
    return true;
  } catch (e) {
    console.error("创建集合失败:", e);
    return false;
  }
}

async function runValidation() {
  console.log("开始验证俯卧位质控集合结构...\n");

  try {
    // 验证集合结构
    const sessionValid = await validateProneSessionSchema();
    const dailyValid = await validateProneQualityDailySchema();

    // 如果集合不存在，创建它们
    if (!sessionValid || !dailyValid) {
      console.log("\n需要创建集合...");
      await createCollectionsWithValidation();

      // 重新验证
      await validateProneSessionSchema();
      await validateProneQualityDailySchema();
    }

    console.log("\n✅ 验证完成！");
    process.exit(0);
  } catch (e) {
    console.error("\n❌ 验证失败:", e);
    process.exit(1);
  }
}

// 运行验证
runValidation();
