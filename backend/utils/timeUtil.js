const TZ_OFFSET_MS = 8 * 3600 * 1000;

/** 鎶婁竴娈?[start,end] 鎸変笢鍏尯 0 鐐瑰垏鍒嗕负澶氭棩 */
function splitByDayCST(start, end) {
  if (!start || !end || end <= start) return [];
  const result = [];
  let cursor = new Date(start.getTime());
  while (cursor < end) {
    const cstTime = new Date(cursor.getTime() + TZ_OFFSET_MS);
    const yyyy = cstTime.getUTCFullYear();
    const mm = String(cstTime.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(cstTime.getUTCDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const nextCstMidnight =
      Date.UTC(yyyy, cstTime.getUTCMonth(), cstTime.getUTCDate() + 1) - TZ_OFFSET_MS;
    const segEnd = Math.min(end.getTime(), nextCstMidnight);
    const durationSec = Math.round((segEnd - cursor.getTime()) / 1000);
    if (durationSec > 0) result.push({ date: dateStr, durationSec });
    cursor = new Date(segEnd);
  }
  return result;
}

/** 鎶?涓滃叓鍖?YYYY-MM-DD"杞负 UTC Date锛堢敤浜庢棩鏈熻寖鍥寸瓫閫夛級 */
function cstDateStrToUtc(s, endOfDay = false) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  const ms = endOfDay
    ? Date.UTC(y, m - 1, d + 1) - TZ_OFFSET_MS
    : Date.UTC(y, m - 1, d) - TZ_OFFSET_MS;
  return new Date(ms);
}

/** 鎴彇涓€娈?[s,e] 涓?[rangeStart,rangeEnd] 鐨勪氦闆?*/
function clipRange(s, e, rs, re) {
  const start = rs ? Math.max(s.getTime(), rs.getTime()) : s.getTime();
  const end = re ? Math.min(e.getTime(), re.getTime()) : e.getTime();
  if (end <= start) return null;
  return [new Date(start), new Date(end)];
}

module.exports = { splitByDayCST, cstDateStrToUtc, clipRange };