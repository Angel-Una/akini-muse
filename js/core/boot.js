/* 启动层：在页面解析前建立全局常量与兼容环境。 */

/* 开屏期间锁定页面，只显示启动画面 */
try {
  document.documentElement.className += " akini-boot-lock";
} catch (e) {}

/* 性能埋点空实现，core 中的埋点调用依赖它存在。 */
window.__akiniPerfMark = function () {};

/* 生命周期唯一入口：全站只挂 1 个 visibilitychange。
   模块用 __akiniOnVisible(fn) / __akiniOnHidden(fn) 注册，按注册顺序执行；
   单个回调抛错只告警一次，不影响其余模块。 */
(function () {
  var vis = [],
    hid = [],
    bound = false;
  function run(list) {
    for (var i = 0; i < list.length; i++) {
      try {
        list[i]();
      } catch (e) {
        try {
          console.warn("[Akini][lifecycle]", e);
        } catch (_) {}
      }
    }
  }
  function dispatch() {
    run(document.hidden ? hid : vis);
  }
  function add(list, fn) {
    if (typeof fn !== "function" || list.indexOf(fn) >= 0) return;
    list.push(fn);
    if (!bound) {
      bound = true;
      document.addEventListener("visibilitychange", dispatch);
    }
  }
  window.__akiniOnVisible = function (fn) {
    add(vis, fn);
  };
  window.__akiniOnHidden = function (fn) {
    add(hid, fn);
  };
})();

/* ---- boot block 2 ---- */

