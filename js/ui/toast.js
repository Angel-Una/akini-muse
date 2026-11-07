/* toast 提示 + 全局异常捕获 */
(function () {
  /* toast 桥：优先使用全局 __akiniToast，缺失时自绘 */
  function __fallbackToast(msg) {
    try {
      var t = document.createElement("div");
      t.textContent = String(msg);
      t.style.cssText =
        "position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:9900;background:rgba(0,0,0,.78);color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;max-width:80vw;box-shadow:0 4px 16px rgba(0,0,0,.3);transition:opacity .3s;";
      document.body.appendChild(t);
      setTimeout(function () {
        t.style.opacity = "0";
      }, 2200);
      setTimeout(function () {
        try {
          document.body.removeChild(t);
        } catch (e) {}
      }, 2600);
    } catch (e) {}
  }
  window.akiniToast = window.akiniToast || window.__akiniToast || __fallbackToast;
  function AK(m) {
    try {
      (window.akiniToast || __fallbackToast)(m);
    } catch (e) {
      try {
        __fallbackToast(m);
      } catch (e2) {}
    }
  }

  /* ===== 全局脚本异常 / Promise 拒绝提示 ===== */
  var __akErrLast = "",
    __akErrLastAt = 0;
  window.addEventListener("error", function (e) {
    try {
      var msg = String((e && e.message) || "");
      if (msg.indexOf("Failed to read the 'error'") >= 0 || msg.indexOf("AbortError") >= 0) return;
      if (
        /not allowed by the user agent|NotAllowedError|user denied|denied by the user|securityerror|play\(\) failed/i.test(
          msg,
        )
      )
        return;
      if (!msg || msg.indexOf("Script error") !== -1) return;
      console.error("[AKINI_UNCAUGHT]", msg, e && e.filename, e && e.lineno);
      try {
        window.__akiniErrorLog = window.__akiniErrorLog || [];
        window.__akiniErrorLog.push({
          time: new Date().toISOString(),
          msg: msg,
          src: String(e.filename || ""),
          line: e.lineno || 0,
          col: e.colno || 0,
        });
        if (window.__akiniErrorLog.length > 50) window.__akiniErrorLog.shift();
      } catch (_l) {}
      var now = Date.now();
      if (msg === __akErrLast && now - __akErrLastAt < 30000) return;
      __akErrLast = msg;
      __akErrLastAt = now;
    } catch (ex) {}
  });
  window.addEventListener("unhandledrejection", function (e) {
    try {
      var r = e && e.reason;
      var _rawMsg = String((r && r.message) || r || "");
      if (
        /not allowed by the user agent|NotAllowedError|user denied|denied by the user|AbortError|play\(\) failed|network state|in-progress transaction|delete range|Transaction|IndexedDB|IDB/i.test(
          _rawMsg + " " + String((r && r.name) || ""),
        )
      ) {
        try {
          e.preventDefault();
        } catch (_p) {}
        return;
      }
      var msg = "Promise拒绝: " + _rawMsg.slice(0, 80);
      console.error("[AKINI_UNCAUGHT]", msg);
      try {
        e.preventDefault();
      } catch (_p2) {}
      var now = Date.now();
      if (msg === __akErrLast && now - __akErrLastAt < 30000) return;
      __akErrLast = msg;
      __akErrLastAt = now;
    } catch (ex) {}
  });
})();
