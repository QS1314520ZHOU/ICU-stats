const cron = require("node-cron");
const { runDailyQualityCalculation } = require("./proneQualityCron");

/**
 * 定时任务调度器
 */
class Scheduler {
  constructor() {
    this.jobs = [];
  }

  /**
   * 启动所有定时任务
   */
  start() {
    console.log("启动定时任务调度器...");

    // 每日凌晨 2:00 执行俯卧位质控计算
    const proneQualityJob = cron.schedule("0 2 * * *", async () => {
      console.log("触发俯卧位质控每日计算任务");
      await runDailyQualityCalculation();
    }, {
      scheduled: true,
      timezone: "Asia/Shanghai"
    });

    this.jobs.push({
      name: "prone-quality-daily",
      job: proneQualityJob,
      schedule: "0 2 * * *",
      description: "每日凌晨2:00执行俯卧位质控计算"
    });

    console.log("定时任务调度器启动完成");
    console.log("已注册任务:");
    this.jobs.forEach(j => {
      console.log(`  - ${j.name}: ${j.schedule} (${j.description})`);
    });
  }

  /**
   * 停止所有定时任务
   */
  stop() {
    console.log("停止定时任务调度器...");
    this.jobs.forEach(j => {
      j.job.stop();
    });
    this.jobs = [];
    console.log("定时任务调度器已停止");
  }

  /**
   * 获取任务状态
   */
  getStatus() {
    return {
      running: this.jobs.length > 0,
      jobs: this.jobs.map(j => ({
        name: j.name,
        schedule: j.schedule,
        description: j.description,
        running: j.job.running
      }))
    };
  }
}

// 创建单例
const scheduler = new Scheduler();

module.exports = scheduler;
