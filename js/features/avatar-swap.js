(function () {
  "use strict";
  if (window.__akiniAvatarSwapReady) return;
  window.__akiniAvatarSwapReady = true;

  var KEY = "akini_swap_avatar_pos";

  function readState() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "1" || v === "true" || v === true;
    } catch (e) {
      return false;
    }
  }

  var _lastApplied = null;
  var _mergeTimer = null;
  var _mergedForce = false;
  function doRefresh(force) {
    var state = readState();
    if (!force && _lastApplied === state) return;
    _lastApplied = state;
    try {
      window.reapplyAvatarSwap();
    } catch (e) {}
  }
  function refresh(force) {
    if (force) _mergedForce = true;
    if (_mergeTimer) return;
    _mergeTimer = setTimeout(function () {
      _mergeTimer = null;
      var f = _mergedForce;
      _mergedForce = false;
      doRefresh(f);
    }, 120);
  }
  window.__akiniApplyAvatarSwap = function () {
    refresh(true);
  };

  /* 开关点击兜底：core 未接管（状态没变）时补一次状态切换再重渲染。
     必须在捕获阶段记录点击前状态，否则 core 的元素级处理器会先改状态。 */
  var pendingState = null;
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target && e.target.closest ? e.target.closest("#swapAvatarPosToggle,#swapAvatarRow") : null;
      if (!t) return;
      pendingState = readState();
    },
    true,
  );
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target && e.target.closest ? e.target.closest("#swapAvatarPosToggle,#swapAvatarRow") : null;
      if (!t) return;
      var before = pendingState;
      pendingState = null;
      setTimeout(function () {
        if (before !== null && readState() === before) {
          try {
            localStorage.setItem(KEY, before ? "0" : "1");
          } catch (err) {}
        }
        refresh(true);
      }, 60);
    },
    false,
  );

  var _forceOnce = function () {
    refresh(true);
  };
  ["DOMContentLoaded", "load"].forEach(function (ev) {
    if (document.readyState === "complete" && ev === "load") {
      _forceOnce();
      return;
    }
    window.addEventListener(ev, _forceOnce);
  });
  window.addEventListener("akini-img-ready", _forceOnce);
  window.addEventListener("akini-storage-restored", _forceOnce);
  /* 回前台/往返缓存恢复：不强制，只有开关真的变了才重绘 */
  window.__akiniOnVisible(function () { refresh(false); });
  window.addEventListener("pageshow", function () {
    refresh(false);
  });
  /* 安卓 resize（地址栏收起/软键盘）会高频触发，必须节流 */
  var _rzTimer = null;
  window.addEventListener("resize", function () {
    if (_rzTimer) clearTimeout(_rzTimer);
    _rzTimer = setTimeout(function () {
      refresh(false);
    }, 300);
  });

  refresh(true);
  setTimeout(function () {
    refresh(true);
  }, 1200);
})();

