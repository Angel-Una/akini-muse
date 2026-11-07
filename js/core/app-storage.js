/**
 * Akini 储存数据页（数据管理）
 * 入口：设置页「储存数据」行 → 全屏页面
 * 功能：导出备份 / 导入备份 / 清除数据
 */
(function () {
  "use strict";

  var AREA_ID = "storageArea";

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
    return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }

  /* 按 key 分类统计占用 —— 严格按用户定义：
     聊天记录 = 微信界面的聊天记录（chat_history / contacts / sessions / pending_reply 等）
     图片媒体 = 所有界面的图片数据（bg / avatar / cover / sticker / media / wallpaper / emoji 图）
     设置数据 = 所有界面的其他数据（settings / toggle / prob / wordbank / moments / icity / mail / survey / shop / font / theme / music 等）
     陪伴和观影 = 一次性的，结束后就没有了 → 不计入（akini_watch_* / akini_companion_* 直接跳过） */
  function categorizeKey(k) {
    if (!k) return null;
    /* 陪伴 / 观影：一次性，不计入 */
    if (/^akini_(watch_|companion_)/.test(k)) return null;
    /* 图片媒体：所有界面的壁纸、头像、封面、表情包、媒体缓存 */
    if (/^akini_.*(_bg|_avatar|_cover|_wallpaper)$/.test(k)) return "图片媒体";
    if (
      /^akini_(home_bg|my_avatar|ta_avatar|icity_my_avatar|icity_ta_avatar|friends_bg|call_bg|callmini_bg|call_mini_bg|cover_img|chat_bg|music_bg|day_bg|anniv_bg|watch_wallpaper)/.test(
        k,
      )
    )
      return "图片媒体";
    if (/^akini_(stk|sticker|media_|emoji_img|wb_emoji)/.test(k)) return "图片媒体";
    /* 聊天记录：微信界面的聊天记录、联系人、会话、待回复 */
    if (
      /^akini_(chat_history_|chat_critical_|chat_meta_|contacts|sessions|last_chat|pending_reply|chat_backup_|active_chat)/.test(
        k,
      )
    )
      return "聊天记录";
    /* 设置数据：其余全部（开关、概率、字卡库、朋友圈、iCity、信件、问卷、商店、字体、主题、音乐等） */
    return "设置数据";
  }

  /* 收集 localStorage 中各 key 的字节数（仅作 IDB 之外的补缺，避免与 IDB 镜像重复计数） */
  function computeLsBytes() {
    var map = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        var v = localStorage.getItem(k) || "";
        map[k] = (k.length + v.length) * 2; // UTF-16
      }
    } catch (e) {}
    return map;
  }

  function getStorageEstimate() {
    return new Promise(function (resolve) {
      try {
        if (navigator.storage && navigator.storage.estimate) {
          navigator.storage
            .estimate()
            .then(function (r) {
              resolve({ usage: Number(r && r.usage) || 0, quota: Number(r && r.quota) || 0 });
            })
            .catch(function () {
              resolve({ usage: 0, quota: 0 });
            });
          return;
        }
      } catch (e) {}
      try {
        if (navigator.webkitTemporaryStorage && navigator.webkitTemporaryStorage.queryUsageAndQuota) {
          navigator.webkitTemporaryStorage.queryUsageAndQuota(
            function (u, q) {
              resolve({ usage: Number(u) || 0, quota: Number(q) || 0 });
            },
            function () {
              resolve({ usage: 0, quota: 0 });
            },
          );
          return;
        }
      } catch (e) {}
      resolve({ usage: 0, quota: 0 });
    });
  }

  /* 估算单个值的字节数：Blob/File 用 size，ArrayBuffer 用 byteLength，
     字符串按 UTF-16，其他用 JSON 序列化长度。只用于展示占用，不要求精确到字节。 */
  function valueBytes(v) {
    try {
      if (v == null) return 0;
      if (typeof v === "string") return v.length * 2;
      if (typeof Blob !== "undefined" && v instanceof Blob) return v.size;
      if (typeof ArrayBuffer !== "undefined" && v instanceof ArrayBuffer) return v.byteLength;
      if (v.buffer && v.buffer instanceof ArrayBuffer) return v.buffer.byteLength;
      var s = JSON.stringify(v);
      return s ? s.length * 2 : 0;
    } catch (e) {
      return 0;
    }
  }

  /* 异步计算所有 IndexedDB 数据库的实际占用，并按 key 分类归入三大类。
     打开失败的库跳过；返回 {total, cats, keys}，keys 为已统计的 key 集合（用于与 LS 去重）。 */
  function computeIdbSize() {
    return new Promise(function (resolve) {
      var result = { total: 0, cats: {}, keys: {} };
      var dbs = [];
      try {
        if (indexedDB && indexedDB.databases) {
          indexedDB
            .databases()
            .then(function (list) {
              dbs = (list || [])
                .filter(function (d) {
                  return d && d.name;
                })
                .map(function (d) {
                  return d.name;
                });
              nextDb();
            })
            .catch(function () {
              resolve(result);
            });
        } else {
          resolve(result);
        }
      } catch (e) {
        resolve(result);
      }

      function addCat(k, bytes) {
        var cat = /^akini_/.test(k) ? categorizeKey(k) : "设置数据";
        if (cat === null) return;
        result.cats[cat] = (result.cats[cat] || 0) + bytes;
        result.total += bytes;
        result.keys[k] = true;
      }

      function nextDb() {
        if (!dbs.length) {
          resolve(result);
          return;
        }
        var name = dbs.shift();
        try {
          var req = indexedDB.open(name);
          req.onerror = function () {
            nextDb();
          };
          req.onblocked = function () {
            try {
              req.result && req.result.close();
            } catch (e) {}
            nextDb();
          };
          req.onsuccess = function () {
            var db = req.result;
            var stores = [];
            try {
              var names = db.objectStoreNames;
              for (var i = 0; i < names.length; i++) stores.push(names[i]);
            } catch (e) {}
            function nextStore() {
              if (!stores.length) {
                try {
                  db.close();
                } catch (e) {}
                nextDb();
                return;
              }
              var sn = stores.shift();
              try {
                var tx = db.transaction(sn, "readonly");
                var os = tx.objectStore(sn);
                var cnt = os.count();
                cnt.onsuccess = function () {
                  var total = Number(cnt.result) || 0;
                  if (total === 0) {
                    nextStore();
                    return;
                  }
                  var cursorReq = os.openCursor();
                  cursorReq.onsuccess = function (ev) {
                    var cur = ev.target.result;
                    if (cur) {
                      var k = cur.key;
                      var keyStr = typeof k === "string" ? k : String(k);
                      addCat(keyStr, valueBytes(cur.value));
                      try {
                        cur.continue();
                      } catch (e) {
                        nextStore();
                      }
                    } else {
                      nextStore();
                    }
                  };
                  cursorReq.onerror = function () {
                    nextStore();
                  };
                };
                cnt.onerror = function () {
                  nextStore();
                };
              } catch (e) {
                nextStore();
              }
            }
            nextStore();
          };
        } catch (e) {
          nextDb();
        }
      }
    });
  }

  /* 渲染储存面板：先算完 localStorage + IndexedDB 再一次性渲染，避免"计算中…→数字"闪烁。
     DOM 只在首次构建，后续只更新数字与进度条宽度。 */
  var __storRendered = false;
  /* ===== 聊天记录导出 / 导入（仅默认联系人） =====
     网站只有一个默认联系人的聊天逻辑：导出只导出这个联系人的全部聊天记录，
     导入时整段覆盖它的聊天记录，不做跨联系人合并。 */
  function _dcContact() {
    try {
      {
        var d = window.__akiniDefaultContact();
        if (d && d.id != null) return d;
      }
    } catch (e) {}
    try {
      var cs = window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() : [];
      return cs && cs.length ? cs[0] : null;
    } catch (e) {
      return null;
    }
  }
  function _dcKey(c) {
    return "akini_chat_history_" + c.id;
  }
  function _idbReadRaw(k, cb) {
    var idb = window._idbStore;
    var done = false;
    var fin = function (v) {
      if (done) return;
      done = true;
      cb(v || null);
    };
    var ls = null;
    try {
      ls = localStorage.getItem(k);
    } catch (e) {}
    if (ls) return fin(ls);
    if (!idb || typeof idb.get !== "function") return fin(null);
    try {
      var r = idb.get(k, function (v) {
        fin(v);
      });
      if (r && typeof r.then === "function")
        r.then(fin, function () {
          fin(null);
        });
    } catch (e) {}
    setTimeout(function () {
      fin(null);
    }, 1500);
  }
  function collectDefaultChat() {
    return new Promise(function (resolve, reject) {
      var c = _dcContact();
      if (!c) return reject(new Error("没有找到联系人"));
      var k = _dcKey(c);
      var mem = "";
      try {
        /* 数组模型对外只输出 join 后的完整 HTML，导出的文件仍是通用格式 */
        mem = window.__akiniChatLog
          ? window.__akiniChatLog.html(c.id)
          : (window.akiniStore && window.akiniStore.memoryGet ? window.akiniStore.memoryGet(k) : "") || "";
      } catch (e) {}
      _idbReadRaw(k, function (v) {
        var hist = mem || v || "";
        /* IDB 里可能是数组 JSON：导出仍还原成 HTML，兼容旧版导入 */
        if (hist && hist.charAt(0) === "[") {
          try {
            var _a = JSON.parse(hist);
            if (Array.isArray(_a))
              hist = _a
                .map(function (o) {
                  return (o && o.html) || "";
                })
                .join("");
          } catch (e) {}
        }
        resolve({
          app: "akini-chat",
          v: 2,
          exportedAt: new Date().toISOString(),
          contact: { id: c.id, name: c.name || "对方" },
          rows: (hist.match(/class="msg-row/g) || []).length,
          history: hist,
        });
      });
    });
  }
  function _chatSaveFile(text, fileName) {
    var blob = new Blob([text], { type: "application/json" });
    /* 同上：大聊天记录不走 iOS 分享面板，否则直接卡死 */
    if (blob.size > 768 * 1024) return void _chatDownload(blob, fileName);
    try {
      var file = new File([blob], fileName, { type: "application/json" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Akini 聊天记录备份" }).catch(function () {
          _chatDownload(blob, fileName);
        });
        return;
      }
    } catch (e) {}
    _chatDownload(blob, fileName);
  }
  function _chatDownload(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try {
        URL.revokeObjectURL(url);
        a.remove();
      } catch (e) {}
    }, 2000);
  }
  function exportChatRecords() {
    collectDefaultChat()
      .then(function (bundle) {
        if (!bundle.history) {
          if (window.__akiniCenterModal) window.__akiniCenterModal("聊天记录", "默认联系人还没有聊天记录可导出");
          else alert("默认联系人还没有聊天记录可导出");
          return;
        }
        var d = new Date();
        var pad = function (x) {
          return (x < 10 ? "0" : "") + x;
        };
        _chatSaveFile(
          JSON.stringify(bundle, null, 2),
          "akini-chat-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".json",
        );
      })
      .catch(function (e) {
        try {
          if (window.__akiniCenterModal)
            window.__akiniCenterModal("聊天记录", "导出失败：" + (e && e.message ? e.message : e));
        } catch (e2) {}
      });
  }
  function importChatRecords(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var bundle = JSON.parse(String(fr.result || ""));
        if (!bundle || bundle.app !== "akini-chat") throw new Error("不是有效的 Akini 聊天记录文件");
        var hist = "";
        if (typeof bundle.history === "string") hist = bundle.history;
        else if (bundle.histories) {
          /* 兼容旧版文件：只取第一条聊天记录，整段覆盖默认联系人 */
          var ks = Object.keys(bundle.histories).filter(function (k) {
            return k.indexOf("akini_chat_history_") === 0;
          });
          if (ks.length) hist = bundle.histories[ks[0]] || "";
        }
        if (!hist) throw new Error("文件里没有聊天记录");
        var c = _dcContact();
        if (!c) throw new Error("没有找到联系人");
        if (!confirm("导入会整段覆盖默认联系人「" + (c.name || "对方") + "」的全部聊天记录，确定继续吗？")) return;
        var k = _dcKey(c);
        var store = window.akiniStore;
        /* 数组模型是唯一权威：整段导入先拆成 {ts,html} 数组再落盘 */
        try {
          if (window.__akiniChatLog) {
            window.__akiniChatLog.replace(c.id, hist);
            window.__akiniChatLog.flush();
          } else if (store && typeof store.set === "function") store.set(k, hist);
          else localStorage.setItem(k, hist);
        } catch (e) {
          throw e;
        }
        try {
          window.akiniContacts && window.akiniContacts.resetCache && window.akiniContacts.resetCache();
        } catch (e) {}
        try {
          window.renderChatList && window.renderChatList();
        } catch (e) {}
        try {
          if (
            window.akiniContacts &&
            window.akiniContacts.getActiveChatId &&
            window.akiniContacts.getActiveChatId() === c.id &&
            window.openChat
          ) {
            window.openChat(c.id, true);
          }
        } catch (e) {}
        var rows = window.__akiniChatLog
          ? window.__akiniChatLog.count(c.id)
          : (hist.match(/class="msg-row/g) || []).length;
        if (window.__akiniCenterModal) window.__akiniCenterModal("聊天记录", "已覆盖导入 " + rows + " 条消息");
        else alert("已覆盖导入 " + rows + " 条消息");
      } catch (e) {
        try {
          if (window.__akiniCenterModal)
            window.__akiniCenterModal("聊天记录", "导入失败：" + (e && e.message ? e.message : e));
        } catch (e2) {}
      }
    };
    fr.readAsText(file);
  }

  function renderStorage() {
    var body = document.getElementById("akStorBody");
    if (!body) return;

    if (!__storRendered) {
      body.innerHTML =
        '<div class="settings-card"><div class="card-title">网站内存空间</div>' +
        '<div class="ak-stor-total-wrap">' +
        '<div class="ak-stor-total-bar"><div class="ak-stor-total-fill" id="akStorTotalFill" style="width:0%"></div></div>' +
        '<div class="ak-stor-total-text" id="akStorTotalLine">储存总量 <b>计算中…</b></div>' +
        "</div>" +
        '<div class="ak-stor-divider">按内容分类</div>' +
        '<div id="akStorCatRows"></div>' +
        '<div class="ak-hint" style="margin-top:8px">点击「导出备份」可保存全部数据到文件</div>' +
        "</div>" +
        '<div class="settings-card"><div class="card-title">备份与恢复</div>' +
        '<div class="ak-hint" style="margin-top:0">数据每次变更已自动备份到浏览器本地库；换设备/清理浏览器前请先导出备份文件</div>' +
        '<div class="ak-btn-col">' +
        '<button class="ak-stor-btn primary" id="akStorExport" type="button">导出备份</button>' +
        '<button class="ak-stor-btn" id="akStorImport" type="button">导入备份</button>' +
        '<input type="file" id="akStorImportFile" accept=".zip,.json" class="akini-file-offscreen">' +
        "</div>" +
        "</div>" +
        '<div class="settings-card"><div class="card-title">聊天记录</div>' +
        '<div class="ak-hint" style="margin-top:0">导出默认联系人的全部聊天记录；导入时整段覆盖默认联系人的聊天</div>' +
        '<div class="ak-btn-col">' +
        '<button class="ak-stor-btn primary" id="akChatExport" type="button">导出聊天记录</button>' +
        '<button class="ak-stor-btn" id="akChatImport" type="button">导入聊天记录</button>' +
        '<input type="file" id="akChatImportFile" accept=".json,application/json" class="akini-file-offscreen">' +
        "</div>" +
        "</div>" +
        '<div class="settings-card"><div class="card-title">清除数据</div>' +
        '<div class="ak-hint" style="margin-top:0">清空后聊天记录、联系人、朋友圈、iCity、贴纸、设置全部删除（含浏览器本地库），不可恢复</div>' +
        '<div class="ak-btn-col">' +
        '<button class="ak-stor-btn danger" id="akStorWipe" type="button">清除全部数据</button>' +
        "</div>" +
        "</div>";
      __storRendered = true;
      bindActions();
    }

    var totalLine = document.getElementById("akStorTotalLine");
    var totalFill = document.getElementById("akStorTotalFill");

    /* 总量行保持"计算中…"，分类行也先不渲染，等 IDB+LS+配额全部算完再一次性刷新，杜绝数字闪烁 */
    var lsMap = computeLsBytes();
    Promise.all([computeIdbSize(), getStorageEstimate()])
      .then(function (results) {
        var idbRes = results[0] || { cats: {}, keys: {} };
        var est = results[1] || { usage: 0, quota: 0 };

        /* 以 IDB 为准（所有 akini_ 关键键都镜像到 IDB），
         LS 只补充 IDB 里没有的 key（非 akini_ 或未镜像的），避免同一批数据被算两遍 */
        var mergedCats = { 聊天记录: 0, 图片媒体: 0, 设置数据: 0 };
        for (var c in idbRes.cats) {
          if (mergedCats.hasOwnProperty(c)) mergedCats[c] += idbRes.cats[c];
          else mergedCats[c] = idbRes.cats[c];
        }
        for (var lk in lsMap) {
          if (idbRes.keys[lk]) continue; /* IDB 已统计，跳过 */
          var lcat = /^akini_/.test(lk) ? categorizeKey(lk) : "设置数据";
          if (lcat === null) continue;
          mergedCats[lcat] = (mergedCats[lcat] || 0) + lsMap[lk];
        }

        var catTotal = (mergedCats["聊天记录"] || 0) + (mergedCats["图片媒体"] || 0) + (mergedCats["设置数据"] || 0);
        var usedBytes = catTotal;
        var quotaBytes = est.quota > 0 ? est.quota : 0;
        _renderCatRows(mergedCats);
        if (totalLine) {
          var totalTxt = quotaBytes > 0 ? fmtSize(usedBytes) + " / " + fmtSize(quotaBytes) : fmtSize(usedBytes);
          totalLine.innerHTML =
            "已用 <b>" +
            fmtSize(usedBytes) +
            "</b>" +
            (quotaBytes > 0 ? " / 总量 <b>" + fmtSize(quotaBytes) + "</b>" : "");
        }
        if (totalFill) {
          var pct = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
          totalFill.style.width = pct.toFixed(1) + "%";
        }
      })
      .catch(function () {
        /* 出错兜底：用分类之和渲染 */
        var mergedCats = { 聊天记录: 0, 图片媒体: 0, 设置数据: 0 };
        for (var lk2 in lsMap) {
          var lcat2 = /^akini_/.test(lk2) ? categorizeKey(lk2) : "设置数据";
          if (lcat2 === null) continue;
          mergedCats[lcat2] = (mergedCats[lcat2] || 0) + lsMap[lk2];
        }
        var t = (mergedCats["聊天记录"] || 0) + (mergedCats["图片媒体"] || 0) + (mergedCats["设置数据"] || 0);
        _renderCatRows(mergedCats);
        if (totalLine) totalLine.innerHTML = "已用 <b>" + fmtSize(t) + "</b>";
      });
  }

  function _renderCatRows(cats) {
    var catRowsEl = document.getElementById("akStorCatRows");
    if (!catRowsEl) return;
    var order = ["聊天记录", "图片媒体", "设置数据"];
    var maxCat = 1;
    order.forEach(function (c) {
      if ((cats[c] || 0) > maxCat) maxCat = cats[c];
    });
    catRowsEl.innerHTML = order
      .filter(function (cat) {
        /* “其他（缓存）”只在确有差额时出现，避免固定多一行 0 字节 */
        return cat !== "其他（缓存）" || (cats[cat] || 0) > 0;
      })
      .map(function (cat) {
        var bytes = cats[cat] || 0;
        var pct = Math.max(1, Math.round((bytes / maxCat) * 100));
        return (
          '<div class="ak-stor-row">' +
          '<div class="ak-stor-cat">' +
          cat +
          "</div>" +
          '<div class="ak-stor-bar"><div class="ak-stor-bar-fill" style="width:' +
          pct +
          '%"></div></div>' +
          '<div class="ak-stor-size">' +
          fmtSize(bytes) +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function bindActions() {
    var $ = function (id) {
      return document.getElementById(id);
    };
    var note = function (msg) {
      try {
        if (window.__akiniCenterModal) window.__akiniCenterModal("储存数据", msg);
        else alert(msg);
      } catch (e) {
        alert(msg);
      }
    };

    var expBtn = $("akStorExport");
    if (expBtn)
      expBtn.onclick = function () {
        try {
          if (window.akExportBackup) window.akExportBackup();
          else note("备份模块加载中，请稍后再试");
        } catch (e) {
          note("导出失败：" + e.message);
        }
      };

    var impBtn = $("akStorImport");
    var impFile = $("akStorImportFile");
    if (impBtn && impFile) {
      impBtn.onclick = function () {
        impFile.click();
      };
      impFile.onchange = function (ev) {
        var file = ev.target.files && ev.target.files[0];
        if (file && window.akImportBackup) window.akImportBackup(file);
        ev.target.value = "";
      };
    }

    var chatExpBtn = $("akChatExport");
    if (chatExpBtn)
      chatExpBtn.onclick = function () {
        exportChatRecords();
      };

    var chatImpBtn = $("akChatImport");
    var chatImpFile = $("akChatImportFile");
    if (chatImpBtn && chatImpFile) {
      chatImpBtn.onclick = function () {
        chatImpFile.click();
      };
      chatImpFile.onchange = function (ev) {
        var file = ev.target.files && ev.target.files[0];
        importChatRecords(file);
        ev.target.value = "";
      };
    }

    var wipeBtn = $("akStorWipe");
    if (wipeBtn)
      wipeBtn.onclick = function () {
        if (!confirm("确定要清空全部数据吗？\n聊天记录、联系人、朋友圈、iCity、贴纸、设置都会被删除，且无法恢复！"))
          return;
        if (!confirm("最后确认：真的要全部删除吗？建议先点「导出备份」留底。")) return;
        wipeBtn.disabled = true;
        wipeBtn.textContent = "正在清除…";
        // 全局清除标记：阻断一切 localStorage 写回与 IDB 备份，防止清除后数据复活
        
window.__akiniWiping = true;

        // 放行 AkiniPersist 的删除/清空拦截，否则 localStorage.clear() 会把 akini_ 关键数据全部保留下来，清除失败
        
window._akiniAllowRemove = true;

        // 立即清空内存镜像 + IDB 待写队列，防止刷新前的间隙旧数据被重新落盘
        try {
          if (window.akiniStore && window.akiniStore.wipeMemory) window.akiniStore.wipeMemory();
        } catch (e) {}
        try {
          document.cookie = "akini_wipe_pending=1;path=/;max-age=600";
        } catch (e) {}
        var reloaded = false;
        var doReload = function () {
          if (reloaded) return;
          reloaded = true;
          // core 式：换 URL 整页加载（?reset= 时间戳），bfcache 对 URL 变化不适用，旧页面无法从内存复活
          try {
            location.href = location.pathname + "?reset=" + Date.now();
          } catch (e) {
            try {
              location.reload(true);
            } catch (e2) {
              location.reload();
            }
          }
        };
        var clearLocal = function () {
          try {
            localStorage.clear();
          } catch (e) {}
          try {
            sessionStorage.clear();
          } catch (e) {}
          // 逐键强删残留（含非 akini_ 键）
          try {
            var rest = [];
            for (var i = 0; i < localStorage.length; i++) {
              var k = localStorage.key(i);
              if (k) rest.push(k);
            }
            rest.forEach(function (k) {
              try {
                localStorage.removeItem(k);
              } catch (e) {}
            });
          } catch (e) {}
          try {
            var srest = [];
            for (var j = 0; j < sessionStorage.length; j++) {
              var sk = sessionStorage.key(j);
              if (sk) srest.push(sk);
            }
            srest.forEach(function (k) {
              try {
                sessionStorage.removeItem(k);
              } catch (e) {}
            });
          } catch (e) {}
        };
        var finish = function () {
          // 所有 IDB 已删，最后清 localStorage 并立即刷新（顺序不能反，否则快照机制会在间隙写回）
          clearLocal();
          // core 式全量归0：清空所有可访问 cookie（含残留的标记/会话 cookie）
          try {
            document.cookie.split(";").forEach(function (c) {
              var n = String(c).split("=")[0].trim();
              if (n) document.cookie = n + "=;path=/;max-age=0";
            });
          } catch (e) {}
          try {
            document.cookie = "akini_wipe_pending=1;path=/;max-age=600";
          } catch (e) {}
          setTimeout(doReload, 200);
        };
        var deleteAllIdb = function () {
          try {
            _idbStore && _idbStore.clearAll && _idbStore.clearAll(function () {});
          } catch (e) {}
          try {
            if (indexedDB.databases) {
              indexedDB
                .databases()
                .then(function (dbs) {
                  (dbs || []).forEach(function (d) {
                    if (d && d.name) {
                      try {
                        indexedDB.deleteDatabase(d.name);
                      } catch (e) {}
                    }
                  });
                })
                .catch(function () {});
            }
          } catch (e) {}
          try {
            indexedDB.deleteDatabase("akini_img_db");
          } catch (e) {}
          /* CacheStorage（ServiceWorker 缓存）一并清——浏览器 estimate.usage 会把它算进去 */
          try {
            if (window.caches && caches.keys) {
              caches
                .keys()
                .then(function (names) {
                  names.forEach(function (n) {
                    try {
                      caches.delete(n);
                    } catch (e) {}
                  });
                })
                .catch(function () {});
            }
          } catch (e) {}
          finish();
        };
        // 云端备份同步删除（用户要求全部归0，防止重启后云恢复把数据复活）；最多等 2.5s，失败也不阻塞本地清理
        try {
          if (window.__akiniCloudBackup && window.__akiniCloudBackup.wipeCloud) {
            var cloudDone = false;
            var proceed = function () {
              if (cloudDone) return;
              cloudDone = true;
              try {
                if (window._idbStore && window._idbStore.clearAll)
                  window._idbStore.clearAll(function () {
                    deleteAllIdb();
                  });
                else deleteAllIdb();
              } catch (e) {
                deleteAllIdb();
              }
            };
            Promise.race([
              window.__akiniCloudBackup.wipeCloud(),
              new Promise(function (res) {
                setTimeout(res, 2500);
              }),
            ])
              .then(proceed)
              .catch(proceed);
          } else if (window._idbStore && window._idbStore.clearAll)
            window._idbStore.clearAll(function () {
              deleteAllIdb();
            });
          else deleteAllIdb();
        } catch (e) {
          deleteAllIdb();
        }
        // 6 秒仍未完成则再补一轮清空后强制刷新
        setTimeout(function () {
          try {
            if (window._idbStore && window._idbStore.clearAll) window._idbStore.clearAll(function () {});
          } catch (e) {}
          try {
            clearLocal();
          } catch (e) {}
          setTimeout(doReload, 300);
        }, 6000);
      };
  }

  function buildArea() {
    if (document.getElementById(AREA_ID)) return;
    var anchor = document.getElementById("settingsArea");
    var d = document.createElement("div");
    d.id = AREA_ID;
    d.className = "settings-area ak-storage-area";
    d.style.display = "none";
    d.innerHTML =
      '<div class="settings-header">' +
      '<button class="back-btn" id="storageBackBtn" type="button" ' +
      'onclick="window.hideAll&&window.hideAll();window.showArea&&window.showArea(\'settingsArea\');return false;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<div class="title">储存数据</div>' +
      "</div>" +
      '<div class="settings-body" id="akStorBody"></div>';
    (anchor && anchor.parentNode ? anchor.parentNode : document.body).appendChild(d);
  }

  window.__openStorageMgr = function () {
    try {
      buildArea();
      if (window.hideAll) window.hideAll();
      if (window.showArea) window.showArea(AREA_ID);
      else {
        var e = document.getElementById(AREA_ID);
        if (e) e.style.display = "flex";
      }
      renderStorage();
    } catch (err) {
      console.error("[StorageMgr] open error", err);
    }
  };
})();

(function () {
  "use strict";
  if (window.__akiniCloudBackupReady) return;
  window.__akiniCloudBackupReady = true;

  var SUPA_URL = "https://backend.miaoda.online/projects/supabase356066302944653312";
  var SUPA_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMTA0MzIwMDIyLCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.-sN1xREpzprJmdy1bxy9YnVRXjpHv-2WT7thmiit45c";
  var TABLE = "akini_cloud_backups";
  var MAX_PAYLOAD = 4.5 * 1024 * 1024; // 超出则剔除最大 value 的非关键 key
  var SKIP_RE = /^akini_(next_|last_)/; // 高频调度键不备份

  // 绝不因体积剔除的关键 key：会话索引/通讯录/头像/封面/名字/核心设置
  var PROTECT_EXACT = {
    akini_sessions: 1,
    akini_contacts: 1,
    akini_device_id: 1,
    akini_my_avatar: 1,
    akini_ta_avatar: 1,
    akini_icity_my_avatar: 1,
    akini_icity_ta_avatar: 1,
    akini_my_name: 1,
    akini_ta_name: 1,
    akini_home_bg: 1,
  };
  var PROTECT_PREFIX = ["akini_contact_avatar_"];
  function isProtectedKey(k) {
    if (PROTECT_EXACT[k]) return true;
    for (var i = 0; i < PROTECT_PREFIX.length; i++) {
      if (k.indexOf(PROTECT_PREFIX[i]) === 0) return true;
    }
    return false;
  }

  // ---- 设备 ID：本机唯一标识，多层冗余持久化（localStorage + cookie 十年），防止浏览器清理后无法关联云端备份 ----
  function getDeviceId() {
    var id = null;
    try {
      id = localStorage.getItem("akini_device_id");
    } catch (e) {}
    if (!id) {
      // localStorage 被清理时从 cookie 找回，并回填 localStorage
      try {
        var m = (document.cookie || "").match(/(?:^|;\s*)akini_device_id=([^;]+)/);
        if (m && m[1]) id = decodeURIComponent(m[1]);
        if (id) {
          try {
            localStorage.setItem("akini_device_id", id);
          } catch (e) {}
        }
      } catch (e) {}
    }
    if (!id) {
      id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      try {
        localStorage.setItem("akini_device_id", id);
      } catch (e) {}
    }
    // 始终同步写 cookie（10 年）做第二重保障
    try {
      document.cookie = "akini_device_id=" + encodeURIComponent(id) + ";path=/;max-age=315360000;SameSite=Lax";
    } catch (e) {}
    return id;
  }
  var DEVICE_ID = getDeviceId();

  // ---- 本地“空壳/默认值”判定 ----
  var _DEFAULT_VALS = {
    akini_my_name: ["我", ""],
    akini_ta_name: ["梦角", "对方", "TA", ""],
    akini_my_status: ["在线", ""],
    akini_ta_status: ["在线", ""],
    akini_signature: [""],
    akini_friends_signature: [""],
  };
  function _isRealStr(v) {
    return !(v == null || v === "" || v === "null" || v === "undefined");
  }
  function _isShellLocal(k, v) {
    if (!_isRealStr(v)) return true;
    var s = String(v);
    if (s === "[]" || s === "{}") return true;
    if (_DEFAULT_VALS[k] && _DEFAULT_VALS[k].indexOf(s) >= 0) return true;
    try {
      if (k === "akini_contacts") {
        var a = JSON.parse(s);
        if (!Array.isArray(a) || !a.length) return true;
        var real = a.filter(function (c) {
          return c && c.id !== "ta_default" && String(c.name || "") !== "对方";
        });
        return !real.length; // 只剩默认联系人 = 空壳
      }
      if (
        k === "akini_groups" ||
        k === "akini_sessions" ||
        k === "akini_chat_sessions" ||
        k === "akini_chat_pins" ||
        k === "akini_home_avatars"
      ) {
        var o = JSON.parse(s);
        if (Array.isArray(o)) return !o.length;
        return !o || !Object.keys(o).length;
      }
      if (k.indexOf("akini_chat_history") === 0) {
        var msgs = JSON.parse(s);
        return !Array.isArray(msgs) || !msgs.length;
      }
    } catch (e) {}
    return false;
  }
  function _msgCount(v) {
    try {
      if (typeof v !== "string" || !v) return 0;
      if (v.charAt(0) === "[") {
        var a = JSON.parse(v);
        return Array.isArray(a) ? a.length : 0;
      }
      var m = v.match(/<div[^>]*class="msg-row/g);
      return m ? m.length : 0;
    } catch (e) {
      return 0;
    }
  }
  /* 删除墓碑：用户刚清空/删除某个键后，云端旧数据不能又把它拉回来 */
  function _isDeletedLocally(k, cloudAt) {
    try {
      var del = window.__akiniSnap && window.__akiniSnap.isDeleted ? window.__akiniSnap.isDeleted(k) : 0;
      if (del && cloudAt && del > cloudAt) {
        console.warn("[云备份] 本地已删除该键，拒绝用云端旧数据回填: " + k);
        return true;
      }
      /* 通用删除墓碑 akini_del_at_<k>：字卡删空、聊天消息删除/清空等用户主动缩短操作
         都会在写入侧盖章。本地删除时刻新于云端备份时刻 → 拒绝旧值回填。 */
      var delAt = 0;
      try {
        delAt = parseFloat(localStorage.getItem("akini_del_at_" + k) || "0") || 0;
      } catch (eDA) {}
      if (delAt && cloudAt && delAt > cloudAt) {
        console.warn("[云备份] 本地已删除/缩短该键，拒绝云端旧数据回填: " + k);
        return true;
      }
    } catch (e) {}
    return false;
  }

  // ---- 收集全部 akini_ 数据 ----
  function collectAll() {
    var data = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf("akini_") !== 0 || SKIP_RE.test(k)) continue;
        var v = localStorage.getItem(k);
        /* 跳过字面 "null"/"undefined" 脏值，防止把脏数据传上云端再回填到其他设备 */
        if (v != null && v !== "null" && v !== "undefined") data[k] = v;
      }
    } catch (e) {}
    // 内存镜像补充：大键（>200KB 图片等）只存在内存/IDB，必须全量遍历内存键，否则会漏备
    try {
      if (window.akiniStore && window.akiniStore.memoryKeys && window.akiniStore.memoryGet) {
        window.akiniStore.memoryKeys().forEach(function (k) {
          if (!k || k.indexOf("akini_") !== 0 || SKIP_RE.test(k)) return;
          var mv = window.akiniStore.memoryGet(k);
          if (mv != null && mv !== "") data[k] = mv;
        });
      }
    } catch (e) {}
    return data;
  }

  // ---- 体积控制：超出上限时剔除最大 value 的非关键 key（关键 key 绝不剔除）----
  function shrink(data) {
    var s = JSON.stringify(data);
    if (s.length <= MAX_PAYLOAD) return s;
    var entries = Object.keys(data).map(function (k) {
      return { k: k, size: (data[k] || "").length };
    });
    entries.sort(function (a, b) {
      return b.size - a.size;
    });
    var cur = s.length;
    for (var i = 0; i < entries.length && cur > MAX_PAYLOAD; i++) {
      var k = entries[i].k;
      if (isProtectedKey(k)) continue;
      console.warn("[云备份] 数据过大，跳过备份: " + k + " (" + Math.round(entries[i].size / 1024) + "KB)");
      delete data[k];
      cur -= entries[i].size + k.length + 6;
    }
    return JSON.stringify(data);
  }

  var _lastBackupSig = "";
  var _backupTimer = null;
  var _backingUp = false;
  var _restoreDone = false; // 本轮启动已确认云端状态（成功或确认无数据）
  var _cloudKeyCount = 0; // 云端 key 数量（用于检测本地数据骤减）
  /* 后端返回 401/403/404（项目暂停、密钥失效）时进入冷却期。
     否则每次定时器都会先 collectAll() 全量遍历 localStorage 再 JSON.stringify
     最大 4.5MB 的 payload，然后才收到 403 —— 数据多的账号会周期性明显卡一下。 */
  var _cloudBlockedUntil = 0;
  var CLOUD_BLOCK_MS = 30 * 60 * 1000;

  function backup(immediate) {
    /* 轻量模式是「连续启动崩溃」后的自救状态，此时再做全量 collectAll+stringify
       只会让机器继续 OOM 崩溃。本地 IndexedDB 仍是完整副本，跳过云备份不影响本机数据。 */
    if (window.__AKINI_SAFE_MODE) return;
    if (!immediate && Date.now() < _cloudBlockedUntil) return;
    if (window.__akiniWiping) return; // 清除数据期间禁止上传，避免把中间态写回云端
    if (_backingUp && !immediate) return;
    if (document.hidden && !immediate) return; // 页面在后台时不跑周期备份（切后台瞬间已有 immediate 备份兜底）
    if (_backupTimer) {
      clearTimeout(_backupTimer);
      _backupTimer = null;
    }
    var run = function () {
      try {
        var data = collectAll();
        var keys = Object.keys(data);
        if (!keys.length) return;
        // 防空覆盖 1：云端状态尚未确认且本地数据异常少（疑似刚被清理）→ 跳过，等待恢复流程
        if (!_restoreDone && keys.length < 8) {
          console.warn("[云备份] 云端状态未确认且本地数据过少，跳过本次备份");
          return;
        }
        // 防空覆盖 2：云端数据量明显多于本地（本地被浏览器清理过）→ 禁止上传空壳，改为触发恢复
        if (_cloudKeyCount >= 8 && keys.length < Math.max(8, Math.floor(_cloudKeyCount * 0.5))) {
          console.warn("[云备份] 检测到本地数据骤减（" + keys.length + "/" + _cloudKeyCount + "），跳过备份并触发恢复");
          restore();
          return;
        }
        var sig =
          keys.length +
          ":" +
          keys.reduce(function (a, k) {
            return a + (data[k] || "").length;
          }, 0);
        if (!immediate && sig === _lastBackupSig) return; // 无变化不传
        var payload = shrink(data);
        _backingUp = true;
        var bodyStr = JSON.stringify({ device_id: DEVICE_ID, payload: payload, updated_at: new Date().toISOString() });
        /* keepalive 请求体上限约 64KB，超限的即时备份改用普通 fetch（尽力送达），避免每次都静默失败 */
        var useKeepalive = !!immediate && bodyStr.length < 60000;
        fetch(SUPA_URL + "/rest/v1/" + TABLE, {
          method: "POST",
          headers: {
            apikey: SUPA_KEY,
            Authorization: "Bearer " + SUPA_KEY,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: bodyStr,
          keepalive: useKeepalive,
        })
          .then(function (r) {
            _backingUp = false;
            if (r.ok) {
              _lastBackupSig = sig;
              _cloudKeyCount = Math.max(_cloudKeyCount, keys.length);
              backupBlobs(); // zzzx：顺带备份小说正文等大体积 IDB 内容
            } else {
              if (r.status === 401 || r.status === 403 || r.status === 404) {
                _cloudBlockedUntil = Date.now() + CLOUD_BLOCK_MS;
              }
              console.warn("[云备份] 备份失败 HTTP " + r.status);
            }
          })
          .catch(function () {
            _backingUp = false;
          });
      } catch (e) {
        _backingUp = false;
      }
    };
    // 改为微任务延迟到下一轮事件循环，避免与 _akiniImmediateBackup / localStorage 拦截的 pagehide
    // 备份在同一时刻叠加触发，造成低端机 OOM 闪退
    if (immediate) setTimeout(run, 0);
    else _backupTimer = setTimeout(run, 3000);
  }

  /* ==================== zzzx 大体积内容云端保险 ====================
   * 小说正文等存在 IndexedDB 的大文本不在主 payload（4.5MB 上限）内，
   * iOS/Safari 清理 IndexedDB 后会永久丢失 → 逐键独立行备份到 akini_cloud_blobs 表。
   * 只补本地缺失、绝不覆盖；单条 >3MB 跳过。
   */
  var BLOB_TABLE = "akini_cloud_blobs";
  var BLOB_RE = /^akini_novel_content_/;
  var BLOB_MAX = 3 * 1024 * 1024;
  var _blobCache = {}; // key -> 本地内容长度（变化才上传，避免重复流量）

  function backupBlobs() {
    try {
      if (window.__akiniWiping) return;
      if (!window._idbStore || !window._idbStore.keys || !window._idbStore.get) return;
      window._idbStore.keys(function (ks) {
        if (!ks || !ks.length) return;
        var targets = [];
        for (var i = 0; i < ks.length; i++) {
          if (BLOB_RE.test(ks[i])) targets.push(ks[i]);
        }
        if (!targets.length) return;
        var idx = 0;
        (function next() {
          if (idx >= targets.length) return;
          var k = targets[idx++];
          window._idbStore.get(k, function (v) {
            try {
              if (typeof v === "string" && v.length > 0 && v.length <= BLOB_MAX && _blobCache[k] !== v.length) {
                _blobCache[k] = v.length;
                fetch(SUPA_URL + "/rest/v1/" + BLOB_TABLE, {
                  method: "POST",
                  headers: {
                    apikey: SUPA_KEY,
                    Authorization: "Bearer " + SUPA_KEY,
                    "Content-Type": "application/json",
                    Prefer: "resolution=merge-duplicates,return=minimal",
                  },
                  body: JSON.stringify({
                    device_id: DEVICE_ID,
                    key: k,
                    value: v,
                    updated_at: new Date().toISOString(),
                  }),
                }).catch(function () {
                  delete _blobCache[k];
                }); // 失败下次重传
              }
            } catch (e) {}
            setTimeout(next, 300); // 逐本间隔上传，避免突发
          });
        })();
      });
    } catch (e) {}
  }

  function restoreBlobs() {
    try {
      if (!window._idbStore || !window._idbStore.get || !window._idbStore.set) return;
      fetch(
        SUPA_URL + "/rest/v1/" + BLOB_TABLE + "?device_id=eq." + encodeURIComponent(DEVICE_ID) + "&select=key,value",
        {
          headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
        },
      )
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (rows) {
          if (!rows || !rows.length) return;
          var idx = 0,
            restored = 0;
          (function next() {
            if (idx >= rows.length) {
              if (restored > 0) console.warn("[云备份] 已从云端恢复 " + restored + " 项小说内容");
              return;
            }
            var row = rows[idx++];
            if (!row || !row.key || typeof row.value !== "string" || !row.value) {
              next();
              return;
            }
            // 只补本地缺失的内容，绝不覆盖本地已有
            window._idbStore.get(row.key, function (local) {
              if (local === null || local === undefined || local === "") {
                window._idbStore.set(row.key, row.value, function () {
                  restored++;
                  setTimeout(next, 100);
                });
              } else {
                _blobCache[row.key] = typeof local === "string" ? local.length : 0;
                setTimeout(next, 30);
              }
            });
          })();
        })
        .catch(function () {});
    } catch (e) {}
  }

  // ---- 启动恢复：只补本地缺失的 key，绝不覆盖本地已有数据 ----
  function restore() {
    try {
      // 清除数据后的首次启动（?reset= 时间戳）：用户要求全部归0，绝不从云端复活
      if (/[?&]reset=/.test(location.search || "")) {
        console.warn("[云备份] 检测到清除数据后的启动，跳过恢复");
        _restoreDone = true;
        return;
      }
      fetch(
        SUPA_URL +
          "/rest/v1/" +
          TABLE +
          "?device_id=eq." +
          encodeURIComponent(DEVICE_ID) +
          "&select=payload,updated_at",
        {
          headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
        },
      )
        .then(function (r) {
          if (!r.ok) {
            _restoreDone = true;
            /* 读取就 403/401/404，说明后端不可用，没必要紧接着再 POST 一次全量备份 */
            if (r.status === 401 || r.status === 403 || r.status === 404) {
              _cloudBlockedUntil = Date.now() + CLOUD_BLOCK_MS;
              return;
            }
            backup();
            return;
          }
          return r.json();
        })
        .then(function (rows) {
          if (!rows) return;
          _restoreDone = true;
          restoreBlobs(); // zzzx：云端状态确认后，补回本地缺失的小说正文等大内容
          if (!rows.length || !rows[0].payload) {
            backup();
            return;
          }
          var cloud = null;
          try {
            cloud = JSON.parse(rows[0].payload);
          } catch (e) {
            return;
          }
          if (!cloud || typeof cloud !== "object") return;
          var cloudKeys = Object.keys(cloud);
          _cloudKeyCount = cloudKeys.length;
          var _cloudUpdatedAt = 0;
          try {
            _cloudUpdatedAt = Date.parse(rows[0].updated_at) || 0;
          } catch (eUp) {}
          var missing = [];
          /* 图像键进入延迟批，等本地对账完成后再判断是否缺失 */
          var pendingImgs = [];
          cloudKeys.forEach(function (k) {
            if (!(cloud[k] && cloud[k] !== "null" && cloud[k] !== "undefined")) return;
            var _isImg = !!(window.__akiniImgWts && window.__akiniImgWts.isImg(k));
            if (_isImg && !window.__akiniStorageRestored) {
              pendingImgs.push(k);
              return;
            }
            var local = null;
            try {
              local = localStorage.getItem(k);
            } catch (e) {}
            var mem = null;
            try {
              if (window.akiniStore && window.akiniStore.memoryGet) mem = window.akiniStore.memoryGet(k);
            } catch (e) {}
            var cur = typeof mem === "string" && mem !== "" ? mem : local;
            if (_isDeletedLocally(k, _cloudUpdatedAt)) return;
            /* TA 手机收藏：本地用户刚新增/删除过 → 云端旧备份绝不能回填
             （否则表现为「删掉的收藏重进又出现」） */
            if (k.indexOf("akini_ta_phone_") === 0) {
              var _favAt = 0;
              try {
                _favAt = parseFloat(localStorage.getItem("akini_ta_fav_at_" + k.slice(15)) || "0") || 0;
              } catch (eFav) {}
              if (_favAt && _favAt > _cloudUpdatedAt) return;
            }
            if (_isShellLocal(k, cur)) {
              missing.push(k);
              return;
            }
            /* 聊天记录：本地可能只是被截断的尾部，云端更完整则回填全量 */
            if (k.indexOf("akini_chat_history") === 0) {
              if (_msgCount(cloud[k]) > _msgCount(cur)) missing.push(k);
            }
          });
          /* 时间戳仲裁：本地(cookie/LS 侧车)记录的写入时间比云端新(3s 容差) →
           云端是旧值，拒绝回填该键（本地曾有更新的数据） */
          function _wtsOk(k) {
            try {
              var isImg = !!(window.__akiniImgWts && window.__akiniImgWts.isImg(k));
              var lw = (window.__akiniImgWts && window.__akiniImgWts.local(k)) || 0;
              var cw = 0;
              try {
                cw = +(cloud["akini_wts_" + k] || 0) || 0;
              } catch (e1) {}
              /* 图片键：本地有新记录且云端不更新 → 拒绝回填(保护用户新图) */
              if (isImg) {
                if (lw > 0 && !(cw > lw)) {
                  console.warn("[云备份] 拒绝用云端旧值覆盖本地更新的图片键: " + k);
                  return false;
                }
              } else {
                if (lw > 0 && cw > 0 && lw > cw + 3000) {
                  console.warn("[云备份] 本地有更新记录，拒绝旧值回填: " + k);
                  return false;
                }
              }
            } catch (e) {}
            return true;
          }
          function _fill(k) {
            var val = cloud[k];
            var _isImg =
              !!(window.__akiniImgWts && window.__akiniImgWts.isImg(k)) ||
              k.indexOf("akini_media_") === 0 ||
              k.indexOf("akini_s1_") === 0 ||
              k.indexOf("akini_s2_") === 0 ||
              k.indexOf("avatar") >= 0 ||
              k.indexOf("_bg") >= 0;
            if (_isImg) {
              try {
                var _mem = null;
                try {
                  if (window.akiniStore && window.akiniStore.memoryGet) _mem = window.akiniStore.memoryGet(k);
                } catch (e0) {}
                var _hasLocal = _mem != null && _mem !== "" && _mem !== "null" && _mem !== "undefined";
                var _lw = 0;
                try {
                  if (window.__akiniImgWts && window.__akiniImgWts.local) _lw = window.__akiniImgWts.local(k) || 0;
                } catch (e1) {}
                var _cw = 0;
                try {
                  _cw = +(cloud["akini_wts_" + k] || 0) || 0;
                } catch (e2) {}
                var _cloudNewer = _cw > 0 && _cw > _lw;
                if (_hasLocal && !_cloudNewer) {
                  console.warn("[云备份] 拒绝用云端值覆盖本地更新的图片键: " + k + " (lw=" + _lw + ",cw=" + _cw + ")");
                  return;
                }
              } catch (e3) {
                /* 仲裁失败时保守不写图片，宁可漏填也不覆盖 */ return;
              }
            } else {
              /* 非图片键写入 localStorage，限制 40KB 防止 QuotaExceeded */
              try {
                if (typeof val === "string" && val.length > 40 * 1024) {
                  console.warn(
                    "[云备份] 跳过向 localStorage 写入过大数据: " + k + " (" + Math.round(val.length / 1024) + "KB)",
                  );
                } else {
                  localStorage.setItem(k, val);
                }
              } catch (e) {}
            }
            try {
              if (window.akiniStore && window.akiniStore.memorySet) window.akiniStore.memorySet(k, val);
            } catch (e) {}
            try {
              if (window._idbStore && window._idbStore.set) {
                window._idbStore.set(k, val);
              }
            } catch (e) {}
          }
          missing = missing.filter(_wtsOk);
          if (missing.length) {
            // 回填缺失 key：localStorage + 内存 + IDB 三层同时写入
            missing.forEach(_fill);
            console.warn("[云备份] 已从云端恢复 " + missing.length + " 项缺失数据");
            // 恢复完成后立即刷新界面（联系人/聊天/头像/预览），让恢复的数据即刻生效
            try {
              if (window.__akiniOnCriticalRestored) window.__akiniOnCriticalRestored();
            } catch (e) {}
          }
          // 图像键延迟批：本地对账完成后再判断（最多等 30s），含两条通道——
          // ① 仍缺失且云端不旧于本地记录 → 回填；② 云端时间戳明显更新 → 即使本地非空也覆盖
          //    （破解"IDB 旧值先被 restoreAll 巩固进内存，云端新值永远进不来"的死锁）
          if (pendingImgs.length) {
            var _tries = 0;
            (function _waitStorage() {
              if (!window.__akiniStorageRestored && _tries++ < 100) {
                setTimeout(_waitStorage, 300);
                return;
              }
              var late = [],
                newer = [];
              pendingImgs.forEach(function (k) {
                var local = null;
                try {
                  local = localStorage.getItem(k);
                } catch (e) {}
                var mem = null;
                try {
                  if (window.akiniStore && window.akiniStore.memoryGet) mem = window.akiniStore.memoryGet(k);
                } catch (e) {}
                var hasLocal = mem != null && mem !== "" && mem !== "null" && mem !== "undefined";
                var empty = !hasLocal;
                var lw = (window.__akiniImgWts && window.__akiniImgWts.local(k)) || 0;
                var cw = 0;
                try {
                  cw = +(cloud["akini_wts_" + k] || 0) || 0;
                } catch (e1) {}
                /* 仅在云端时间戳确实更新(cw>lw)时才覆盖本地，杜绝"巩固旧值"再被旧值覆盖 */
                if (cw > 0 && cw > lw) {
                  newer.push(k);
                  return;
                }
                if (empty && _wtsOk(k)) late.push(k);
              });
              var did = late.length + newer.length;
              if (did > 0) {
                late.forEach(_fill);
                newer.forEach(_fill);
                console.warn(
                  "[云备份] 图像键延迟批恢复 " +
                    did +
                    " 项" +
                    (newer.length ? "（含 " + newer.length + " 项云端较新覆盖）" : ""),
                );
                try {
                  if (window.__akiniOnCriticalRestored) window.__akiniOnCriticalRestored();
                } catch (e) {}
              }
            })();
          }
          // 缺失较多说明本地被清理过：回填后不自动刷新。
          // 去掉 location.reload()。iOS/PWA 上它会造成"恢复→刷新→再恢复"的
          // 白屏/闪屏循环，而回填的数据已经在内存里，下次启动自然会用上。
          if (missing.length >= 3) {
            console.warn("[云备份] 本地缺失 " + missing.length + " 项，已回填到内存（不再自动刷新）");
          }
          try {
            window.dispatchEvent(new Event("akini-cloud-restored"));
          } catch (eEv) {}
        })
        .catch(function () {
          // 网络失败：不标记完成（防止空数据覆盖云端），10 秒后自动重试
          setTimeout(restore, 10000);
        });
    } catch (e) {}
  }

  // ---- 钩子 ----
  // 页面隐藏时不执行云备份，回前台后补跑
  var _pendingHideBackup = false;
  window.__akiniOnHidden(function () { 
      _pendingHideBackup = true; // 仅做标记，回前台补跑
     }), window.__akiniOnVisible(function () { if (_pendingHideBackup) {
      _pendingHideBackup = false;
      setTimeout(function () {
        backup(false);
      }, 2000); // 回前台 2s 后补跑，避开 UI 恢复高峰
    } });
  // 对齐 原生：取消「每 150 秒全量 collectAll + stringify 上传」和 30 秒启动备份。
  // 这两件事是安卓上最持续的主线程卡顿源；本地 IndexedDB 已是权威，云端只在切后台时补一份。
  restore();

  // ---- 清除云端备份：清除数据时调用，保证云端同样归0 ----
  function wipeCloud() {
    try {
      // zzzx：同步清空大体积内容表
      try {
        fetch(SUPA_URL + "/rest/v1/" + BLOB_TABLE + "?device_id=eq." + encodeURIComponent(DEVICE_ID), {
          method: "DELETE",
          headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
          keepalive: true,
        }).catch(function () {});
      } catch (e0) {}
      return fetch(SUPA_URL + "/rest/v1/" + TABLE + "?device_id=eq." + encodeURIComponent(DEVICE_ID), {
        method: "DELETE",
        headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
        keepalive: true,
      })
        .then(function (r) {
          if (r.ok) {
            _lastBackupSig = "";
            _cloudKeyCount = 0;
          }
          return r.ok;
        })
        .catch(function () {
          return false;
        });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  /* 强制云端恢复：用云端数据覆盖本地全部 akini_ 键（数据被默认值覆盖时的救命稻草）。
     仅在用户主动调用时执行，绝不自动触发。恢复完成后刷新页面生效。 */
  function forceRestore(done) {
    try {
      fetch(
        SUPA_URL +
          "/rest/v1/" +
          TABLE +
          "?device_id=eq." +
          encodeURIComponent(DEVICE_ID) +
          "&select=payload,updated_at",
        {
          headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
        },
      )
        .then(function (r) {
          if (!r.ok) {
            if (done) done(false, "HTTP " + r.status);
            return;
          }
          return r.json();
        })
        .then(function (rows) {
          if (!rows || !rows.length || !rows[0].payload) {
            if (done) done(false, "云端无数据");
            return;
          }
          var cloud = null;
          try {
            cloud = JSON.parse(rows[0].payload);
          } catch (e) {
            if (done) done(false, "解析失败");
            return;
          }
          if (!cloud || typeof cloud !== "object") {
            if (done) done(false, "数据格式错误");
            return;
          }
          var keys = Object.keys(cloud).filter(function (k) {
            return k && cloud[k] && cloud[k] !== "null" && cloud[k] !== "undefined";
          });
          var ok = 0;
          keys.forEach(function (k) {
            try {
              var val = cloud[k];
              if (window.akiniStore && window.akiniStore.memorySet) window.akiniStore.memorySet(k, val);
              if (window._idbStore && window._idbStore.set) window._idbStore.set(k, val);
              if (typeof val === "string" && val.length < 40 * 1024) {
                try {
                  localStorage.setItem(k, val);
                } catch (e) {}
              }
              ok++;
            } catch (e) {}
          });
          console.warn("[云备份] 强制恢复完成，共覆盖 " + ok + " 项数据，请刷新页面");
          if (done) done(true, ok);
        })
        .catch(function () {
          if (done) done(false, "网络错误");
        });
    } catch (e) {
      if (done) done(false, String(e));
    }
  }

  window.__akiniCloudBackup = {
    backup: backup,
    restore: restore,
    forceRestore: forceRestore,
    wipeCloud: wipeCloud,
    deviceId: DEVICE_ID,
  };
  console.log("[云备份] 已启用，设备 " + DEVICE_ID);
})();
