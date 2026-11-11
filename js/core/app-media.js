/**
 * Akini 备份引擎：standard-main 风格 ZIP 导出/导入
 * 把 localStorage + IndexedDB 中的数据打包成 ZIP：backup.json + media/* 二进制
 * 避免单文件巨型 JSON 无法解析，导入后再把媒体内联回 data URL。
 */
(function (global) {
  "use strict";

  var MIN_MEDIA_CHARS = 800;

  function isDataMediaUrl(s) {
    return typeof s === "string" && s.length > MIN_MEDIA_CHARS && /^data:(image|video|audio)\//i.test(s);
  }

  function dataUrlToBinary(dataUrl) {
    if (typeof dataUrl !== "string") return null;
    var m = /^data:([^,]+),([\s\S]*)$/.exec(dataUrl);
    if (!m) return null;
    var header = m[1];
    var body = m[2].replace(/\s/g, "");
    var mime = header.split(";")[0].trim();
    var isB64 = /;base64/i.test(header);
    if (isB64) {
      try {
        var binary = atob(body);
        var len = binary.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return { mime: mime, bytes: bytes };
      } catch (e) {
        return null;
      }
    }
    try {
      return {
        mime: mime,
        bytes: new TextEncoder().encode(decodeURIComponent(body)),
      };
    } catch (e2) {
      return null;
    }
  }

  function uint8ToBase64Chunked(u8) {
    var CHUNK = 0x8000;
    var str = "";
    for (var i = 0; i < u8.length; i += CHUNK) {
      str += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + CHUNK, u8.length)));
    }
    return btoa(str);
  }

  function binaryToDataUrl(mime, u8) {
    return "data:" + (mime || "application/octet-stream") + ";base64," + uint8ToBase64Chunked(u8);
  }

  function extractMediaTree(node, state) {
    if (!state) state = { store: {}, map: new Map(), n: 0 };
    if (node === null || node === undefined) return node;
    if (typeof node === "string") {
      if (isDataMediaUrl(node)) {
        var id = state.map.get(node);
        if (!id) {
          id = "m" + state.n++;
          state.map.set(node, id);
          state.store[id] = node;
        }
        return { __mRef: id };
      }
      return node;
    }
    if (Array.isArray(node))
      return node.map(function (x) {
        return extractMediaTree(x, state);
      });
    if (typeof node === "object") {
      if (node instanceof Date) return node.toISOString();
      var out = {};
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        out[k] = extractMediaTree(node[k], state);
      }
      return out;
    }
    return node;
  }

  function inlineMediaTree(node, store) {
    if (!store) store = {};
    if (node === null || node === undefined) return node;
    if (typeof node === "object" && !Array.isArray(node) && node.__mRef && typeof node.__mRef === "string") {
      var blob = store[node.__mRef];
      return blob !== undefined && blob !== null ? blob : node;
    }
    if (Array.isArray(node))
      return node.map(function (x) {
        return inlineMediaTree(x, store);
      });
    if (typeof node === "object") {
      var o = {};
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        o[k] = inlineMediaTree(node[k], store);
      }
      return o;
    }
    return node;
  }

  /* 聊天记录里的图片是内联在 html 字符串里的 <img src="data:...">，
     extractMediaTree 看不到（它只处理顶级 data URL 值）。
     直接 JSON.parse 整个聊天数组会把内存撑爆闪退（尤其消息多+带图）。
     这里用正则在原始字符串上把 data URL 抽到 mediaStore，换成轻量占位符。 */
  var _INLINE_MEDIA_RE = /data:(?:image|video|audio)\/[^"\\<>\s]+/gi;
  function extractInlineMedia(str, state) {
    if (typeof str !== "string" || str.length < MIN_MEDIA_CHARS) return str;
    return str.replace(_INLINE_MEDIA_RE, function (url) {
      if (url.length <= MIN_MEDIA_CHARS) return url;
      var id = state.map.get(url);
      if (!id) {
        id = "m" + state.n++;
        state.map.set(url, id);
        state.store[id] = url;
      }
      return "__akRef__" + id;
    });
  }
  function inlineMediaFromString(str, store) {
    if (typeof str !== "string" || str.indexOf("__akRef__") < 0) return str;
    return str.replace(/__akRef__m\d+/g, function (m) {
      var id = m.slice("__akRef__".length);
      return store[id] != null ? String(store[id]) : m;
    });
  }

  /* 导入聊天记录：不再把 mediaStore 里的图片还原成内联 base64（单条会话可到几十 MB，
     手机导入必闪退）。直接改写成运行时本来就会用的 data-mh 占位 + 外置媒体，
     并把媒体写进 akini_media_ 的 IDB 键，渲染时按需取图。 */
  function rewriteImgTag(tag, hash, ph) {
    var esc = tag.indexOf('\\"') >= 0;
    var q = esc ? '\\"' : '"';
    var cleaned = tag.replace(
      /\ssrc=\\?"(?:__akRef__m\d+|data:(?:image|video|audio)\/[^"\\<>]+)\\?"/i,
      "",
    );
    return cleaned.replace(/<img\b/i, "<img data-mh=" + q + hash + q + " src=" + q + ph + q);
  }
  function importChatHistory(str, store) {
    if (typeof str !== "string") return str;
    var media = window.__akiniMedia;
    if (!media || !media.put) return inlineMediaFromString(str, store);
    var ph = media.PLACEHOLDER || "";
    /* 1) 新版备份：图片已抽成 __akRef__mN */
    str = str.replace(/<img\b[^>]*__akRef__m\d+[^>]*>/gi, function (tag) {
      var mm = tag.match(/__akRef__m(\d+)/);
      var blob = mm && store ? store["m" + mm[1]] : null;
      if (!blob) return tag;
      var hash = media.put(blob);
      return hash ? rewriteImgTag(tag, hash, ph) : tag;
    });
    /* 2) 旧备份：仍然内联 data URL，同样外置，避免整段历史塞满 base64 */
    str = str.replace(/<img\b[^>]*data:(?:image|video|audio)\/[^>]*>/gi, function (tag) {
      var mm = tag.match(/data:(?:image|video|audio)\/[^"\\\s>]+/i);
      if (!mm || mm[0].length < 24 * 1024) return tag;
      var hash = media.put(mm[0]);
      return hash ? rewriteImgTag(tag, hash, ph) : tag;
    });
    return str;
  }

  function processLocalStorageValueForExport(str, state, key) {
    if (str == null) return str;
    if (typeof str !== "string") return str;
    /* 聊天记录：不 JSON.parse 整段数组，直接在字符串层面提取内嵌媒体。
       一万多条带图消息 parse 一次能吃掉几百 MB，低端机直接闪退。 */
    if (key && key.indexOf("akini_chat_history_") === 0) {
      return extractInlineMedia(str, state);
    }
    if (isDataMediaUrl(str)) {
      var id = state.map.get(str);
      if (!id) {
        id = "m" + state.n++;
        state.map.set(str, id);
        state.store[id] = str;
      }
      // __raw 标记该值原本是普通字符串（data URL），导入时应还原为字符串而非 JSON
      return JSON.stringify({ __mRef: id, __raw: true });
    }
    try {
      var parsed = JSON.parse(str);
      var extracted = extractMediaTree(parsed, state);
      return JSON.stringify(extracted);
    } catch (e) {
      return str;
    }
  }

  function processLocalStorageValueForImport(str, store, key) {
    if (str == null) return str;
    if (typeof str !== "string") return str;
    /* 聊天记录：导出时用正则抽走了内嵌 data URL，这里反向还原，不 JSON.parse。
       注意用带外置的版本：图片改写成 data-mh 占位，绝不把几十 MB base64 塞回历史。 */
    if (key && key.indexOf("akini_chat_history_") === 0) {
      return importChatHistory(str, store);
    }
    try {
      var parsed = JSON.parse(str);
      // 原本就是 data URL 字符串的值，直接还原为 data URL 字符串
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.__mRef && parsed.__raw === true) {
        var blob = store[parsed.__mRef];
        return blob !== undefined && blob !== null ? String(blob) : str;
      }
      return JSON.stringify(inlineMediaTree(parsed, store));
    } catch (e) {
      return str;
    }
  }

  // 派生/快照键：仅排除极少数短生命周期的临时状态键，确保所有用户自定义背景、头像、设置、字卡、信件、记录等完整导出
  function isDerivedKey(k) {
    return k === "akini_ls_dirty" || k === "__aktest__";
  }

  // 仅问卷不支持文件导出导入，备份时排除，导入时也跳过
  // 表情包可正常导出导入；涉及前缀: akini_surveys_ / akini_survey_groups_
  function isSurveyKey(k) {
    if (!k || typeof k !== "string") return false;
    return k.indexOf("akini_surveys_") === 0 || k.indexOf("akini_survey_groups_") === 0;
  }

  function collectLocalStorageSync() {
    var data = {};
    // 1) localStorage 全量（拦截层对关键键返回内存权威值）
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || isDerivedKey(key) || isSurveyKey(key)) continue;
        try {
          var v = localStorage.getItem(key);
          if (v != null) data[key] = v;
        } catch (e) {}
      }
    } catch (e) {}
    // 2) 内存镜像补充：大键（>200KB 图片/完整聊天记录）被配额策略移出 LS，只存在内存/IDB
    try {
      if (window.akiniStore && window.akiniStore.memoryKeys && window.akiniStore.memoryGet) {
        window.akiniStore.memoryKeys().forEach(function (k) {
          if (!k || isDerivedKey(k) || isSurveyKey(k)) return;
          var mv = window.akiniStore.memoryGet(k);
          if (mv != null && mv !== "") data[k] = mv; // 内存为权威层，覆盖 LS 残留旧值
        });
      }
    } catch (e) {}
    // 3) core 的图片缓存：旧版把图存在默认 localforage / __akiniImgCache，
    //    存储层只镜像了 _idbStore（AkiniApp），这里兜底补齐，避免导出漏图。
    try {
      if (window.__akiniImgCache && typeof window.__akiniImgCache === "object") {
        for (var ck in window.__akiniImgCache) {
          if (!Object.prototype.hasOwnProperty.call(window.__akiniImgCache, ck)) continue;
          if (!ck || isDerivedKey(ck) || isSurveyKey(ck)) continue;
          var cv = window.__akiniImgCache[ck];
          if (cv != null && cv !== "" && (data[ck] == null || data[ck] === "")) data[ck] = cv;
        }
      }
    } catch (e) {}
    // 4) sessionStorage 应急副本补缺（仅补缺失，不覆盖）
    try {
      for (var j = 0; j < sessionStorage.length; j++) {
        var sk = sessionStorage.key(j);
        if (!sk || sk.indexOf("akini_") !== 0 || isDerivedKey(sk) || isSurveyKey(sk)) continue;
        if (data[sk] == null || data[sk] === "") {
          var sv = sessionStorage.getItem(sk);
          if (sv != null && sv !== "") data[sk] = sv;
        }
      }
    } catch (e) {}
    return data;
  }

  function collectIndexedDB(cb) {
    var out = {};
    var sources = 0;
    function merge(idbData) {
      if (idbData && typeof idbData === "object") {
        for (var k in idbData) {
          if (!Object.prototype.hasOwnProperty.call(idbData, k)) continue;
          if (isDerivedKey(k) || isSurveyKey(k)) continue;
          out[k] = idbData[k];
        }
      }
    }
    function done() {
      sources--;
      if (sources <= 0) cb && cb(out);
    }
    // 主存储：AkiniApp / akini_data（存储层镜像的所有 akini_ 键）
    if (window._idbStore && window._idbStore.getAll) {
      sources++;
      try {
        window._idbStore.getAll(function (d) {
          merge(d);
          done();
        });
      } catch (e) {
        done();
      }
    }
    // 默认 localforage：core 的 __akiniImgSet / __akiniImgStoreInit 把旧图存在这里，
    // 与 _idbStore 是不同的 IndexedDB 库，必须单独采集才不会漏图。
    try {
      if (window.localforage && typeof localforage.iterate === "function") {
        sources++;
        var lfData = {};
        localforage
          .iterate(function (val, key) {
            if (key && String(key).indexOf("akini_") === 0) lfData[key] = val;
          })
          .then(
            function () {
              merge(lfData);
              done();
            },
            function () {
              done();
            },
          );
      }
    } catch (e) {
      if (sources === 0) cb && cb({});
    }
    if (sources === 0) cb && cb({});
  }

  function buildBackupPayload(done) {
    var lsData = collectLocalStorageSync();
    collectIndexedDB(function (idbData) {
      var state = { store: {}, map: new Map(), n: 0 };
      var lsOut = {};
      for (var k in lsData) {
        if (!Object.prototype.hasOwnProperty.call(lsData, k)) continue;
        lsOut[k] = processLocalStorageValueForExport(lsData[k], state, k);
      }
      var idbOut = {};
      for (var k2 in idbData) {
        if (!Object.prototype.hasOwnProperty.call(idbData, k2)) continue;
        /* 聊天记录：现在只在 IDB 里（启动期不再水合到内存/LS）。
           旧逻辑会把 IDB 版跳过、只导出 LS 里的空串 → 聊天记录在备份里直接没了。
           这里直接取「消息行数更多」的版本并写进输出。行数用字符级计数，
           不 JSON.parse（一万条 parse 一次几百 MB，低端机闪退）。 */
        if (k2.indexOf("akini_chat_history_") === 0) {
          var _la = lsData[k2] || "",
            _lb = idbData[k2] || "";
          var _best = typeof _lb === "string" && (!_la || _lb.length > _la.length) ? _lb : _la;
          if (_best) lsOut[k2] = processLocalStorageValueForExport(_best, state, k2);
          continue;
        }
        // LS/内存为运行期权威：已覆盖的键跳过 IDB 版本；IDB 独有的键（含 _backup 完整副本）全部收录
        if (lsData[k2] != null) continue;
        idbOut[k2] = processLocalStorageValueForExport(idbData[k2], state, k2);
      }
      done({
        type: "akini-backup-v5",
        formatVersion: 5,
        appName: "Akini",
        timestamp: new Date().toISOString(),
        localStorage: lsOut,
        indexedDB: idbOut,
        mediaStore: state.store,
      });
    });
  }

  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    /* 安卓下载是异步的：大 ZIP 还没开始写盘就把 blob URL 撤销，下载会中断/失败，
       文件管理里自然“什么都没有”。延长到 60s 并忽略已撤销的报错。 */
    setTimeout(function () {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    }, 60000);
  }

  /* 手机端导出统一走系统分享面板 / 手动保存弹窗：
     安卓 WebView、加到桌面的 PWA 里 a[download] 常常静默失败；
     而 ZIP 是异步生成的，点击导出时的“用户手势”早就过期，
     浏览器会直接拒绝这次下载 —— 用户看到“导出成功”却哪都找不到文件。
     这里给出「保存文件」按钮：按钮点击才是有效手势，下载必定落盘。 */
  function isMobileUA() {
    try {
      return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent || "");
    } catch (e) {
      return false;
    }
  }
  function offerSaveManually(blob, fileName, done) {
    var modal = window.__akiniCenterModal;
    if (typeof modal !== "function") return false;
    try {
      modal(
        "导出完成",
        "文件已生成：" +
          fileName +
          "\n\n点击「保存文件」后选择保存位置（安卓建议选「下载 / Download」）。保存后即可在手机文件管理里看到。",
        {
          confirm: true,
          okText: "保存文件",
          cancelText: "关闭",
          onClose: function (ok) {
            if (!ok) return;
            downloadBlob(blob, fileName);
            done && done("download");
          },
        },
      );
      return true;
    } catch (e) {
      return false;
    }
  }
  function saveBlobSmart(blob, fileName, done) {
    var type = (blob && blob.type) || (/\.zip$/i.test(fileName) ? "application/zip" : "application/octet-stream");
    /* iOS 的 navigator.share(files) 对大文件会直接卡死 WebView：
       全局备份动不动就几十 MB，超过阈值一律走普通下载，不进分享面板。 */
    if (blob && blob.size > 768 * 1024) {
      downloadBlob(blob, fileName);
      done && done("download");
      return;
    }
    try {
      var f = new File([blob], fileName, { type: type });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        var p;
        try {
          p = navigator.share({ files: [f], title: fileName });
        } catch (e0) {
          p = null;
        }
        if (p && typeof p.then === "function") {
          p.then(function () {
            done && done("share");
          }).catch(function (e) {
            if (e && e.name === "AbortError") return; // 用户主动取消分享，不算失败
            /* NotAllowedError：异步生成导致手势过期，分享被拒 → 交给手动保存按钮 */
            if (!offerSaveManually(blob, fileName, done)) {
              downloadBlob(blob, fileName);
              done && done("download");
            }
          });
          return;
        }
      }
    } catch (e) {}
    if (isMobileUA() && offerSaveManually(blob, fileName, done)) return;
    downloadBlob(blob, fileName);
    done && done("download");
  }

  function notify(title, body, type) {
    try {
      if (window.__akiniCenterModal) {
        window.__akiniCenterModal(title, body);
      } else if (typeof showNotification === "function") {
        showNotification(body, type || "info", 3000);
      } else {
        alert(body);
      }
    } catch (e) {}
  }

  function isZipArrayBuffer(ab) {
    if (!ab || ab.byteLength < 4) return false;
    var u = new Uint8Array(ab);
    return (
      u[0] === 0x50 &&
      u[1] === 0x4b &&
      (u[2] === 0x03 || u[2] === 0x05 || u[2] === 0x07) &&
      (u[3] === 0x04 || u[3] === 0x06 || u[3] === 0x08)
    );
  }

  function parseZipBackup(ab, done, errCb) {
    if (typeof JSZip === "undefined") {
      /* 按需异步加载 JSZip，加载成功后自动重试，失败再报错 */
      if (window.__akiniEnsureJSZip) {
        window.__akiniEnsureJSZip(function (ok) {
          if (ok) {
            parseZipBackup(ab, done, errCb);
          } else {
            errCb && errCb("JSZip 加载失败，无法读取 ZIP 备份");
          }
        });
        return;
      }
      errCb && errCb("JSZip 未加载，无法读取 ZIP 备份");
      return;
    }
    JSZip.loadAsync(ab)
      .then(function (zip) {
        var jsonFile = zip.file("backup.json");
        if (!jsonFile) {
          var names = Object.keys(zip.files).filter(function (n) {
            var e = zip.files[n];
            return e && !e.dir && /\.json$/i.test(n);
          });
          if (names.length === 1) jsonFile = zip.file(names[0]);
        }
        if (!jsonFile) {
          errCb && errCb("ZIP 内未找到 backup.json");
          return;
        }
        jsonFile
          .async("string")
          .then(function (raw) {
            if (raw.length && raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
            try {
              var data = JSON.parse(raw);
              var idx = data.mediaIndex;
              if (data.formatVersion === 5 && data.type === "akini-backup-v5" && idx && typeof idx === "object") {
                var built = {};
                var ids = Object.keys(idx);
                var pending = ids.length;
                if (pending === 0) {
                  data.mediaStore = built;
                  done(data);
                  return;
                }
                ids.forEach(function (id) {
                  var meta = idx[id];
                  var path = meta && meta.path ? meta.path : "media/" + id;
                  var zf = zip.file(path);
                  if (!zf) {
                    console.warn("[AkiniBackup] ZIP 缺少媒体文件", path);
                    pending--;
                    if (pending === 0) {
                      data.mediaStore = built;
                      done(data);
                    }
                    return;
                  }
                  var mimeMeta = meta && meta.mime ? meta.mime : "application/octet-stream";
                  if (mimeMeta === "text/plain+dataurl") {
                    zf.async("string").then(function (txt) {
                      built[id] = txt;
                      pending--;
                      if (pending === 0) {
                        data.mediaStore = built;
                        done(data);
                      }
                    });
                  } else {
                    zf.async("arraybuffer").then(function (buf) {
                      built[id] = binaryToDataUrl(mimeMeta, new Uint8Array(buf));
                      pending--;
                      if (pending === 0) {
                        data.mediaStore = built;
                        done(data);
                      }
                    });
                  }
                });
              } else {
                done(data);
              }
            } catch (e) {
              errCb && errCb("备份 JSON 解析失败：" + e.message);
            }
          })
          .catch(function (e) {
            errCb && errCb("读取 backup.json 失败：" + e.message);
          });
      })
      .catch(function (e) {
        errCb && errCb("ZIP 解析失败：" + e.message);
      });
  }

  function loadBackupFromArrayBuffer(ab, done, errCb) {
    if (isZipArrayBuffer(ab)) {
      parseZipBackup(ab, done, errCb);
      return;
    }
    /* 分块解码，每块之间让出主线程；解析后释放 text 引用 */
    try {
      var u8 = new Uint8Array(ab);
      var dec = new TextDecoder("utf-8");
      var CH = 1024 * 1024,
        text = "";
      var i = 0;
      function stepDecode() {
        try {
          var end = Math.min(i + CH, u8.length);
          text += dec.decode(u8.subarray(i, end), { stream: true });
          i = end;
          if (i < u8.length) {
            setTimeout(stepDecode, 0);
            return;
          }
          text += dec.decode();
          if (text.length && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
          /* 解析也放异步：巨型 JSON.parse 同样冻结主线程数百毫秒~数秒 */
          setTimeout(function () {
            try {
              var data = JSON.parse(text);
              text = ""; /* 尽早释放，降低峰值内存 */
              u8 = null;
              ab = null;
              done(data);
            } catch (e2) {
              text = "";
              u8 = null;
              ab = null;
              errCb && errCb("备份解析失败：" + e2.message);
            }
          }, 30);
        } catch (e1) {
          text = "";
          u8 = null;
          ab = null;
          errCb && errCb("备份解码失败：" + e1.message);
        }
      }
      stepDecode();
    } catch (e) {
      errCb && errCb("备份解析失败：" + e.message);
    }
  }

  function exportBackupToFile() {
    notify("备份导出", "正在生成备份文件…", "info");
    buildBackupPayload(function (payload) {
      var dateStr = new Date().toISOString().slice(0, 10);
      var fileNameZip = "akini-backup-" + dateStr + ".zip";
      if (typeof JSZip !== "undefined") {
        try {
          var zip = new JSZip();
          var store = payload.mediaStore || {};
          var mediaIndex = {};
          for (var sid in store) {
            if (!Object.prototype.hasOwnProperty.call(store, sid)) continue;
            var url = store[sid];
            var parts = dataUrlToBinary(url);
            var path = "media/" + sid;
            if (parts && parts.bytes && parts.bytes.length) {
              zip.file(path, parts.bytes, { binary: true });
              mediaIndex[sid] = { path: path, mime: parts.mime };
            } else {
              var txtPath = path + ".txt";
              zip.file(txtPath, String(url));
              mediaIndex[sid] = { path: txtPath, mime: "text/plain+dataurl" };
            }
          }
          var jsonBody = {
            type: "akini-backup-v5",
            formatVersion: 5,
            appName: payload.appName || "Akini",
            timestamp: payload.timestamp,
            localStorage: payload.localStorage,
            indexedDB: payload.indexedDB,
            mediaIndex: mediaIndex,
          };
          zip.file("backup.json", "\uFEFF" + JSON.stringify(jsonBody));
          zip
            .generateAsync({
              type: "blob",
              mimeType: "application/zip",
              compression: "DEFLATE",
              compressionOptions: { level: 6 },
            })
            .then(function (zipBlob) {
              var countMsg =
                "localStorage " +
                Object.keys(payload.localStorage).length +
                " 项，IndexedDB " +
                Object.keys(payload.indexedDB).length +
                " 项";
              /* 安卓必须走系统分享面板：直接 a[download] 在 WebView/PWA 里常静默失败，
                 文件既不落盘也没有任何提示（用户以为导出成功，去“文件”里却找不到）。 */
              saveBlobSmart(zipBlob, fileNameZip, function (how) {
                if (how === "share") {
                  notify(
                    "导出成功",
                    "已导出 ZIP（" + countMsg + "）。请到刚才在系统面板中选择的保存位置查看。",
                    "success",
                  );
                } else {
                  notify(
                    "导出成功",
                    "已导出 ZIP（" +
                      countMsg +
                      "）。文件保存在手机「下载 / Download」目录，可在文件管理中按类型「压缩包」查找。",
                    "success",
                  );
                }
              });
            })
            .catch(function (e) {
              console.error("[AkiniBackup] ZIP 导出失败", e);
              fallbackJson(payload, dateStr);
            });
          return;
        } catch (zipErr) {
          console.error("[AkiniBackup] ZIP 初始化失败", zipErr);
        }
      } else if (window.__akiniEnsureJSZip) {
        notify("备份导出", "正在加载压缩组件…", "info");
        window.__akiniEnsureJSZip(function (ok) {
          if (ok) {
            exportBackupToFile();
          } else {
            fallbackJson(payload, dateStr);
          }
        });
        return;
      }
      fallbackJson(payload, dateStr);
    });
  }

  function fallbackJson(payload, dateStr) {
    var fileName = "akini-backup-all-" + dateStr + ".json";
    var str = "\uFEFF" + JSON.stringify(payload);
    var blob = new Blob([str], { type: "application/json;charset=utf-8" });
    saveBlobSmart(blob, fileName, function (how) {
      notify(
        "导出成功",
        how === "share"
          ? "已全量导出所有设置与内容（含头像、背景图、聊天、字卡、自定义文字等全部数据），请到系统面板中选择的保存位置查看。"
          : "已全量导出所有设置与内容（含头像、背景图、聊天、字卡、自定义文字等全部数据）。文件在手机「下载 / Download」目录；若在微信/QQ 内打开，请用系统浏览器重新导出。",
        "success",
      );
    });
  }

  function applyBackupToStorage(data, done, errCb) {
    window._restoringData = true;
    // 放行 AkiniPersist 的 clear/removeItem 拦截，确保旧数据被真正清空
    
window._akiniAllowRemove = true;

    // 清空内存镜像 + IDB 待写队列：旧内存值会在拦截读取时遮蔽导入的新值
    try {
      if (window.akiniStore && window.akiniStore.wipeMemory) window.akiniStore.wipeMemory();
    } catch (e) {}
    var lsRaw = (data && data.localStorage) || {};
    var idbRaw = (data && data.indexedDB) || {};
    var mediaStore = (data && data.mediaStore) || {};
    var backupKeyCount = Object.keys(lsRaw).length + Object.keys(idbRaw).length;
    if (backupKeyCount === 0) {
      window._restoringData = false;
      
window._akiniAllowRemove = false;

      if (errCb) errCb("备份文件为空，未导入任何数据");
      return;
    }

    // 先拍回滚快照，导入失败时可恢复
    var rollback = {};
    try {
      for (var ri = 0; ri < localStorage.length; ri++) {
        var rk = localStorage.key(ri);
        if (rk) rollback[rk] = localStorage.getItem(rk);
      }
    } catch (e) {}
    function restoreRollback() {
      try {
        localStorage.clear();
      } catch (e) {}
      for (var k in rollback) {
        try {
          localStorage.setItem(k, rollback[k]);
        } catch (e) {}
      }
    }

    function writeAll() {
      var count = 0;
      var finished = false;
      function finishOk() {
        if (finished) return;
        finished = true;
        // localStorage.setItem 的拦截层已把每个键镜像到「内存 + IndexedDB 队列」。
        // 必须等 IDB 事务真正提交完再回调：聊天记录、聊天背景这类大图/大文本只存在 IDB，
        // 以前这里 fire-and-forget 后 1.5s 就刷新，事务被中断 → 导入后聊天和背景“消失”。
        var _doneFired = false;
        var _afterFlush = function () {
          if (_doneFired) return;
          _doneFired = true;
          try {
            localStorage.removeItem("akini_localstorage_snapshot");
          } catch (e) {}
          try {
            localStorage.removeItem("akini_localstorage_snapshot_backup");
          } catch (e) {}

window._akiniAllowRemove = false;

          if (done) done(count);
        };
        try {
          if (window.akiniStore && window.akiniStore.flushIdb) window.akiniStore.flushIdb(_afterFlush);
          else _afterFlush();
        } catch (e) {
          _afterFlush();
        }
        /* IDB.set 的回调在个别机型/配额紧张时可能永远不回来（事务 abort、回调丢失），
           导致导入完成回调永不执行：看起来"导入完了但界面还是旧的"，缓存里还留着
           旧占位联系人，于是又冒出"另一个联系人"。这里兜底：最多等 2.5s 必须收尾。 */
        try {
          setTimeout(_afterFlush, 2500);
        } catch (e) {
          _afterFlush();
        }
      }

      function tryWrite(key, value) {
        if (value === null || value === undefined) return;
        if (isDerivedKey(key)) return; // 快照/派生键不导入，运行时自动再生
        if (isSurveyKey(key)) return; // 仅问卷不支持文件导入，跳过；表情包可正常导入
        count++;
        // 拦截层会同步写入内存并异步镜像到 IndexedDB，无需再单独调 _idbStore.set
        try {
          localStorage.setItem(key, value);
        } catch (e) {}
      }

      // 分批写入：每批 25 键后让出主线程，大备份（含媒体内联）降到每批 8 键，避免页面假死
      var _wkeys = [];
      for (var key in lsRaw) {
        if (Object.prototype.hasOwnProperty.call(lsRaw, key)) _wkeys.push([lsRaw, key]);
      }
      for (var k2 in idbRaw) {
        if (Object.prototype.hasOwnProperty.call(idbRaw, k2)) _wkeys.push([idbRaw, k2]);
      }
      var _totalChars = 0;
      try {
        _wkeys.forEach(function (p) {
          var v = p[0][p[1]];
          _totalChars += typeof v === "string" ? v.length : 200;
        });
      } catch (e) {}
      var _batchSize = _wkeys.length && _totalChars / _wkeys.length > 61440 ? 8 : 25;
      var _wi = 0;
      (function step() {
        var end = Math.min(_wi + _batchSize, _wkeys.length);
        for (; _wi < end; _wi++) {
          var src = _wkeys[_wi][0],
            kk = _wkeys[_wi][1];
          /* 单个键（尤其是超大聊天记录 / 异常媒体引用）处理失败时，
             只跳过这一项，不能让它把整批写入中断——以前一处异常会让 finishOk
             永远不执行：导入看似成功、实际内存快照还是旧联系人，随后原地补建
             就多出「另一个联系人」，重进才恢复正常。 */
          try {
            tryWrite(kk, processLocalStorageValueForImport(src[kk], mediaStore, kk));
          } catch (eKey) {
            try {
              console.warn("[akini] 导入跳过异常键", kk, eKey && eKey.message);
            } catch (eLog) {}
          }
        }
        if (_wi < _wkeys.length) {
          setTimeout(step, 0);
          return;
        }
        finishOk();
      })();
    }

    // 清空旧数据（localStorage + sessionStorage + IndexedDB + 默认 localforage + 图片缓存，
    // 防止旧图/旧数据混入导入后的新数据）
    try {
      localStorage.clear();
    } catch (e) {}
    try {
      sessionStorage.clear();
    } catch (e) {}
    /* 数组模型的内存快照也清掉：否则刷新前的 pagehide flush 会用旧数组覆盖刚导入的记录 */
    try {
      if (window.__akiniChatLog && window.__akiniChatLog.reset) window.__akiniChatLog.reset();
    } catch (e) {}
    try {
      if (window.__akiniImgCache) {
        for (var _ik in window.__akiniImgCache) delete window.__akiniImgCache[_ik];
      }
    } catch (e) {}
    try {
      if (window.localforage && localforage.clear) localforage.clear().catch(function () {});
    } catch (e) {}

    var importFail = function (msg) {
      restoreRollback();
      window._restoringData = false;
      
window._akiniAllowRemove = false;

      if (errCb) errCb(msg);
    };
    if (window._idbStore && window._idbStore.clearAll) {
      try {
        window._idbStore.clearAll(function () {
          try {
            writeAll();
          } catch (e) {
            importFail("导入写入失败：" + e.message);
          }
        });
      } catch (e) {
        importFail("清空旧数据失败：" + e.message);
      }
    } else {
      try {
        writeAll();
      } catch (e) {
        importFail("导入写入失败：" + e.message);
      }
    }
  }

  function akImportBackup(file) {
    if (!file) return;
    /* 导入全程进度提示——大文件解析/写入耗时数秒，无提示会被用户当成卡死反复点击 */
    try {
      if (window.__akiniCenterModal) {
        window.__akiniCenterModal(
          "正在导入",
          "正在读取备份文件（" +
            (file.size / 1048576 >= 1
              ? (file.size / 1048576).toFixed(1) + " MB"
              : Math.round(file.size / 1024) + " KB") +
            "），请勿离开页面…",
        );
      } else {
        notify("正在导入", "正在读取备份文件，请稍候…", "info");
      }
    } catch (e) {}
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var ab = ev.target.result;
        loadBackupFromArrayBuffer(
          ab,
          function (data) {
            function doImport() {
              try {
                if (window.__akiniCenterModal) {
                  window.__akiniCenterModal("正在导入", "正在写入数据，完成后可直接使用…");
                } else {
                  notify("正在导入", "正在写入数据，请稍候…", "info");
                }
              } catch (e) {}
              applyBackupToStorage(
                data,
                function (count) {
                  // 不再整页刷新：IDB 事务已提交，清掉内存快照后原地重建界面即可。
                  window._restoringData = false;
                  notify("导入成功", "成功导入 " + count + " 项数据", "success");
                  try {
                    if (window.__akiniChatLog && window.__akiniChatLog.reset) window.__akiniChatLog.reset();
                  } catch (e) {}
                  try {
                    if (window.__akiniOnCriticalRestored) window.__akiniOnCriticalRestored();
                  } catch (e) {}
                  try {
                    window.dispatchEvent(new Event("akini-data-imported"));
                  } catch (e) {}
                },
                function (err) {
                  notify("导入失败", err, "error");
                },
              );
            }
            if (window.__akiniCenterModal) {
              window.__akiniCenterModal("确认导入", "导入将覆盖当前全部本地数据，确定继续？", {
                confirm: true,
                onClose: function (ok) {
                  if (ok) doImport();
                },
              });
            } else if (confirm("导入将覆盖当前全部本地数据，确定继续？")) {
              doImport();
            }
          },
          function (err) {
            notify("导入失败", err, "error");
          },
        );
      } catch (e) {
        notify("导入失败", e.message, "error");
      }
    };
    reader.onerror = function () {
      notify("读取失败", "文件读取失败，请重试", "error");
    };
    reader.readAsArrayBuffer(file);
  }

  global.akExportBackup = exportBackupToFile;
  global.akImportBackup = akImportBackup;
  global.__akiniBackupEngineReady = true;

  function bindBackupButtons() {
    var exp = document.getElementById("exportBackupBtn");
    var imp = document.getElementById("importBackupInput");
    if (exp) exp.addEventListener("click", exportBackupToFile);
    if (imp) {
      imp.addEventListener("change", function () {
        akImportBackup(imp.files && imp.files[0]);
        imp.value = "";
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindBackupButtons);
  } else {
    setTimeout(bindBackupButtons, 0);
  }
})(window);