(function () {
  "use strict";
  if (window.__akiniChatAvatarSyncReady) return;
  window.__akiniChatAvatarSyncReady = true;

  function srcOf(v) {
    if (!v) return "";
    var s = String(v);
    if (!/^(data:|https?:|blob:)/.test(s)) {
      var m = s.match(/src="([^"]+)"/);
      s = m && m[1] ? m[1] : "";
    }
    return /^(data:|https?:|blob:)/.test(s) ? s : "";
  }

  function myAvatarSrc() {
    try {
      return window.getMyAvatarSrc ? window.getMyAvatarSrc() : "";
    } catch (e) {
      return "";
    }
  }

  /* 顶部头像（首页/聊天页顶部那一张）才是「用户刚换的头像」。
     消息历史里的头像如果在发送时写死，之后就会和顶部头像对不上。 */
  function topTaAvatar() {
    try {
      var list = ["akini_ta_avatar", "akini_avatar_right", "akini_icity_ta_avatar"];
      for (var i = 0; i < list.length; i++) {
        var s = srcOf(localStorage.getItem(list[i]));
        if (s && !(window.__akiniIsDefaultAvatarToken && window.__akiniIsDefaultAvatarToken(s))) return s;
      }
    } catch (e) {}
    return "";
  }

  function contactAvatarSrc(cid) {
    try {
      var t =
        window.akiniContacts && window.akiniContacts.getChatTarget ? window.akiniContacts.getChatTarget(cid) : null;
      return t && t.avatar ? srcOf(t.avatar) : "";
    } catch (e) {
      return "";
    }
  }

  var _unifying = false;
  function taAvatarSrc(cid) {
    var top = topTaAvatar();
    var cur = contactAvatarSrc(cid);
    /* 源头统一：顶部头像变了以后，把联系人的 avatar 也改成同一张。
       否则聊天页头/首页/消息列表读 contact.avatar，消息历史读旧值，永远对不上。 */
    if (top && top !== cur && !_unifying) {
      _unifying = true;
      try {
        if (window.akiniContacts && window.akiniContacts.updateContact)
          window.akiniContacts.updateContact(cid, { avatar: top });
      } catch (e) {}
      setTimeout(function () {
        _unifying = false;
      }, 800);
    }
    return top || cur || srcOf(localStorage.getItem("akini_ta_avatar"));
  }

  function chatId() {
    try {
      var id =
        window.akiniContacts && window.akiniContacts.getActiveChatId ? window.akiniContacts.getActiveChatId() : null;
      if (id) return id;
      var c = window.__akiniDefaultContact && window.__akiniDefaultContact();
      return c && c.id ? c.id : null;
    } catch (e) {
      return null;
    }
  }

  function rewrite(html, my, ta) {
    if (!html || typeof html !== "string" || html.indexOf("msg-avatar") < 0) return html;
    try {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var changed = false;
      if (my)
        doc.querySelectorAll(".msg-row.me .msg-avatar img").forEach(function (img) {
          if (img.getAttribute("src") !== my) {
            img.setAttribute("src", my);
            changed = true;
          }
        });
      if (ta)
        doc.querySelectorAll(".msg-row.other .msg-avatar img").forEach(function (img) {
          if (img.getAttribute("src") !== ta) {
            img.setAttribute("src", ta);
            changed = true;
          }
        });
      return changed ? doc.body.innerHTML : html;
    } catch (e) {
      return html;
    }
  }

  function patchDom(my, ta) {
    var body = document.getElementById("chatBody");
    if (!body) return;
    if (my)
      body.querySelectorAll(".msg-row.me .msg-avatar img").forEach(function (img) {
        if (img.getAttribute("src") !== my) img.setAttribute("src", my);
      });
    if (ta)
      body.querySelectorAll(".msg-row.other .msg-avatar img").forEach(function (img) {
        if (img.getAttribute("src") !== ta) img.setAttribute("src", ta);
      });
  }

  var running = false;
  var _lastSig = null;
  var timer = null;
  var _pendingForce = false;
  function sync(force) {
    if (running) return;
    running = true;
    try {
      var cid = chatId();
      if (!cid) return;
      var my = myAvatarSrc();
      var ta = taAvatarSrc(cid);
      if (!my && !ta) return;
      /* 头像没变就跳过重型历史改写：避免每次图片加载/回前台都全量解析聊天记录（卡顿源）。
         当前可见 DOM 始终修正（代价很小）；数据来源（IDB 回填）晚到时由强制事件重跑。 */
      var sig = my + "|" + ta;
      patchDom(my, ta);
      if (!force && sig === _lastSig) return;
      _lastSig = sig;
      var old = "";
      var fromMem = false;
      try {
        old = window.__akiniGetChatMem ? window.__akiniGetChatMem(cid) : "";
        fromMem = !!old;
      } catch (e) {}
      if (!fromMem || !window.__akiniRestoreSettled) {
        _lastSig = null;
        return;
      }
      var fixed = rewrite(old, my, ta);
      if (fixed !== old) {
        /* 数组模型：整段改写走 chat-log，避免把 HTML 字符串写进 JSON 主记录 */
        try {
          if (window.__akiniChatLog) window.__akiniChatLog.replace(cid, fixed);
          else if (window.akiniStore && window.akiniStore.set)
            window.akiniStore.set("akini_chat_history_" + cid, fixed, null, { authoritative: true });
          else localStorage.setItem("akini_chat_history_" + cid, fixed);
        } catch (e) {}
        /* 同步 core 的内存/渲染缓存，否则本次会话内重新渲染会退回旧头像 */
        try {
          window.akiniContacts.updateSession(cid, { messagesHTML: fixed, allowShrink: true });
        } catch (e) {}
      }
      /* 会话列表行头像也走同一份数据，顺手重绘一次 */
      try {
        window.renderChatList();
      } catch (e) {}
    } catch (e) {
    } finally {
      running = false;
    }
  }
  function schedule(force) {
    if (force) _pendingForce = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      var f = _pendingForce;
      _pendingForce = false;
      sync(f);
      /* 给渲染一次兜底机会后清掉脏标记，避免每次渲染都全量解析聊天记录 */
      setTimeout(function () {
      }, 600);
    }, 200);
  }

  window.addEventListener("akini-avatar-changed", function () {
    schedule(true);
  });
  window.addEventListener("akini-storage-restored", function () {
    schedule(true);
  });
  window.addEventListener("akini-img-ready", function () {
    schedule(true);
  });
  window.__akiniOnVisible(function () { schedule(false); });
  window.addEventListener("pageshow", function () {
    schedule(false);
  });
  /* 首屏之后 IDB 聊天记录可能晚到，只在还没有内容时补几轮 */
  [1200, 3000].forEach(function (ms) {
    setTimeout(function () {
      if (_lastSig === null) schedule(true);
    }, ms);
  });
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () {
      schedule(true);
    });
  else schedule(true);
})();
