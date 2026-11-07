/* ==================== 字卡库表情包模块 + 评论输入栏表情包按钮 ==================== */
(function () {
  "use strict";
  if (window.__akiniStickerModuleReady) return;
  window.__akiniStickerModuleReady = true;

  function _stkKey(cid) {
    return "akini_stickers_" + cid;
  }
  /* 读取顺序：内存镜像 → localStorage。大表情包库会被存储层分流到内存+IndexedDB，
     只读 localStorage 会读到空数组，表现为"添加成功但列表不显示" */
  function _rawRead(k) {
    try {
      if (window.akiniStore && window.akiniStore.memoryGet) {
        var m = window.akiniStore.memoryGet(k);
        if (m != null && m !== "") return m;
      }
    } catch (e) {}
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function _makePanel(id) {
    var p = document.getElementById(id);
    if (p) return p;
    var base = document.getElementById("wbContent");
    if (!base || !base.parentNode) return null;
    p = document.createElement("div");
    p.id = id;
    p.className = base.className || "wb-content";
    p.style.display = "none";
    base.parentNode.insertBefore(p, base.nextSibling);
    return p;
  }
  function _wbPanel() {
    return _makePanel("wbStkPanel");
  }
  function _wbSrvPanel() {
    return _makePanel("wbSrvPanel");
  }
  function _wbPanelShow(tab) {
    var stk = tab === "sticker";
    var srv = tab === "survey";
    var p = _wbPanel();
    var s = _wbSrvPanel();
    var base = document.getElementById("wbContent");
    if (p) p.style.display = stk ? "" : "none";
    if (s) s.style.display = srv ? "" : "none";
    if (base) base.style.display = stk || srv ? "none" : "";
    /* 主字卡模块切 tab 时会重绘 #wbGroupFilter/#addWordBtn，用 overlay 级类强制隐藏 */
    var ov = document.getElementById("wordbankOverlay");
    if (ov) ov.classList.toggle("wb-panel-mode", stk || srv);
  }
  var _stkRev = 0;
  /* 数据模型升级：每条为 {s:图片dataURL, g:分组id, b:是否屏蔽}，兼容旧版纯字符串数组 */
  function _stkOne(it) {
    if (typeof it === "string") return it.trim() ? { s: it, g: "", b: 0 } : null;
    if (it && typeof it === "object" && it.s) return { s: String(it.s), g: it.g ? String(it.g) : "", b: it.b ? 1 : 0 };
    return null;
  }
  function _stkRead(cid) {
    var key = _stkKey(cid);
    try {
      var c = window.__csCache && window.__csCache[key];
      if (Array.isArray(c) && c.length) return c.map(_stkOne).filter(Boolean);
    } catch (e0) {}
    try {
      var a = JSON.parse(_rawRead(key) || "[]");
      if (Array.isArray(a)) return a.map(_stkOne).filter(Boolean);
    } catch (e) {}
    return [];
  }
  /* 表情包库是大图片键，启动时可能只驻留在 IndexedDB：把 IDB 里的数据回填到
     __csCache（聊天表情包面板的同步读取源）与内存镜像，刷新后列表和发送都不会空。 */
  function _hydrateStickers() {
    if (window.__stkHydratedDone) return;
    var IDB = window._idbStore;
    if (!IDB || typeof IDB.keys !== "function") {
      /* 没有 IDB 时可同步读到的就是全部真实数据：水合视为已完成 */
      window.__stkHydratedDone = true;
      _stkFixLegacyRole();
      return;
    }
    var _pending = 0;
    var _finish = function () {
      if (_pending > 0 || window.__stkHydratedDone) return;
      window.__stkHydratedDone = true;
      /* 水合结束才做一次性角色归位：此时两端是否为空是可信的，
         不会把用户后来导入（显式指定 o="me"）的表情包误搬走 */
      _stkFixLegacyRole();
      try {
        if (window.__wbTab === "sticker") renderStickerTab();
      } catch (eR) {}
    };
    try {
      IDB.keys(function (keys) {
        (keys || []).forEach(function (k) {
          k = String(k);
          if (k.indexOf("akini_stickers_") !== 0 || k.indexOf("_backup") >= 0) return;
          try {
            if (window.__csCache && window.__csCache[k] && window.__csCache[k].length) return;
          } catch (e) {}
          var mem = null;
          try {
            mem = window.akiniStore && window.akiniStore.memoryGet ? window.akiniStore.memoryGet(k) : null;
          } catch (e) {}
          if (mem) {
            try {
              var ma = JSON.parse(mem);
              if (Array.isArray(ma) && ma.length) {
                window.__csCache = window.__csCache || {};
                window.__csCache[k] = ma;
                return;
              }
            } catch (e) {}
          }
          /* localStorage 里的值比 IDB 新时以 LS 为准 */
          try {
            var raw = localStorage.getItem(k);
            if (raw && raw.length > 2) {
              var la = JSON.parse(raw);
              if (Array.isArray(la) && la.length) {
                window.__csCache = window.__csCache || {};
                window.__csCache[k] = la;
                return;
              }
            }
          } catch (eLS) {}
          try {
            _pending++;
            IDB.get(k, function (v) {
              _pending--;
              try {
                if (!v) return;
                var arr = [];
                try {
                  arr = JSON.parse(v);
                } catch (e) {
                  return;
                }
                if (!Array.isArray(arr) || !arr.length) return;
                window.__csCache = window.__csCache || {};
                window.__csCache[k] = arr;
                try {
                  if (window.akiniStore && window.akiniStore.memorySet) window.akiniStore.memorySet(k, v);
                } catch (e) {}
                if (k === _stkKey(_getCid()) && window.__wbTab === "sticker") renderStickerTab();
              } finally {
                _finish();
              }
            });
          } catch (eG) {
            _pending--;
          }
        });
        _finish();
      });
    } catch (e) {}
  }
  function _stkWrite(cid, arr) {
    _stkRev++;
    /* 同步刷新 getContactStickersSync 的 __csCache，保证添加/删除后聊天/观影/陪伴立即读到最新 */
    try {
      window.__csCache = window.__csCache || {};
      window.__csCache["akini_stickers_" + cid] = arr;
    } catch (e0) {}
    if (window.akiniStore && window.akiniStore.setJson) {
      try {
        window.akiniStore.setJson(_stkKey(cid), arr);
        return;
      } catch (e) {}
    }
    try {
      localStorage.setItem(_stkKey(cid), JSON.stringify(arr));
    } catch (e) {
      if (window.__akiniCenterModal) window.__akiniCenterModal("存储失败", "图片过大，请换一张小图");
    }
  }
  /* ---- 表情包独立分组（与主字卡/emoji/拍一拍平级的独立模块，分组互不影响） ---- */
  /* 分组按联系人完全独立——每个联系人（含"我"）各自一套分组，存 akini_stk_groups_<cid>；
     旧的全局 akini_stk_groups 仅在首次访问时迁移拷贝，之后各联系人独立演化 */
  function _stkGKey(cid) {
    return "akini_stk_groups_" + (cid || _getCid());
  }
  function _stkGRead(cid) {
    cid = cid || _getCid();
    try {
      var raw = null;
      try {
        raw = _rawRead(_stkGKey(cid));
      } catch (e0) {}
      if (raw != null) {
        var g = JSON.parse(raw);
        if (Array.isArray(g))
          return g.filter(function (x) {
            return x && x.name;
          });
      }
      var legacy = JSON.parse(localStorage.getItem("akini_stk_groups") || "[]");
      if (Array.isArray(legacy) && legacy.length) {
        var arr = legacy.filter(function (x) {
          return x && x.name;
        });
        try {
          localStorage.setItem(_stkGKey(cid), JSON.stringify(arr));
        } catch (e2) {}
        return arr;
      }
    } catch (e) {}
    return [];
  }
  function _stkGWrite(arr, cid) {
    _stkRev++;
    try {
      localStorage.setItem(_stkGKey(cid || _getCid()), JSON.stringify(arr));
    } catch (e) {}
  }
  function _stkGName(gid) {
    var g = _stkGRead();
    for (var i = 0; i < g.length; i++) if (String(g[i].id) === String(gid)) return g[i].name;
    return "";
  }
  /* 读取指定联系人分组（导出用，不切换当前 cid）；首次访问触发旧全局分组迁移拷贝 */
  window.__akiniStkGroupsOf = function (cid) {
    try {
      var raw = _rawRead("akini_stk_groups_" + cid);
      if (raw == null) {
        raw = localStorage.getItem("akini_stk_groups") || "[]";
        var legacy = JSON.parse(raw || "[]");
        var arr = Array.isArray(legacy)
          ? legacy.filter(function (x) {
              return x && x.name;
            })
          : [];
        if (arr.length) {
          try {
            localStorage.setItem("akini_stk_groups_" + cid, JSON.stringify(arr));
          } catch (e2) {}
        }
        return arr;
      }
      var g = JSON.parse(raw || "[]");
      return Array.isArray(g)
        ? g.filter(function (x) {
            return x && x.name;
          })
        : [];
    } catch (e) {
      return [];
    }
  };
  /* 写入指定联系人分组（导入恢复用） */
  function _stkAllCids() {
    var ids = ["me"];
    try {
      var cs = window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() : [];
      cs.forEach(function (c) {
        if (c && c.id != null && ids.indexOf(String(c.id)) < 0) ids.push(String(c.id));
      });
    } catch (e) {}
    return ids;
  }
  function _esc(s) {
    return String(s || "").replace(/</g, "&lt;");
  }
  function _avHtml(av, size) {
    if (av && /^(data:|https?:|blob:|\/)/.test(av))
      return '<img src="' + av + '" decoding="sync" style="width:100%;height:100%;object-fit:cover;" alt=""/>';
    /* 默认头像（emoji/空）统一走 nt()：与聊天页一致人形线条 SVG 兜底 */
    return window.nt(av || "", size || 40);
    return '<span style="font-size:' + Math.round((size || 40) * 0.45) + 'px;">' + (av || "") + "</span>";
  }
  function _myAvatar() {
    try {
      {
        var a = window.getMyAvatar();
        if (a) return a;
      }
    } catch (e) {}
    return localStorage.getItem("akini_my_avatar") || (window.__akiniAvatarCache && window.__akiniAvatarCache.my) || "";
  }

  var _curCid = null;
  var _cidPickedInSession = false; /* 本次会话内是否手动点过头像（只有手动点"我"才固定在"我"名下） */
  function _defaultCid() {
    try {
      var cs = window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() || [] : [];
      var active =
        window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : null;
      var pick = null,
        i;
      if (active) {
        for (i = 0; i < cs.length; i++)
          if (cs[i] && String(cs[i].id) === String(active)) {
            pick = cs[i];
            break;
          }
      }
      if (!pick && cs.length) pick = cs[0];
      if (pick && pick.id != null) return String(pick.id);
    } catch (e) {}
    return "me";
  }
  /* 每次读取都以持久化的当前联系人键为准，避免内存里的旧值把切换卡死。
     旧版把默认角色固定成「我」并持久化了 'me'，这里用 akini_wb_sticker_cid_manual 区分
     「用户真的点过 '我'」和「旧版自动写进去的 'me'」：只有前者才信任 'me'。 */
  function _cidValid(cid) {
    if (!cid || cid === "me") return true;
    try {
      var cs = window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() || [] : [];
      for (var i = 0; i < cs.length; i++) if (cs[i] && String(cs[i].id) === String(cid)) return true;
    } catch (e) {}
    return false;
  }
  function _getCid() {
    try {
      var v = localStorage.getItem("akini_wb_sticker_cid");
      var manual = localStorage.getItem("akini_wb_sticker_cid_manual") === "1";
      if (v && (manual || v !== "me")) {
        if (_cidValid(v)) {
          _curCid = v;
          return v;
        }
        /* 指向已被清理的多人分身：清掉设置，回落到默认联系人 */
        localStorage.removeItem("akini_wb_sticker_cid");
        localStorage.removeItem("akini_wb_sticker_cid_manual");
      }
    } catch (e) {}
    if (_curCid && (_cidPickedInSession || _curCid !== "me") && _cidValid(_curCid)) return _curCid;
    _curCid = null;
    return _defaultCid();
  }
  function _setCid(cid) {
    _curCid = cid;
    _cidPickedInSession = true;
    try {
      localStorage.setItem("akini_wb_sticker_cid", cid);
      localStorage.setItem("akini_wb_sticker_cid_manual", "1");
    } catch (e) {}
  }

  /* ---- 字卡库表情包面板：两行工具下面横排小头像（可滑动切换）+ 分组筛选条 + 每行四个网格 ---- */
  /* 表情包模块状态：分组筛选/搜索词/多选/屏蔽 */
  var _stkFilterGid = ""; /* ''=全部 '__ungrouped__'=未分组 其余=分组id */
  var _stkQuery = "";
  var _stkSelMode = false;
  var _stkBlockMode = false;
  var _stkSel = {}; /* idx -> true */

  /* 表情包 tab 时隐藏字卡专用分组筛选条/底部文字新增按钮（表情包分组筛选在内容区内自绘），工具栏恒显示 */
  function _applyStickerChrome(on) {
    var tb = document.querySelector("#wordbankOverlay .wb-toolbar");
    if (tb) tb.style.display = ""; /* 用户明确要求恢复表情包模块工具栏显示，绝不隐藏 */
    var gf = document.getElementById("wbGroupFilter");
    if (gf && on) gf.style.display = "none";
    var addBtn = document.getElementById("addWordBtn");
    if (addBtn) addBtn.style.display = on ? "none" : "";
    if (on) _syncModeBars();
  }

  function _syncModeBars() {
    var on = window.__wbTab === "sticker";
    var sa = document.getElementById("wbSelectActions");
    var ba = document.getElementById("wbBlockActions");
    var cnt = Object.keys(_stkSel).length;
    if (sa) sa.style.display = on && _stkSelMode ? "flex" : "none";
    if (ba) ba.style.display = on && _stkBlockMode ? "flex" : "none";
    var db = document.getElementById("wbSelectDeleteBtn");
    if (db) db.textContent = "删除(" + cnt + ")";
    var bd = document.getElementById("wbBlockDoBtn");
    if (bd) bd.textContent = "屏蔽(" + cnt + ")";
    var bu = document.getElementById("wbBlockUndoBtn");
    if (bu) bu.textContent = "取消屏蔽(" + cnt + ")";
    var sb = document.getElementById("selectBtn");
    if (sb) {
      sb.style.background = on && _stkSelMode ? "#1a1a1a" : "";
      sb.style.color = on && _stkSelMode ? "#fff" : "";
    }
    var bb = document.getElementById("wbBlockBtn");
    if (bb) {
      bb.style.background = on && _stkBlockMode ? "#1a1a1a" : "";
      bb.style.color = on && _stkBlockMode ? "#fff" : "";
    }
  }

  function _stkExitModes() {
    _stkSelMode = false;
    _stkBlockMode = false;
    _stkSel = {};
    _syncModeBars();
  }

  function _stkFiltered(arr) {
    var out = [];
    arr.forEach(function (it, i) {
      if (_stkFilterGid === "__ungrouped__") {
        if (it.g) return;
      } else if (_stkFilterGid && String(it.g) !== String(_stkFilterGid)) return;
      if (_stkQuery) {
        var gn = (it.g ? _stkGName(it.g) : "未分组").toLowerCase();
        if (gn.indexOf(_stkQuery.toLowerCase()) < 0) return;
      }
      out.push({ it: it, idx: i });
    });
    return out;
  }

  /* 字卡库【问卷】Tab 工具栏 */
  var _srvFilterGid = ""; /* ''=全部 '__ungrouped__'=未分组 其余=分组id */
  var _srvQuery = "";
  var _srvSelMode = false;
  var _srvBlockMode = false;
  var _srvSel = {}; /* sid -> true */
  var _srvRev = 0;
  function _srvActiveCid() {
    var cid = window.__currentWbSurveyCid || window.__wbSurveyContactId;
    if (!cid && window.akiniContacts && typeof window.akiniContacts.getContacts === "function") {
      var cs = window.akiniContacts.getContacts() || [];
      if (cs[0]) cid = cs[0].id;
    }
    return cid || "me";
  }
  function _srvRead() {
    try {
      var a = JSON.parse(localStorage.getItem("akini_surveys_" + _srvActiveCid()) || "[]");
      if (Array.isArray(a)) return a;
    } catch (e) {}
    return [];
  }
  function _srvWrite(arr) {
    _srvRev++;
    try {
      localStorage.setItem("akini_surveys_" + _srvActiveCid(), JSON.stringify(arr));
    } catch (e) {}
  }
  function _srvGRead() {
    var cid = _srvActiveCid();
    var perKey = "akini_survey_groups_" + cid;
    try {
      var v = localStorage.getItem(perKey);
      if (v) {
        var a = JSON.parse(v);
        if (Array.isArray(a)) return a;
      }
    } catch (e) {}
    /* 兼容旧全局键：首次读取时把全局分组迁移到当前联系人名下，之后按联系人独立 */
    try {
      var old = localStorage.getItem("akini_survey_groups");
      if (old) {
        var arr = JSON.parse(old);
        if (Array.isArray(arr) && arr.length) {
          try {
            localStorage.setItem(perKey, old);
          } catch (eM) {}
          return arr;
        }
      }
    } catch (e) {}
    return [];
  }
  function _srvGWrite(arr) {
    _srvRev++;
    try {
      localStorage.setItem("akini_survey_groups_" + _srvActiveCid(), JSON.stringify(arr));
    } catch (e) {}
  }
  function _srvGName(gid) {
    var gs = _srvGRead();
    for (var i = 0; i < gs.length; i++) if (String(gs[i].id) === String(gid)) return gs[i].name || "";
    return "";
  }
  function _srvSyncBars() {
    var on = window.__wbTab === "survey";
    var sa = document.getElementById("wbSelectActions");
    var ba = document.getElementById("wbBlockActions");
    var cnt = Object.keys(_srvSel).length;
    if (sa) sa.style.display = on && _srvSelMode ? "flex" : "none";
    if (ba) ba.style.display = on && _srvBlockMode ? "flex" : "none";
    var db = document.getElementById("wbSelectDeleteBtn");
    if (db) db.textContent = "删除(" + cnt + ")";
    var bd = document.getElementById("wbBlockDoBtn");
    if (bd) bd.textContent = "屏蔽(" + cnt + ")";
    var bu = document.getElementById("wbBlockUndoBtn");
    if (bu) bu.textContent = "取消屏蔽(" + cnt + ")";
    var sb = document.getElementById("selectBtn");
    if (sb) {
      var so = on && _srvSelMode;
      sb.style.background = so ? "#1a1a1a" : "";
      sb.style.color = so ? "#fff" : "";
    }
    var bb2 = document.getElementById("wbBlockBtn");
    if (bb2) {
      var bo = on && _srvBlockMode;
      bb2.style.background = bo ? "#1a1a1a" : "";
      bb2.style.color = bo ? "#fff" : "";
    }
  }
  function _srvExitModes() {
    _srvSelMode = false;
    _srvBlockMode = false;
    _srvSel = {};
    _srvSyncBars();
  }
  /* 多选/屏蔽只改已渲染卡片的边框与勾选角标，不重建列表，避免点工具时整屏闪烁 */
  function _srvPaintMode() {
    var box = document.getElementById("wbSrvPanel");
    if (!box) {
      _srvSyncBars();
      return;
    }
    var show = _srvSelMode || _srvBlockMode;
    Array.prototype.forEach.call(box.querySelectorAll(".wb-survey-card"), function (card) {
      var sid = card.getAttribute("data-sid");
      var on = !!_srvSel[sid];
      card.style.borderColor = on ? "#1a1a1a" : "#eee";
      var chk = card.querySelector(".srv-chk");
      if (!show) {
        if (chk) chk.parentNode.removeChild(chk);
        return;
      }
      if (!chk) {
        chk = document.createElement("span");
        chk.className = "srv-chk";
        chk.style.cssText =
          "position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:50%;color:#fff;font-size:13px;line-height:19px;text-align:center;z-index:2;";
        card.appendChild(chk);
      }
      chk.style.border = "1.5px solid " + (on ? "#1a1a1a" : "#ccc");
      chk.style.background = on ? "#1a1a1a" : "#fff";
      chk.innerHTML = on ? "&#10003;" : "";
    });
    _srvSyncBars();
  }
  /* 与 _stkTap 一致的元素级四通道绑定，tab 守卫改为 survey */
  /* 一处元素可能同时服务表情包与问卷两个 tab，各自带 tab 守卫；
     因此按元素登记多组处理器，点击时只执行守卫通过的那一组 */
  function _bindTap(el, fn, guard) {
    if (typeof el === "string") el = document.getElementById(el);
    if (!el || typeof fn !== "function") return;
    var handlers = el.__akiniTapHandlers || (el.__akiniTapHandlers = []);
    for (var i = 0; i < handlers.length; i++) {
      if (handlers[i].fn === fn) {
        handlers[i].guard = guard;
        return;
      }
    }
    handlers.push({ fn: fn, guard: guard });
    if (el.__akiniTapBound) return;
    el.__akiniTapBound = 1;
    el.style.cursor = "pointer";
    el.style.webkitTapHighlightColor = "transparent";
    el.style.touchAction = "manipulation";
    var sx = 0,
      sy = 0,
      moved = false,
      fired = false;
    function run(e) {
      var hs = el.__akiniTapHandlers || [];
      for (var j = 0; j < hs.length; j++) {
        var h = hs[j];
        if (h.guard && !h.guard()) continue;
        try {
          h.fn(e);
        } catch (err) {}
        return;
      }
    }
    el.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches && e.touches[0]) {
          sx = e.touches[0].clientX;
          sy = e.touches[0].clientY;
          moved = false;
          fired = false;
        }
      },
      { passive: true },
    );
    el.addEventListener(
      "touchmove",
      function (e) {
        if (
          e.touches &&
          e.touches[0] &&
          (Math.abs(e.touches[0].clientX - sx) > 10 || Math.abs(e.touches[0].clientY - sy) > 10)
        ) {
          moved = true;
        }
      },
      { passive: true },
    );
    el.addEventListener(
      "touchcancel",
      function () {
        moved = false;
        fired = false;
      },
      { passive: true },
    );
    /* 用 touchend 而非 click：移动端 click 有 300ms 延迟且可能被其他模块的
       touchend preventDefault 吞掉；touchend 立即触发，体验跟手 */
    el.addEventListener("touchend", function (e) {
      if (moved) {
        moved = false;
        return;
      }
      fired = true;
      run(e);
    });
    el.addEventListener("click", function (e) {
      if (fired) {
        fired = false;
        return;
      }
      if (moved) {
        moved = false;
        return;
      }
      run(e);
    });
  }
  window.__akiniBindTap = _bindTap;
  function _srvTap(el, fn) {
    _bindTap(el, fn, function () {
      return window.__wbTab === "survey";
    });
  }
  function _srvToggleSearch() {
    var bar = document.getElementById("wbSearchBar");
    if (!bar) return;
    var showing = bar.style.display !== "none" && bar.style.display !== "";
    var ip = document.getElementById("wbSearchInput");
    if (showing) {
      bar.style.display = "none";
      _srvQuery = "";
      if (ip) ip.value = "";
      renderSurveyWbTab();
    } else {
      bar.style.display = "block";
      window.__wbSyncSearchScope && window.__wbSyncSearchScope();
      if (ip) {
        ip.placeholder = "搜索问卷标题或问题...";
        try {
          ip.focus();
        } catch (e) {}
      }
    }
  }
  function _srvToggleSelMode() {
    _srvSelMode = !_srvSelMode;
    if (_srvSelMode) _srvBlockMode = false;
    _srvSel = {};
    _srvPaintMode();
  }
  function _srvToggleBlockMode() {
    _srvBlockMode = !_srvBlockMode;
    if (_srvBlockMode) _srvSelMode = false;
    _srvSel = {};
    _srvPaintMode();
  }
  function _srvSelAll() {
    var arr = _srvRead();
    arr.forEach(function (s) {
      if (s && !s.deleted) _srvSel[s.id] = true;
    });
    _srvPaintMode();
  }
  function _srvEmptyGuard() {
    if (Date.now() - (window.__srvJustDone || 0) < 1500) return true;
    alert("请先选择问卷");
    return false;
  }
  /* 星星多选删除：删除问卷统一走星星工具 */
  var _srvDelInProgress = false;
  function _srvSelDelete() {
    if (_srvDelInProgress) return;
    var sids = Object.keys(_srvSel);
    if (!sids.length) {
      _srvEmptyGuard();
      return;
    }
    _srvDelInProgress = true;
    window.__akiniCenterModal("确认", "确定删除选中的 " + sids.length + " 份问卷？", {
      confirm: true,
      okText: "删除",
      cancelText: "取消",
      onClose: function (ok) {
        setTimeout(function () {
          _srvDelInProgress = false;
        }, 1000);
        if (!ok) return;
        var arr = _srvRead();
        arr.forEach(function (s) {
          if (s && _srvSel[s.id]) s.deleted = true;
        });
        _srvWrite(arr);
        _srvSel = {};
        window.__srvJustDone = Date.now();
        renderSurveyWbTab();
      },
    });
  }
  function _srvPickGroupForSel(cb) {
    var groups = _srvGRead();
    if (!groups.length) {
      alert("请先通过工具栏「分组」创建问卷分组");
      return;
    }
    var ov = document.createElement("div");
    ov.id = "srvGroupPickOv";
    ov.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;z-index:8400;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;";
    var h =
      '<div style="background:#fff;border-radius:16px;padding:20px;width:85%;max-height:60%;overflow-y:auto;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;">' +
      '<div style="font-size:16px;font-weight:600;color:#333">选择分组</div>';
    groups.forEach(function (g) {
      h +=
        '<button type="button" data-gid="' +
        g.id +
        '" style="padding:10px 14px;background:#f5f5f5;border:none;border-radius:10px;font-size:14px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;">' +
        String(g.name).replace(/</g, "&lt;") +
        "</button>";
    });
    h +=
      '<button type="button" data-cancel="1" style="padding:10px;background:#eee;border:none;border-radius:10px;font-size:14px;cursor:pointer;">取消</button></div>';
    ov.innerHTML = h;
    ov.addEventListener("click", function (e) {
      if (!ov.contains(e.target)) return;
      if (e.target === ov) {
        ov.remove();
        return;
      }
      var b = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!b) return;
      ov.remove();
      if (b.getAttribute("data-cancel")) return;
      cb(b.getAttribute("data-gid") || "");
    });
    document.body.appendChild(ov);
  }
  function _srvSelGroup() {
    var sids = Object.keys(_srvSel);
    if (!sids.length) {
      _srvEmptyGuard();
      return;
    }
    _srvPickGroupForSel(function (gid) {
      var arr = _srvRead();
      arr.forEach(function (s) {
        if (s && _srvSel[s.id]) s.g = gid || "";
      });
      _srvWrite(arr);
      _srvSel = {};
      window.__srvJustDone = Date.now();
      renderSurveyWbTab();
    });
  }
  function _srvBlockDo(blocked) {
    var sids = Object.keys(_srvSel);
    if (!sids.length) {
      _srvEmptyGuard();
      return;
    }
    var arr = _srvRead();
    arr.forEach(function (s) {
      if (s && _srvSel[s.id]) s.b = blocked ? 1 : 0;
    });
    _srvWrite(arr);
    _srvSel = {};
    window.__srvJustDone = Date.now();
    renderSurveyWbTab();
  }
  function _srvDedup() {
    var arr = _srvRead();
    var seen = {};
    var removed = 0;
    for (var i = arr.length - 1; i >= 0; i--) {
      var s = arr[i];
      if (!s || s.deleted) continue;
      var sig =
        String(s.title || "").trim() +
        "||" +
        (s.questions || [])
          .map(function (q) {
            return String(q.text || "").trim();
          })
          .join("||");
      if (sig === "||") continue;
      if (seen[sig]) {
        s.deleted = true;
        removed++;
      } else seen[sig] = 1;
    }
    alert(removed > 0 ? "成功清除 " + removed + " 份重复问卷" : "没有重复问卷");
    if (removed > 0) {
      _srvSel = {};
      _srvWrite(arr);
      renderSurveyWbTab();
    }
  }
  /* 问卷分组管理弹窗 */
  function _srvRenderGroupModal() {
    var list = document.getElementById("srvGroupList");
    var empty = document.getElementById("srvGroupEmpty");
    if (!list) return;
    var groups = _srvGRead();
    var arr = _srvRead().filter(function (s) {
      return s && !s.deleted;
    });
    if (!groups.length) {
      list.innerHTML = "";
      list.style.display = "none";
      if (empty) empty.style.display = "block";
      return;
    }
    list.style.display = "flex";
    if (empty) empty.style.display = "none";
    var h = "";
    groups.forEach(function (g, gi) {
      var cnt = arr.filter(function (x) {
        return String(x.g) === String(g.id);
      }).length;
      h +=
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8f8f8;border-radius:10px;margin-bottom:8px;">' +
        '<div style="display:flex;align-items:center;gap:8px;min-width:0;"><span style="font-size:14px;color:#333;font-weight:500;">' +
        String(g.name).replace(/</g, "&lt;") +
        '</span><span style="font-size:12px;color:#aaa;">' +
        cnt +
        "份</span></div>" +
        '<div style="display:flex;align-items:center;gap:2px;margin:-10px -12px -10px 0;">' +
        '<button type="button" class="srv-group-edit" data-gi="' +
        gi +
        '" style="background:none;border:none;color:#666;cursor:pointer;padding:10px 8px;min-width:36px;min-height:40px;touch-action:manipulation;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>' +
        '<button type="button" class="srv-group-del" data-gi="' +
        gi +
        '" style="background:none;border:none;color:#ff6b6b;font-size:16px;cursor:pointer;padding:10px 12px;min-width:40px;min-height:40px;touch-action:manipulation;">&#10005;</button></div></div>';
    });
    list.innerHTML = h;
    list.querySelectorAll(".srv-group-edit").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var gi = parseInt(this.getAttribute("data-gi"), 10);
        var gs = _srvGRead();
        if (isNaN(gi) || gi < 0 || gi >= gs.length) return;
        window.__akiniPromptModal(
          "修改分组名称",
          "请输入新的分组名称",
          function (v) {
            if (!v || !v.trim()) return;
            var cur = _srvGRead();
            if (gi >= cur.length) return;
            cur[gi].name = v.trim();
            _srvGWrite(cur);
            _srvRenderGroupModal();
            renderSurveyWbTab();
          },
          { value: gs[gi].name },
        );
      });
    });
    list.querySelectorAll(".srv-group-del").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var gi = parseInt(this.getAttribute("data-gi"), 10);
        var gs = _srvGRead();
        if (isNaN(gi) || gi < 0 || gi >= gs.length) return;
        var gid = String(gs[gi].id);
        var gname = gs[gi].name;
        window.__akiniCenterModal("确认", "删除分组「" + gname + "」？组内问卷会变为未分组", {
          confirm: true,
          okText: "删除",
          cancelText: "取消",
          onClose: function (ok) {
            if (!ok) return;
            gs.splice(gi, 1);
            _srvGWrite(gs);
            var arr2 = _srvRead();
            var dirty = false;
            arr2.forEach(function (x) {
              if (x && String(x.g) === gid) {
                x.g = "";
                dirty = true;
              }
            });
            if (dirty) _srvWrite(arr2);
            if (String(_srvFilterGid) === gid) _srvFilterGid = "";
            _srvRenderGroupModal();
            renderSurveyWbTab();
          },
        });
      });
    });
  }
  function _srvOpenGroupModal() {
    var m = document.getElementById("srvGroupModal");
    if (!m) return;
    _srvRenderGroupModal();
    m.style.display = "flex";
  }
  function _srvBindGroupModal() {
    var m = document.getElementById("srvGroupModal");
    if (!m || m.__bound) return;
    m.__bound = 1;
    m.addEventListener("click", function (e) {
      if (e.target === m) m.style.display = "none";
    });
    _srvTap("srvGroupClose", function () {
      m.style.display = "none";
    });
    _srvTap("srvGroupCreateBtn", function () {
      window.__akiniPromptModal("新建分组", "请输入问卷分组名称", function (name) {
        if (!name || !name.trim()) return;
        var gs = _srvGRead();
        gs.push({ id: Date.now(), name: name.trim() });
        _srvGWrite(gs);
        _srvRenderGroupModal();
        renderSurveyWbTab();
      });
    });
  }
  function _bindSurveyToolbar() {
    if (window.__srvToolbarBound) return;
    window.__srvToolbarBound = 1;
    _srvTap("searchBtn", _srvToggleSearch);
    _srvTap("wbSearchClose", function () {
      var bar = document.getElementById("wbSearchBar");
      if (bar) bar.style.display = "none";
      _srvQuery = "";
      var ip = document.getElementById("wbSearchInput");
      if (ip) ip.value = "";
      if (window.__wbTab === "survey") renderSurveyWbTab();
    });
    _srvTap("groupBtn", _srvOpenGroupModal);
    _srvTap("dedupBtn", _srvDedup);
    _srvTap("wbBlockBtn", _srvToggleBlockMode);
    _srvTap("selectBtn", _srvToggleSelMode);
    _srvTap("wbSelectAllBtn", _srvSelAll);
    _srvTap("wbSelectDeleteBtn", _srvSelDelete);
    _srvTap("wbSelectGroupBtn", _srvSelGroup);
    _srvTap("wbSelectCancelBtn", function () {
      _srvSelMode = false;
      _srvSel = {};
      _srvPaintMode();
    });
    _srvTap("wbBlockDoBtn", function () {
      _srvBlockDo(true);
    });
    _srvTap("wbBlockUndoBtn", function () {
      _srvBlockDo(false);
    });
    _srvTap("wbBlockExitBtn", function () {
      _srvBlockMode = false;
      _srvSel = {};
      _srvPaintMode();
    });
    /* 搜索输入：window 捕获阶段拦截，阻断主模块 input 处理器重绘主字卡列表 */
    window.addEventListener(
      "input",
      function (e) {
        if (window.__wbTab !== "survey") return;
        var t = e.target;
        if (!t || t.id !== "wbSearchInput") return;
        _srvQuery = t.value.trim();
        renderSurveyWbTab();
      },
      true,
    );
    _srvBindGroupModal();
  }

  /* 字卡库【问卷】Tab 原生渲染，完全复刻表情包联系人横条逻辑（无我的，每个联系人独立问卷，右上角新增进创建问卷） */
  function renderSurveyWbTab() {
    var box = _wbSrvPanel();
    if (!box) return;
    var tb = document.querySelector("#wordbankOverlay .wb-toolbar");
    if (tb) tb.style.display = "";
    var gf = document.getElementById("wbGroupFilter");
    if (gf) gf.style.display = "none";
    var addBtn = document.getElementById("addWordBtn");
    if (addBtn) addBtn.style.display = "none";

    var contacts = [];
    try {
      if (window.akiniContacts && window.akiniContacts.getContacts) {
        contacts = window.akiniContacts.getContacts() || [];
      }
    } catch (e) {}
    if (!contacts.length) {
      try {
        var raw0 = localStorage.getItem("akini_contacts");
        if (raw0) contacts = JSON.parse(raw0) || [];
      } catch (e) {}
    }
    contacts = contacts.filter(function (c) {
      return c && c.id !== "me" && c.id !== "my";
    });

    /* 无联系人时使用默认联系人 */
    if (!contacts.length) {
      try {
        var dc =
          window.__akiniDefaultContact && typeof window.__akiniDefaultContact === "function"
            ? window.__akiniDefaultContact()
            : null;
        if (dc) contacts = [dc];
      } catch (e) {}
    }
    if (!contacts.length) {
      box.innerHTML =
        '<div style="text-align:center;color:#999;font-size:14px;padding:60px 20px;line-height:1.8;">暂无联系人</div>';
      _srvSyncBars();
      return;
    }

    var activeCid = "";
    try {
      var _defC =
        window.__akiniDefaultContact && typeof window.__akiniDefaultContact === "function"
          ? window.__akiniDefaultContact()
          : null;
      if (_defC && _defC.id) activeCid = _defC.id;
    } catch (e) {}
    if (
      !activeCid ||
      !contacts.some(function (c) {
        return String(c.id) === String(activeCid);
      })
    ) {
      var curChat =
        window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : "";
      if (
        curChat &&
        contacts.some(function (c) {
          return String(c.id) === String(curChat);
        })
      ) {
        activeCid = curChat;
      } else {
        activeCid = contacts[0].id;
      }
    }
    window.__currentWbSurveyCid = activeCid;
    window.__wbSurveyContactId = activeCid;

    var curContact =
      contacts.find(function (c) {
        return String(c.id) === String(activeCid);
      }) || contacts[0];
    var curName = (curContact && curContact.name) || "联系人";

    /* 内容签名：面板还是同一份内容时直接复用，切 tab 不重建头像与卡片，避免闪烁 */
    var _sigS =
      String(activeCid) +
      "\x1f" +
      _srvFilterGid +
      "\x1f" +
      _srvQuery +
      "\x1f" +
      _srvRev +
      "\x1f" +
      contacts.length +
      "\x1f" +
      curName;
    if (box.__srvSig === _sigS) {
      _srvPaintMode();
      return;
    }

    var h = "";

    var surveys = _srvRead();
    var _sentSurvey = {};
    try {
      var _h = "";
      try {
        /* 直接在落盘的原始 JSON 上扫：不 join 整段历史，正则兼容 JSON 里的转义引号 */
        if (window.__akiniChatLog) _h = window.__akiniChatLog.raw(activeCid) || "";
        if (!_h) _h = (window.akiniContacts.getSession(activeCid) || {}).messagesHTML || "";
        if (!_h && window.__akiniChatLog) _h = window.__akiniChatLog.html(activeCid);
      } catch (e0) {}
      var _re = /data-survey-id=\\?"([^"\\]+)\\?"[^>]*data-survey-reply=\\?"0\\?"/g,
        _m;
      while ((_m = _re.exec(_h))) _sentSurvey[_m[1]] = 1;
    } catch (e) {}
    var validList = surveys.filter(function (s) {
      return s && !s.deleted && String(s.id).indexOf("srv_recv_") !== 0 && !s.sentToChat && !_sentSurvey[String(s.id)];
    });

    /* 问卷分组筛选条（与表情包一致 chips） */
    var groups = _srvGRead();
    if (groups.length) {
      var chip = function (gid, label, count) {
        var on2 = String(_srvFilterGid) === String(gid);
        return (
          '<button type="button" class="wb-srv-chip wb-gf-btn' +
          (on2 ? " active" : "") +
          '" data-gid="' +
          gid +
          '" style="flex-shrink:0;-webkit-tap-highlight-color:transparent;">' +
          label +
          (count != null ? "(" + count + ")" : "") +
          "</button>"
        );
      };
      h +=
        '<div style="display:flex;gap:6px;overflow-x:auto;margin:8px 16px 0;padding:5px;background:transparent;border-radius:14px;-webkit-overflow-scrolling:touch;box-sizing:border-box;flex-shrink:0;min-height:40px;">';
      h += chip("", "全部", null);
      h += chip(
        "__ungrouped__",
        "未分组",
        validList.filter(function (x) {
          return !x.g;
        }).length,
      );
      groups.forEach(function (g) {
        h += chip(
          g.id,
          String(g.name || "分组").replace(/</g, "&lt;"),
          validList.filter(function (x) {
            return String(x.g) === String(g.id);
          }).length,
        );
      });
      h += "</div>";
    }

    var shown = validList.filter(function (s) {
      if (_srvFilterGid === "__ungrouped__") {
        if (s.g) return false;
      } else if (_srvFilterGid && String(s.g) !== String(_srvFilterGid)) return false;
      if (_srvQuery) {
        var q = _srvQuery.toLowerCase();
        var hit =
          String(s.title || "")
            .toLowerCase()
            .indexOf(q) >= 0;
        if (!hit)
          hit = (s.questions || []).some(function (qq) {
            return (
              String(qq.text || "")
                .toLowerCase()
                .indexOf(q) >= 0
            );
          });
        if (!hit)
          hit =
            String(s.g ? _srvGName(s.g) : "")
              .toLowerCase()
              .indexOf(q) >= 0;
        if (!hit) return false;
      }
      return true;
    });

    h +=
      '<div style="padding:14px 16px;background:#fff;min-height:220px;width:100%;box-sizing:border-box;flex:1 1 auto;overflow-y:auto;">';
    if (!shown.length) {
      h +=
        '<div style="text-align:center;color:#999;padding:48px 16px;font-size:14px;line-height:1.8;background:#fff;border-radius:12px;border:1px dashed #e0e0e0;">' +
        (validList.length
          ? "没有匹配的问卷"
          : "「" +
            curName.replace(/</g, "&lt;") +
            '」还没有问卷<br/><span style="font-size:12px;color:#aaa;">点击右上角「+ 新增」为 TA 创建问卷</span>') +
        "</div>";
    } else {
      shown.forEach(function (s) {
        var title = (s.title || "未命名问卷").replace(/</g, "&lt;");
        var qCount = (s.questions && s.questions.length) || 0;
        var qPreviews = (s.questions || [])
          .slice(0, 2)
          .map(function (q, qi) {
            return (
              '<div style="font-size:12px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
              (qi + 1) +
              ". " +
              String(q.text || "").replace(/</g, "&lt;") +
              "</div>"
            );
          })
          .join("");
        var selOn = !!_srvSel[s.id];
        var inMode = _srvSelMode || _srvBlockMode;
        var gTag = s.g
          ? '<span style="display:inline-block;font-size:11px;color:#1a1a1a;background:#f0f0f0;border-radius:8px;padding:2px 8px;margin-top:6px;">' +
            String(_srvGName(s.g) || "分组").replace(/</g, "&lt;") +
            "</span>"
          : "";
        h +=
          '<div class="wb-survey-card" data-sid="' +
          s.id +
          '" style="position:relative;background:#fff;border-radius:12px;padding:14px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.04);border:1.5px solid ' +
          (selOn ? "#1a1a1a" : "#eee") +
          ";" +
          (s.b ? "opacity:.55;" : "") +
          '">' +
          (inMode
            ? '<span class="srv-chk" style="position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:50%;border:1.5px solid ' +
              (selOn ? "#1a1a1a" : "#ccc") +
              ";background:" +
              (selOn ? "#1a1a1a" : "#fff") +
              ';color:#fff;font-size:13px;line-height:19px;text-align:center;z-index:2;">' +
              (selOn ? "&#10003;" : "") +
              "</span>"
            : "") +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
          '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:15px;font-weight:600;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
          (inMode ? "padding-right:28px;" : "") +
          '">' +
          title +
          "</div>" +
          '<div style="font-size:12px;color:#888;margin:3px 0 6px;">共 ' +
          qCount +
          " 个问题" +
          (s.b ? " · 已屏蔽" : "") +
          "</div>" +
          qPreviews +
          gTag +
          "</div></div>" +
          '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #f5f5f5;">' +
          '<button type="button" class="wb-survey-edit-btn" data-sid="' +
          s.id +
          '" style="padding:6px 14px;background:#1a1a1a;color:#fff;border:none;border-radius:14px;font-size:12px;font-weight:500;cursor:pointer;">编辑</button>' +
          "</div></div>";
      });
    }
    h += "</div>";

    box.innerHTML = h;
    box.__srvSig = _sigS;
    _srvSyncBars();

    box.querySelectorAll(".wb-srv-chip").forEach(function (el) {
      _srvTap(el, function (e) {
        _srvFilterGid = el.getAttribute("data-gid") || "";
        _srvSel = {};
        renderSurveyWbTab();
      });
    });

    /* 多选/屏蔽模式下点击卡片=切换选中（星星删除/屏蔽均走此选择） */
    box.querySelectorAll(".wb-survey-card").forEach(function (card) {
      _srvTap(card, function (e) {
        if (!_srvSelMode && !_srvBlockMode) return;
        if (
          e.target &&
          e.target.closest &&
          (e.target.closest(".wb-survey-edit-btn") || e.target.closest(".wb-survey-del-btn"))
        )
          return;
        var sid = card.getAttribute("data-sid");
        if (_srvSel[sid]) delete _srvSel[sid];
        else _srvSel[sid] = true;
        var on2 = !!_srvSel[sid];
        card.style.borderColor = on2 ? "#1a1a1a" : "#eee";
        var chk = card.querySelector(".srv-chk");
        if (chk) {
          chk.style.borderColor = on2 ? "#1a1a1a" : "#ccc";
          chk.style.background = on2 ? "#1a1a1a" : "#fff";
          chk.innerHTML = on2 ? "&#10003;" : "";
        }
        _srvSyncBars();
      });
    });

    /* 保证弹窗层级最高，能浮在字卡库之上 */
    function _ensureSurveyModalZIndex() {
      ["surveyCreateModal", "surveyListModal", "surveyDetailModal", "surveyCreatedListModal"].forEach(function (id) {
        var m = document.getElementById(id);
        if (m) {
          m.style.zIndex = "8600";
          if (m.parentNode !== document.body) document.body.appendChild(m);
        }
      });
    }

    box.querySelectorAll(".wb-survey-edit-btn").forEach(function (btn) {
      _srvTap(btn, function (e) {
        if (_srvSelMode || _srvBlockMode) return;
        var sid = btn.getAttribute("data-sid");
        var sIdx = surveys.findIndex(function (it) {
          return String(it.id) === String(sid);
        });
        if (sIdx < 0) return;
        window.__surveyForContactConfig = activeCid;
        window.__currentWbSurveyCid = activeCid;
        window.__wbSurveyContactId = activeCid;
        try {
          localStorage.setItem("akini_active_chat_id", activeCid);
        } catch (x) {}
        _ensureSurveyModalZIndex();
        if (typeof window.openSurveyEdit === "function") {
          window.openSurveyEdit(sIdx);
        } else {
          console.warn("[survey] openSurveyEdit not found on window");
        }
      });
    });
  }
  window.renderSurveyWbTab = renderSurveyWbTab;
  window.__srvBumpRev = function () {
    _srvRev++;
  };
  window.__openSurveyCreateForCurrentContact = function () {
    var cid = window.__currentWbSurveyCid;
    if (!cid && window.akiniContacts && window.akiniContacts.getContacts) {
      var cs = window.akiniContacts.getContacts() || [];
      if (cs[0]) cid = cs[0].id;
    }
    window.__surveyForContactConfig = cid || "";
    if (cid && window.akiniContacts && window.akiniContacts.setActiveChatId) {
      window.akiniContacts.setActiveChatId(cid);
    }
    {
      /* 显式传 contact：这里是字卡库问卷右上角「为联系人新建专属问卷」，
         不传的话会被当成聊天加号的「我发给联系人回答」模式 */
      window.openSurveyCreate("contact");
    }
  };

  /* 选择/屏蔽模式只改已渲染格子的边框与勾选角标，不重建 img，避免点工具时整屏重绘闪烁 */
  function _stkPaintMode() {
    var box = document.getElementById("wbStkPanel");
    if (!box) {
      _syncModeBars();
      return;
    }
    var show = _stkSelMode || _stkBlockMode;
    Array.prototype.forEach.call(box.querySelectorAll(".wb-stk-item"), function (el) {
      var idx = parseInt(el.getAttribute("data-idx"), 10);
      var on = !!_stkSel[idx];
      el.style.borderColor = on ? "#1a1a1a" : "#eee";
      var chk = el.querySelector(".stk-chk");
      if (!show) {
        if (chk) chk.parentNode.removeChild(chk);
        return;
      }
      if (!chk) {
        chk = document.createElement("span");
        chk.className = "stk-chk";
        chk.style.cssText =
          "position:absolute;top:4px;left:4px;width:18px;height:18px;border-radius:50%;color:#fff;font-size:12px;line-height:17px;text-align:center;";
        el.appendChild(chk);
      }
      chk.style.border = "1.5px solid " + (on ? "#1a1a1a" : "#ccc");
      chk.style.background = on ? "#1a1a1a" : "rgba(255,255,255,.9)";
      chk.innerHTML = on ? "\u2713" : "";
    });
    _syncModeBars();
  }

  /* 面板内容签名：联系人/分组/搜索词/数据版本任一项变化才重建 DOM。
     已挂载的面板与签名一致时直接复用现有节点——不重造 <img>，切 tab 与点工具都不会闪。 */
  /* 旧版表情包默认角色被固定成「我」，导致导入/新增的表情包全落在 akini_stickers_me。
     一次性归位：用户从未手动切换过角色、默认联系人还没有表情包时，把这些表情包移给默认联系人。 */
  var _stkRoleFixing = false;
  function _stkFixLegacyRole() {
    try {
      localStorage.setItem("akini_stk_role_fix_v1", "1");
    } catch (e) {}
  }

  function renderStickerTab() {
    var box = _wbPanel();
    if (!box) return;
    /* 主屏幕 PWA / 轻量模式：表情包图片不在启动时全量读入内存，
       打开表情包 tab 时再从 IndexedDB 水合，避免冷启动一次性解码几十 MB 图片被系统杀掉 */
    if (!window.__stkHydratedDone && (window.__AKINI_STANDALONE || window.__AKINI_SAFE_MODE)) {
      try {
        _hydrateStickers();
      } catch (eHY) {}
    }
    _applyStickerChrome(true);
    _stkFixLegacyRole();
    var cid = _getCid();
    var _dc0 = (window.__akiniDefaultContact && window.__akiniDefaultContact()) || null;
    var contacts = _dc0 ? [_dc0] : [];
    var myName = localStorage.getItem("akini_my_name") || "我";
    var _sigBase =
      cid + "\x1f" + _stkFilterGid + "\x1f" + _stkQuery + "\x1f" + contacts.length + "\x1f" + myName + "\x1f" + _stkRev;
    /* 筛选/联系人变化时重置分页上限；上限纳入签名，点「显示更多」才会触发重绘 */
    if (box.__stkSigBase !== _sigBase) ((box.__stkSigBase = _sigBase), (window.__stkLimit = 80));
    var _stkLimit = window.__stkLimit || 80;
    var _sig = _sigBase + "\x1f" + _stkLimit;
    if (box.__stkSig === _sig && box.querySelector(".wb-stk-person")) {
      _stkPaintMode();
      return;
    }
    var people = [{ id: "me", name: myName, avatar: _myAvatar() }].concat(
      contacts.map(function (c) {
        return { id: c.id, name: c.name || "对方", avatar: c.avatar || "" };
      }),
    );
    var h =
      '<div style="display:flex;gap:14px;overflow-x:auto;padding:6px 16px 8px;margin-top:4px;background:#fff;-webkit-overflow-scrolling:touch;width:100%;box-sizing:border-box;align-self:stretch;flex-shrink:0;min-height:72px;">';
    people.forEach(function (p) {
      var on = String(p.id) === String(cid);
      h +=
        '<div class="wb-stk-person" data-cid="' +
        p.id +
        '" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;">' +
        '<div style="width:44px;height:44px;border-radius:50%;background:#f0f0f0;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
        (on ? "box-shadow:0 0 0 2px #1a1a1a;" : "") +
        '">' +
        _avHtml(p.avatar, 44) +
        "</div>" +
        '<div style="font-size:11px;' +
        (on ? "color:#1a1a1a;font-weight:600;" : "color:#888;") +
        'max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2;">' +
        _esc(p.name) +
        "</div></div>";
    });
    h += "</div>";
    /* 表情包独立分组筛选条：与其他三个 tab 一致，无分组数据时不显示 */
    var groups = _stkGRead();
    if (groups.length) {
      var arr0 = _stkRead(cid);
      h +=
        '<div style="display:flex;gap:6px;overflow-x:auto;margin:0 16px 8px;padding:5px;background:#f5f5f5;border-radius:14px;-webkit-overflow-scrolling:touch;align-self:stretch;box-sizing:border-box;flex-shrink:0;min-height:40px;">';
      var chip = function (gid, label, count) {
        var on2 = String(_stkFilterGid) === String(gid);
        return (
          '<button type="button" class="wb-stk-chip wb-gf-btn' +
          (on2 ? " active" : "") +
          '" data-gid="' +
          gid +
          '" style="flex-shrink:0;-webkit-tap-highlight-color:transparent;">' +
          label +
          (count != null ? "(" + count + ")" : "") +
          "</button>"
        );
      };
      h += chip("", "全部", null);
      h += chip(
        "__ungrouped__",
        "未分组",
        arr0.filter(function (x) {
          return !x.g;
        }).length,
      );
      groups.forEach(function (g) {
        h += chip(
          g.id,
          _esc(g.name),
          arr0.filter(function (x) {
            return String(x.g) === String(g.id);
          }).length,
        );
      });
      h += "</div>";
    }
    var arr = _stkRead(cid);
    var shown = _stkFiltered(arr);
    /* 白底（去掉灰底），网格每行三个 */
    h +=
      '<div style="padding:0 12px 12px;background:#fff;min-height:200px;width:100%;box-sizing:border-box;align-self:stretch;flex:1 1 auto;"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';
    shown.slice(0, _stkLimit).forEach(function (row) {
      var it = row.it,
        i = row.idx;
      var selOn = !!_stkSel[i];
      var inMode = _stkSelMode || _stkBlockMode;
      h +=
        '<div class="wb-stk-item" data-idx="' +
        i +
        '" style="position:relative;aspect-ratio:1/1;background:#fff;border:1px solid ' +
        (selOn ? "#1a1a1a" : "#eee") +
        ";border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;" +
        (it.b ? "opacity:.4;" : "") +
        '">' +
        /* 同步解码：重绘时图片在同一帧内就绪，不会先出现空白格再"闪"出图片 */
        '<img src="' +
        it.s +
        '" decoding="sync" style="width:100%;height:100%;object-fit:contain;" alt=""/>' +
        (inMode
          ? '<span class="stk-chk" style="position:absolute;top:4px;left:4px;width:18px;height:18px;border-radius:50%;border:1.5px solid ' +
            (selOn ? "#1a1a1a" : "#ccc") +
            ";background:" +
            (selOn ? "#1a1a1a" : "rgba(255,255,255,.9)") +
            ';color:#fff;font-size:12px;line-height:17px;text-align:center;">' +
            (selOn ? "✓" : "") +
            "</span>"
          : "") +
        (it.b
          ? '<span style="position:absolute;bottom:3px;right:3px;font-size:10px;color:#fff;background:rgba(0,0,0,.55);border-radius:6px;padding:1px 5px;">已屏蔽</span>'
          : "") +
        "</div>";
    });
    h += "</div>";
    if (shown.length > _stkLimit)
      h +=
        '<button type="button" id="wbStkLoadMore" style="display:block;width:100%;margin:4px 0 8px;padding:10px 0;border:1px dashed #ccc;border-radius:10px;background:transparent;color:#888;font-size:13px;">显示更多（剩余 ' +
        (shown.length - _stkLimit) +
        " 张）</button>";
    h +=
      (shown.length
        ? ""
        : '<div style="text-align:center;color:#bbb;font-size:13px;padding:40px 0;">' +
          (arr.length ? "没有匹配的表情包" : "还没有表情包，点右上角「新增」添加图片") +
          "</div>") +
      "</div>";
    box.innerHTML = h;
    box.__stkSig = _sig;
    var _slm = document.getElementById("wbStkLoadMore");
    _slm &&
      _slm.addEventListener("click", function () {
        ((window.__stkLimit = _stkLimit + 80), renderStickerTab());
      });
    _syncModeBars();
    /* 容器级事件委托：touchend 捕获阶段。
       主字卡模块在 #wbContent 的 touchend（冒泡阶段）里对未滑动的触摸无条件 preventDefault，
       iOS 上这会抑制后续 click，导致头像切换/分组筛选/格子点击全部失效。
       捕获阶段先于冒泡执行，在此直接处理即可绕过。 */
    if (!window.__stkTapDelegated) {
      window.__stkTapDelegated = true;
      var _content = box;
      var _slop = { x: 0, y: 0, moved: false };
      _content.addEventListener(
        "touchstart",
        function (ev) {
          var p = ev.touches && ev.touches[0];
          if (!p) return;
          _slop.x = p.clientX;
          _slop.y = p.clientY;
          _slop.moved = false;
        },
        { passive: true, capture: true },
      );
      _content.addEventListener(
        "touchmove",
        function (ev) {
          var p = ev.touches && ev.touches[0];
          if (!p) return;
          if (Math.abs(p.clientX - _slop.x) > 10 || Math.abs(p.clientY - _slop.y) > 10) _slop.moved = true;
        },
        { passive: true, capture: true },
      );
      _content.addEventListener(
        "touchcancel",
        function () {
          _slop.moved = false;
        },
        { passive: true, capture: true },
      );
      _content.addEventListener(
        "touchend",
        function (ev) {
          if (window.__wbTab !== "sticker") return;
          if (_slop.moved) {
            _slop.moved = false;
            return;
          }
          var t = ev.target && ev.target.closest ? ev.target : null;
          if (!t || !t.closest) return;
          var person = t.closest(".wb-stk-person");
          var chipEl = t.closest(".wb-stk-chip");
          var item = t.closest(".wb-stk-item");
          if (!person && !chipEl && !item) return;
          try {
            if (person) {
              _setCid(person.getAttribute("data-cid"));
              _stkSel = {};
              renderStickerTab();
              return;
            }
            if (chipEl) {
              _stkFilterGid = chipEl.getAttribute("data-gid") || "";
              _stkSel = {};
              renderStickerTab();
              return;
            }
            if (item) {
              var idx = parseInt(item.getAttribute("data-idx"), 10);
              if (isNaN(idx)) return;
              if (_stkSelMode || _stkBlockMode) {
                if (_stkSel[idx]) delete _stkSel[idx];
                else _stkSel[idx] = true;
                var __on = !!_stkSel[idx];
                item.style.borderColor = __on ? "#1a1a1a" : "#eee";
                var __chk = item.querySelector(".stk-chk");
                if (__chk) {
                  __chk.style.borderColor = __on ? "#1a1a1a" : "#ccc";
                  __chk.style.background = __on ? "#1a1a1a" : "rgba(255,255,255,.9)";
                  __chk.textContent = __on ? "✓" : "";
                }
                _syncModeBars();
              } else {
                /* 普通点击不删除表情包：删除统一走星标选择模式 */
              }
            }
          } catch (x) {}
        },
        true,
      );
    }
  }

  /* ---- 删除确认 ---- */
  var _delTarget = null;

  function _bindDeleteSheet() {
    var sh = document.getElementById("wbStickerActionSheet");
    var ok = document.getElementById("wbStickerDelConfirm");
    var no = document.getElementById("wbStickerDelCancel");
    if (!sh || sh.__bound) return;
    sh.__bound = 1;
    sh.addEventListener("click", function (e) {
      if (e.target === sh) sh.style.display = "none";
    });
    no &&
      no.addEventListener("click", function () {
        sh.style.display = "none";
      });
    ok &&
      ok.addEventListener("click", function () {
        if (_delTarget) {
          var arr = _stkRead(_delTarget.cid);
          if (_delTarget.idx >= 0 && _delTarget.idx < arr.length) {
            arr.splice(_delTarget.idx, 1);
            _stkWrite(_delTarget.cid, arr);
          }
        }
        _delTarget = null;
        sh.style.display = "none";
        renderStickerTab();
      });
  }

  /* 表情包/问卷 tab 不提供导出/导入（这两个模块不参与字卡文件），切回字卡 tab 时恢复 */
  window.__wbSyncIOButtons = function () {
    try {
      var _hide = window.__wbTab === "sticker" || window.__wbTab === "survey";
      ["wbExportBtn", "wbImportBtn", "wbImportInput"].forEach(function (id) {
        var _e = document.getElementById(id);
        if (_e) _e.style.display = _hide ? "none" : "";
      });
    } catch (_e) {}
  };

  /* ---- tab 切换跟踪 ---- */
  function _syncTab(tabName) {
    var tabs = document.querySelector(".wb-tabs");
    var prev = window.__wbTab || "main";
    /* 只有显式传入 tabName 时才切换；否则只同步 DOM 激活态，避免把已切换的 tab 又改回去 */
    if (tabName) {
      window.__wbTab = tabName;
    } else {
      window.__wbTab = window.__wbTab || "main";
    }
    /* 同步 .active 类，确保与 window.__wbTab 一致 */
    if (tabs) {
      var tbs = tabs.querySelectorAll(".tab");
      tbs.forEach(function (b) {
        if ((b.getAttribute("data-tab") || "main") === window.__wbTab) b.classList.add("active");
        else b.classList.remove("active");
      });
    }
    /* 分组管理弹窗标题按当前模块命名（表情包 tab 用独立的 stkGroupModal，标题已静态写好） */
    try {
      var _gmT = document.querySelector("#groupModal .title");
      if (_gmT)
        _gmT.textContent =
          ({ main: "主字卡", emoji: "Emoji", pat: "拍一拍", bubble: "小气泡" }[window.__wbTab] || "主字卡") +
          "分组管理";
    } catch (e) {}
    var on = window.__wbTab === "sticker";
    if (!on && prev === "sticker") {
      _stkExitModes();
      _stkQuery = "";
    }
    if (window.__wbTab !== "survey" && prev === "survey") {
      _srvExitModes();
      _srvQuery = "";
      _srvFilterGid = "";
      var _srvSb = document.getElementById("wbSearchBar");
      if (_srvSb) _srvSb.style.display = "none";
      var _srvSi = document.getElementById("wbSearchInput");
      if (_srvSi) _srvSi.value = "";
    }
    var _sa = document.getElementById("wbSelectActions");
    var _ba = document.getElementById("wbBlockActions");
    if (_sa) _sa.style.display = "none";
    if (_ba) _ba.style.display = "none";
    _applyStickerChrome(on);
    window.__wbSyncSearchScope && window.__wbSyncSearchScope();
    var isSurvey = window.__wbTab === "survey";
    /* 表情包/问卷 tab 不提供导入/导出：直接把按钮从 DOM 移除（不是 display:none），
       切回其他 tab 时再插回工具栏 */
    try {
      window.__wbSyncIOButtons && window.__wbSyncIOButtons();
    } catch (eTabBtn) {}
    /* 表情包/问卷各用独立面板：#wbContent 留给主字卡模块随意重绘，互不干扰 */
    _wbPanelShow(window.__wbTab);
    if (on) {
      renderStickerTab();
    } else if (isSurvey) {
      _bindSurveyToolbar();
      if (typeof renderSurveyWbTab === "function") renderSurveyWbTab();
    } else {
      try {
        window.__wbRenderList && window.__wbRenderList();
      } catch (e) {}
      /* 分组条按当前 tab 独立渲染：切回主字卡时它可能被 wb-panel-mode 隐藏过，
         且不能残留上一个 tab 的分组，必须重新渲染一次 */
      try {
        window.__wbRenderGroupFilter && window.__wbRenderGroupFilter();
      } catch (eGf) {}
    }
  }
  function _bindTabs() {
    var tabs = document.querySelector(".wb-tabs");
    if (!tabs || tabs.__stkBound) return;
    tabs.__stkBound = 1;
    tabs.addEventListener(
      "touchend",
      function (e) {
        var t = e.target && e.target.closest ? e.target.closest(".tab") : null;
        if (t) {
          var name = t.getAttribute("data-tab") || "main";
          _syncTab(name);
        }
      },
      true,
    );
    /* click 兜底：只同步 DOM 激活态与重绘 */
    tabs.addEventListener("click", function () {
      _syncTab();
    });
  }

  /* ---- 工具栏接管：表情包 tab 下由表情包模块独立处理（与主字卡/emoji/拍一拍平级） ---- */
  /* 与主模块 a() 完全相同的绑定模式：元素级 touchstart/touchmove/touchend/click，
     touchend fire 后 preventDefault 抑制合成 click + swallow 吞残余 + __stkHandled 双保险，
     confirm/prompt 弹窗不会弹两遍；行为与主字卡/Emoji/拍一拍工具栏完全一致 */
  function _stkTap(el, fn) {
    if (window.__akiniBindTap)
      window.__akiniBindTap(el, fn, function () {
        return window.__wbTab === "sticker";
      });
  }

  /* 分组管理弹窗 */
  function _stkRenderGroupModal() {
    var list = document.getElementById("stkGroupList");
    var empty = document.getElementById("stkGroupEmpty");
    if (!list) return;
    var groups = _stkGRead();
    var arr = _stkRead(_getCid());
    if (!groups.length) {
      list.innerHTML = "";
      list.style.display = "none";
      if (empty) empty.style.display = "block";
      return;
    }
    list.style.display = "flex";
    if (empty) empty.style.display = "none";
    var h = "";
    groups.forEach(function (g, gi) {
      var cnt = arr.filter(function (x) {
        return String(x.g) === String(g.id);
      }).length;
      /* 行样式与其他三个 tab 的分组管理完全一致（一致内联样式，仅单位用"张"） */
      h +=
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8f8f8;border-radius:10px;margin-bottom:8px;">' +
        '<div style="display:flex;align-items:center;gap:8px;min-width:0;"><span style="font-size:14px;color:#333;font-weight:500;">' +
        _esc(g.name) +
        '</span><span style="font-size:12px;color:#aaa;">' +
        cnt +
        "张</span></div>" +
        '<div style="display:flex;align-items:center;gap:2px;margin:-10px -12px -10px 0;">' +
        '<button type="button" class="stk-group-edit" data-gi="' +
        gi +
        '" title="修改分组名称" style="background:none;border:none;color:#666;cursor:pointer;padding:10px 8px;min-width:36px;min-height:40px;touch-action:manipulation;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>' +
        '<button type="button" class="stk-group-del del-group" data-gi="' +
        gi +
        '" style="background:none;border:none;color:#ff6b6b;font-size:16px;cursor:pointer;padding:10px 12px;min-width:40px;min-height:40px;touch-action:manipulation;">✕</button></div></div>';
    });
    list.innerHTML = h;
    list.querySelectorAll(".stk-group-edit").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var gi = parseInt(this.getAttribute("data-gi"), 10);
        var gs = _stkGRead();
        if (isNaN(gi) || gi < 0 || gi >= gs.length) return;
        window.__akiniPromptModal(
          "修改分组名称",
          "请输入新的分组名称",
          function (v) {
            if (!v || !v.trim()) return;
            var cur = _stkGRead();
            if (gi >= cur.length) return;
            cur[gi].name = v.trim();
            _stkGWrite(cur);
            _stkRenderGroupModal();
            renderStickerTab();
          },
          { value: gs[gi].name },
        );
      });
    });
    list.querySelectorAll(".stk-group-del").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var gi = parseInt(this.getAttribute("data-gi"), 10);
        var gs = _stkGRead();
        if (isNaN(gi) || gi < 0 || gi >= gs.length) return;
        var gid = String(gs[gi].id);
        var gname = gs[gi].name;
        window.__akiniCenterModal("确认", "删除分组「" + gname + "」？组内表情包会变为未分组", {
          confirm: true,
          okText: "删除",
          cancelText: "取消",
          onClose: function (ok) {
            if (!ok) return;
            gs.splice(gi, 1);
            _stkGWrite(gs);
            _stkAllCids().forEach(function (c) {
              var a2 = _stkRead(c),
                dirty = false;
              a2.forEach(function (x) {
                if (String(x.g) === gid) {
                  x.g = "";
                  dirty = true;
                }
              });
              if (dirty) _stkWrite(c, a2);
            });
            if (String(_stkFilterGid) === gid) _stkFilterGid = "";
            _stkRenderGroupModal();
            renderStickerTab();
          },
        });
      });
    });
  }
  function _stkOpenGroupModal() {
    var m = document.getElementById("stkGroupModal");
    if (!m) return;
    _stkRenderGroupModal();
    m.style.display = "flex";
  }
  function _bindStkGroupModal() {
    var m = document.getElementById("stkGroupModal");
    if (!m || m.__bound) return;
    m.__bound = 1;
    m.addEventListener("click", function (e) {
      if (e.target === m) m.style.display = "none";
    });
    /* 关闭/新建统一走 _cap 捕获 */
    _stkTap("stkGroupClose", function () {
      m.style.display = "none";
    });
    _stkTap("stkGroupCreateBtn", function () {
      window.__akiniPromptModal("新建分组", "请输入表情包分组名称", function (name) {
        if (!name || !name.trim()) return;
        var gs = _stkGRead();
        gs.push({ id: Date.now(), name: name.trim() });
        _stkGWrite(gs);
        _stkRenderGroupModal();
        renderStickerTab();
      });
    });
  }

  /* 多选「加入分组」选择面板 */
  function _stkPickGroupForSel(cb) {
    var groups = _stkGRead();
    if (!groups.length) {
      alert("请先通过工具栏「分组」创建分组");
      return;
    }
    var ov = document.createElement("div");
    ov.id = "stkGroupPickOv";
    /* 与其他三个 tab 的「选择分组」弹窗样式统一（居中白卡 + wb-pick-group-btn） */
    ov.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;z-index:8400;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;";
    var h =
      '<div style="background:#fff;border-radius:16px;padding:20px;width:85%;max-height:60%;overflow-y:auto;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;">' +
      '<div style="font-size:16px;font-weight:600;color:#333">选择分组</div>';
    groups.forEach(function (g) {
      h +=
        '<button type="button" data-gid="' +
        g.id +
        '" class="wb-pick-group-btn" style="padding:10px 14px;background:#f5f5f5;border:none;border-radius:10px;font-size:14px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;">' +
        _esc(g.name) +
        "</button>";
    });
    h +=
      '<button type="button" data-cancel="1" style="padding:10px;background:#eee;border:none;border-radius:10px;font-size:14px;cursor:pointer;">取消</button></div>';
    ov.innerHTML = h;
    ov.addEventListener("click", function (e) {
      /* 创建本弹窗的原始点击会继续冒泡经过 body，closest('button') 会误匹配工具栏按钮导致弹窗闪关并被移到未分组；
         只响应发生在弹窗内部的点击 */
      if (!ov.contains(e.target)) return;
      if (e.target === ov) {
        ov.remove();
        return;
      }
      var b = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!b) return;
      ov.remove();
      if (b.getAttribute("data-cancel")) return;
      cb(b.getAttribute("data-gid") || "");
    });
    document.body.appendChild(ov);
  }

  /* 查重：按图片内容去除当前角色重复表情包 */
  function _stkDedup() {
    var cid = _getCid();
    var arr = _stkRead(cid);
    var seen = {};
    var out = [];
    arr.forEach(function (it) {
      if (!seen[it.s]) {
        seen[it.s] = 1;
        out.push(it);
      }
    });
    var removed = arr.length - out.length;
    alert(removed > 0 ? "成功去重 " + removed + " 张表情包" : "没有重复表情包");
    if (removed > 0) {
      _stkWrite(cid, out);
      _stkSel = {};
      renderStickerTab();
    }
  }

  /* 搜索栏顶部显示当前搜索范围（主字卡/Emoji/拍一拍/表情包） */
  window.__wbSyncSearchScope = function () {
    var el = document.getElementById("wbSearchScope");
    var ip = document.getElementById("wbSearchInput");
    var map = { main: "主字卡", emoji: "Emoji", pat: "拍一拍", sticker: "表情包", bubble: "小气泡", survey: "问卷" };
    var phMap = {
      main: "搜索字卡...",
      emoji: "搜索字卡...",
      pat: "搜索字卡...",
      bubble: "搜索小气泡...",
      sticker: "按分组名搜索表情包...",
      survey: "搜索问卷标题或问题...",
    };
    var tab = window.__wbTab || "main";
    if (el) el.textContent = "搜索范围：" + (map[tab] || "主字卡");
    if (ip) ip.placeholder = phMap[tab] || "搜索字卡...";
  };

  function _stkToggleSearch() {
    var bar = document.getElementById("wbSearchBar");
    if (!bar) return;
    var showing = bar.style.display !== "none" && bar.style.display !== "";
    var ip = document.getElementById("wbSearchInput");
    if (showing) {
      bar.style.display = "none";
      _stkQuery = "";
      if (ip) ip.value = "";
      renderStickerTab();
    } else {
      bar.style.display = "block";
      window.__wbSyncSearchScope();
      if (ip) {
        ip.placeholder = "按分组名搜索表情包...";
        try {
          ip.focus();
        } catch (e) {}
      }
    }
  }
  function _stkToggleSelMode() {
    _stkSelMode = !_stkSelMode;
    if (_stkSelMode) _stkBlockMode = false;
    _stkSel = {};
    _stkPaintMode();
  }
  function _stkToggleBlockMode() {
    _stkBlockMode = !_stkBlockMode;
    if (_stkBlockMode) _stkSelMode = false;
    _stkSel = {};
    _stkPaintMode();
  }
  function _stkSelAll() {
    var arr = _stkRead(_getCid());
    _stkFiltered(arr).forEach(function (row) {
      _stkSel[row.idx] = true;
    });
    _stkPaintMode();
  }
  /* 操作成功后 1.5s 内的空选择静默忽略 */
  function _stkEmptyGuard() {
    if (Date.now() - (window.__stkJustDone || 0) < 1500) return true;
    alert("请先选择表情包");
    return false;
  }
  var _stkDelInProgress = false;
  function _stkSelDelete() {
    if (_stkDelInProgress) return;
    var idxs = Object.keys(_stkSel)
      .map(Number)
      .sort(function (a, b) {
        return b - a;
      });
    if (!idxs.length) {
      _stkEmptyGuard();
      return;
    }
    _stkDelInProgress = true;
    window.__akiniCenterModal("确认", "确定删除选中的 " + idxs.length + " 张表情包？", {
      confirm: true,
      okText: "删除",
      cancelText: "取消",
      onClose: function (ok) {
        setTimeout(function () {
          _stkDelInProgress = false;
        }, 1000);
        if (!ok) return;
        var cid = _getCid();
        var arr = _stkRead(cid);
        idxs.forEach(function (i) {
          if (i >= 0 && i < arr.length) arr.splice(i, 1);
        });
        _stkWrite(cid, arr);
        _stkSel = {};
        window.__stkJustDone = Date.now();
        renderStickerTab();
      },
    });
  }
  function _stkSelGroup() {
    var idxs = Object.keys(_stkSel).map(Number);
    if (!idxs.length) {
      _stkEmptyGuard();
      return;
    }
    _stkPickGroupForSel(function (gid) {
      var cid = _getCid();
      var arr = _stkRead(cid);
      idxs.forEach(function (i) {
        if (arr[i]) arr[i].g = gid || "";
      });
      _stkWrite(cid, arr);
      _stkSel = {};
      window.__stkJustDone = Date.now();
      renderStickerTab();
    });
  }
  function _stkBlockDo(blocked) {
    var idxs = Object.keys(_stkSel).map(Number);
    if (!idxs.length) {
      _stkEmptyGuard();
      return;
    }
    var cid = _getCid();
    var arr = _stkRead(cid);
    idxs.forEach(function (i) {
      if (arr[i]) arr[i].b = blocked ? 1 : 0;
    });
    _stkWrite(cid, arr);
    _stkSel = {};
    window.__stkJustDone = Date.now();
    renderStickerTab();
  }

  function _bindStickerToolbar() {
    if (window.__stkToolbarBound) return;
    window.__stkToolbarBound = 1;
    _stkTap("searchBtn", _stkToggleSearch);
    _stkTap("wbSearchClose", function () {
      var bar = document.getElementById("wbSearchBar");
      if (bar) bar.style.display = "none";
      _stkQuery = "";
      var ip = document.getElementById("wbSearchInput");
      if (ip) ip.value = "";
      renderStickerTab();
    });
    _stkTap("groupBtn", _stkOpenGroupModal);
    _stkTap("dedupBtn", _stkDedup);
    /* 字卡库统一导入完成后，供 core 刷新表情包面板 */
    window.__wbRenderStickerTab = renderStickerTab;
    /* 统一导入是 core 直接写 akini_stickers_*，不会经过 _stkWrite：
       这里清掉同步缓存并重绘，避免表情包面板/聊天读到导入前的旧数据 */
    window.__wbRefreshStickers = function () {
      _stkRev++;
      try {
        if (window.__csCache) {
          Object.keys(window.__csCache).forEach(function (k) {
            if (k.indexOf("akini_stickers_") === 0) delete window.__csCache[k];
          });
        }
      } catch (e) {}
      renderStickerTab();
    };
    _stkTap("wbBlockBtn", _stkToggleBlockMode);
    _stkTap("selectBtn", _stkToggleSelMode);
    _stkTap("wbSelectAllBtn", _stkSelAll);
    _stkTap("wbSelectDeleteBtn", _stkSelDelete);
    _stkTap("wbSelectGroupBtn", _stkSelGroup);
    _stkTap("wbSelectCancelBtn", function () {
      _stkSelMode = false;
      _stkSel = {};
      _stkPaintMode();
    });
    _stkTap("wbBlockDoBtn", function () {
      _stkBlockDo(true);
    });
    _stkTap("wbBlockUndoBtn", function () {
      _stkBlockDo(false);
    });
    _stkTap("wbBlockExitBtn", function () {
      _stkBlockMode = false;
      _stkSel = {};
      _stkPaintMode();
    });
    /* 搜索输入：拦截主模块处理器，避免其重绘覆盖表情包网格 */
    window.addEventListener(
      "input",
      function (e) {
        if (window.__wbTab !== "sticker") return;
        var t = e.target;
        if (!t || t.id !== "wbSearchInput") return;
        _stkQuery = t.value.trim();
        renderStickerTab();
      },
      true,
    );
    /* 搜索栏被任一模块打开时同步顶部搜索范围标签 */
    var sb = document.getElementById("wbSearchBar");
    if (sb && window.MutationObserver) {
      var smo = new MutationObserver(function () {
        window.__wbSyncSearchScope && window.__wbSyncSearchScope();
      });
      smo.observe(sb, { attributes: true, attributeFilter: ["style"] });
    }
    _bindStkGroupModal();
  }

  /* ---- 表情包专属添加弹窗逻辑 ---- */
  var _pendingStickerFiles = [];

  function _renderStickerPreviews() {
    var grid = document.getElementById("wbStickerPreviewGrid");
    var countEl = document.getElementById("wbStickerPickedCount");
    var clearBtn = document.getElementById("wbStickerClearAll");
    if (!grid) return;
    if (countEl) countEl.textContent = String(_pendingStickerFiles.length);
    if (clearBtn) clearBtn.style.display = _pendingStickerFiles.length > 0 ? "inline-block" : "none";
    if (!_pendingStickerFiles.length) {
      grid.innerHTML =
        '<div id="wbStickerEmptyTip" style="grid-column:1/-1;text-align:center;color:#bbb;font-size:13px;padding:36px 0;">未选择任何图片</div>';
      return;
    }
    var html = "";
    _pendingStickerFiles.forEach(function (dataUrl, idx) {
      html +=
        '<div style="position:relative;width:100%;aspect-ratio:1/1;min-height:64px;height:auto;background:#fff;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;box-sizing:border-box;">' +
        '<img src="' +
        dataUrl +
        '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;" alt=""/>' +
        '<button type="button" class="wb-stk-del-item" data-idx="' +
        idx +
        '" style="position:absolute;top:2px;right:2px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.65);color:#fff;border:none;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;z-index:2;">✕</button>' +
        "</div>";
    });
    grid.innerHTML = html;
    grid.querySelectorAll(".wb-stk-del-item").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var i = parseInt(this.getAttribute("data-idx"), 10);
        if (!isNaN(i) && i >= 0 && i < _pendingStickerFiles.length) {
          _pendingStickerFiles.splice(i, 1);
          _renderStickerPreviews();
        }
      });
    });
  }

  function _openAddStickerModal() {
    _pendingStickerFiles = [];
    var modal = document.getElementById("addStickerModal");
    if (!modal) return;
    _renderStickerPreviews();
    /* 填充「添加进分组」下拉 */
    var sel = document.getElementById("wbStickerGroupSelect");
    if (sel) {
      var oh = '<option value="">-- 不分组 --</option>';
      _stkGRead().forEach(function (g) {
        oh += '<option value="' + g.id + '">' + _esc(g.name) + "</option>";
      });
      sel.innerHTML = oh;
    }
    modal.style.display = "flex";
    modal.classList.add("show");
  }
  window.__initAddStickerModal = _openAddStickerModal;

  function _bindAddStickerModalEvents() {
    var modal = document.getElementById("addStickerModal");
    if (!modal || modal.__boundStkEvents) return;
    modal.__boundStkEvents = 1;

    var input = document.getElementById("wbStickerMultiInput");
    if (input) {
      input.addEventListener("change", function () {
        var files = Array.from(this.files || []);
        this.value = "";
        if (!files.length) return;
        var pending = files.length;
        files.forEach(function (file) {
          var reader = new FileReader();
          reader.onload = function (ev) {
            if (ev.target && ev.target.result) {
              _pendingStickerFiles.push(ev.target.result);
            }
            pending--;
            if (pending <= 0) {
              _renderStickerPreviews();
            }
          };
          reader.readAsDataURL(file);
        });
      });
    }

    var clearBtn = document.getElementById("wbStickerClearAll");
    if (clearBtn) {
      clearBtn.addEventListener("click", function (e) {
        _pendingStickerFiles = [];
        _renderStickerPreviews();
      });
    }

    var cancelBtn = document.getElementById("cancelAddSticker");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function (e) {
        _pendingStickerFiles = [];
        modal.style.display = "none";
        modal.classList.remove("show");
      });
    }

    var confirmBtn = document.getElementById("confirmAddSticker");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function (e) {
        if (!_pendingStickerFiles.length) {
          alert("请先选择要添加的表情包图片");
          return;
        }
        var gidSel = document.getElementById("wbStickerGroupSelect");
        var gid = gidSel ? gidSel.value || "" : "";
        var cid = _getCid();
        var arr = _stkRead(cid);
        var _addCnt = _pendingStickerFiles.length;
        _pendingStickerFiles.forEach(function (s) {
          arr.push({ s: s, g: gid, b: 0 });
        });
        _stkWrite(cid, arr);
        _pendingStickerFiles = [];
        modal.style.display = "none";
        modal.classList.remove("show");
        renderStickerTab();
        var _roleName = "我";
        if (cid !== "me") {
          try {
            var _co =
              window.akiniContacts && window.akiniContacts.getContactById
                ? window.akiniContacts.getContactById(cid)
                : null;
            if (_co && _co.name) _roleName = _co.name;
          } catch (e2) {}
        }
        window.__akiniToast && window.__akiniToast("✓ 成功添加 " + _addCnt + " 个表情包到「" + _roleName + "」");
      });
    }
  }

  /* ---- 右上角新增：表情包 tab 时弹出添加表情包弹窗 ---- */
  function _bindAdd() {
    _bindAddStickerModalEvents();
    /* iOS 上 inline onclick 可能因 touchend 抑制而不触发，这里在捕获阶段直接接管 */
    var addBtn = document.querySelector("#wordbankOverlay .wb-head-add");
    if (addBtn && !addBtn.__stkBound) {
      addBtn.__stkBound = 1;
      var openPicker = function (e) {
        if (window.__wbTab !== "sticker") return;
        var now = Date.now();
        if (addBtn.__stkLock && now - addBtn.__stkLock < 700) return;
        addBtn.__stkLock = now;
        _openAddStickerModal();
      };
      addBtn.addEventListener("pointerdown", openPicker, true);
      addBtn.addEventListener("touchend", openPicker, true);
      addBtn.addEventListener("click", openPicker, true);
    }
  }

  /* ---- 通用表情包选择面板（评论/观影输入栏用，读「我」的表情包库） ---- */
  var _pickCb = null;
  window.__openStickerPickPanel = function (onPick) {
    _pickCb = onPick;
    var p = document.getElementById("stickerPickPanel");
    var g = document.getElementById("stickerPickGrid");
    if (!p || !g) return;
    var arr = _stkRead("me").filter(function (it) {
      return !it.b;
    });
    if (!arr.length) {
      try {
        var gb = JSON.parse(localStorage.getItem("akini_stickers") || "[]");
        if (Array.isArray(gb))
          arr = gb
            .map(_stkOne)
            .filter(Boolean)
            .filter(function (it) {
              return !it.b;
            });
      } catch (e) {}
    }
    var h = "";
    arr.forEach(function (it, i) {
      /* 弃用 aspect-ratio（旧 Android WebView 不支持会导致 item 高度塌陷、图片全部堆叠），
         改用 padding-bottom:100% 方形兼容写法 */
      h +=
        '<div class="stk-pick-item" data-idx="' +
        i +
        '" style="width:100%;height:0;padding-bottom:100%;background:#f7f7f7;border-radius:10px;overflow:hidden;position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent;"><img src="' +
        it.s +
        '" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;" alt=""/></div>';
    });
    g.innerHTML =
      h ||
      '<div style="grid-column:1/-1;text-align:center;color:#bbb;font-size:13px;padding:36px 0;">还没有表情包，去「字卡库 → 表情包」添加</div>';
    g.querySelectorAll(".stk-pick-item").forEach(function (el) {
      el.addEventListener("click", function () {
        var it = arr[parseInt(this.getAttribute("data-idx"), 10)];
        p.style.display = "none";
        if (it && _pickCb) _pickCb(it.s);
      });
    });
    /* 观影全屏时面板移到全屏元素内（Fullscreen API 下 body 级 fixed 元素不可见/布局异常） */
    try {
      var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl && p.parentElement !== fsEl) {
        p.__origParent = p.parentElement;
        fsEl.appendChild(p);
      } else if (!fsEl && p.__origParent && p.parentElement !== p.__origParent) {
        p.__origParent.appendChild(p);
      }
    } catch (e) {}
    p.style.display = "flex";
  };
  function _bindPickPanel() {
    var p = document.getElementById("stickerPickPanel");
    var c = document.getElementById("stickerPickClose");
    if (!p || p.__bound) return;
    p.__bound = 1;
    p.addEventListener("click", function (e) {
      if (e.target === p) p.style.display = "none";
    });
    c &&
      c.addEventListener("click", function () {
        p.style.display = "none";
      });
  }

  /* ---- 三处输入栏表情包按钮 ---- */
  function _restorePh(input) {
    if (input && input.__stickerHint) {
      input.placeholder = input.__origPh || (input.id === "msgInput" ? "iMessage信息" : "发送消息…");
      input.__stickerHint = false;
    }
  }
  try {
    var _msgInp = document.getElementById("msgInput");
    if (_msgInp) {
      if (!_msgInp.hasAttribute("data-quote")) _msgInp.placeholder = "iMessage信息";
      try {
        new MutationObserver(function () {
          try {
            if (_msgInp && !_msgInp.hasAttribute("data-quote") && _msgInp.placeholder !== "iMessage信息") {
              _msgInp.placeholder = "iMessage信息";
            }
          } catch (_) {}
        }).observe(_msgInp, { attributes: true, attributeFilter: ["placeholder", "data-quote"] });
      } catch (_) {}
      /* 第一屏卡片背景"内联 !important"钉死——美化主题的 ID 选择器优先级高于样式表规则，
       顶部始终透出 banner；内联 important 是作者样式天花板，任何主题都压不过。
       同值重复写入无副作用（浏览器对相同赋值不触发重绘） */
      try {
        var _s1pin = function () {
          try {
            var _el =
              document.querySelector("#screen1 .s1-frosted-content") || document.querySelector(".s1-frosted-content");
            if (!_el) return;
            _el.style.setProperty(
              "background",
              "linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 42%, rgba(255,255,255,0.75) 58%, rgba(255,255,255,0.75) 66%, rgba(255,255,255,0.3) 86%, rgba(255,255,255,0) 100%)",
              "important",
            );
            _el.style.setProperty("backdrop-filter", "none", "important");
            _el.style.setProperty("-webkit-backdrop-filter", "none", "important");
            _el.style.setProperty("box-shadow", "none", "important");
            /* 用户要求：图标回到原位 */
          } catch (_) {}
        };
        _s1pin();
      } catch (_) {}
    }
  } catch (_) {}
  function _markPending(input, key, src) {
    window[key] = src;
    if (input) {
      if (!input.__origPh) input.__origPh = input.placeholder || "";
      input.placeholder = "[表情包] 已选好，点发送";
      input.__stickerHint = true;
      if (!input.__phBound) {
        input.__phBound = 1;
        input.addEventListener("input", function () {
          _restorePh(this);
        });
      }
    }
  }
  function _bindStickerBtns() {
    var fb = document.getElementById("friendsCommentStickerBtn");
    if (fb && !fb.__bound) {
      fb.__bound = 1;
      fb.addEventListener("click", function (e) {
        window.__openStickerPickPanel(function (src) {
          _markPending(document.getElementById("friendsCommentInput"), "__friendsPendingSticker", src);
        });
      });
    }
    var ib = document.getElementById("icityDetailCommentStickerBtn");
    if (ib && !ib.__bound) {
      ib.__bound = 1;
      ib.addEventListener("click", function (e) {
        window.__openStickerPickPanel(function (src) {
          _markPending(document.getElementById("icityDetailCommentInput"), "__icityPendingSticker", src);
        });
      });
    }
    var wb = document.getElementById("watchStickerBtn");
    if (wb && !wb.__bound) {
      wb.__bound = 1;
      wb.addEventListener("click", function (e) {
        window.__openStickerPickPanel(function (src) {
          /* 观影聊天选择表情包直接发送 */
          if (typeof window.__watchSendStickerDirect === "function") {
            window.__watchSendStickerDirect(src);
          } else {
            _markPending(document.getElementById("watchMsgInput"), "__watchPendingSticker", src);
            var sb = document.getElementById("watchSendBtn");
            if (sb) sb.click();
          }
        });
      });
    }
    /* 朋友圈评论弹窗：点遮罩关闭 + 发送后恢复占位 */
    var fm = document.getElementById("friendsCommentInputModal");
    if (fm && !fm.__stkBound) {
      fm.__stkBound = 1;
      fm.addEventListener("click", function (e) {
        if (e.target === fm) fm.style.display = "none";
      });
    }
    /* 提交后恢复输入框占位提示 */
    ["friendsCommentSubmit", "icityDetailCommentSend"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b && !b.__phBound) {
        b.__phBound = 1;
        b.addEventListener("click", function () {
          setTimeout(function () {
            _restorePh(document.getElementById("friendsCommentInput"));
            _restorePh(document.getElementById("icityDetailCommentInput"));
          }, 50);
        });
      }
    });
  }

  function _installRenderRouter() {
    function route(orig) {
      return function () {
        if (window.__wbTab === "sticker") {
          _wbPanelShow("sticker");
          renderStickerTab();
          return;
        }
        if (window.__wbTab === "survey") {
          _wbPanelShow("survey");
          renderSurveyWbTab();
          return;
        }
        _wbPanelShow(window.__wbTab);
        return orig.apply(this, arguments);
      };
    }
    var origList = window.__wbRenderList;
    if (typeof origList === "function" && !origList.__akiniRouted) {
      var routedList = route(origList);
      routedList.__akiniRouted = 1;
      window.__wbRenderList = routedList;
    }
    var origWb = window.renderWordbank;
    if (typeof origWb === "function" && !origWb.__akiniRouted) {
      var routedWb = route(origWb);
      routedWb.__akiniRouted = 1;
      window.renderWordbank = routedWb;
    }
  }

  var _initDone = false;
  function _init() {
    if (_initDone) return;
    _initDone = true;
    _installRenderRouter();
    _bindTabs();
    _bindAdd();
    _bindDeleteSheet();
    _bindPickPanel();
    _bindStickerBtns();
    _bindStickerToolbar();
    _syncTab();
    /* 轻量模式下延迟到真正打开表情包 tab 再全量水合；
       但聊天里的表情包选择器需要当前角色的数据，这里只预读当前角色这一份。 */
    if (!(window.__AKINI_STANDALONE || window.__AKINI_SAFE_MODE)) {
      _hydrateStickers();
    } else {
      try {
        var _lc = _getCid();
        var _lk = _lc ? _stkKey(_lc) : "";
        if (_lk && window._idbStore && typeof window._idbStore.get === "function") {
          window._idbStore.get(_lk, function (v) {
            try {
              if (!v) return;
              var a = JSON.parse(v);
              if (!Array.isArray(a) || !a.length) return;
              window.__csCache = window.__csCache || {};
              window.__csCache[_lk] = a;
            } catch (ePL) {}
          });
        }
      } catch (eLP) {}
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _init);
  else _init();
  setTimeout(_init, 800);
})();
