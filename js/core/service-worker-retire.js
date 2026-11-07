/* Service Worker 退役与缓存清理 */

(function () {
  /* safe=1 安全模式——正常启动反复崩溃时，地址栏加 ?safe=1 进自救页 */
  if (/[?&]safe=1/.test(location.search)) window.__AKINI_SAFE_MODE = true;
  window.AKINI_VERSION = "c43";
  /* 统一自然时间：刚刚→N分钟前→N小时前→N天前→N个月前→YYYY年M月
     朋友圈/iCity/双方主页/通知中心全站共用，只有这一份实现 */
  window.__akiniNaturalTime = function (ts) {
    try {
      if (ts == null || ts === "") return "";
      var d = ts instanceof Date ? ts : new Date(typeof ts === "string" ? ts.replace(/\//g, "-") : ts);
      var t = d.getTime();
      if (isNaN(t)) return typeof ts === "string" ? ts : "";
      var now = Date.now();
      var n = Math.floor((now - t) / 1e3);
      if (n < 0) n = 0;
      if (n < 60) return "刚刚";
      if (n < 3600) return Math.floor(n / 60) + "分钟前";
      if (n < 86400) return Math.floor(n / 3600) + "小时前";
      if (n < 2592000) return Math.floor(n / 86400) + "天前";
      var _months =
        (new Date(now).getFullYear() - d.getFullYear()) * 12 + (new Date(now).getMonth() - d.getMonth());
      if (_months < 12) return Math.max(1, _months) + "个月前";
      return d.getFullYear() + "年" + (d.getMonth() + 1) + "月";
    } catch (e) {
      return "";
    }
  };
  try {
    try {
      localStorage.removeItem("akini_boot_ver");
    } catch (e) {}
  } catch (e) {}

  // 保证设置页无论何时打开，最底部版本号始终实时更新为最新版
  function _syncVersionUI() {
    try {
      var el = document.getElementById("akiniSettingsVersionText");
      if (el) el.innerText = "当前版本 " + (window.AKINI_VERSION || "") + " (最新版)";
      /* 启动页也显示版本号，一眼可辨是否拿到最新包（防旧缓存/旧站点） */
    } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _syncVersionUI);
  } else {
    _syncVersionUI();
  }
  window.addEventListener("load", _syncVersionUI);
})();
