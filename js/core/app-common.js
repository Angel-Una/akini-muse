/* ============================================================
 * Akini 小说 & 陪伴 模块
 * 小说：导入 txt / 书架 3 列 / 长按换封面改名 / 选人共读 / 阅读页头像栏 + 三点菜单
 *       （背景、字号、翻页方式：下滑滚动 / 左右翻页；深色背景自动浅字）
 * 陪伴：选人（复刻网易云一起听）→ 双方头像 + 波形爱心 + 浅粉动态环 + 陪伴计时
 *       + 双方消息区（顶部渐变）+ 消息/表情线条输入栏 + ⋮（换背景带浅黑蒙层/退出）
 * ============================================================ */
(function () {
  "use strict";

  /* ---------- 通用工具 ---------- */
  function $(id) {
    return document.getElementById(id);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function idbSet(k, v) {
    try {
      window._idbStore && window._idbStore.set(k, v, function () {});
    } catch (e) {}
  }
  function idbGet(k, cb) {
    try {
      if (window._idbStore && window._idbStore.get) {
        window._idbStore.get(k, function (v) {
          cb(v == null ? null : v);
        });
        return;
      }
    } catch (e) {}
    cb(null);
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  function lsGet(k, d) {
    try {
      var v = localStorage.getItem(k);
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  }
  function isImgSrc(s) {
    return typeof s === "string" && /^(data:|https?:|blob:)/.test(s);
  }
  /* 头像渲染统一走主程序 nt()：默认头像（空/emoji/文字）→ 线条人像 SVG，真实图片 → img（全局约定） */
  function avatarInner(url) {
    if (window.nt) {
      try {
        return window.nt(url || "", 40);
      } catch (e) {}
    }
    if (!isImgSrc(url) && window.__akiniLineAvatarImg) return window.__akiniLineAvatarImg();
    if (isImgSrc(url))
      return '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    return "";
  }
  function myAvatar() {
    var a = lsGet("akini_my_avatar", "");
    if (!a && window.__akiniAvatarCache && window.__akiniAvatarCache.my) a = window.__akiniAvatarCache.my;
    return a || "\uD83D\uDC31";
  }
  function contacts() {
    try {
      return window.akiniContacts && window.akiniContacts.getContacts ? window.akiniContacts.getContacts() || [] : [];
    } catch (e) {
      return [];
    }
  }
  function contactById(id) {
    try {
      return window.akiniContacts && window.akiniContacts.getContactById
        ? window.akiniContacts.getContactById(id)
        : null;
    } catch (e) {
      return null;
    }
  }
  function goHome() {
    try {
      window.navTo("home");
    } catch (e) {
      var h = $("homeArea");
      if (h) h.style.display = "flex";
    }
  }
  function openSheet(id) {
    var e = $(id);
    if (!e) return;
    if (e.parentNode !== document.body) {
      try {
        document.body.appendChild(e);
      } catch (err) {}
    }
    e.style.display = "flex";
  }
  function closeSheet(id) {
    var e = $(id);
    if (e) e.style.display = "none";
  }

  /* ============================================================
   * 一、陪伴
   * ============================================================ */
  var COMPANION_KEY = "akini_companion_state";
  var COMPANION_BG_KEY = "akini_companion_bg";
  var _companionSel = null;
  var _companionTimer = null;
  var _companionBg = ""; /* 内存缓存，进入时从 IDB 读 */

  /* 陪伴状态解析缓存：一条含图消息可达上百 KB，若每次渲染都 JSON.parse
     整段历史，内存会周期性翻倍（低端机闪退主因之一）。raw 字符串不变时复用结果。 */
  var _cStateRaw = null,
    _cStateCache = null;
  var COMPANION_RENDER_MAX = 80; /* 只渲染最近 80 条，旧消息仍在存储里 */
  var COMPANION_KEEP_MAX = 200; /* 存储最多保留 200 条，防止无限增长吃满配额 */
  function companionState() {
    try {
      var raw = lsGet(COMPANION_KEY, "null");
      if (raw === _cStateRaw) return _cStateCache;
      var v = JSON.parse(raw);
      _cStateRaw = raw;
      _cStateCache = v;
      return v;
    } catch (e) {
      return null;
    }
  }
  function saveCompanionState(st) {
    try {
      if (st && st.msgs && st.msgs.length > COMPANION_KEEP_MAX) {
        st.msgs = st.msgs.slice(-COMPANION_KEEP_MAX);
      }
    } catch (e) {}
    _cStateRaw = null;
    _cStateCache = st;
    var str = "";
    try {
      str = JSON.stringify(st);
    } catch (e) {
      return;
    }
    /* localStorage 5MB 硬上限：陪伴历史里的图片 base64 一旦把配额写爆，
       后续所有写入都会失败（表现为"闪退/数据丢失"）。超过 3MB 时从最旧的
       图片开始丢弃，只保留文字，确保设置、联系人等关键数据永远写得进去。 */
    var LIMIT = 3 * 1024 * 1024;
    try {
      var ms = (st && st.msgs) || [];
      for (var i = 0; i < ms.length && str.length > LIMIT; i++) {
        var m = ms[i];
        if (m && m.img && String(m.img).length > 20000) {
          delete m.img;
          m.imgGone = true;
          str = JSON.stringify(st);
        }
      }
    } catch (eT) {}
    lsSet(COMPANION_KEY, str);
  }

  function fmtDur(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      ss = s % 60;
    function p(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return p(h) + ":" + p(m) + ":" + p(ss);
  }

  function showCompanionView(view) {
    var pv = $("companionPickerView"),
      mv = $("companionMainView");
    if (pv) pv.style.display = view === "picker" ? "flex" : "none";
    if (mv) mv.style.display = view === "main" ? "flex" : "none";
  }

  function applyCompanionBg() {
    var layer = $("companionBgLayer"),
      dim = $("companionBgDim");
    if (!layer || !dim) return;
    var app = $("app-companion");
    if (isImgSrc(_companionBg)) {
      layer.style.backgroundImage = "url(" + _companionBg + ")";
      layer.style.display = "block";
      dim.style.display = "block"; /* 更换背景图后整体带一层浅黑色 */
      if (app) app.classList.add("hasBg"); /* 气泡切自定义背景适配样式 */
    } else {
      layer.style.display = "none";
      dim.style.display = "none";
      if (app) app.classList.remove("hasBg"); /* 默认背景用默认气泡 */
    }
  }

  function renderCompanionMsgs(scrollBottom) {
    var box = $("companionMsgs");
    if (!box) return;
    var st = companionState();
    var msgs = (st && st.msgs) || [];
    if (!msgs.length) {
      box.innerHTML =
        '<div style="text-align:center;color:#bbb;font-size:13px;padding:26px 0 0;line-height:1.8">陪伴开始啦<br>在下面发条消息给对方吧~</div>';
      return;
    }
    /* 陪伴气泡不显示头像，仅消息内容居中。窗口化：只渲染最近 80 条 */
    box.innerHTML = "";
    var _start = msgs.length > COMPANION_RENDER_MAX ? msgs.length - COMPANION_RENDER_MAX : 0;
    msgs.slice(_start).forEach(function (m) {
      var me = m.side === "me";
      var row = document.createElement("div");
      row.className = "msg-row " + (me ? "me" : "other");
      row.setAttribute("data-ts", String(m.ts || Date.now()));
      row.style.paddingLeft = "0";
      row.style.paddingRight = "0";
      var bubbleHtml = m.img
        ? '<div class="bubble sticker-bubble" style="background:transparent;padding:0;box-shadow:none;border:none;"><img src="' +
          esc(m.img) +
          '" style="max-width:120px;max-height:120px;border-radius:8px;display:block;" loading="lazy" decoding="async" alt=""/></div>'
        : m.imgGone
          ? '<div class="bubble">[图片已清理]</div>'
          : '<div class="bubble">' + esc(m.text || "") + "</div>";
      row.innerHTML = '<div class="msg-content-line">' + bubbleHtml + "</div>";
      /* 引用：与主聊天一致，气泡下方整宽引用卡（我→右对齐，对方→左对齐） */
      if (m.quote && window.__akiniQuoteCardHtml) {
        row.innerHTML +=
          '<div style="flex-basis:100%;width:100%;box-sizing:border-box;margin-top:2px;text-align:' +
          (me ? "right" : "left") +
          ';">' +
          window.__akiniQuoteCardHtml(m.quote.n, m.quote.t, m.quote.s, m.quote.mh) +
          "</div>";
      }
      box.appendChild(row);
      try {
        window.__akiniProcessMsgMeta(row);
      } catch (e) {}
    });
    if (scrollBottom !== false) box.scrollTop = box.scrollHeight;
  }

  /* 陪伴历史存储 key */
  var COMPANION_HISTORY_KEY = "akini_companion_history";

  function companionHistory() {
    try {
      return JSON.parse(lsGet(COMPANION_HISTORY_KEY, "[]")) || [];
    } catch (e) {
      return [];
    }
  }
  function saveCompanionHistory(arr) {
    lsSet(COMPANION_HISTORY_KEY, JSON.stringify(arr));
  }

  function pushCompanionHistory(st) {
    /* st: { cid, ts, msgs } → 记录对象名/时长/消息条数 */
    if (!st || !st.cid) return;
    var c = contactById(st.cid);
    var name = c ? c.name || "未命名" : "对方";
    var durMs = Date.now() - (st.ts || Date.now());
    var msgs = st.msgs || [];
    var msgCount = msgs.length;
    /* 聊天记录总结：取最后一条文本消息片段，无文本则显示条数 */
    var summary = "";
    for (var i = msgs.length - 1; i >= 0; i--) {
      var m = msgs[i];
      if (m && m.text && String(m.text).trim()) {
        summary = String(m.text).trim();
        break;
      }
    }
    if (!summary) summary = "共" + msgCount + "条消息";
    else if (summary.length > 30) summary = summary.substring(0, 30) + "…";
    var arr = companionHistory();
    var content = "";
    try {
      content = localStorage.getItem("akini_companion_content") || "";
    } catch (e) {}
    arr.unshift({
      cid: st.cid,
      name: name,
      avatar: c ? c.avatar || "" : "",
      duration: durMs,
      msgCount: msgCount,
      startTs: st.ts,
      endTs: Date.now(),
      summary: summary,
      content: content,
    });
    /* 最多保留 100 条 */
    if (arr.length > 100) arr.length = 100;
    saveCompanionHistory(arr);
  }

  function renderCompanionHistory() {
    var list = $("companionHistoryList");
    if (!list) return;
    var arr = companionHistory();
    if (!arr.length) {
      list.innerHTML =
        '<div style="text-align:center;color:#bbb;font-size:14px;padding:60px 0;line-height:1.8">暂无陪伴历史</div>';
      return;
    }
    list.innerHTML = arr
      .map(function (h) {
        var dur = fmtDur(h.duration || 0);
        var d = h.startTs ? new Date(h.startTs) : null;
        var dateStr = d
          ? d.getMonth() +
            1 +
            "月" +
            d.getDate() +
            "日 " +
            ("0" + d.getHours()).slice(-2) +
            ":" +
            ("0" + d.getMinutes()).slice(-2)
          : "";
        /* 头像按联系人 id 实时解析：退出陪伴时存下的 h.avatar 可能是空串
         （联系人头像存于 akini_contact_avatar_<id>，载入时机晚于历史归档），
         直接用 getTaAvatar 走与聊天列表一致的解析路径，避免永远显示默认头像。 */
        var avHtml = "";
        try {
          if (window.getTaAvatar) avHtml = window.getTaAvatar(h.cid);
        } catch (e) {}
        if (!avHtml) avHtml = avatarInner(h.avatar);
        return (
          '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0">' +
          '<div style="width:44px;height:44px;border-radius:50%;background:#e8e8e8;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">' +
          avHtml +
          "</div>" +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:15px;font-weight:600;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
          esc(h.name) +
          "</div>" +
          '<div style="font-size:12px;color:#999;margin-top:2px">' +
          esc(dateStr) +
          "</div>" +
          (h.summary
            ? '<div style="font-size:12px;color:#666;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
              esc(h.summary) +
              "</div>"
            : "") +
          "</div>" +
          '<div style="text-align:right;flex-shrink:0">' +
          '<div style="font-size:13px;color:#666">' +
          dur +
          "</div>" +
          '<div style="font-size:12px;color:#999;margin-top:2px">' +
          (h.msgCount || 0) +
          " 条聊天记录</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function startCompanion(cid) {
    /* 距离只在开启陪伴时随机生成一次（0-1000），随会话固化保存；
       退出陪伴后下次开启才重新随机；计时每次从 0 开始（不累计） */
    /* 距离 0-100 米，保留一位小数 */
    var st = { cid: cid, ts: Date.now(), msgs: [], dist: Math.round(Math.random() * 1000) / 10 };
    saveCompanionState(st);
    enterCompanionMain(st);
  }

  /* 陪伴界面与首页聊天预览、双人头像、一起听（含总结卡片/详情）共用「交换双方头像位置」开关，
     开启时左右头像互换，关闭时还原；开关切换后由 __akiniRefreshCompanionAvatars 即时刷新 */
  function companionSwapped() {
    try {
      return !!window.isSwapped();
    } catch (e) {
      return false;
    }
  }
  function applyCompanionAvatars(c) {
    var myA = $("companionMyAvatar"),
      taA = $("companionTaAvatar");
    var mine = avatarInner(myAvatar()),
      other = avatarInner(c ? c.avatar : "");
    var sw = companionSwapped();
    if (myA) myA.innerHTML = sw ? other : mine;
    if (taA) taA.innerHTML = sw ? mine : other;
  }
  window.__akiniRefreshCompanionAvatars = function () {
    try {
      var st = companionState();
      if (!st || !st.cid) return;
      applyCompanionAvatars(contactById(st.cid));
    } catch (e) {}
  };

  function enterCompanionMain(st) {
    var c = contactById(st.cid);
    var name = c ? c.name || "未命名" : "对方";
    applyCompanionAvatars(c);
    var dd = $("companionDistance");
    if (dd) {
      if (typeof st.dist !== "number" || isNaN(st.dist)) {
        st.dist = Math.round(Math.random() * 1000) / 10;
        saveCompanionState(st);
      }
      dd.textContent = "TA距离你" + st.dist.toFixed(1) + "米";
    }
    applyCompanionBg();
    renderCompanionMsgs(false);
    showCompanionView("main");
    if (_companionTimer) {
      clearInterval(_companionTimer);
      _companionTimer = null;
    }
    var timerEl = $("companionTimer");
    var tick = function () {
      var cur = companionState();
      if (!cur) {
        if (timerEl) timerEl.textContent = "00:00:00";
        return;
      }
      if (timerEl) timerEl.textContent = fmtDur(Date.now() - cur.ts);
    };
    tick();
    _companionTimer = setInterval(tick, 1000);
  }

  function endCompanion() {
    /* 退出前归档陪伴历史（对象/时长/消息条数），再清空状态 */
    var st = companionState();
    if (st && st.cid) pushCompanionHistory(st);
    lsSet(COMPANION_KEY, '{"cleared":true}');
    if (_companionTimer) {
      clearInterval(_companionTimer);
      _companionTimer = null;
    }
    _companionSel = null;
    closeSheet("companionMenuSheet");
    /* 退出陪伴后回到「开始陪伴」首页，不回手机首页（和退出一起听行为一致） */
    try {
      var compApp = document.getElementById("app-companion");
      if (compApp) {
        compApp.style.display = "none";
        compApp.classList.remove("show");
      }
    } catch (e) {}
    if (typeof window.__akiniShowCompanionHome === "function") {
      window.__akiniShowCompanionHome();
    } else {
      var compHome = document.getElementById("companionHomeOverlay");
      if (compHome) compHome.style.display = "flex";
    }
  }

  function companionStickerPool(cid) {
    /* 该联系人专属表情包（与观影 watchStickerPool 同数据源 getContactStickersSync） */
    var out = [];
    try {
      if (typeof window.__akiniStickerSrcs === "function") {
        out = window.__akiniStickerSrcs(cid);
      } else {
        var own = window.getContactStickersSync(cid);
        (Array.isArray(own) ? own : []).forEach(function (it) {
          var s2 = "";
          if (typeof it === "string") s2 = it;
          else if (it && typeof it.s === "string") s2 = it.s;
          var blocked = it && typeof it === "object" && (it.b === 1 || it.b === true || it.b === "1");
          if (!blocked && /^data:image\//.test(s2)) out.push(s2);
        });
      }
    } catch (e) {}
    return out;
  }
  function showCompanionTyping() {
    /* 微信一致正在输入：消息区左下角、无头像、仅三点气泡 */
    var box = $("companionMsgs");
    if (!box || $("companionTyping")) return;
    var t = document.createElement("div");
    t.id = "companionTyping";
    t.className = "akcp-typing";
    t.innerHTML = '<span class="wt-dot"></span><span class="wt-dot"></span><span class="wt-dot"></span>';
    box.appendChild(t);
    box.scrollTop = box.scrollHeight;
  }
  function hideCompanionTyping() {
    var t = $("companionTyping");
    if (t) t.remove();
  }
  function scheduleCompanionReply(cid) {
    /* 回复节奏照搬微信/观影：设置页回复延迟范围（默认 2~5s）
       输入动态改为发消息后 ~0.4s 立即出现（微信真实体验是秒出），回复仍按延迟范围送达 */
    var dMin = parseFloat(lsGet("akini_num_replyDelayMin", "2"));
    var dMax = parseFloat(lsGet("akini_num_replyDelayMax", "5"));
    if (!(dMin >= 0)) dMin = 2;
    if (!(dMax >= dMin)) dMax = Math.max(dMin, 5);
    var delayMs = 1000 * (dMin + Math.random() * (dMax - dMin));
    setTimeout(function () {
      if (companionState()) showCompanionTyping();
    }, 400);
    setTimeout(function () {
      hideCompanionTyping();
      var cur = companionState();
      if (!cur) return;
      /* 表情包：概率与 原生 聊天一致（20%），仅用该联系人自己的专属收藏，裸图无气泡 */
      var stkProb = 0.2;
      if (Math.random() < stkProb) {
        var pool = companionStickerPool(cur.cid);
        if (pool.length) {
          cur.msgs = cur.msgs || [];
          cur.msgs.push({ side: "ta", img: pool[Math.floor(Math.random() * pool.length)], ts: Date.now() });
          saveCompanionState(cur);
          renderCompanionMsgs(true);
          __notifyCompanionMsg(cur.cid, "[表情包]");
          return;
        }
      }
      /* 文本回复：从该联系人字卡库抽取 */
      var t = "";
      try {
        t = window.pickWordCards ? window.pickWordCards(1, cur.cid) : "";
      } catch (e) {}
      t = (t || "").split("\n")[0].trim();
      if (!t) return;
      cur.msgs = cur.msgs || [];
      cur.msgs.push({ side: "ta", text: t, ts: Date.now() });
      saveCompanionState(cur);
      renderCompanionMsgs(true);
      __notifyCompanionMsg(cur.cid, t);
    }, delayMs);
  }
  /* 用户不在陪伴界面时，联系人消息触发局内通知（内部自动处理后台系统通知），与微信聊天一致 */
  function __notifyCompanionMsg(cid, msg) {
    try {
      var mv = $("companionMainView");
      var hidden = !mv || mv.style.display === "none";
      if (typeof window.showInAppNotif !== "function") return;
      var cc = getContactById(cid);
      /* 陪伴里每条消息都要有提示，界面开着也弹；只有不在界面时计未读角标 */
      if (hidden) {
        try {
          window.__akiniIncrFeatureUnread && window.__akiniIncrFeatureUnread("companion");
        } catch (eU) {}
      }
      window.showInAppNotif({
        app: "陪伴",
        appIcon: "🎧",
        avatar: (cc && cc.avatar) || "",
        name: (cc && cc.name) || "陪伴对象",
        fullContent: true,
        msg: msg || "",
        onTap: function () {
          try {
            window.__openCompanion && window.__openCompanion();
          } catch (e0) {}
        },
      });
    } catch (e) {}
  }
  function sendCompanionMsg(imgUrl) {
    var st = companionState();
    if (!st) return;
    var input = $("companionMsgInput");
    var v = imgUrl ? "" : ((input && input.value) || "").trim();
    if (!imgUrl && !v) return;
    /* 引用：读取输入框上的 data-quote（长按消息"引用"写入），随消息存到 quote 字段 */
    var quote = null;
    if (!imgUrl && input && input.getAttribute("data-quote")) {
      var q = input.getAttribute("data-quote") || "";
      var qn = q.replace(/[：:].*/, "").trim() || q;
      var qt = q.length > qn.length ? q.slice(qn.length).replace(/^[：:]/, "").trim() : "";
      quote = {
        n: qn,
        t: qt,
        s: input.getAttribute("data-quote-sticker") || "",
        mh: input.getAttribute("data-quote-sticker-mh") || "",
      };
    }
    st.msgs = st.msgs || [];
    st.msgs.push(
      imgUrl
        ? { side: "me", img: imgUrl, ts: Date.now() }
        : { side: "me", text: v, ts: Date.now(), quote: quote },
    );
    saveCompanionState(st);
    if (input) {
      input.value = "";
      (input.removeAttribute("data-quote"),
        input.removeAttribute("data-quote-sticker"),
        input.removeAttribute("data-quote-sticker-mh"),
        (input.placeholder = input.__origPh || "说点什么…"));
      var qb = $("companionQuoteBar");
      qb && qb.classList.remove("show");
    }
    renderCompanionMsgs(true);
    scheduleCompanionReply(st.cid);
  }

  window.__openCompanion = function () {
    idbGet(COMPANION_BG_KEY, function (v) {
      _companionBg = v || "";
      applyCompanionBg();
    });
    /* 会话保持（与一起听一致）——存在进行中的陪伴会话时直接回到陪伴主界面，
       切出/返回/刷新都不重置；仅「退出陪伴」主动操作才清除会话回选人页 */
    var st = companionState();
    if (st && st.cid && contactById(st.cid)) {
      enterCompanionMain(st);
      return;
    }
    var d = window.__akiniDefaultContact && window.__akiniDefaultContact();
    if (d) {
      _companionSel = d.id;
      startCompanion(d.id);
      return;
    }
    _companionSel = null;
    goHome();
  };
  window.companionState = companionState;

  function bindCompanion() {
    var back1 = $("companionBackBtn"),
      back2 = $("companionMainBackBtn");
    var confirm = $("companionConfirmBtn");
    var histBtn = $("companionHistoryBtn");
    var histClose = $("companionHistoryClose");
    var histOverlay = $("companionHistoryOverlay");
    var menuBtn = $("companionMenuBtn");
    var menuCancel = $("companionMenuCancel");
    var menuSheet = $("companionMenuSheet");
    var actBg = $("companionActBg");
    var actBgReset = $("companionActBgReset");
    var actExit = $("companionActExit");
    var bgInput = $("companionBgInput");
    var msgInput = $("companionMsgInput");
    var emojiBtn = $("companionEmojiBtn");
    var emojiSheet = $("companionEmojiSheet");
    var emojiGrid = $("companionEmojiGrid");

    if (back1) back1.addEventListener("click", goHome);
    if (back2) back2.addEventListener("click", goHome);
    if (histBtn)
      histBtn.addEventListener("click", function () {
        renderCompanionHistory();
        openSheet("companionHistoryOverlay");
      });
    if (histClose)
      histClose.addEventListener("click", function () {
        closeSheet("companionHistoryOverlay");
      });
    if (histOverlay)
      histOverlay.addEventListener("click", function (e) {
        if (e.target === histOverlay) closeSheet("companionHistoryOverlay");
      });
    if (confirm)
      confirm.addEventListener("click", function () {
        if (!_companionSel) return;
        startCompanion(_companionSel);
      });

    if (menuBtn)
      menuBtn.addEventListener("click", function () {
        openSheet("companionMenuSheet");
      });
    if (menuCancel)
      menuCancel.addEventListener("click", function () {
        closeSheet("companionMenuSheet");
      });
    if (menuSheet)
      menuSheet.addEventListener("click", function (e) {
        if (e.target === menuSheet) closeSheet("companionMenuSheet");
      });
    if (actBg)
      actBg.addEventListener("click", function () {
        closeSheet("companionMenuSheet");
        if (bgInput) bgInput.click();
      });
    if (actBgReset)
      actBgReset.addEventListener("click", function () {
        closeSheet("companionMenuSheet");
        _companionBg = "";
        idbSet(COMPANION_BG_KEY, "");
        applyCompanionBg();
      });
    if (actExit) actExit.addEventListener("click", endCompanion);
    if (bgInput)
      bgInput.addEventListener("change", function () {
        var f = this.files && this.files[0];
        this.value = "";
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          shrinkImage(fr.result, 750, 1334, function (url) {
            _companionBg = url;
            idbSet(COMPANION_BG_KEY, url);
            applyCompanionBg();
          });
        };
        fr.readAsDataURL(f);
      });

    if (msgInput)
      msgInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          sendCompanionMsg();
        }
      });

    if (emojiBtn)
      emojiBtn.addEventListener("click", function () {
        /* 与主聊天表情面板同款（头像横滑条 + 52px 流式小图），贴在输入栏上方 */
        if (typeof window.__openStickerPickPanel === "function")
          window.__openStickerPickPanel(function (src) {
            sendCompanionMsg(src);
          }, emojiBtn.parentElement);
      });
    if (emojiSheet)
      emojiSheet.addEventListener("click", function (e) {
        if (e.target === emojiSheet) closeSheet("companionEmojiSheet");
      });
  }

  /* ============================================================
   * 二、小说
   * ============================================================ */
  var BOOKS_KEY = "akini_novel_books";
  var CONTENT_PREFIX = "akini_novel_content_";
  var PROGRESS_PREFIX = "akini_novel_progress_";
  var PAGEPROG_PREFIX = "akini_novel_pageprog_";
  var SETTING_KEY = "akini_novel_reader_settings";

  var _books = [];
  var _booksLoaded = false;
  var _curBook = null;
  var _readerContact = null;
  var _readerContacts = []; /* 共读多选 */
  var _readerParas = [];
  var _readerIdx = 0;
  var _readerChapters = []; /* 当前书籍章节索引列表 [{title,pidx}] */
  var RENDER_CHUNK = 120;

  var COVER_GRADS = [
    ["#3a3a3a", "#161616"],
    ["#5c5c5c", "#2b2b2b"],
    ["#e9e9e6", "#cfcfc9"],
    ["#1c1c1c", "#000000"],
    ["#d7d7d2", "#a9a9a3"],
    ["#4a4a4a", "#202020"],
  ];
  var DARK_BG = "#2a2a2e";

  function saveBooks() {
    var payload = JSON.stringify(_books);
    /* 书架 JSON 双写：IDB + localStorage */
    try {
      idbSet(BOOKS_KEY, payload);
    } catch (e) {}
    try {
      window._idbStore && window._idbStore.flush && window._idbStore.flush();
    } catch (e) {}
    try {
      lsSet(BOOKS_KEY, payload);
    } catch (e) {
      /* localStorage 配额已满时，至少保证 IDB 已成功写入，不抛错 */
    }
  }

  function loadBooks(cb) {
    if (_booksLoaded) {
      cb();
      return;
    }
    var _done = function (stored) {
      try {
        if (!Array.isArray(stored)) stored = [];
        /* 异步读回的是导入前的旧快照，而内存里可能已有刚 push 的新书——
           合并去重而不是直接覆盖，防止"首次导入后书架空白、重启才出现" */
        if (_books && _books.length) {
          var seen = {};
          stored.forEach(function (b) {
            if (b && b.id) seen[b.id] = 1;
          });
          _books.forEach(function (b) {
            if (b && b.id && !seen[b.id]) stored.push(b);
          });
        }
        _books = stored;
      } catch (e) {
        if (!Array.isArray(_books)) _books = [];
      }
      _booksLoaded = true;
      cb();
    };
    idbGet(BOOKS_KEY, function (v) {
      try {
        var arr = v ? JSON.parse(v) : null;
        if (Array.isArray(arr) && arr.length) {
          _done(arr);
          return;
        }
      } catch (e) {}
      /* IDB 未读到/为空时，读 localStorage 兜底 */
      try {
        var ls = lsGet(BOOKS_KEY, "");
        var arr2 = ls ? JSON.parse(ls) : null;
        if (Array.isArray(arr2) && arr2.length) {
          _done(arr2);
          return;
        }
      } catch (e) {}
      _done([]);
    });
  }

  function defaultCover(b) {
    var h = 0;
    for (var i = 0; i < b.title.length; i++) h = (h * 31 + b.title.charCodeAt(i)) >>> 0;
    var g = COVER_GRADS[h % COVER_GRADS.length];
    var light = "#e9e9e6" === g[0] || "#d7d7d2" === g[0],
      ink = light ? "rgba(24,24,22,.92)" : "rgba(246,246,243,.94)",
      bar = light ? "rgba(24,24,22,.28)" : "rgba(246,246,243,.35)";
    return (
      '<div class="aknv-cover" style="width:100%;height:100%;background:linear-gradient(150deg,' +
      g[0] +
      "," +
      g[1] +
      ');display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;box-sizing:border-box">' +
      '<div style="font-size:14px;font-weight:700;color:' +
      ink +
      ';text-align:center;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-all">' +
      esc(b.title) +
      "</div>" +
      '<div style="margin-top:6px;width:24px;height:2px;background:' +
      bar +
      ';border-radius:1px"></div>' +
      "</div>"
    );
  }

  window.__renderNovelShelf = function () {
    loadBooks(function () {
      var grid = $("novelShelfGrid");
      var tip = $("novelEmptyTip");
      if (!grid) return;
      if (tip) tip.style.display = _books.length ? "none" : "block";
      grid.innerHTML = _books
        .map(function (b) {
          var cover = isImgSrc(b.cover)
            ? '<img src="' + esc(b.cover) + '" style="width:100%;height:100%;object-fit:cover;">'
            : defaultCover(b);
          return (
            '<div class="aknv-book" data-bid="' +
            esc(b.id) +
            '" style="cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none">' +
            '<div style="width:100%;aspect-ratio:3/4;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.12);background:#eee">' +
            cover +
            "</div>" +
            '<div style="margin-top:6px;font-size:13px;color:#333;text-align:center;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-all">' +
            esc(b.title) +
            "</div>" +
            "</div>"
          );
        })
        .join("");
      bindBookEvents(grid);
    });
  };

  function bindBookEvents(grid) {
    Array.prototype.forEach.call(grid.querySelectorAll(".aknv-book"), function (el) {
      var lpTimer = null,
        longFired = false;
      var start = function () {
        longFired = false;
        var bid = el.getAttribute("data-bid");
        lpTimer = setTimeout(function () {
          longFired = true;
          if (_manageMode) return;
          _curBook =
            _books.filter(function (b) {
              return b.id === bid;
            })[0] || null;
          if (_curBook) openSheet("novelBookActions");
          try {
            if (navigator.vibrate) navigator.vibrate(30);
          } catch (e) {}
        }, 600);
      };
      var cancel = function () {
        if (lpTimer) {
          clearTimeout(lpTimer);
          lpTimer = null;
        }
      };
      el.addEventListener("touchstart", start, { passive: true });
      el.addEventListener("touchend", cancel);
      el.addEventListener("touchmove", cancel);
      el.addEventListener("mousedown", start);
      el.addEventListener("mouseup", cancel);
      el.addEventListener("mouseleave", cancel);
      el.addEventListener("click", function () {
        if (longFired) {
          longFired = false;
          return;
        }
        if (_manageMode) {
          openEditBook(el.getAttribute("data-bid"));
          return;
        }
        var bid = el.getAttribute("data-bid");
        _curBook =
          _books.filter(function (b) {
            return b.id === bid;
          })[0] || null;
        if (_curBook) openNovelPicker();
      });
    });
  }

  /* ---------- 导入 txt ---------- */
  function decodeText(buf) {
    var u8 = new Uint8Array(buf);
    if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) u8 = u8.subarray(3);
    if (u8.length >= 2 && ((u8[0] === 0xff && u8[1] === 0xfe) || (u8[0] === 0xfe && u8[1] === 0xff))) {
      try {
        return new TextDecoder("utf-16").decode(u8);
      } catch (e0) {}
    }
    /* 分块流式解码——大文件一次性 decode 会在低端机产生巨大内存峰值导致页面卡死/崩溃，
       按 4MB 分块 stream 解码，多字节字符跨块由 TextDecoder 自动处理 */
    function streamDecode(u8d, enc, fatal) {
      var dec = fatal ? new TextDecoder(enc, { fatal: true }) : new TextDecoder(enc);
      var CH = 4 * 1024 * 1024,
        out = "";
      for (var i = 0; i < u8d.length; i += CH) {
        out += dec.decode(u8d.subarray(i, Math.min(i + CH, u8d.length)), { stream: true });
      }
      return out + dec.decode();
    }
    try {
      return streamDecode(u8, "utf-8", true);
    } catch (e) {}
    try {
      return streamDecode(u8, "gb18030", false);
    } catch (e2) {}
    try {
      return streamDecode(u8, "utf-8", false);
    } catch (e3) {
      return "";
    }
  }

  /* 书籍信息里保存/读取章节缓存，切换书籍后章节列表立即可用 */
  var CHAPTER_CACHE_PREFIX = "akini_novel_chapters_";
  function cacheChapters(bookId, chapters) {
    try {
      idbSet(CHAPTER_CACHE_PREFIX + bookId, JSON.stringify(chapters));
    } catch (e) {}
    try {
      window._idbStore && window._idbStore.flush && window._idbStore.flush();
    } catch (e) {}
  }

  function importNovel(file) {
    if (!file) return;
    /* 超大文件护栏——超过 120MB 的 txt 在手机上必然内存崩溃，直接拒绝并明确提示，绝不卡崩 */
    if (file.size > 120 * 1024 * 1024) {
      alert(
        "文件过大（" +
          Math.round(file.size / 1048576) +
          "MB），超过 120MB 无法导入\n请把小说拆分成多个小文件后分别导入",
      );
      return;
    }
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var txt = decodeText(fr.result) || "";
        txt = txt.replace(/^﻿/, "").trim();
        if (!txt) {
          alert("导入失败：文件内容为空或无法识别");
          return;
        }
        var title = (file.name || "未命名").replace(/\.[^.]+$/, "") || "未命名";
        var id = "nv" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
        var book = { id: id, title: title, cover: "", fileName: file.name, addedAt: Date.now() };
        _books.push(book);
        saveBooks();
        idbSet(CONTENT_PREFIX + id, txt);
        /* 导入时立即解析章节并缓存 */
        var tmpParas = txt
          .split(/\r\n|\r|\n/)
          .map(function (p) {
            return p.trim();
          })
          .filter(function (p) {
            return p !== "";
          });
        var chs = parseChapters(tmpParas);
        cacheChapters(id, chs);
        window.__renderNovelShelf();
      } catch (e) {
        alert("导入失败：" + (e && e.message ? e.message : "文件解析出错"));
      }
    };
    fr.onerror = function () {
      alert("导入失败：文件读取失败");
    };
    fr.readAsArrayBuffer(file);
  }

  /* ---------- 封面/背景图压缩 ---------- */
  function shrinkImage(dataUrl, maxW, maxH, cb) {
    cb(dataUrl);
  }

  /* ---------- 选人共读弹层 ---------- */
  function openNovelPicker() {
    var d = window.__akiniDefaultContact && window.__akiniDefaultContact();
    if (d) {
      _readerContact = d.id;
      _readerContacts = [d.id];
      openReader();
      return;
    }
    _readerContact = null;
    _readerContacts = [];
    renderNovelPickerList();
    openSheet("novelPickerOverlay");
  }

  function renderNovelPickerList() {
    var list = $("novelPickerList");
    if (!list) return;
    var cs = contacts();
    if (!cs.length) {
      list.innerHTML =
        '<div style="text-align:center;color:#999;font-size:14px;padding:40px 0;line-height:1.8">暂无联系人</div>';
      return;
    }
    list.innerHTML = cs
      .map(function (c) {
        var on = _readerContacts.indexOf(c.id) >= 0;
        return (
          '<div class="aknv-item" data-cid="' +
          esc(c.id) +
          '" style="display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;-webkit-tap-highlight-color:transparent">' +
          '<div style="width:22px;height:22px;border-radius:50%;border:2px solid ' +
          (on ? "#1a1a1a" : "#ddd") +
          ";background:" +
          (on ? "#1a1a1a" : "#fff") +
          ';color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          (on ? "\u2713" : "") +
          "</div>" +
          '<div style="width:40px;height:40px;border-radius:50%;background:#e8e8e8;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">' +
          avatarInner(c.avatar) +
          "</div>" +
          '<div style="flex:1;min-width:0;font-size:15px;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
          esc(c.name || "未命名") +
          "</div>" +
          "</div>"
        );
      })
      .join("");
    Array.prototype.forEach.call(list.querySelectorAll(".aknv-item"), function (el) {
      el.addEventListener("click", function () {
        var cid = el.getAttribute("data-cid");
        var ix = _readerContacts.indexOf(cid);
        if (ix >= 0) _readerContacts.splice(ix, 1);
        else _readerContacts.push(cid);
        _readerContact = _readerContacts[0] || null;
        renderNovelPickerList();
      });
    });
  }

  /* ---------- 阅读页设置 ---------- */
  function readerSettings() {
    try {
      return JSON.parse(lsGet(SETTING_KEY, "null")) || {};
    } catch (e) {
      return {};
    }
  }
  function saveReaderSettings(s) {
    lsSet(SETTING_KEY, JSON.stringify(s));
  }
  function flipMode() {
    return readerSettings().flip === "page" ? "page" : "scroll";
  }

  function applyReaderSettings() {
    var s = readerSettings();
    var page = $("app-novel-reader");
    var content = $("novelReaderContent");
    var fsEl = $("novelFontSizeValue");
    var fs = Math.min(28, Math.max(14, parseInt(s.fontSize, 10) || 18));
    var dark = s.bgColor === DARK_BG;
    if (content) {
      content.style.fontSize = fs + "px";
      content.style.lineHeight = "1.9";
      /* 深色背景自动切浅色文字，避免黑底看不见 */
      content.style.color = dark ? "#d8d8d8" : "#2b2b2b";
    }
    if (fsEl) fsEl.textContent = String(fs);
    if (page) {
      if (isImgSrc(s.bg)) {
        page.style.background = "#f5f0e8";
        page.style.backgroundImage = "url(" + s.bg + ")";
        page.style.backgroundSize = "cover";
        page.style.backgroundPosition = "center";
        /* 图片背景上叠一层浅色蒙层保证文字可读 */
        page.style.boxShadow = "inset 0 0 0 999px rgba(255,255,255,0.42)";
      } else {
        page.style.backgroundImage = "";
        page.style.background = s.bgColor || "#f5f0e8";
        page.style.boxShadow = "none";
      }
    }
    var row = $("novelBgColors");
    if (row) {
      Array.prototype.forEach.call(row.children, function (el) {
        var c = el.getAttribute("data-color");
        el.style.boxShadow = c === s.bgColor && !isImgSrc(s.bg) ? "0 0 0 2px #1a1a1a" : "none";
      });
    }
    /* 翻页方式按钮态 */
    var bScroll = $("novelFlipScroll"),
      bPage = $("novelFlipPage");
    var isPage = flipMode() === "page";
    if (bScroll) {
      bScroll.style.background = isPage ? "#f8f8f8" : "#1a1a1a";
      bScroll.style.color = isPage ? "#333" : "#fff";
      bScroll.style.border = isPage ? "1px solid #e0e0e0" : "none";
    }
    if (bPage) {
      bPage.style.background = isPage ? "#1a1a1a" : "#f8f8f8";
      bPage.style.color = isPage ? "#fff" : "#333";
      bPage.style.border = isPage ? "none" : "1px solid #e0e0e0";
    }
  }

  /* ---------- 翻页（左右）模式 ---------- */
  var _pagedPages = [];
  var _pagedIdx = 0;

  /* 视口真实分页算法：一次渲染全部段落批量测量（offsetTop 差值含段间距），
     页项记录 {t:文本, p:段落号}，单段超页的按字符二分切块，保证不漏字 */
  function _computePages() {
    _pagedPages = [[]];
    if (!_readerParas.length) return;
    var content = $("novelReaderContent");
    if (!content) return;
    var cs = window.getComputedStyle(content);
    var w = Math.max(50, content.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
    /* 8px 安全边距，防止临界行被 overflow:hidden 裁掉 */
    var maxH = Math.max(60, content.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) - 8);
    var meas = document.createElement("div");
    meas.style.cssText =
      "position:absolute;top:0;left:-9999px;width:" + w + "px;visibility:hidden;box-sizing:border-box;";
    meas.style.fontSize = cs.fontSize;
    meas.style.lineHeight = cs.lineHeight;
    meas.style.fontFamily = cs.fontFamily;
    var pStyle = "margin:0 0 1em;text-indent:2em;word-break:break-all;";
    var html = "";
    for (var i = 0; i < _readerParas.length; i++)
      html += '<p style="' + pStyle + '">' + esc(_readerParas[i]) + "</p>";
    meas.innerHTML = html;
    document.body.appendChild(meas);
    var kids = meas.children;
    var N = kids.length;
    /* 单段超高时用第二个隐藏容器二分切块 */
    var meas2 = document.createElement("div");
    meas2.style.cssText = meas.style.cssText;
    meas2.style.fontSize = cs.fontSize;
    meas2.style.lineHeight = cs.lineHeight;
    meas2.style.fontFamily = cs.fontFamily;
    document.body.appendChild(meas2);
    function pieceH(t) {
      meas2.innerHTML = '<p style="' + pStyle + '">' + esc(t) + "</p>";
      return meas2.firstChild.getBoundingClientRect().height;
    }
    var pages = [],
      cur = [],
      curH = 0;
    function flush() {
      if (cur.length) {
        pages.push(cur);
        cur = [];
        curH = 0;
      }
    }
    function pushItem(t, p, h) {
      if (curH + h > maxH && cur.length) flush();
      cur.push({ t: t, p: p });
      curH += h;
    }
    for (var k = 0; k < N; k++) {
      var el = kids[k];
      var hh = k + 1 < N ? kids[k + 1].offsetTop - el.offsetTop : el.offsetHeight;
      if (el.offsetHeight > maxH) {
        /* 单段超页：字符二分切块，块间正常参与分页 */
        var para = _readerParas[k];
        var start = 0;
        while (start < para.length) {
          var lo = 1,
            hi = para.length - start,
            fit = 1;
          while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (pieceH(para.slice(start, start + mid)) <= maxH) {
              fit = mid;
              lo = mid + 1;
            } else hi = mid - 1;
          }
          var piece = para.slice(start, start + fit);
          pushItem(piece, k, pieceH(piece));
          start += fit;
        }
      } else {
        pushItem(_readerParas[k], k, hh);
      }
    }
    flush();
    if (!pages.length) pages = [[]];
    _pagedPages = pages;
    document.body.removeChild(meas);
    document.body.removeChild(meas2);
  }

  function _renderPaged() {
    var content = $("novelReaderContent");
    var ind = $("novelPageIndicator");
    if (!content || !ind) return;
    content.innerHTML = "";
    content.style.overflowY = "hidden";
    content.style.overflowX = "hidden";

    var pageParas = _pagedPages[_pagedIdx] || [];
    var html = "";
    for (var i = 0; i < pageParas.length; i++) {
      html +=
        '<p data-pidx="' +
        pageParas[i].p +
        '" style="margin:0 0 1em;text-indent:2em;word-break:break-all">' +
        esc(pageParas[i].t) +
        "</p>";
    }
    content.innerHTML = html;
    try {
      window._akiniDecorateCm && window._akiniDecorateCm();
    } catch (e) {}
    ind.textContent = _pagedIdx + 1 + "/" + _pagedPages.length;
    ind.style.display = "block";

    // 滚动到顶部，模拟真实翻页
    content.scrollTop = 0;
  }

  function enterPageMode() {
    var content = $("novelReaderContent");
    if (!content) return;
    content.classList.add("paged");
    _computePages();
    _renderPaged();
  }

  function exitPageMode() {
    var content = $("novelReaderContent");
    if (!content) return;
    content.classList.remove("paged");
    content.style.overflowY = "auto";
    content.style.overflowX = "hidden";
  }

  function updatePageIndicator() {
    var ind = $("novelPageIndicator");
    if (!ind) return;
    if (flipMode() !== "page") {
      ind.style.display = "none";
      return;
    }
    ind.textContent = _pagedIdx + 1 + "/" + _pagedPages.length;
    ind.style.display = "block";
  }

  function nextPage() {
    if (_pagedIdx < _pagedPages.length - 1) {
      _pagedIdx++;
      _renderPaged();
      savePageProgress();
    }
  }

  function prevPage() {
    if (_pagedIdx > 0) {
      _pagedIdx--;
      _renderPaged();
      savePageProgress();
    }
  }

  function savePageProgress() {
    if (!_curBook) return;
    lsSet(PAGEPROG_PREFIX + _curBook.id, String(_pagedIdx));
  }

  /* ---------- 章节自动解析 ----------
     识别常见章节标题：第1章 / 第一章 / 第001章 / Chapter 1 / 序章 / 前言 / 楔子 / 后记 等 */
  function parseChapters(paras) {
    var chapters = [];
    /* 章节标题识别（尽量全覆盖）：
       - 第X章/卷/回/节/集/部/话，数字支持阿拉伯/全角/中文（第12章、第１２章、第一百二十章）
       - 允许外括号【】〖〗() 与前缀词（正文/正文卷/VIP卷/最新章节）
       - chapter N / 序章 / 前言 / 楔子 / 引子 / 尾声 / 后记 / 番外 / 终章 / 卷N */
    var reMain =
      /^[【\[〖「『(（]?\s*(?:(?:(?:正文|正文卷|VIP卷|最新章节)\s*)?第\s*[0-9０-９零一二三四五六七八九十百千万两]+\s*[章卷回节集部话]|chapter\s+\d+|序[章言曲]?|前言|楔子|引子|尾声|后记|番外[篇记]*|终章|卷\s*[0-9０-９零一二三四五六七八九十百千万两]+).*$/i;
    /* 兜底：主规则几乎没识别到时，再试 "1、标题" "1. 标题" "001 标题" 这类纯数字编号 */
    var reNum = /^[【\[〖「『(（]?\s*[0-9０-９]{1,5}\s*[、.．\)）\]】]\s*\S.*$/;
    function scan(re) {
      var out = [];
      for (var i = 0; i < paras.length; i++) {
        var p = paras[i].trim();
        if (p && p.length <= 120 && re.test(p)) {
          /* 排除「（第一卷完）」这类卷结束标记，不是章节 */
          if (/^[【\[〖「『(（]?\s*第\s*[0-9０-９零一二三四五六七八九十百千万两]+\s*[卷部]\s*完[)）\]】」』]?\s*$/.test(p))
            continue;
          out.push({ title: p, pidx: i });
        }
      }
      return out;
    }
    chapters = scan(reMain);
    /* 晋江「☆、标题」格式：星标顺序即章节号（第1章、第2章…），与显式「第N章」合并 */
    var reStar = /^[☆★][、.．]\s*\S.*$/;
    var stars = scan(reStar).filter(function (s) {
      for (var j = 0; j < chapters.length; j++) if (chapters[j].pidx === s.pidx) return false;
      return true;
    });
    if (stars.length) {
      stars.forEach(function (s, i) {
        chapters.push({
          title: "第" + (i + 1) + "章 " + s.title.replace(/^[☆★][、.．]\s*/, ""),
          pidx: s.pidx,
        });
      });
      chapters.sort(function (a, b) {
        return a.pidx - b.pidx;
      });
    }
    /* 混合格式书（一部分"第X章"、一部分"1、标题"）：主规则已找到章节但编号
       明显不连续（例如只有第114章起），补扫纯数字编号并合并 */
    var needNum = chapters.length < 2 && !stars.length;
    if (!needNum && chapters.length && !stars.length) {
      var nums = [];
      chapters.forEach(function (c) {
        var mm = c.title.match(/第\s*([0-9０-９]+)\s*[章卷回节集部话]/);
        if (mm)
          nums.push(
            parseInt(
              mm[1].replace(/[０-９]/g, function (ch) {
                return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
              }),
              10,
            ),
          );
      });
      if (nums.length) {
        var mn = Math.min.apply(null, nums),
          mx = Math.max.apply(null, nums);
        if (mn > 3 || mx - mn + 1 > nums.length + 10) needNum = true;
      }
    }
    if (needNum) {
      var alt = scan(reNum).filter(function (c) {
        for (var j = 0; j < chapters.length; j++) if (chapters[j].pidx === c.pidx) return false;
        return true;
      });
      if (alt.length)
        chapters = chapters.concat(alt).sort(function (a, b) {
          return a.pidx - b.pidx;
        });
    }
    return chapters;
  }

  /* ---------- 打开阅读页 ---------- */
  function openReader() {
    if (!_curBook) return;
    closeSheet("novelPickerOverlay");
    var myA = $("novelReaderMyAvatar"),
      taA = $("novelReaderTaAvatar");
    var avs = _readerContacts
      .map(function (id) {
        return contactById(id);
      })
      .filter(Boolean);
    if (myA) {
      myA.style.width = "40px";
      myA.style.height = "40px";
      myA.innerHTML = avatarInner(myAvatar());
    }
    if (taA) {
      taA.style.width = "auto";
      taA.style.height = "40px";
      taA.style.background = "transparent";
      taA.style.border = "none";
      taA.style.overflow = "visible";
      taA.style.marginLeft = "0";
      taA.style.display = "flex";
      taA.style.alignItems = "center";
      taA.innerHTML = avs.length
        ? avs
            .map(function (c2, i) {
              return (
                '<div style="width:40px;height:40px;border-radius:50%;background:#e8e8e8;overflow:hidden;border:2px solid #fff;margin-left:' +
                (i ? "-14px" : "-10px") +
                ";position:relative;z-index:" +
                (20 - i) +
                ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
                avatarInner(c2.avatar) +
                "</div>"
              );
            })
            .join("")
        : '<span style="font-size:14px;color:#bbb;margin-left:-10px">+</span>';
    }
    var tt = $("novelReaderTitle");
    if (tt) tt.textContent = _curBook.title;
    var content = $("novelReaderContent");
    if (content) content.innerHTML = '<div style="text-align:center;color:#999;padding:40px 0">加载中…</div>';
    window.showEl("app-novel-reader");
    applyReaderSettings();
    idbGet(CONTENT_PREFIX + _curBook.id, function (txt) {
      txt = txt || "";
      _readerParas = txt
        .split(/\n+/)
        .map(function (p) {
          return p.trim();
        })
        .filter(function (p) {
          return p !== "";
        });
      _readerChapters = parseChapters(_readerParas);
      cacheChapters(_curBook.id, _readerChapters);
      _readerIdx = 0;
      if (content) content.innerHTML = "";
      if (flipMode() === "page") {
        enterPageMode();
        var savedPg = Math.min(
          parseInt(lsGet(PAGEPROG_PREFIX + _curBook.id, "0"), 10) || 0,
          Math.max(0, _pagedPages.length - 1),
        );
        if (savedPg > 0)
          showResumePrompt(
            "上次读到第 " + (savedPg + 1) + " 页",
            function () {
              _pagedIdx = savedPg;
              _renderPaged();
            },
            function () {
              lsSet(PAGEPROG_PREFIX + _curBook.id, "0");
            },
          );
      } else {
        exitPageMode();
        renderMoreParas();
        if (content) content.scrollTop = 0;
        var prog = parseInt(lsGet(PROGRESS_PREFIX + _curBook.id, "0"), 10) || 0;
        if (content && prog > 5 && prog < _readerParas.length - 1)
          showResumePrompt(
            "上次读到第 " + (prog + 1) + " 段",
            function () {
              jumpToPara(prog);
            },
            function () {
              lsSet(PROGRESS_PREFIX + _curBook.id, "0");
            },
          );
      }
    });
  }

  /* 跳到指定段落（滚动模式）：先渲染到该段，再精确滚过去 */
  function jumpToPara(prog) {
    var content = $("novelReaderContent");
    if (!content) return;
    var target = Math.min(_readerParas.length - 1, Math.max(0, Math.round(prog)));
    while (_readerIdx <= target) renderMoreParas();
    requestAnimationFrame(function () {
      var el = content.querySelector('[data-pidx="' + target + '"]');
      if (el)
        content.scrollTop = Math.max(
          0,
          el.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop - 12,
        );
    });
  }

  /* 重进书籍的「继续上次阅读」确认弹窗（黑白风格）：是=跳到上次位置，否=从头开始并清掉旧进度 */
  function showResumePrompt(whereText, onYes, onNo) {
    var old = $("novelResumeModal");
    if (old) old.remove();
    var ov = document.createElement("div");
    ov.id = "novelResumeModal";
    ov.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:6013;display:flex;align-items:center;justify-content:center";
    ov.innerHTML =
      '<div style="width:78%;max-width:300px;background:#fff;border-radius:18px;padding:24px 20px 16px;box-sizing:border-box;box-shadow:0 24px 64px rgba(0,0,0,.35)">' +
      '<div style="font-size:16px;font-weight:800;color:#000;text-align:center">继续上次阅读？</div>' +
      '<div style="font-size:13px;color:#888;text-align:center;margin-top:8px">' +
      esc(whereText) +
      "</div>" +
      '<div style="display:flex;gap:10px;margin-top:20px">' +
      '<button id="novelResumeNo" type="button" style="flex:1;height:42px;border:none;border-radius:21px;background:#f0f0f0;color:#000;font-size:14px;font-weight:600;cursor:pointer;touch-action:manipulation">否，从头开始</button>' +
      '<button id="novelResumeYes" type="button" style="flex:1;height:42px;border:none;border-radius:21px;background:#000;color:#fff;font-size:14px;font-weight:600;cursor:pointer;touch-action:manipulation">是，继续阅读</button></div></div>';
    document.body.appendChild(ov);
    function done(fn) {
      return function () {
        try {
          ov.remove();
        } catch (e) {}
        try {
          fn && fn();
        } catch (e) {}
      };
    }
    ov.querySelector("#novelResumeYes").addEventListener("click", done(onYes));
    ov.querySelector("#novelResumeNo").addEventListener("click", done(onNo));
  }

  function renderMoreParas() {
    var content = $("novelReaderContent");
    if (!content || !_readerParas.length) {
      if (content && !_readerParas.length)
        content.innerHTML = '<div style="text-align:center;color:#999;padding:40px 0">这本书没有内容</div>';
      return;
    }
    var end = Math.min(_readerParas.length, _readerIdx + RENDER_CHUNK);
    var html = "";
    for (var i = _readerIdx; i < end; i++) {
      html +=
        '<p data-pidx="' +
        i +
        '" style="margin:0 0 1em;text-indent:2em;word-break:break-all">' +
        esc(_readerParas[i]) +
        "</p>";
    }
    if (end >= _readerParas.length)
      html +=
        '<div id="novelProgressMarker" style="text-align:center;color:#bbb;font-size:12px;padding:24px 0">— 全书完 —</div>';
    var marker = $("novelProgressMarker");
    if (marker) marker.remove();
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    while (wrap.firstChild) content.appendChild(wrap.firstChild);
    _readerIdx = end;
    try {
      window._akiniDecorateCm && window._akiniDecorateCm();
    } catch (e) {}
  }

  function saveProgress() {
    if (!_curBook) return;
    /* 存「当前视口顶部可见的段落号」，而不是已渲染段落数——否则恢复时跑偏 */
    var content = $("novelReaderContent");
    var cur = 0;
    if (content) {
      var base = content.getBoundingClientRect().top;
      var ps = content.querySelectorAll("[data-pidx]");
      for (var i = 0; i < ps.length; i++) {
        if (ps[i].getBoundingClientRect().top - base <= 12) {
          var v = parseInt(ps[i].getAttribute("data-pidx"), 10);
          if (!isNaN(v)) cur = v;
        } else break;
      }
    }
    lsSet(PROGRESS_PREFIX + _curBook.id, String(cur));
  }

  function closeReader() {
    if (flipMode() === "page") savePageProgress();
    else saveProgress();
    var e = $("app-novel-reader");
    if (e) e.style.display = "none";
    var _menu = $("novelReaderMenu");
    if (_menu) _menu.style.display = "none";
    var _picker = $("novelPickerOverlay");
    if (_picker) _picker.style.display = "none";
    var _actions = $("novelBookActions");
    if (_actions) _actions.style.display = "none";
    closeChapterDrawer();
    window.__renderNovelShelf();
  }

  /* ---------- 章节目录侧滑面板 ---------- */
  function openChapterDrawer() {
    var drawer = $("novelChapterDrawer");
    var panel = $("novelChapterDrawerPanel");
    var list = $("novelChapterDrawerList");
    if (!drawer || !panel || !list) return;
    renderChapterList(list);
    drawer.style.display = "flex";
    requestAnimationFrame(function () {
      panel.style.transform = "translateX(0)";
    });
  }
  function closeChapterDrawer() {
    var drawer = $("novelChapterDrawer");
    var panel = $("novelChapterDrawerPanel");
    if (!drawer || !panel) return;
    panel.style.transform = "translateX(-100%)";
    setTimeout(function () {
      drawer.style.display = "none";
    }, 260);
  }
  function renderChapterList(listEl) {
    if (!_readerParas.length) {
      listEl.innerHTML = '<div style="text-align:center;color:#bbb;font-size:14px;padding:40px 0">暂无章节</div>';
      return;
    }
    var html = "";
    if (!_readerChapters.length) {
      html +=
        '<div style="padding:12px 18px;color:#888;font-size:13px;border-bottom:1px solid #f5f5f5">未识别到章节标题<br><span style="font-size:12px">章节名示例：第1章、第一章、Chapter 1</span></div>';
    }
    html += _readerChapters
      .map(function (ch, idx) {
        var num = idx + 1;
        return (
          '<button class="novel-chapter-item" data-pidx="' +
          ch.pidx +
          '" type="button" style="display:block;width:100%;padding:13px 18px;background:#fff;border:none;border-bottom:1px solid #f5f5f5;text-align:left;font-size:15px;color:#1a1a1a;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;touch-action:manipulation">' +
          '<span style="display:inline-block;min-width:28px;color:#999;font-size:13px;margin-right:6px">' +
          num +
          "</span>" +
          esc(ch.title) +
          "</button>"
        );
      })
      .join("");
    listEl.innerHTML = html;
    Array.prototype.forEach.call(listEl.querySelectorAll(".novel-chapter-item"), function (btn) {
      btn.addEventListener("click", function () {
        var pidx = parseInt(btn.getAttribute("data-pidx"), 10);
        if (isNaN(pidx)) return;
        jumpToParagraph(pidx);
        closeChapterDrawer();
      });
    });
  }
  function jumpToParagraph(pidx) {
    if (!_readerParas.length || pidx < 0 || pidx >= _readerParas.length) return;
    var content = $("novelReaderContent");
    if (!content) return;
    if (flipMode() === "page") {
      /* 翻页模式：找到该段落所在页 */
      _pagedIdx = 0;
      for (var i = 0; i < _pagedPages.length; i++) {
        var page = _pagedPages[i];
        var has = false;
        for (var j = 0; j < page.length; j++) {
          if (_readerParas.indexOf(page[j]) === pidx) {
            has = true;
            break;
          }
        }
        if (has) {
          _pagedIdx = i;
          break;
        }
      }
      _renderPaged();
      savePageProgress();
    } else {
      /* 滚动模式：确保该段落已渲染再滚动 */
      if (_readerIdx <= pidx) {
        while (_readerIdx <= pidx && _readerIdx < _readerParas.length) renderMoreParas();
      }
      requestAnimationFrame(function () {
        var el = content.querySelector('[data-pidx="' + pidx + '"]');
        if (el) {
          content.scrollTop = Math.max(
            0,
            el.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop - 14,
          );
        }
      });
      saveProgress();
    }
  }

  /* ---------- 绑定 ---------- */
  function bindNovel() {
    var back = $("novelBackBtn");
    var addBtn = $("novelAddBtn");
    var importInput = $("novelImportInput");
    var readerBack = $("novelReaderBackBtn");
    var chapterMenuBtn = $("novelChapterMenuBtn");
    var chapterDrawer = $("novelChapterDrawer");
    var chapterDrawerMask = $("novelChapterDrawerMask");
    var chapterDrawerClose = $("novelChapterDrawerClose");
    var menuBtn = $("novelMenuBtn");
    var menuClose = $("novelMenuClose");
    var menuOverlay = $("novelReaderMenu");
    var fsMinus = $("novelFontMinus"),
      fsPlus = $("novelFontPlus");
    var bgRow = $("novelBgColors");
    var bgInput = $("novelBgInput");
    var flipScroll = $("novelFlipScroll"),
      flipPage = $("novelFlipPage");
    var pickerClose = $("novelPickerClose");
    var pickerConfirm = $("novelPickerConfirm");
    var pickerOverlay = $("novelPickerOverlay");
    var actOverlay = $("novelBookActions");
    var actCover = $("novelActCover");
    var actRename = $("novelActRename");
    var actDelete = $("novelActDelete");
    var actCancel = $("novelActCancel");
    var coverInput = $("novelCoverInput");
    var renameOverlay = $("novelRenameModal");
    var renameInput = $("novelRenameInput");
    var renameOk = $("novelRenameOk");
    var renameCancel = $("novelRenameCancel");
    var content = $("novelReaderContent");

    if (back) back.addEventListener("click", goHome);
    /* 导入小说 */
    if (importInput)
      importInput.addEventListener("change", function () {
        var f = this.files && this.files[0];
        this.value = "";
        importNovel(f);
      });
    if (readerBack) readerBack.addEventListener("click", closeReader);
    var readerExit = $("novelReaderExitBtn");
    if (readerExit) readerExit.addEventListener("click", function () { closeReader(); });
    if (chapterMenuBtn)
      chapterMenuBtn.addEventListener("click", function () {
        openChapterDrawer();
      });
    if (chapterDrawerClose) chapterDrawerClose.addEventListener("click", closeChapterDrawer);
    if (chapterDrawerMask) chapterDrawerMask.addEventListener("click", closeChapterDrawer);
    if (chapterDrawer)
      chapterDrawer.addEventListener("click", function (e) {
        if (e.target === chapterDrawer) closeChapterDrawer();
      });
    if (menuBtn)
      menuBtn.addEventListener("click", function () {
        openSheet("novelReaderMenu");
      });
    if (menuClose)
      menuClose.addEventListener("click", function () {
        closeSheet("novelReaderMenu");
      });
    if (menuOverlay)
      menuOverlay.addEventListener("click", function (e) {
        if (e.target === menuOverlay) closeSheet("novelReaderMenu");
      });

    if (fsMinus)
      fsMinus.addEventListener("click", function () {
        var s = readerSettings();
        s.fontSize = Math.max(14, (parseInt(s.fontSize, 10) || 18) - 1);
        saveReaderSettings(s);
        applyReaderSettings();
        updatePageIndicator();
      });
    if (fsPlus)
      fsPlus.addEventListener("click", function () {
        var s = readerSettings();
        s.fontSize = Math.min(28, (parseInt(s.fontSize, 10) || 18) + 1);
        saveReaderSettings(s);
        applyReaderSettings();
        updatePageIndicator();
      });

    /* 阅读区点击左右翻页 */
    if (content) {
      content.addEventListener("click", function (e) {
        if (flipMode() !== "page") return;
        var rect = content.getBoundingClientRect();
        var x = e.clientX - rect.left;
        if (x > rect.width * 0.7) {
          nextPage();
          e.preventDefault();
          return;
        }
        if (x < rect.width * 0.3) {
          prevPage();
          e.preventDefault();
          return;
        }
      });
      var _touchStartX = 0,
        _touchStartY = 0;
      content.addEventListener(
        "touchstart",
        function (e) {
          if (flipMode() !== "page") return;
          if (e.touches && e.touches.length) {
            _touchStartX = e.touches[0].clientX;
            _touchStartY = e.touches[0].clientY;
          }
        },
        { passive: true },
      );
      content.addEventListener(
        "touchend",
        function (e) {
          if (flipMode() !== "page") return;
          if (e.changedTouches && e.changedTouches.length) {
            var dx = e.changedTouches[0].clientX - _touchStartX;
            var dy = e.changedTouches[0].clientY - _touchStartY;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
              if (dx < 0) nextPage();
              else prevPage();
            }
          }
        },
        { passive: true },
      );
    }
    if (bgRow)
      Array.prototype.forEach.call(bgRow.children, function (el) {
        el.addEventListener("click", function () {
          var s = readerSettings();
          s.bgColor = el.getAttribute("data-color");
          delete s.bg;
          saveReaderSettings(s);
          applyReaderSettings();
        });
      });
    if (bgInput)
      bgInput.addEventListener("change", function () {
        var f = this.files && this.files[0];
        this.value = "";
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          shrinkImage(fr.result, 750, 1334, function (url) {
            var s = readerSettings();
            s.bg = url;
            saveReaderSettings(s);
            applyReaderSettings();
          });
        };
        fr.readAsDataURL(f);
      });

    /* 翻页方式切换 */
    if (flipScroll)
      flipScroll.addEventListener("click", function () {
        var s = readerSettings();
        if (s.flip === "scroll") return;
        s.flip = "scroll";
        saveReaderSettings(s);
        applyReaderSettings();
        if (_curBook) {
          /* 记住当前页首段，切回滚动后停在这一段，不重头再来 */
          var cur = _pagedPages[_pagedIdx] || [];
          var pidx = cur.length ? cur[0].p : 0;
          var content2 = $("novelReaderContent");
          if (content2) content2.innerHTML = "";
          _readerIdx = 0;
          exitPageMode();
          renderMoreParas();
          jumpToPara(pidx);
          updatePageIndicator();
        }
      });
    if (flipPage)
      flipPage.addEventListener("click", function () {
        var s = readerSettings();
        if (s.flip === "page") return;
        s.flip = "page";
        saveReaderSettings(s);
        applyReaderSettings();
        if (_curBook) {
          saveProgress(); /* 先落盘当前滚动位置 */
          var pidx = parseInt(lsGet(PROGRESS_PREFIX + _curBook.id, "0"), 10) || 0;
          enterPageMode();
          /* 切到包含当前段的那一页 */
          _pagedIdx = 0;
          for (var pi = 0; pi < _pagedPages.length; pi++) {
            var arr = _pagedPages[pi];
            if (!arr.length) continue;
            if (arr[0].p <= pidx && arr[arr.length - 1].p >= pidx) {
              _pagedIdx = pi;
              break;
            }
            if (arr[0].p > pidx) {
              _pagedIdx = pi - 1 < 0 ? 0 : pi - 1;
              break;
            }
          }
          _renderPaged();
          savePageProgress();
        }
      });
    /* 滚动时实时保存顶部段落（节流），退出/被杀后也能准确续读 */
    if (content && !content._aknvProgBound) {
      content._aknvProgBound = true;
      var _svT = null;
      content.addEventListener(
        "scroll",
        function () {
          if (flipMode() === "page") return;
          if (_svT) return;
          _svT = setTimeout(function () {
            _svT = null;
            saveProgress();
          }, 500);
        },
        { passive: true },
      );
    }

    if (pickerClose)
      pickerClose.addEventListener("click", function () {
        closeSheet("novelPickerOverlay");
      });
    if (pickerOverlay)
      pickerOverlay.addEventListener("click", function (e) {
        if (e.target === pickerOverlay) closeSheet("novelPickerOverlay");
      });
    if (pickerConfirm)
      pickerConfirm.addEventListener("click", function () {
        if (!_readerContacts.length) {
          alert("先选一位一起看的联系人吧~");
          return;
        }
        _readerContact = _readerContacts[0];
        openReader();
      });

    if (actCancel)
      actCancel.addEventListener("click", function () {
        closeSheet("novelBookActions");
      });
    if (actOverlay)
      actOverlay.addEventListener("click", function (e) {
        if (e.target === actOverlay) closeSheet("novelBookActions");
      });
    if (actCover)
      actCover.addEventListener("click", function () {
        closeSheet("novelBookActions");
        if (coverInput) coverInput.click();
      });
    if (coverInput)
      coverInput.addEventListener("change", function () {
        var f = this.files && this.files[0];
        this.value = "";
        if (!f || !_curBook) return;
        var fr = new FileReader();
        fr.onload = function () {
          shrinkImage(fr.result, 240, 320, function (url) {
            _curBook.cover = url;
            saveBooks();
            window.__renderNovelShelf();
          });
        };
        fr.readAsDataURL(f);
      });
    if (actRename)
      actRename.addEventListener("click", function () {
        closeSheet("novelBookActions");
        if (renameInput && _curBook) renameInput.value = _curBook.title;
        openSheet("novelRenameModal");
      });
    if (actDelete)
      actDelete.addEventListener("click", function () {
        closeSheet("novelBookActions");
        if (!_curBook) return;
        if (!confirm("确定删除《" + _curBook.title + "》吗？")) return;
        var id = _curBook.id;
        _books = _books.filter(function (b) {
          return b.id !== id;
        });
        saveBooks();
        try {
          window._idbStore && window._idbStore.remove && window._idbStore.remove(CONTENT_PREFIX + id);
        } catch (e) {}
        lsSet(PROGRESS_PREFIX + id, "0"); /* removeItem 被主程序禁用，写 0 重置 */
        lsSet(PAGEPROG_PREFIX + id, "0");
        window.__renderNovelShelf();
      });
    if (renameCancel)
      renameCancel.addEventListener("click", function () {
        closeSheet("novelRenameModal");
      });
    if (renameOverlay)
      renameOverlay.addEventListener("click", function (e) {
        if (e.target === renameOverlay) closeSheet("novelRenameModal");
      });
    if (renameOk)
      renameOk.addEventListener("click", function () {
        if (!_curBook) {
          closeSheet("novelRenameModal");
          return;
        }
        var v = ((renameInput && renameInput.value) || "").trim();
        if (v) {
          _curBook.title = v.slice(0, 60);
          saveBooks();
          window.__renderNovelShelf();
        }
        closeSheet("novelRenameModal");
      });

    if (content) {
      var st = null;
      content.addEventListener(
        "scroll",
        function () {
          if (st) clearTimeout(st);
          st = setTimeout(function () {
            if (flipMode() === "page") {
              updatePageIndicator();
              savePageProgress();
            } else {
              if (
                content.scrollTop + content.clientHeight > content.scrollHeight - 600 &&
                _readerIdx < _readerParas.length
              ) {
                renderMoreParas();
              }
              saveProgress();
            }
          }, 200);
        },
        { passive: true },
      );
    }
  }

  /* ---------- 启动 ---------- */
  function boot() {
    bindCompanion();
    bindNovel();
  }
  if (document.readyState === "loading") {
    /* ============================================================
     书架管理（画笔改封面书名）+ 段评系统（长按选段/圆圈计数/定时回复/永久保存）
     ============================================================ */
    var _manageMode = false;
    var _cmPending = null; /* 待添加段评 {pidx, quote} */
    var _cmViewing = null; /* 查看中的段评 id */
    var CM_PREFIX = "akini_nvcm_";

    function cmLoad() {
      if (!_curBook) return [];
      try {
        return JSON.parse(lsGet(CM_PREFIX + _curBook.id, "[]")) || [];
      } catch (e) {
        return [];
      }
    }
    function cmSave(list) {
      if (!_curBook) return;
      lsSet(CM_PREFIX + _curBook.id, JSON.stringify(list));
    }
    function cmFmtTime(ts) {
      var d = new Date(ts);
      function p(n) {
        return n < 10 ? "0" + n : "" + n;
      }
      return d.getMonth() + 1 + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    }

    /* ---------- 段评标记渲染：段落末尾圆圈+数量 ---------- */
    window._akiniDecorateCm = function () {
      var content = $("novelReaderContent");
      if (!content || !_curBook) return;
      var list = cmLoad();
      var byPara = {};
      list.forEach(function (cm) {
        if (cm.pidx == null || cm.pidx < 0) return;
        (byPara[cm.pidx] = byPara[cm.pidx] || []).push(cm);
      });
      Array.prototype.forEach.call(content.querySelectorAll("p[data-pidx]"), function (p) {
        Array.prototype.forEach.call(p.querySelectorAll(".aknv-cmmark"), function (m) {
          m.remove();
        });
        var pidx = parseInt(p.getAttribute("data-pidx"), 10);
        var cms = byPara[pidx];
        if (!cms || !cms.length) return;
        var total = 0;
        cms.forEach(function (cm) {
          total += (cm.list || []).length;
        });
        var mk = document.createElement("span");
        mk.className = "aknv-cmmark";
        mk.setAttribute("data-pidx", String(pidx));
        /* 小圆圈+数字居中圈内，防全局样式覆盖（min/max-width + flex:0 0 固定 + line-height:1） */
        mk.style.cssText =
          "display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;min-width:18px;max-width:18px;flex:0 0 18px;border:1.5px solid #1a1a1a;color:#1a1a1a;border-radius:50%;font-size:" +
          (total > 9 ? "8px" : "10px") +
          ";line-height:1;font-weight:600;font-style:normal;text-align:center;text-indent:0;letter-spacing:0;padding:0;margin-left:3px;vertical-align:middle;cursor:pointer;box-sizing:border-box;background:rgba(255,255,255,.75)";
        mk.textContent = String(total);
        mk.addEventListener("click", function (e) {
          openCmView(pidx);
        });
        p.appendChild(mk);
      });
    };

    /* ---------- 长按选择 → 添加段评浮动条 ---------- */
    function ensureCmDom() {
      if ($("aknvSelBar")) return;
      var bar = document.createElement("div");
      bar.id = "aknvSelBar";
      bar.style.cssText =
        "display:none;position:fixed;z-index:6010;background:#1a1a1a;color:#fff;font-size:14px;padding:8px 16px;border-radius:8px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);user-select:none;-webkit-user-select:none";
      bar.textContent = "添加段评";
      document.body.appendChild(bar);
      bar.addEventListener("click", function () {
        bar.style.display = "none";
        if (_cmPending) openCmAdd();
      });

      var add = document.createElement("div");
      add.id = "aknvCmAdd";
      add.style.cssText =
        "display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:6011;align-items:center;justify-content:center";
      add.innerHTML =
        '<div style="width:86%;max-width:340px;background:#fff;border-radius:14px;padding:16px;box-sizing:border-box">' +
        '<div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:8px">添加段评</div>' +
        '<div id="aknvCmAddQuote" style="font-size:13px;color:#888;background:#f6f6f6;border-radius:8px;padding:8px 10px;margin-bottom:10px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-all"></div>' +
        '<textarea id="aknvCmAddInput" rows="3" maxlength="200" placeholder="写下你的段评" style="width:100%;box-sizing:border-box;border:1px solid #e0e0e0;border-radius:10px;padding:10px 12px;font-size:15px;outline:0;resize:none;color:#1a1a1a;font-family:inherit"></textarea>' +
        '<div style="display:flex;gap:10px;margin-top:12px"><button id="aknvCmAddCancel" type="button" style="flex:1;height:42px;border-radius:10px;border:1px solid #e0e0e0;background:#f8f8f8;color:#555;font-size:15px;cursor:pointer">取消</button><button id="aknvCmAddOk" type="button" style="flex:1;height:42px;border-radius:10px;border:none;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;cursor:pointer">保存</button></div>' +
        "</div>";
      document.body.appendChild(add);
      $("aknvCmAddCancel").addEventListener("click", function () {
        add.style.display = "none";
        _cmPending = null;
      });
      add.addEventListener("click", function (e) {
        if (e.target === add) {
          add.style.display = "none";
          _cmPending = null;
        }
      });
      $("aknvCmAddOk").addEventListener("click", saveCmAdd);

      var view = document.createElement("div");
      view.id = "aknvCmView";
      view.style.cssText =
        "display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:6012;align-items:flex-end;justify-content:center";
      view.innerHTML =
        '<div style="width:100%;max-width:520px;max-height:78vh;background:#fff;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -12px 48px rgba(0,0,0,.25)">' +
        '<div style="width:38px;height:4px;border-radius:2px;background:#e0e0e0;margin:10px auto 0;flex-shrink:0"></div>' +
        '<div style="display:flex;align-items:center;padding:10px 16px 10px;flex-shrink:0">' +
        '<span style="flex:1;font-size:17px;font-weight:800;color:#000;letter-spacing:1px">段评</span>' +
        '<button id="aknvCmMoreBtn" type="button" title="回复设置" style="background:none;border:none;font-size:18px;color:#000;cursor:pointer;padding:4px 8px;line-height:1">⋯</button></div>' +
        '<div id="aknvCmReplyCfg" style="display:none;padding:0 16px 10px;flex-shrink:0;align-items:center;gap:8px">' +
        '<span style="font-size:13px;color:#666;flex:1">联系人回复段评时间</span>' +
        '<input id="aknvCmDelayInput" type="number" min="1" max="600" value="10" style="width:60px;height:32px;border:none;background:#f0f0f0;border-radius:8px;padding:0 8px;font-size:14px;outline:0;text-align:center;color:#000"/>' +
        '<span style="font-size:13px;color:#999">秒</span></div>' +
        '<div id="aknvCmViewQuote" style="margin:0 16px 10px;font-size:13px;color:#555;background:#f7f7f7;border-left:3px solid #000;border-radius:8px;padding:9px 12px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-all;flex-shrink:0"></div>' +
        '<div id="aknvCmViewList" style="flex:1;overflow-y:auto;padding:0 16px;min-height:80px"></div>' +
        '<div style="display:flex;gap:8px;padding:10px 16px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid #f0f0f0;flex-shrink:0">' +
        '<input id="aknvCmViewInput" maxlength="200" placeholder="写段评…" style="flex:1;min-width:0;height:42px;border:none;background:#f5f5f5;border-radius:21px;padding:0 16px;font-size:14px;outline:0;color:#000"/>' +
        '<button id="aknvCmViewSend" type="button" style="height:42px;padding:0 20px;border:none;border-radius:21px;background:#000;color:#fff;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0">发送</button></div>' +
        "</div>";
      document.body.appendChild(view);
      /* 右上角不再放叉：点弹窗外空白处即可返回（见下方 view 的委托） */
      view.addEventListener("click", function (e) {
        if (e.target === view) {
          view.style.display = "none";
          _cmViewing = null;
        }
      });
      $("aknvCmViewSend").addEventListener("click", sendCmFromView);
      $("aknvCmMoreBtn").addEventListener("click", function () {
        var cfg = $("aknvCmReplyCfg");
        cfg.style.display = cfg.style.display === "flex" ? "none" : "flex";
      });
      $("aknvCmDelayInput").addEventListener("change", function () {
        var v = Math.min(600, Math.max(1, parseInt(this.value, 10) || 10));
        this.value = v;
        lsSet("akini_nvcm_delay", String(v));
      });
      /* 段评删除：线条垃圾桶图标，两段式确认——第一次点图标变黑并出「确认？」，2.5 秒内再点一次才真正删除 */
      var _cmTrashSvg =
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
      window.__akiniCmTrashSvg = _cmTrashSvg;
      $("aknvCmViewList").addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(".aknv-cm-del") : null;
        if (!btn) return;
        e.preventDefault();
        if (btn.dataset.arm === "1") {
          var ts = parseInt(btn.dataset.ts, 10);
          var who = btn.dataset.who || "";
          var all = cmLoad();
          var changed = false;
          all = all.filter(function (cm) {
            if (cm.pidx !== _cmViewing) return true;
            var before = (cm.list || []).length;
            cm.list = (cm.list || []).filter(function (m) {
              return !(m.ts === ts && (m.who || "") === who);
            });
            if (cm.list.length !== before) changed = true;
            return cm.list.length > 0;
          });
          if (changed) {
            cmSave(all);
            window._akiniDecorateCm();
            openCmView(_cmViewing, true);
          }
          return;
        }
        btn.dataset.arm = "1";
        btn.innerHTML = '<span style="font-size:11px;font-weight:700;color:#000">确认？</span>';
        setTimeout(function () {
          if (btn.isConnected) {
            btn.dataset.arm = "";
            btn.innerHTML = _cmTrashSvg;
          }
        }, 2500);
      });
    }

    function openCmAdd() {
      ensureCmDom();
      var q = $("aknvCmAddQuote");
      if (q) q.textContent = _cmPending.quote;
      var inp = $("aknvCmAddInput");
      if (inp) inp.value = "";
      $("aknvCmAdd").style.display = "flex";
    }

    function cmStripEmoji(t) {
      /* 段评仅文字：剔除 emoji 与图片占位 */
      return String(t || "")
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
        .trim();
    }

    function saveCmAdd() {
      var inp = $("aknvCmAddInput");
      var text = cmStripEmoji(inp ? inp.value : "");
      if (!text) {
        alert("段评不能为空哦");
        return;
      }
      var list = cmLoad();
      var cm = {
        id: "cm" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        pidx: _cmPending.pidx,
        quote: _cmPending.quote.slice(0, 120),
        list: [{ who: "me", text: text, ts: Date.now() }],
        replied: false,
      };
      list.push(cm);
      cmSave(list);
      $("aknvCmAdd").style.display = "none";
      _cmPending = null;
      window._akiniDecorateCm();
      scheduleCmReply(cm);
    }

    /* ---------- 联系人定时回复段评（字卡库文字） ---------- */
    function scheduleCmReply(cm) {
      if (!cm || cm.replied) return;
      var delay = Math.min(600, Math.max(1, parseInt(lsGet("akini_nvcm_delay", "10"), 10) || 10)) * 1000;
      setTimeout(function () {
        var list = cmLoad();
        var cur = null;
        for (var i = 0; i < list.length; i++)
          if (list[i].id === cm.id) {
            cur = list[i];
            break;
          }
        if (!cur || cur.replied) return;
        var pool = _readerContacts.length
          ? _readerContacts
          : contacts().map(function (c) {
              return c.id;
            });
        if (!pool.length) return;
        var cid = pool[Math.floor(Math.random() * pool.length)];
        var c = contactById(cid);
        if (!c) return;
        var t = "";
        try {
          t = window.pickWordCards ? window.pickWordCards(1, cid) : "";
        } catch (e) {}
        t = (t || "").split(
          "\n",
        )[0]; /* 联系人回复段评保留字卡主字卡和emoji模块，仅排除表情包图片(pickWordCards已过滤pat) */
        if (!t) return;
        cur.list.push({ who: cid, name: c.name || "联系人", avatar: c.avatar || "", text: t, ts: Date.now() });
        cur.replied = true;
        cmSave(list);
        window._akiniDecorateCm();
        if (_cmViewing) openCmView(_cmViewing, true);
      }, delay);
    }

    /* ---------- 查看段评弹窗 ---------- */
    function openCmView(pidx, keepOpen) {
      ensureCmDom();
      _cmViewing = pidx;
      var list = cmLoad().filter(function (cm) {
        return cm.pidx === pidx;
      });
      if (!list.length) {
        $("aknvCmView").style.display = "none";
        _cmViewing = null;
        return;
      }
      $("aknvCmViewQuote").textContent =
        list.map(function (cm) {
          return cm.quote;
        })[0] || "";
      var di = $("aknvCmDelayInput");
      if (di) di.value = lsGet("akini_nvcm_delay", "10");
      var items = [];
      list.forEach(function (cm) {
        (cm.list || []).forEach(function (m) {
          items.push(m);
        });
      });
      items.sort(function (a, b) {
        return a.ts - b.ts;
      });
      $("aknvCmViewList").innerHTML =
        items
          .map(function (m) {
            var isMe = m.who === "me";
            var name = isMe ? "我" : m.name || "联系人";
            var av = isMe ? avatarInner(myAvatar()) : avatarInner(m.avatar || "");
            return (
              '<div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid #f2f2f2">' +
              '<div style="width:36px;height:36px;border-radius:50%;background:#f0f0f0;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">' +
              av +
              "</div>" +
              '<div style="flex:1;min-width:0">' +
              '<div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:13px;font-weight:700;color:#000">' +
              esc(name) +
              "</span>" +
              '<span style="font-size:11px;color:#aaa">' +
              cmFmtTime(m.ts) +
              "</span></div>" +
              '<div style="font-size:14px;color:#1a1a1a;margin-top:4px;word-break:break-all;line-height:1.6">' +
              esc(m.text) +
              "</div>" +
              "</div>" +
              '<button type="button" class="aknv-cm-del" data-ts="' +
              m.ts +
              '" data-who="' +
              esc(m.who || "") +
              '" style="background:none;border:none;color:#bbb;cursor:pointer;padding:4px 2px 4px 8px;flex-shrink:0;align-self:flex-start;line-height:1;display:flex;align-items:center;min-width:24px;min-height:24px;justify-content:center">' +
              (window.__akiniCmTrashSvg || "删除") +
              "</button>" +
              "</div>"
            );
          })
          .join("") || '<div style="text-align:center;color:#bbb;font-size:13px;padding:24px 0">暂无段评</div>';
      var v = $("aknvCmView");
      v.style.display = "flex";
      if (!keepOpen) {
        var lv = $("aknvCmViewList");
        lv.scrollTop = lv.scrollHeight;
      }
    }

    function sendCmFromView() {
      var inp = $("aknvCmViewInput");
      var text = cmStripEmoji(inp ? inp.value : "");
      if (!text) return;
      var list = cmLoad();
      var cur = null;
      for (var i = list.length - 1; i >= 0; i--)
        if (list[i].pidx === _cmViewing) {
          cur = list[i];
          break;
        }
      if (!cur) return;
      cur.list.push({ who: "me", text: text, ts: Date.now() });
      cmSave(list);
      inp.value = "";
      window._akiniDecorateCm();
      openCmView(_cmViewing, true);
      if (!cur.replied) scheduleCmReply(cur);
    }

    /* ---------- 选择监听 ---------- */
    function bindCmSelection() {
      var content = $("novelReaderContent");
      if (!content || content._aknvCmBound) return;
      content._aknvCmBound = true;
      ensureCmDom();
      var check = function () {
        setTimeout(function () {
          var bar = $("aknvSelBar");
          if (!bar) return;
          var sel = window.getSelection();
          if (!sel || sel.isCollapsed || !sel.rangeCount) {
            bar.style.display = "none";
            return;
          }
          var range = sel.getRangeAt(0);
          var node = range.commonAncestorContainer;
          var el = node.nodeType === 1 ? node : node.parentNode;
          var p = el && el.closest ? el.closest("p[data-pidx]") : null;
          if (!p || !content.contains(p)) {
            bar.style.display = "none";
            return;
          }
          var quote = sel.toString().trim();
          if (!quote) {
            bar.style.display = "none";
            return;
          }
          _cmPending = { pidx: parseInt(p.getAttribute("data-pidx"), 10), quote: quote };
          var rc = range.getBoundingClientRect();
          bar.style.left = Math.max(10, Math.min(window.innerWidth - 110, rc.left + rc.width / 2 - 50)) + "px";
          bar.style.top = Math.max(50, rc.top - 44) + "px";
          bar.style.display = "block";
        }, 60);
      };
      content.addEventListener("mouseup", check);
      content.addEventListener("touchend", check);
      content.addEventListener("click", function (e) {
        if (!e.target.closest || !e.target.closest(".aknv-cmmark")) {
          var bar = $("aknvSelBar");
          var sel = window.getSelection();
          if (bar && (!sel || sel.isCollapsed)) bar.style.display = "none";
        }
      });
    }

    /* ---------- 书架管理模式 ---------- */
    function ensureManageDom() {
      if ($("aknvAddMenu")) return;
      var menu = document.createElement("div");
      menu.id = "aknvAddMenu";
      menu.style.cssText =
        "display:none;position:fixed;top:52px;right:10px;z-index:6013;background:#fff;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.16);overflow:hidden;min-width:120px";
      menu.innerHTML =
        '<button id="aknvMenuImport" type="button" style="display:block;width:100%;padding:13px 18px;background:#fff;border:none;font-size:15px;color:#1a1a1a;text-align:left;cursor:pointer;border-bottom:1px solid #f0f0f0">导入</button>' +
        '<button id="aknvMenuManage" type="button" style="display:block;width:100%;padding:13px 18px;background:#fff;border:none;font-size:15px;color:#1a1a1a;text-align:left;cursor:pointer">管理</button>';
      document.body.appendChild(menu);
      $("aknvMenuImport").addEventListener("click", function () {
        menu.style.display = "none";
        var inp = $("novelImportInput");
        if (inp) inp.click();
      });
      $("aknvMenuManage").addEventListener("click", function () {
        menu.style.display = "none";
        setManageMode(true);
      });
      document.addEventListener("click", function (e) {
        if (!e.target.closest || (!e.target.closest("#aknvAddMenu") && !e.target.closest("#novelAddBtn")))
          menu.style.display = "none";
      });

      var em = document.createElement("div");
      em.id = "aknvEditModal";
      em.style.cssText =
        "display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:6014;align-items:center;justify-content:center";
      em.innerHTML =
        '<div style="width:84%;max-width:320px;background:#fff;border-radius:14px;padding:18px 16px 14px;box-sizing:border-box">' +
        '<div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:12px;text-align:center">编辑书籍</div>' +
        '<div style="display:flex;gap:14px;align-items:flex-start">' +
        '<div id="aknvEditCover" style="width:72px;height:96px;border-radius:8px;overflow:hidden;background:#eee;flex-shrink:0;cursor:pointer;position:relative"></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:12px;color:#999;margin-bottom:6px">书名</div>' +
        '<input id="aknvEditTitle" maxlength="60" style="width:100%;box-sizing:border-box;height:40px;border:1px solid #e0e0e0;border-radius:10px;padding:0 12px;font-size:15px;outline:0;color:#1a1a1a"/>' +
        '<div style="font-size:12px;color:#bbb;margin-top:8px">点左侧封面可更换</div></div></div>' +
        '<input accept="image/*" type="file" id="aknvEditCoverInput" style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0"/>' +
        '<div style="display:flex;gap:10px;margin-top:16px"><button id="aknvEditCancel" type="button" style="flex:1;height:42px;border-radius:10px;border:1px solid #e0e0e0;background:#f8f8f8;color:#555;font-size:15px;cursor:pointer">取消</button><button id="aknvEditOk" type="button" style="flex:1;height:42px;border-radius:10px;border:none;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;cursor:pointer">保存</button></div>' +
        '<button id="aknvEditDelete" type="button" style="width:100%;height:42px;margin-top:10px;border-radius:10px;border:1px solid #f3c2c2;background:#fff5f5;color:#e04040;font-size:15px;cursor:pointer">删除本书</button>' +
        "</div>";
      document.body.appendChild(em);
      $("aknvEditCancel").addEventListener("click", function () {
        em.style.display = "none";
      });
      em.addEventListener("click", function (e) {
        if (e.target === em) em.style.display = "none";
      });
      /* 管理界面删除本书（与长按菜单删除同一逻辑） */
      $("aknvEditDelete").addEventListener("click", function () {
        if (!_editBook) return;
        if (!confirm("确定删除《" + (_editBook.title || "") + "》吗？删除后无法恢复")) return;
        var id = _editBook.id;
        _books = _books.filter(function (b) {
          return b.id !== id;
        });
        saveBooks();
        try {
          window._idbStore && window._idbStore.remove && window._idbStore.remove(CONTENT_PREFIX + id);
        } catch (e) {}
        lsSet(PROGRESS_PREFIX + id, "0");
        lsSet(PAGEPROG_PREFIX + id, "0");
        em.style.display = "none";
        window.__renderNovelShelf();
      });
      $("aknvEditCover").addEventListener("click", function () {
        $("aknvEditCoverInput").click();
      });
      $("aknvEditCoverInput").addEventListener("change", function () {
        var f = this.files && this.files[0];
        if (!f || !_editBook) return;
        var fr = new FileReader();
        fr.onload = function () {
          shrinkImage(fr.result, 300, 400, function (url) {
            _editBook.cover = url;
            renderEditCover();
          });
        };
        fr.readAsDataURL(f);
        this.value = "";
      });
      $("aknvEditOk").addEventListener("click", function () {
        if (!_editBook) return;
        var t = ($("aknvEditTitle").value || "").trim();
        if (t) _editBook.title = t;
        saveBooks();
        em.style.display = "none";
        window.__renderNovelShelf();
      });
    }

    var _editBook = null;
    function renderEditCover() {
      var box = $("aknvEditCover");
      if (!box || !_editBook) return;
      box.innerHTML = isImgSrc(_editBook.cover)
        ? '<img src="' + esc(_editBook.cover) + '" style="width:100%;height:100%;object-fit:cover">'
        : defaultCover(_editBook);
    }

    function setManageMode(on) {
      _manageMode = !!on;
      var addBtn = $("novelAddBtn");
      if (addBtn) {
        if (on) {
          addBtn.innerHTML = '<span style="font-size:14px;color:#1a1a1a;white-space:nowrap">退出管理</span>';
          addBtn.style.width = "auto";
          addBtn.style.padding = "0 4px";
        } else {
          addBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:24px;height:24px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
          addBtn.style.width = "32px";
          addBtn.style.padding = "0";
        }
      }
      window.__renderNovelShelf();
    }

    function openEditBook(bid) {
      ensureManageDom();
      _editBook =
        _books.filter(function (b) {
          return b.id === bid;
        })[0] || null;
      if (!_editBook) return;
      $("aknvEditTitle").value = _editBook.title || "";
      renderEditCover();
      $("aknvEditModal").style.display = "flex";
    }
    window.openEditBook = openEditBook;

    /* ---------- 包装书架渲染：管理模式加画笔 ---------- */

    var _origRenderShelf = window.__renderNovelShelf;

    /* ---------- 绑定加号 → 菜单 ---------- */
    function bindNovelMenu() {
      ensureManageDom();
      ensureCmDom();
      bindCmSelection();
      var addBtn = $("novelAddBtn");
      if (addBtn && !addBtn._aknvMenuBound) {
        addBtn._aknvMenuBound = true;
        addBtn.addEventListener(
          "click",
          function (e) {
            if (_manageMode) {
              setManageMode(false);
              return;
            }
            var menu = $("aknvAddMenu");
            if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
          },
          true,
        );
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(bindNovelMenu, 400);
      });
    } else {
      setTimeout(bindNovelMenu, 400);
    }

    /* ---------- 陪伴头像光环颜色自定义（RGB 三通道滑杆自由调色） ---------- */
    function hslToRgb(h, s, l) {
      s /= 100;
      l /= 100;
      var k = function (n) {
        return (n + h / 30) % 12;
      };
      var a = s * Math.min(l, 1 - l);
      var f = function (n) {
        return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      };
      return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    }
    function readHaloRgb() {
      var r = lsGet("akini_halo_r", ""),
        g = lsGet("akini_halo_g", ""),
        b = lsGet("akini_halo_b", "");
      if (r === "" || g === "" || b === "") {
        /* 旧版 HSL 数据一次性迁移为 RGB */
        var oh = parseInt(lsGet("akini_halo_hue", "335"), 10) || 0;
        var os = parseInt(lsGet("akini_halo_sat", "100"), 10);
        if (isNaN(os)) os = 100;
        var ol = parseInt(lsGet("akini_halo_light", "75"), 10);
        if (isNaN(ol)) ol = 75;
        var c = hslToRgb(oh, os, ol);
        r = String(c[0]);
        g = String(c[1]);
        b = String(c[2]);
        lsSet("akini_halo_r", r);
        lsSet("akini_halo_g", g);
        lsSet("akini_halo_b", b);
      }
      return { r: parseInt(r, 10) || 0, g: parseInt(g, 10) || 0, b: parseInt(b, 10) || 0 };
    }
    function applyHaloColor() {
      var c = readHaloRgb();
      var r = c.r,
        g = c.g,
        b = c.b;
      /* 浅色变体：与白色混合 25%，用于弧光尾段，同一颜色的明暗层次 */
      var r2 = Math.round(r + (255 - r) * 0.25),
        g2 = Math.round(g + (255 - g) * 0.25),
        b2 = Math.round(b + (255 - b) * 0.25);
      var st = document.getElementById("akiniHaloStyle");
      if (!st) {
        st = document.createElement("style");
        st.id = "akiniHaloStyle";
        document.head.appendChild(st);
      }
      st.textContent =
        ".akcp-halo{border-color:rgba(" +
        r +
        "," +
        g +
        "," +
        b +
        ",.5)!important}" +
        ".akcp-halo::before{background:radial-gradient(circle,rgba(" +
        r +
        "," +
        g +
        "," +
        b +
        ",.38) 52%,rgba(" +
        r +
        "," +
        g +
        "," +
        b +
        ",.12) 66%,rgba(" +
        r +
        "," +
        g +
        "," +
        b +
        ",0) 74%)!important}" +
        ".akcp-halo::after{background:conic-gradient(from 0deg,rgba(" +
        r +
        "," +
        g +
        "," +
        b +
        ",0) 0deg,rgba(" +
        r +
        "," +
        g +
        "," +
        b +
        ",.95) 40deg,rgba(" +
        r2 +
        "," +
        g2 +
        "," +
        b2 +
        ",.95) 80deg,rgba(" +
        r +
        "," +
        g +
        "," +
        b +
        ",0) 125deg)!important}";
    }
    function ensureHaloDom() {
      if ($("akiniHaloModal")) return;
      var m = document.createElement("div");
      m.id = "akiniHaloModal";
      m.style.cssText =
        "display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:6020;align-items:center;justify-content:center";
      m.innerHTML =
        '<div style="width:88%;max-width:340px;background:#fff;border-radius:16px;padding:18px 16px 14px;box-sizing:border-box">' +
        '<div style="font-size:16px;font-weight:700;color:#1a1a1a;text-align:center;margin-bottom:14px">更改头像光环颜色</div>' +
        '<div style="display:flex;justify-content:center;margin-bottom:16px"><div id="akiniHaloPreview" style="width:64px;height:64px;border-radius:50%;background:#eee;position:relative"><div class="akcp-halo" style="position:absolute;inset:-2px"></div></div></div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:13px;color:#666;width:28px;flex-shrink:0">红色</span>' +
        '<input id="akiniHaloR" class="akini-rgb-slider" type="range" min="0" max="255" value="224"/>' +
        '<span id="akiniHaloRv" class="akini-rgb-val">224</span></div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:13px;color:#666;width:28px;flex-shrink:0">绿色</span>' +
        '<input id="akiniHaloG" class="akini-rgb-slider" type="range" min="0" max="255" value="96"/>' +
        '<span id="akiniHaloGv" class="akini-rgb-val">96</span></div>' +
        '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:13px;color:#666;width:28px;flex-shrink:0">蓝色</span>' +
        '<input id="akiniHaloB" class="akini-rgb-slider" type="range" min="0" max="255" value="138"/>' +
        '<span id="akiniHaloBv" class="akini-rgb-val">138</span></div>' +
        '<div style="display:flex;gap:10px;margin-top:18px"><button id="akiniHaloCancel" type="button" style="flex:1;height:42px;border-radius:10px;border:1px solid #e0e0e0;background:#f8f8f8;color:#555;font-size:15px;cursor:pointer">取消</button><button id="akiniHaloOk" type="button" style="flex:1;height:42px;border-radius:10px;border:none;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;cursor:pointer">保存</button></div>' +
        "</div>";
      document.body.appendChild(m);
      /* 白边圆环 thumb（内填当前颜色）+ 数值框样式 */
      var st2 = document.createElement("style");
      st2.textContent =
        ".akini-rgb-slider{-webkit-appearance:none;appearance:none;flex:1;min-width:0;height:14px;border-radius:7px;outline:none;background:#eee}" +
        ".akini-rgb-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:26px;height:26px;border-radius:50%;background:var(--akini-thumb-c,#fff);border:4px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);cursor:pointer;box-sizing:border-box}" +
        ".akini-rgb-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--akini-thumb-c,#fff);border:4px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);cursor:pointer}" +
        ".akini-rgb-val{min-width:44px;padding:6px 0;text-align:center;background:#1a1a1a;color:#fff;border-radius:10px;font-size:14px;font-weight:600;flex-shrink:0}";
      document.head.appendChild(st2);
      var upd = function () {
        var r = +$("akiniHaloR").value,
          g = +$("akiniHaloG").value,
          b = +$("akiniHaloB").value;
        $("akiniHaloRv").textContent = r;
        $("akiniHaloGv").textContent = g;
        $("akiniHaloBv").textContent = b;
        /* 轨道联动渐变：保持另外两通道不变，展示本通道 0→255 的颜色走向（同截图） */
        $("akiniHaloR").style.background =
          "linear-gradient(90deg,rgb(0," + g + "," + b + "),rgb(255," + g + "," + b + "))";
        $("akiniHaloG").style.background =
          "linear-gradient(90deg,rgb(" + r + ",0," + b + "),rgb(" + r + ",255," + b + "))";
        $("akiniHaloB").style.background =
          "linear-gradient(90deg,rgb(" + r + "," + g + ",0),rgb(" + r + "," + g + ",255))";
        /* 三条滑杆的圆环内都填当前合成色 */
        m.style.setProperty("--akini-thumb-c", "rgb(" + r + "," + g + "," + b + ")");
        var pv = $("akiniHaloPreview").querySelector(".akcp-halo");
        if (pv) pv.style.borderColor = "rgba(" + r + "," + g + "," + b + ",.5)";
        /* 实时整体预览 */
        var r2 = Math.round(r + (255 - r) * 0.25),
          g2 = Math.round(g + (255 - g) * 0.25),
          b2 = Math.round(b + (255 - b) * 0.25);
        var st = document.getElementById("akiniHaloPrevStyle");
        if (!st) {
          st = document.createElement("style");
          st.id = "akiniHaloPrevStyle";
          document.head.appendChild(st);
        }
        st.textContent =
          "#akiniHaloPreview .akcp-halo::before{background:radial-gradient(circle,rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",.38) 52%,rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",.12) 66%,rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",0) 74%)!important}" +
          "#akiniHaloPreview .akcp-halo::after{background:conic-gradient(from 0deg,rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",0) 0deg,rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",.95) 40deg,rgba(" +
          r2 +
          "," +
          g2 +
          "," +
          b2 +
          ",.95) 80deg,rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",0) 125deg)!important}";
      };
      $("akiniHaloR").addEventListener("input", upd);
      $("akiniHaloG").addEventListener("input", upd);
      $("akiniHaloB").addEventListener("input", upd);
      $("akiniHaloCancel").addEventListener("click", function () {
        m.style.display = "none";
      });
      m.addEventListener("click", function (e) {
        if (e.target === m) m.style.display = "none";
      });
      $("akiniHaloOk").addEventListener("click", function () {
        lsSet("akini_halo_r", $("akiniHaloR").value);
        lsSet("akini_halo_g", $("akiniHaloG").value);
        lsSet("akini_halo_b", $("akiniHaloB").value);
        applyHaloColor();
        m.style.display = "none";
      });
    }
    function bindHaloMenu() {
      var btn = $("companionActHalo");
      if (!btn || btn._haloBound) return;
      btn._haloBound = true;
      btn.addEventListener("click", function () {
        closeSheet("companionMenuSheet");
        ensureHaloDom();
        var c = readHaloRgb();
        $("akiniHaloR").value = c.r;
        $("akiniHaloG").value = c.g;
        $("akiniHaloB").value = c.b;
        $("akiniHaloR").dispatchEvent(new Event("input"));
        $("akiniHaloModal").style.display = "flex";
      });
    }
    applyHaloColor();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(bindHaloMenu, 450);
      });
    } else {
      setTimeout(bindHaloMenu, 450);
    }
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
    try {
      applyHaloColor();
    } catch (e) {}
    setTimeout(bindNovelMenu, 400);
    setTimeout(bindHaloMenu, 450);
  }
})();
