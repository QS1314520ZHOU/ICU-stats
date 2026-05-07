const API = "/api";
let page = 1, size = 10, total = 0;
const params = new URLSearchParams(location.search);
const deptCode = (params.get("deptCode") || params.get("departmentCode") || params.get("dept") || params.get("code") || "").trim();
const hisPid = (params.get("hisPid") || "").trim();
let currentPatient = null;

if (params.get("startDate")) document.getElementById("startDate").value = params.get("startDate");
if (params.get("endDate")) document.getElementById("endDate").value = params.get("endDate");

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

async function applyDefaultDateRange() {
  if (document.getElementById("startDate").value || document.getElementById("endDate").value) return;
  const yesterday = yesterdayCstInput();
  document.getElementById("startDate").value = yesterday;
  document.getElementById("endDate").value = yesterday;
}

async function loadCurrentPatient() {
  if (!hisPid || currentPatient) return currentPatient;
  const qs = buildQs({ page: 1, size: 1 });
  const r = await fetch(`${API}/patients?${qs}`).then(r => r.json());
  currentPatient = r.data?.list?.[0] || null;
  return currentPatient;
}

function buildQs(extra = {}) {
  const qs = new URLSearchParams();
  const sd = document.getElementById("startDate").value;
  const ed = document.getElementById("endDate").value;
  if (deptCode) qs.append("deptCode", deptCode);
  if (hisPid) qs.append("hisPid", hisPid);
  if (sd) qs.append("startDate", sd);
  if (ed) qs.append("endDate", ed);
  for (const [k, v] of Object.entries(extra)) if (v) qs.append(k, v);
  return qs.toString();
}

async function loadList() {
  const kw = document.getElementById("kw").value.trim();
  const qs = buildQs({ keyword: kw, hisPid, page, size });
  const r = await fetch(`${API}/patients?${qs}`).then(r => r.json());
  total = r.data.total;
  const tbody = document.querySelector("#tbl tbody");
  tbody.innerHTML = r.data.list.map(p => `
    <tr>
      <td>${p.name || ""}</td>
      <td>${p.gender === "Female" ? "女" : (p.gender === "Male" ? "男" : "")}</td>
      <td>${p.dept || ""}</td>
      <td>${p.hisBed || ""}</td>
      <td>${p.bedDoctor || ""}</td>
      <td title="${p.admissionDiagnosis || ""}">${(p.admissionDiagnosis || "").slice(0, 24)}</td>
      <td>${p.admissionTime ? new Date(p.admissionTime).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : ""}</td>
      <td><button class="btn-detail" onclick="goDetail('${p._id}')">详情</button></td>
    </tr>`).join("") || `<tr><td colspan="8" style="text-align:center;color:#aaa">暂无数据</td></tr>`;
  document.getElementById("pageInfo").textContent = `第 ${page} 页 / 共 ${Math.max(1, Math.ceil(total / size))} 页（共 ${total} 条）`;
}

function goDetail(id) {
  const sd = document.getElementById("startDate").value;
  const ed = document.getElementById("endDate").value;
  const qs = new URLSearchParams({ id });
  if (sd) qs.append("startDate", sd);
  if (ed) qs.append("endDate", ed);
  if (deptCode) qs.append("deptCode", deptCode);
  if (hisPid) qs.append("hisPid", hisPid);
  location.href = `detail.html?${qs}`;
}
function prev() { if (page > 1) { page--; loadList(); } }
function next() { if (page * size < total) { page++; loadList(); } }
function applyFilter() {
  page = 1;
  if (!hisPid) {
    loadList();
    return;
  }
  loadDashboard();
}

function formatCstDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

async function loadDashboard() {
  const qs = buildQs();
  const [drug, oxy] = await Promise.all([
    fetch(`${API}/drug/duration?${qs}`).then(r => r.json()),
    fetch(`${API}/bedside/duration?${qs}`).then(r => r.json())
  ]);

  if (hisPid) {
    const patient = await loadCurrentPatient();
    const drugHours = (drug.data || []).reduce((sum, d) => sum + (Number(d.totalHours) || 0), 0);
    const oxyHours = (oxy.data || []).reduce((sum, d) => sum + (Number(d.totalHours) || 0), 0);
    renderOverview(patient, drugHours, oxyHours);
    renderDrugRecords(drug.data || []);
    renderOxygenRecords(oxy.data || []);
  }
}

