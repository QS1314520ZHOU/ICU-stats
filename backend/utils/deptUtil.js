function getDeptCodeQuery(query = {}) {
  const code = String(query.code || "").trim();
  const deptCode = query.deptCode || query.departmentCode || query.dept || (!code.startsWith("param_") ? code : "");
  return String(deptCode || "").trim();
}

async function resolveDeptFilter(db, query = {}) {
  const value = getDeptCodeQuery(query);
  if (!value) return null;

  const dept = await db.collection("department").findOne(
    { $or: [{ code: value }, { name: value }] },
    { projection: { code: 1, name: 1 } }
  );

  return {
    code: dept?.code || value,
    name: dept?.name || value
  };
}

async function resolvePatientPid(db, query = {}) {
  if (query.pid) return String(query.pid);
  const hisPid = String(query.hisPid || "").trim();
  if (!hisPid) return "";

  const filter = { hisPid };
  const dept = await resolveDeptFilter(db, query);
  if (dept) filter.deptCode = dept.code;

  const patient = await db.collection("patient").findOne(filter, { projection: { _id: 1 } });
  return patient?._id ? String(patient._id) : "__NO_MATCH__";
}

module.exports = { getDeptCodeQuery, resolveDeptFilter, resolvePatientPid };
