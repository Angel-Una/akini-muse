/* JSZip 按需加载 */

/* JSZip 按需异步加载：仅在「备份导入/导出」真正用到时才注入脚本，
   避免启动阶段就加载 97KB 压缩库占用内存（安卓端 WebView/PWA 初始化 OOM 闪退防护）。
   并发调用会合并到同一次脚本注入，加载完成后统一回调。 */
(function () {
  var pending = null;
  window.__akiniEnsureJSZip = function (cb) {
    if (typeof JSZip !== "undefined") {
      cb && cb(true);
      return;
    }
    if (pending) {
      pending.push(cb);
      return;
    }
    pending = [cb];
    var finish = function (ok) {
      var arr = pending;
      pending = null;
      arr.forEach(function (f) {
        try {
          f(ok);
        } catch (e) {}
      });
    };
    var s = document.createElement("script");
    s.src = "js/vendor/jszip.min.js";
    s.onload = function () {
      finish(typeof JSZip !== "undefined");
    };
    s.onerror = function () {
      finish(false);
    };
    document.head.appendChild(s);
  };
})();