(function () {
  try {
    if (typeof window !== "undefined") {
      window.globalThis = window.globalThis || window;
      if (!Promise.allSettled) {
        Promise.allSettled = function (promises) {
          return Promise.all(
            Array.prototype.map.call(promises, function (p) {
              return Promise.resolve(p).then(
                function (val) {
                  return { status: "fulfilled", value: val };
                },
                function (err) {
                  return { status: "rejected", reason: err };
                },
              );
            }),
          );
        };
      }
      if (!String.prototype.replaceAll) {
        String.prototype.replaceAll = function (search, replacement) {
          if (search instanceof RegExp) {
            return this.replace(
              new RegExp(search.source, search.flags + (search.flags.indexOf("g") === -1 ? "g" : "")),
              replacement,
            );
          }
          return this.split(search).join(replacement);
        };
      }
      if (!Array.prototype.flat) {
        Array.prototype.flat = function (depth) {
          var d = depth === undefined ? 1 : Math.floor(depth);
          if (d <= 0) return this.slice();
          return Array.prototype.reduce.call(
            this,
            function (acc, val) {
              return acc.concat(Array.isArray(val) ? (d > 1 ? val.flat(d - 1) : val) : val);
            },
            [],
          );
        };
      }
      if (!Object.fromEntries) {
        Object.fromEntries = function (entries) {
          var obj = {};
          if (entries && typeof entries[Symbol.iterator] === "function") {
            var it = entries[Symbol.iterator]();
            var step;
            while (!(step = it.next()).done) {
              var pair = step.value;
              if (pair && pair.length >= 2) obj[pair[0]] = pair[1];
            }
          }
          return obj;
        };
      }
      if (!window.queueMicrotask) {
        window.queueMicrotask = function (fn) {
          Promise.resolve()
            .then(fn)
            .catch(function (e) {
              setTimeout(function () {
                throw e;
              }, 0);
            });
        };
      }
    }
  } catch (e) {
    console.warn("[Akini Polyfill]", e);
  }
})();
(function () {
  try {
    if (!window.FileReader || !window.HTMLCanvasElement) return;
    var MAX_SIDE = 1080;
    var MAX_BYTES = 300 * 1024;
    var nativeRead = FileReader.prototype.readAsDataURL;

    function emit(fr, dataUrl) {
      try {
        Object.defineProperty(fr, "result", { value: dataUrl, configurable: true });
      } catch (e) {}
      try {
        Object.defineProperty(fr, "readyState", { value: 2, configurable: true });
      } catch (e) {}
      try {
        fr.dispatchEvent(
          new ProgressEvent("load", { lengthComputable: true, loaded: dataUrl.length, total: dataUrl.length }),
        );
      } catch (e) {}
      try {
        fr.dispatchEvent(
          new ProgressEvent("loadend", { lengthComputable: true, loaded: dataUrl.length, total: dataUrl.length }),
        );
      } catch (e) {}
    }

    FileReader.prototype.readAsDataURL = function (blob) {
      var fr = this;
      var type = (blob && blob.type) || "";
      if (
        !blob ||
        !/^image\//.test(type) ||
        type === "image/svg+xml" ||
        type === "image/gif" ||
        !blob.size ||
        blob.size <= MAX_BYTES
      ) {
        return nativeRead.call(fr, blob);
      }
      var url;
      try {
        url = URL.createObjectURL(blob);
      } catch (e) {
        return nativeRead.call(fr, blob);
      }
      var img = new Image();
      var done = false;
      function release() {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      }
      function retryNative() {
        if (done) return;
        done = true;
        release();
        nativeRead.call(fr, blob);
      }
      img.onload = function () {
        if (done) return;
        done = true;
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          canvas.getContext("2d").drawImage(img, 0, 0, cw, ch);
          var out = canvas.toDataURL(type === "image/png" ? "image/png" : "image/jpeg", 0.75);
          /* 二次压缩：极少数纹理复杂的图（截图/噪点照片）即便缩放后仍很大，
             再缩到 900px / 0.6 编码一次，避免单张图就把 localStorage 配额吃掉。 */
          try {
            if (out && type !== "image/png" && out.length > 700 * 1024) {
              var s2 = Math.min(1, 900 / Math.max(cw, ch));
              var c2 = document.createElement("canvas");
              c2.width = Math.max(1, Math.round(cw * s2));
              c2.height = Math.max(1, Math.round(ch * s2));
              c2.getContext("2d").drawImage(canvas, 0, 0, c2.width, c2.height);
              var out2 = c2.toDataURL("image/jpeg", 0.6);
              if (out2 && out2.length > 32 && out2.length < out.length) out = out2;
            }
          } catch (e2c) {}
          release();
          if (!out || out.length < 32) {
            done = false;
            retryNative();
            return;
          }
          emit(fr, out);
        } catch (e) {
          done = false;
          retryNative();
        }
      };
      img.onerror = retryNative;
      try {
        img.src = url;
      } catch (e) {
        retryNative();
      }
    };
  } catch (e) {}
})();
(function () {
  try {
    if (!window.Storage || !Storage.prototype.setItem) return;
    var prevSet = Storage.prototype.setItem;
    var prevGet = Storage.prototype.getItem;
    var prevRm = Storage.prototype.removeItem;
    var prevClear = Storage.prototype.clear;
    function fb() {
      return window.__akiniLsFallback || (window.__akiniLsFallback = Object.create(null));
    }
    function isLS(s) {
      try {
        return s === window.localStorage;
      } catch (e) {
        return false;
      }
    }
    /* ---- 写入后的统一善后：配额兜底 + 备份触发（原先散在 core-main 的实例级 setItem 里） ---- */
    var backupTimer = null;
    function isSnapshotKey(k) {
      return k === "akini_localstorage_snapshot" || k === "akini_localstorage_snapshot_backup";
    }
    function afterWrite(k) {
      if (!k || k.indexOf("akini_") !== 0 || isSnapshotKey(k) || backupTimer || !window._akiniDataRestored) return;
      backupTimer = setTimeout(function () {
        backupTimer = null;
        try { Storage.prototype.removeItem.call(localStorage, "akini_localstorage_snapshot"); } catch (e) {}
        try { Storage.prototype.removeItem.call(localStorage, "akini_localstorage_snapshot_backup"); } catch (e) {}
        try { window._idbStore && window._idbStore.backupAll && window._idbStore.backupAll(); } catch (e) {}
      }, 3e3);
    }
    function trimChatHistory(html, keep) {
      if (!html) return html;
      if ((html.match(/<div[^>]*class="msg-row/g) || []).length <= keep) return html;
      for (var n = 0, i = html.length; -1 !== (i = html.lastIndexOf('<div class="msg-row', i - 1));) {
        if (++n === keep + 1) return html.slice(i);
      }
      return html;
    }
    function writeFallback(k, v) {
      fb()[k] = v;
      try {
        if (window.akiniStore && window.akiniStore._queueIdbWrite) window.akiniStore._queueIdbWrite(k, v);
      } catch (e2) {}
    }
    Storage.prototype.getItem = function (k) {
      k = String(k);
      if (isLS(this)) {
        var f = window.__akiniLsFallback;
        if (f && Object.prototype.hasOwnProperty.call(f, k)) return f[k];
      }
      try {
        return prevGet.call(this, k);
      } catch (e) {
        return null;
      }
    };
    Storage.prototype.setItem = function (k, v) {
      k = String(k);
      v = String(v);
      if (isLS(this) && window.__akiniWiping) return;
      /* 备份键去重：foo_backup_backup → foo_backup（原先 core-boot.js 又包了一层，合并到这里） */
      var bi = k.indexOf("_backup");
      if (bi >= 0) k = k.replace(/(_backup)+$/, "_backup");
      try {
        if (isLS(this) && window.__akiniLsFallback) delete window.__akiniLsFallback[k];
      } catch (e0) {}
      try {
        var out = prevSet.call(this, k, v);
        afterWrite(k);
        return out;
      } catch (e) {
        if (!isLS(this)) throw e; // sessionStorage 等保持原生行为
        /* 配额溢出：备份 → 修剪聊天历史备份键 → 重试一次（原先在 core-main 重写 localStorage.setItem） */
        try {
          try {
            window._idbStore && window._idbStore.backupAll && window._idbStore.backupAll();
          } catch (e1) {}
          for (var d = localStorage.length - 1; d >= 0; d--) {
            var u = localStorage.key(d);
            if (u && 0 === u.indexOf("akini_chat_history_backup_")) {
              try {
                var m = prevGet.call(localStorage, u);
                var w = trimChatHistory(m, 200);
                if (m && w !== m) prevSet.call(localStorage, u, w);
                else prevRm.call(localStorage, u);
              } catch (e3) {}
            }
          }
          var out2 = prevSet.call(this, k, v);
          afterWrite(k);
          return out2;
        } catch (e4) {
          writeFallback(k, v);
        }
      }
    };
    Storage.prototype.removeItem = function (k) {
      k = String(k);
      try {
        if (isLS(this) && window.__akiniLsFallback) delete window.__akiniLsFallback[k];
      } catch (e0) {}
      try {
        return prevRm.call(this, k);
      } catch (e) {}
    };
    Storage.prototype.clear = function () {
      try {
        if (isLS(this)) window.__akiniLsFallback = Object.create(null);
      } catch (e0) {}
      try {
        return prevClear.call(this);
      } catch (e) {}
    };
  } catch (e) {
    /* localStorage 整体不可访问（禁用 Cookie / 受限 WebView）：用纯内存实现顶替，
       保证所有 localStorage 读写不抛异常；真实数据由 IndexedDB 镜像与关键快照兜底。 */
    try {
      var mem = window.__akiniLsFallback || Object.create(null);
      var shim = {
        get length() {
          return Object.keys(mem).length;
        },
        key: function (i) {
          return Object.keys(mem)[i] || null;
        },
        getItem: function (k) {
          k = String(k);
          return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
        },
        setItem: function (k, v) {
          mem[String(k)] = String(v);
        },
        removeItem: function (k) {
          delete mem[String(k)];
        },
        clear: function () {
          Object.keys(mem).forEach(function (k) {
            delete mem[k];
          });
        },
      };
      window.__akiniLsFallback = mem;
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: function () {
          return shim;
        },
      });
    } catch (e2) {}
  }
})();
/* 低内存检测：给全局做标记，后续 SW/保活/重合并均可读取 */
try {
  var _ua = navigator.userAgent || "";
  var _isOldAndroid = /Android\s*([0-9]+)/i.test(_ua) && parseInt(RegExp.$1, 10) <= 10;
  var _isLemur = /Lemur|Gecko|Firefox/i.test(_ua) && !/Chrome|Safari/i.test(_ua);
  var _isVivo = /vivo|V1945A|V19|OPPO|P[A-Z]{2}[0-9]{2}/i.test(_ua);
  window.__akiniLowMem =
    (navigator.deviceMemory || 8) <= 4 ||
    (navigator.hardwareConcurrency || 8) <= 4 ||
    (/iPad|iPhone|iPod/.test(_ua) && !window.MSStream) ||
    _isOldAndroid ||
    _isLemur ||
    _isVivo;
  if (window.__akiniLowMem) document.documentElement.classList.add("low-mem");
  /* iOS 降级：iOS 及低内存设备一律进 ios-lite，全局关闭重 GPU 滤镜（backdrop-filter 是 iOS 内存/卡崩主要杀手） */
  var _isIOSLite = (/iPad|iPhone|iPod/.test(_ua) && !window.MSStream) || window.__akiniLowMem;
  if (_isIOSLite) document.documentElement.classList.add("ios-lite");
} catch (e) {}

/* ---- boot block 3 ---- */
 (function () {
  try {
    localStorage.removeItem("akini_ver");
  } catch (e) {}
})();

/* ---- boot block 4 ---- */
/* 原「写穿透」层已删除：它把每个 core 键在 localStorage 之外再写一遍 IndexedDB，
   还额外写 snap_ 影子副本；而 storage.js 已对全部 akini_ 键做内存 + IDB 镜像，
   同一份数据写两遍正是启动慢、越用越卡的来源之一。 */

/* ---- boot block 5 ---- */


/* ---- boot block 6 ---- */

/* 崩溃防护：清理历史 safe-mode 残留，并在检测到页面解析完成前反复报错的循环时
   自动进入轻量模式（跳过非关键图片水合与全量镜像写入），避免 iPhone 主屏幕 PWA
   反复闪退/重进。判定条件：5 分钟内、DOMContentLoaded 之前累计 3 次
   error / unhandledrejection；稳定渲染约 3 秒后打上 ok 标记。 */
(function () {
  try {
    try {
      localStorage.removeItem("akini_crash_guard");
    } catch (e0) {}
    try {
      document.documentElement.classList.remove("akini-deep-safe");
    } catch (e1) {}
    var K = "akini_launch_state_v2";
    var now = Date.now();
    var st = null;
    try {
      st = JSON.parse(localStorage.getItem(K) || "null");
    } catch (e2) {}
    var n = 0;
    if (st && st.ok !== true && now - (Number(st.t) || 0) < 300000) n = Number(st.n) || 0;
    var _dcl = false;
    function _markCrash() {
      if (_dcl) return;
      n += 1;
      try {
        localStorage.setItem(K, JSON.stringify({ t: Date.now(), n: n, ok: false }));
      } catch (eE) {}
    }
    try {
      window.addEventListener("error", _markCrash);
      window.addEventListener("unhandledrejection", _markCrash);
    } catch (eH) {}
    /* iOS「添加到主屏幕」以 standalone 运行，系统给 WebContent 的内存上限比 Safari
       低很多，冷启动时预载图片/全量镜像最容易直接被 Jetsam 杀掉（表现为闪退重进）。
       这里识别 standalone，首次启动就按轻量模式跑，图片改成按需加载。 */
    var _standalone = false;
    try {
      _standalone =
        (window.navigator && window.navigator.standalone === true) ||
        !!(
          window.matchMedia &&
          (window.matchMedia("(display-mode: standalone)").matches ||
            window.matchMedia("(display-mode: fullscreen)").matches)
        );
    } catch (e7s) {}
    if (_standalone) {
      window.__AKINI_STANDALONE = true;
      try {
        document.documentElement.classList.add("akini-standalone");
      } catch (e8) {}
    }
    if (n >= 3) {
      window.__AKINI_SAFE_MODE = true;
      try {
        document.documentElement.classList.add("akini-safe-mode");
      } catch (e4) {}
      try {
        console.warn("[Akini] 连续启动异常，已进入轻量模式（图片按需加载）");
      } catch (e5) {}
    } else {
      try {
        document.documentElement.classList.remove("akini-safe-mode");
      } catch (e6) {}
    }
    /* 解析完成并稳定渲染约 3 秒 = 这次启动是健康的 */
    function _markOk() {
      try {
        localStorage.setItem(K, JSON.stringify({ t: Date.now(), n: 1, ok: true }));
      } catch (e7) {}
    }
    function _afterDomReady() {
      _dcl = true;
      setTimeout(_markOk, 3000);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", _afterDomReady);
    } else {
      _afterDomReady();
    }
  } catch (e) {}
})();

/* ---- boot block 7 ---- */
document.addEventListener("gesturestart", function (e) {
  e.preventDefault();
});
document.addEventListener("gesturechange", function (e) {
  e.preventDefault();
});
document.addEventListener("gestureend", function (e) {
  e.preventDefault();
});
document.addEventListener(
  "dblclick",
  function (e) {
    e.preventDefault();
  },
  { passive: false },
);

/* ---- boot block 8 ---- */
(function () {
  try {
    var t = window.localStorage;
    try {
      t.removeItem("__aktest__");
    } catch (_e0) {}
    t.setItem("__aktest__", "1");
    t.removeItem("__aktest__");
  } catch (e) {
    var _n = e && (e.name || "");
    var _c = e && typeof e.code === "number" ? e.code : -1;
    var _quota =
      _n === "QuotaExceededError" ||
      _n === "NS_ERROR_DOM_STORAGE_QUOTA_REACHED" ||
      _n === "QuotaExceeded" ||
      _c === 22 ||
      _c === 1014;
    if (_quota) {
      try {
        window.localStorage.removeItem("__aktest__");
      } catch (_e1) {}
      console.warn("[Akini] localStorage 配额已满：保留原生存储，旧数据仍可读写");
      return;
    }
    var s = {};
    try {
      Object.defineProperty(window, "localStorage", {
        value: {
          getItem: function (k) {
            return s[k] || null;
          },
          setItem: function (k, v) {
            s[k] = String(v);
          },
          removeItem: function (k) {
            delete s[k];
          },
          clear: function () {
            s = {};
          },
          key: function (i) {
            return Object.keys(s)[i] || null;
          },
          get length() {
            return Object.keys(s).length;
          },
        },
        writable: true,
        configurable: true,
      });
      window.__akiniLocalStorageBlocked = true;
    } catch (_e2) {
      window.__akiniLocalStorageBlocked = true;
    }
    console.warn("[Akini] localStorage 不可用，已启用内存模式（数据不会持久化）");
  }
})();

/* ---- boot block 9 ---- */
 (function () {
  try {
    var removed = 0;
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && /_backup(_backup)+$/.test(k)) {
        localStorage.removeItem(k);
        removed++;
      }
    }
    if (removed) console.log("[Akini] 清理冗余备份键:", removed);
  } catch (e) {}
})();

