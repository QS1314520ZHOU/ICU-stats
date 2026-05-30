const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(process.cwd(), ".env") });
const { connect } = require("./db");
const scheduler = require("./cron/scheduler");

const app = express();
app.use(cors());
app.use(express.json());

const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));

app.use("/api/patients", require("./routes/patient"));
app.use("/api/drug", require("./routes/drug"));
app.use("/api/bedside", require("./routes/bedside"));
app.use("/api/report", require("./routes/report"));
app.use("/api/prone", require("./routes/prone"));

const PORT = process.env.PORT || 3000;
connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server: http://localhost:${PORT}`);
      // 启动定时任务
      scheduler.start();
    });
  })
  .catch((e) => { console.error(e); process.exit(1); });
