const API = "/api";
const params = new URLSearchParams(location.search);
const id = params.get("id");
const deptCode = (params.get("deptCode") || params.get("departmentCode") || params.get("dept") || params.get("code") || "").trim();
const hisPid = (params.get("hisPid") || "").trim();
if (params.get("startDate")) document.getElementById("startDate").value = params.get("startDate");
if (params.get("endDate"))   document.getElementById("endDate").value   = params.get("endDate");
applyDefaultDateRange();

function toCstDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const cst = new Date(d.getTime() + 8 * 3600 * 1000);
  const y = cst.getUTCFullYear();
  const m = String(cst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(cst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayCstInput() {
  return toCstDateInput(new Date(Date.now() - 24 * 3600 * 1000));
}

function applyDefaultDateRange() {
  if (document.getElementById("startDate").value || document.getElementById("endDate").value) return;
  const yesterday = yesterdayCstInput();
  document.getElementById("startDate").value = yesterday;
  document.getElementById("endDate").value = yesterday;
}

function buildQs() {
  const qs = new URLSearchParams();
  qs.append("pid", id);
  const sd = document.getElementById("startDate").value;
  const ed = document.getElementById("endDate").value;
  if (deptCode) qs.append("deptCode", deptCode);
  if (hisPid) qs.append("hisPid", hisPid);
  if (sd) qs.append("startDate", sd);
  if (ed) qs.append("endDate", ed);
  return qs.toString();
}

async function loadAll() {
  const p = await fetch(`${API}/patients/${id}`).then(r => r.json());
  const patient = p.data || {};
  document.getElementById("title").textContent = `病人详情 - ${patient.name || ""}`;
  document.getElementById("baseInfo").innerHTML = `
    <h2>基本信息</h2>
    <div class="kv">
      <div><span>姓名:</span>${patient.name || ""}</div>
      <div><span>hisPid:</span>${patient.hisPid || ""}</div>
      <div><span>mrn:</span>${patient.mrn || ""}</div>
      <div><span>性别:</span>${patient.gender === "Female" ? "女" : "男"}</div>
      <div><span>科室:</span>${patient.dept || ""}</div>
      <div><span>床号:</span>${patient.hisBed || ""}</div>
      <div><span>主治:</span>${patient.bedDoctor || ""}</div>
      <div><span>状态:</span>${patient.status || ""}</div>
      <div style="grid-column:1/-1"><span>诊断:</span>${patient.admissionDiagnosis || ""}</div>
    </div>`;
  const qs = buildQs();
  const [drugRes, oxyRes] = await Promise.all([
    fetch(`${API}/drug/duration?${qs}`).then(r => r.json()),
    fetch(`${API}/bedside/duration?${qs}`).then(r => r.json())
  ]);
  renderDrug(drugRes.data || []);
  renderOxy(oxyRes.data || []);
}

function renderDrug(list) {
  document.querySelector("#tblDrug tbody").innerHTML = list.map(d =>
    `<tr><td>${d.drugName}</td><td>${d.drugSpec || ""}</td><td>${d.segCount}</td><td>${d.totalHours}</td></tr>`
  ).join("") || `<tr><td colspan="4" style="text-align:center;color:#aaa">暂无</td></tr>`;

  echarts.init(document.getElementById("chartDrug")).setOption({
    title: { text: "每种药品微泵总时长（小时）", textStyle: { fontSize: 14 } },
    tooltip: { formatter: p => `${p.name}<br/>${p.value} h` },
    grid: { left: 220, right: 30, top: 40, bottom: 30 },
    xAxis: { type: "value", name: "小时" },
    yAxis: { type: "category", data: list.map(d => d.drugName) },
    series: [{ type: "bar", data: list.map(d => d.totalHours),
      itemStyle: { color: "#3a7bd5" }, label: { show: true, position: "right" } }]
  });

  const allDates = [...new Set(list.flatMap(d => d.daily.map(x => x.date)))].sort();
  const series = list.map(d => ({
    name: d.drugName, type: "bar", stack: "total",
    data: allDates.map(date => (d.daily.find(x => x.date === date) || {}).hours || 0)
  }));
  echarts.init(document.getElementById("chartDrugDaily")).setOption({
    title: { text: "按天微泵时长（小时，东八区）", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" }, legend: { top: 25, type: "scroll" }, grid: { top: 80 },
    xAxis: { type: "category", data: allDates },
    yAxis: { type: "value", name: "小时" }, series
  });
}

function renderOxy(list) {
  document.querySelector("#tblOxy tbody").innerHTML = list.map(d =>
    `<tr><td>${d.strVal}</td><td>${d.segCount}</td><td>${d.totalHours}</td></tr>`
  ).join("") || `<tr><td colspan="3" style="text-align:center;color:#aaa">暂无</td></tr>`;

  echarts.init(document.getElementById("chartOxy")).setOption({
    title: { text: "氧疗途径占比", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "item", formatter: "{b}: {c}h ({d}%)" },
    series: [{ type: "pie", radius: ["40%", "70%"],
      data: list.map(d => ({ name: d.strVal, value: d.totalHours })),
      label: { formatter: "{b}\n{c}h ({d}%)" } }]
  });

  const allDates = [...new Set(list.flatMap(d => d.daily.map(x => x.date)))].sort();
  const series = list.map(d => ({
    name: d.strVal, type: "bar", stack: "total",
    data: allDates.map(date => (d.daily.find(x => x.date === date) || {}).hours || 0)
  }));
  echarts.init(document.getElementById("chartOxyDaily")).setOption({
    title: { text: "按天氧疗途径时长", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" }, legend: { top: 25 }, grid: { top: 80 },
    xAxis: { type: "category", data: allDates },
    yAxis: { type: "value", name: "小时", max: 24 }, series
  });
}

function exportExcel() {
  const qs = buildQs();
  window.open(`${API}/report/export?${qs}`, "_blank");
}

loadAll();