/* ---- boot block 10 ---- */
(function () {
  window.__akiniFormatDateTime = function (s) {
    try {
      if (!s) {
        return "";
      }
      var d;
      if (/^-?\d+/.test(String(s).trim())) {
        d = new Date(Number(String(s).trim()));
      } else {
        d = new Date(s);
      }
      if (isNaN(d.getTime())) {
        return "";
      }
      var now = new Date();
      var h = Math.floor((now - d) / 3600000);
      if (h < 1) {
        var m = Math.floor((now - d) / 60000);
        if (m < 1) {
          m = 1;
        }
        return m + "分钟前";
      }
      if (h < 24) {
        return h + "小时前";
      }
      if (h < 48) {
        return "昨天";
      }
      var Y = d.getFullYear(),
        M = d.getMonth() + 1,
        D = d.getDate();
      function p(n) {
        return n < 10 ? "0" + n : "" + n;
      }
      return Y + "-" + p(M) + "-" + p(D);
    } catch (e) {
      return "";
    }
  };
})();

/* ---- boot block 11 ---- */
/* 网易云 API 代理（歌单导入/一起听使用） */
window.AKINI_NETEASE_PROXY = "https://api.mc666.org.cn";

/* ---- boot block 13 ---- */
/* 时序桩：main.js 启动渲染可能先于内联头像助手定义，先占位避免 ReferenceError 中断启动链；真正的实现紧随其后会覆盖它 */
window.__akiniAvOrLine =
  window.__akiniAvOrLine ||
  function (v) {
    var s = String(v == null ? "" : v).trim();
    return s
      ? s
      : "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#f7f8fa"/><circle cx="40" cy="29" r="14" fill="none" stroke="#5a5e66" stroke-width="1.5"/><path d="M12 76c4-17 14-26 28-26s24 9 28 26" fill="none" stroke="#5a5e66" stroke-width="1.5" stroke-linecap="round"/></svg>',
          );
  };