function renderDrugRecords(list) {
  const section = document.getElementById("drugRecordsSection");
  const tbody = document.querySelector("#tblDrugRecords tbody");
  if (!section || !tbody) return;

  const rows = [];
  list.forEach((d, drugIndex) => {
    (d.daily || []).forEach((day, dayIndex) => {
      const hours = Number(day.hours) || 0;
      const records = recordsForDate(d.records || [], day.date);
      if (hours <= 0 || records.length === 0) return;
      rows.push({
        index: `${drugIndex}-${dayIndex}`,
        date: day.date,
        drugName: d.drugName || "",
        hours,
        records
      });
    });
  });
  rows.sort((a, b) => a.date.localeCompare(b.date) || b.hours - a.hours);

  section.style.display = "block";
  document.getElementById("drugRecordCount").textContent = `${rows.length} 条`;
  tbody.innerHTML = rows.map(r => `
    <tr class="drug-summary-row" data-drug-index="${r.index}">
      <td>${r.date}</td>
      <td title="${r.drugName}">${r.drugName}</td>
      <td>${r.hours.toFixed(2)}</td>
      <td>${r.records.length}</td>
      <td><button class="btn-link" type="button">查看明细</button></td>
    </tr>
    <tr class="record-row" id="drug-records-${r.index}" style="display:none">
      <td colspan="5">
        <table class="nested-table">
          <thead><tr><th>原始药品</th><th>开始时间</th><th>结束时间</th><th>时长(小时)</th><th>说明</th></tr></thead>
          <tbody>
            ${r.records.map(rec => `
              <tr>
                <td title="${rec.drugName || ''}">${rec.drugName || ''}</td>
                <td>${formatCstDateTime(rec.startTime)}</td>
                <td>${formatCstDateTime(rec.endTime)}</td>
                <td>${((Number(rec.durationSec) || 0) / 3600).toFixed(2)}</td>
                <td>${rec.inferredEnd ? '<span class="tag warn">结束时间推断</span>' : ''}</td>
              </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#94a3b8">暂无明细</td></tr>`}
          </tbody>
        </table>
      </td>
    </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#94a3b8">暂无用药数据</td></tr>`;

  tbody.querySelectorAll(".drug-summary-row").forEach(row => {
    row.addEventListener("click", () => {
      const detail = document.getElementById(`drug-records-${row.dataset.drugIndex}`);
      const btn = row.querySelector(".btn-link");
      const open = detail.style.display !== "none";
      detail.style.display = open ? "none" : "table-row";
      if (btn) btn.textContent = open ? "查看明细" : "收起明细";
    });
  });
}

function renderOxygenRecords(list) {
  const section = document.getElementById("oxygenRecordsSection");
  const tbody = document.querySelector("#tblOxygenRecords tbody");
  if (!section || !tbody) return;

  const rows = [];
  list.forEach((d, oxyIndex) => {
    (d.daily || []).forEach((day, dayIndex) => {
      const hours = Number(day.hours) || 0;
      const records = recordsForDate(d.records || [], day.date);
      if (hours <= 0 || records.length === 0) return;
      rows.push({
        index: `${oxyIndex}-${dayIndex}`,
        date: day.date,
        name: d.strVal || "未记录",
        hours,
        records
      });
    });
  });
  rows.sort((a, b) => a.date.localeCompare(b.date) || b.hours - a.hours);

  section.style.display = "block";
  document.getElementById("oxygenRecordCount").textContent = `${rows.length} 条`;
  tbody.innerHTML = rows.map(r => `
    <tr class="drug-summary-row" data-oxygen-index="${r.index}">
      <td>${r.date}</td>
      <td>${r.name}</td>
      <td>${r.hours.toFixed(2)}</td>
      <td>${r.records.length}</td>
      <td><button class="btn-link" type="button">查看明细</button></td>
    </tr>
    <tr class="record-row" id="oxygen-records-${r.index}" style="display:none">
      <td colspan="5">
        <table class="nested-table">
          <thead><tr><th>开始时间</th><th>结束时间</th><th>时长(小时)</th></tr></thead>
          <tbody>
            ${r.records.map(rec => `
              <tr>
                <td>${formatCstDateTime(rec.startTime)}</td>
                <td>${formatCstDateTime(rec.endTime)}</td>
                <td>${((Number(rec.durationSec) || 0) / 3600).toFixed(2)}</td>
              </tr>`).join("") || `<tr><td colspan="3" style="text-align:center;color:#94a3b8">暂无明细</td></tr>`}
          </tbody>
        </table>
      </td>
    </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#94a3b8">暂无氧疗数据</td></tr>`;

  tbody.querySelectorAll("[data-oxygen-index]").forEach(row => {
    row.addEventListener("click", () => {
      const detail = document.getElementById(`oxygen-records-${row.dataset.oxygenIndex}`);
      const btn = row.querySelector(".btn-link");
      const open = detail.style.display !== "none";
      detail.style.display = open ? "none" : "table-row";
      if (btn) btn.textContent = open ? "查看明细" : "收起明细";
    });
  });
}

function recordsForDate(records, date) {
  return records
    .filter(rec => {
      const start = toCstDateInput(rec.startTime);
      const end = toCstDateInput(rec.endTime);
      return start <= date && end >= date;
    })
    .slice()
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function renderOverview(patient, drugHours, oxyHours) {
  const overview = document.getElementById("patientOverview");
  if (!overview) return;
  overview.style.display = "grid";
  const name = patient?.name || "单病人统计";
  document.getElementById("patientName").textContent = name;
  document.getElementById("patientAvatar").textContent = name.slice(0, 1) || "--";
  document.getElementById("patientMeta").textContent = [
    patient?.dept,
    patient?.hisBed ? `${patient.hisBed}床` : "",
    patient?.bedDoctor ? `主治 ${patient.bedDoctor}` : "",
    patient?.admissionDiagnosis ? patient.admissionDiagnosis.slice(0, 36) : ""
  ].filter(Boolean).join(" · ");
  document.getElementById("metricDrug").textContent = `${drugHours.toFixed(2)}h`;
  document.getElementById("metricOxy").textContent = `${oxyHours.toFixed(2)}h`;
  document.getElementById("metricRange").textContent = `${document.getElementById("startDate").value || "--"} ~ ${document.getElementById("endDate").value || "--"}`;
}

function exportExcel() {
  const qs = buildQs();
  window.open(`${API}/report/export?${qs}`, "_blank");
}

(async function init() {
  await applyDefaultDateRange();
  if (hisPid) {
    document.getElementById("kw").style.display = "none";
    document.getElementById("patientListSection").style.display = "none";
  } else {
    await loadList();
    return;
  }
  loadDashboard();
})();
