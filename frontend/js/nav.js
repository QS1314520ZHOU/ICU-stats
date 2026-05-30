/**
 * 导航参数传递：将当前 URL 的 deptCode / pid(hisPid) 传播到所有导航链接
 * 自动兼容 pid ↔ hisPid 参数名差异
 * 每个页面引入 <script src="js/nav.js"></script> 即可
 */
(function () {
  var p = new URLSearchParams(location.search);
  var deptCode = p.get("deptCode") || "";
  var pid = p.get("pid") || p.get("hisPid") || "";

  var parts = [];
  if (deptCode) parts.push("deptCode=" + encodeURIComponent(deptCode));
  if (pid) {
    parts.push("pid=" + encodeURIComponent(pid));
    parts.push("hisPid=" + encodeURIComponent(pid));
  }
  if (parts.length === 0) return;
  var qs = "?" + parts.join("&");

  var links = document.querySelectorAll("header a[href]");
  for (var j = 0; j < links.length; j++) {
    var a = links[j];
    var href = a.getAttribute("href");
    if (href && href.charAt(0) === "/" && href.indexOf(".html") !== -1) {
      a.href = href.split("?")[0] + qs;
    }
  }
})();
