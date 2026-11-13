(function () {
  "use strict";
  if (window.__akiniChatEngineInstalled) return;
  window.__akiniChatEngineInstalled = true;

  var EMPTY_TIP = "字卡库为空，请先到字卡库添加回复内容";

  /* ---------------------------- 基础工具 ---------------------------- */

  function num(key, dflt) {
    var v = parseFloat(localStorage.getItem(key) || "");
    return isNaN(v) ? dflt : v;
  }

  function reportErr(where, e) {
    try {
      console.error("[AkiniChatEngine] " + where, (e && (e.stack || e.message)) || e);
    } catch (_) {}
    try {
      if (window.__akiniReportErr) window.__akiniReportErr("聊天引擎-" + where, e);
    } catch (_) {}
  }

  function escapeHtml(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function activeId() {
    try {
      return window.akiniContacts && window.akiniContacts.getActiveChatId
        ? window.akiniContacts.getActiveChatId()
        : null;
    } catch (e) {
      return null;
    }
  }

  function getTarget(cid) {
    try {
      return window.akiniContacts && window.akiniContacts.getChatTarget
        ? window.akiniContacts.getChatTarget(cid)
        : null;
    } catch (e) {
      return null;
    }
  }

  /* ------------------------- 字卡池（原生 replyPool） ------------------------- */

  var bankCache = null;
  var bankAt = 0;

  function readBank() {
    var now = Date.now();
    if (bankCache && now - bankAt < 1000) return bankCache;

    var bank = [];
    try {
      var v = window.__wbRead ? window.__wbRead("akini_wordbank", []) : null;
      if (Array.isArray(v)) bank = v;
    } catch (e) {}
    if (!bank.length) {
      try {
        var raw = localStorage.getItem("akini_wordbank");
        var sp = raw ? JSON.parse(raw) : null;
        if (Array.isArray(sp)) bank = sp;
      } catch (e2) {}
    }

    bankCache = bank;
    bankAt = now;
    return bank;
  }


  /* 可用字卡：排除拍一拍 / 气泡类，正文必须非空（与 原生 的过滤一致） */
  function isUsableCard(c) {
    if (!c) return false;
    if (typeof c === "string") return !!c.trim();
    var tab = (c.tab || "").toLowerCase();
    var type = (c.type || "").toLowerCase();
    if (tab === "pat" || tab === "bubble" || type === "pat" || type === "bubble") return false;
    var text = c.text || c.content || "";
    return typeof text === "string" && !!text.trim();
  }

  function cardText(c) {
    if (typeof c === "string") return c.trim();
    return String((c && (c.text || c.content)) || "").trim();
  }

  function replyPool(cid) {
    var bank = readBank();
    var list = (Array.isArray(bank) ? bank : []).filter(isUsableCard);
    if (!list.length) return [];
    {
      var filtered = null;
      try {
        filtered = window.__wbFilter(list, cid == null ? "" : String(cid));
      } catch (e) {
        filtered = null;
      }
      if (filtered) list = filtered;
    }
    return list;
  }


  /* 原生：随机取词最多重试 6 次，确保返回可用文本 */
  function pickReplyText(cid) {
    var pool = replyPool(cid);
    if (!pool.length) return "";
    for (var i = 0; i < 6; i++) {
      var c = pool[Math.floor(Math.random() * pool.length)];
      var t = cardText(c);
      if (t) return t;
    }
    return "";
  }

  /* --------------------- 从源头替换取词函数 ---------------------
     core 的 G / J / 转账回复 / 朋友圈等全部走 window.pickWordCards，
     换掉它以后，所有链路都获得「重试 + 禁用过滤」的保障。 */
  var enginePick = function (count, cid) {
    count = Math.max(1, parseInt(count, 10) || 1);
    var pool = replyPool(cid);
    if (!pool.length) return "";
    var out = [];
    for (var i = 0; i < count; i++) {
      var t = pickReplyText(cid);
      if (t) out.push(t);
    }
    return out.join("\n");
  };
  enginePick.__akiniEngine = true;
  window.pickWordCards = enginePick;

  /* --------------------------- 提示 / 输入中 --------------------------- */

  var lastEmptyTipAt = 0;
  function notifyEmpty() {
    var now = Date.now();
    if (now - lastEmptyTipAt < 8000) return;
    lastEmptyTipAt = now;
    try {
      return void window.__akiniNotify(EMPTY_TIP);
    } catch (e) {}
  }

  window.__akiniNotifyEmptyReply = notifyEmpty;
  window.__akiniHasReplyPool = function (cid) {
    return replyPool(cid).length > 0;
  };

  function typingEl() {
    return document.getElementById("typingIndicator");
  }

  function showTyping(cid, target) {
    try {
      if (!cid || document.hidden) return;
      var active = activeId();
      if (active && active !== cid) return;
      window.__akiniTypingMap = window.__akiniTypingMap || {};
      var old = window.__akiniTypingMap[cid];
      if (old && old.timer) clearTimeout(old.timer);
      var avatarHtml = "";
      try {
        avatarHtml = window._akiniAv ? window._akiniAv(target && target.avatar, 38, cid) : "";
      } catch (e) {}
      window.__akiniTypingMap[cid] = {
        avatar: avatarHtml,
        timer: setTimeout(function () {
          clearTyping(cid);
        }, 120000),
      };
      var el = typingEl();
      if (el) el.style.display = "block";
      window.__akiniPaintTypingFloat();
    } catch (e) {
      reportErr("showTyping", e);
    }
  }

  function clearTyping(cid) {
    try {
      window.__akiniTypingMap = window.__akiniTypingMap || {};
      if (cid) {
        var e = window.__akiniTypingMap[cid];
        if (e && e.timer) clearTimeout(e.timer);
        delete window.__akiniTypingMap[cid];
      }
      var active = activeId();
      if (!cid || !active || active === cid) {
        var el = typingEl();
        if (el) el.style.display = "none";
        var body = document.getElementById("chatBody");
        if (body) {
          var rows = body.querySelectorAll('[id^="typingBubbleRow_"]');
          for (var i = 0; i < rows.length; i++) {
            try {
              rows[i].remove();
            } catch (e2) {
              try {
                rows[i].parentNode && rows[i].parentNode.removeChild(rows[i]);
              } catch (e3) {}
            }
          }
        }
      }
      window.__akiniPaintTypingFloat();
    } catch (e) {
      reportErr("clearTyping", e);
    }
  }

  /* ------------------------- 兜底直发（绝不静默） ------------------------- */

  function otherCount(cid) {
    try {
      var s = window.akiniContacts.getSession ? window.akiniContacts.getSession(cid) : null;
      var html = (s && s.messagesHTML) || "";
      var m = html.match(/msg-row other/g);
      return m ? m.length : 0;
    } catch (e) {
      return -1;
    }
  }

  function fallbackAppend(cid, target, text) {
    if (!cid || !text) return false;
    try {
      var name = (target && target.name) || "对方";
      var avatar = (target && target.avatar) || "";
      var av = "";
      try {
        av = window._akiniAv ? window._akiniAv(avatar, 38, cid) : "";
      } catch (e) {}
      var ts = window.__akiniNextTs ? window.__akiniNextTs() : Date.now();
      var html =
        '<div class="msg-row other" data-ts="' +
        ts +
        '">' +
        '<div class="msg-content-line">' +
        '<div class="msg-avatar" data-sender-name="' +
        escapeHtml(name) +
        '">' +
        av +
        "</div>" +
        '<div class="bubble">' +
        escapeHtml(text) +
        "</div>" +
        "</div></div>";

      var contacts = window.akiniContacts;
      var active = activeId();
      var sess = contacts && contacts.getSession ? contacts.getSession(cid) || {} : {};
      var unread = active === cid ? sess.unread || 0 : (sess.unread || 0) + 1;

      window.__akiniAppendMessageHTML(cid, html, {
        lastMsg: text,
        lastTime: Date.now(),
        unread: unread,
        lastSenderAvatar: avatar,
        lastSenderName: name,
      });
      return true;
    } catch (e) {
      reportErr("fallbackAppend", e);
    }
    return false;
  }

  /* ------------------- 包 window.I（core 的 G）：全路径兜底 ------------------- */

  function wrapI() {
    var orig = window.I;
    if (typeof orig !== "function" || orig.__akiniEngineWrapped) return typeof orig === "function";

    function wrapped(cid, target, behavior, instant, member) {
      var args = arguments;
      try {
        var contacts = window.akiniContacts;
        cid = cid || activeId();
        if (!cid || !contacts) return orig.apply(this, args);
        target = target || getTarget(cid);
        if (!behavior) {
          try {
            behavior = window.AKR && window.AKR.pickReplyBehavior ? window.AKR.pickReplyBehavior() : null;
          } catch (e) {}
        }
        var isNone = !!(behavior && behavior.type === "none");
        var isPoke = !!(behavior && behavior.extra && behavior.extra.poke);

        if (!isNone && !isPoke && !replyPool(cid).length) {
          clearTyping(cid);
          notifyEmpty();
          return;
        }

        var before = otherCount(cid);
        var ret;
        try {
          ret = orig.call(this, cid, target, behavior, instant, member);
        } catch (err) {
          reportErr("window.I 渲染失败", err);
          ret = undefined;
          if (window.__akiniReportErr) {
            try {
              window.__akiniReportErr("回复-渲染", err);
            } catch (e2) {}
          }
        }

        /* 渲染失败或静默返回时，用保证可用的文本补一条；拍一拍不追加文字。 */
        if (!isNone && !isPoke) {
          var after = otherCount(cid);
          if (after < 0 || after <= before) {
            var text = pickReplyText(cid);
            if (text && fallbackAppend(cid, target, text)) {
              clearTyping(cid);
            } else if (!text) {
              clearTyping(cid);
              notifyEmpty();
            }
          }
        }
        return ret;
      } catch (e) {
        reportErr("wrapI", e);
        try {
          return orig.apply(this, args);
        } catch (e2) {
          return undefined;
        }
      }
    }

    wrapped.__akiniEngineWrapped = true;
    wrapped.__akiniInner = orig;
    window.I = wrapped;
    return true;
  }

  /* --------------------- 回消息（原生 simulateReply） --------------------- */

  function autoReply(cid, force) {
    try {
      var contacts = window.akiniContacts;
      if (!contacts) return;
      if (window.__akiniToggleOn && !window.__akiniToggleOn("contactReplyToggle", true)) return;

      cid = cid || activeId();
      if (!cid) return;
      var target = getTarget(cid);
      if (!target) return;

      var behavior = null;
      try {
        behavior = window.AKR && window.AKR.pickReplyBehavior ? window.AKR.pickReplyBehavior() : null;
      } catch (e) {}
      if (!behavior || !behavior.type) behavior = { type: "text", extra: {} };
      if (force && behavior.type === "none") behavior = { type: "text", extra: {} };
      if (behavior.type === "none") return;
      var isPoke = !!(behavior.extra && behavior.extra.poke);

      if (!isPoke && !replyPool(cid).length) {
        clearTyping(cid);
        notifyEmpty();
        return;
      }

      var active = activeId();
      if (active === cid) showTyping(cid, target);

      var dmin = num("akini_num_replyDelayMin", 3);
      var dmax = num("akini_num_replyDelayMax", 7);
      if (dmin <= 0) dmin = 3;
      if (dmax < dmin) dmax = dmin + 1;
      var delay = 1000 * (dmin + Math.random() * (dmax - dmin));

      setTimeout(function () {
        try {
          if (!isPoke && !replyPool(cid).length) {
            clearTyping(cid);
            notifyEmpty();
            return;
          }
          window.I(cid, target, behavior, true);
        } catch (e) {
          reportErr("autoReply:send", e);
          var text = pickReplyText(cid);
          if (text) fallbackAppend(cid, target, text);
          else notifyEmpty();
          clearTyping(cid);
        }
      }, delay);
    } catch (e) {
      reportErr("autoReply", e);
    }
  }

  var capturedOrig = { trigger: null, force: null };

  function captureOrig() {
    if (
      !capturedOrig.trigger &&
      typeof window.akiniTriggerReply === "function" &&
      !window.akiniTriggerReply.__akiniEngine
    ) {
      capturedOrig.trigger = window.akiniTriggerReply;
    }
    if (
      !capturedOrig.force &&
      typeof window.__akiniForceReply === "function" &&
      !window.__akiniForceReply.__akiniEngine
    ) {
      capturedOrig.force = window.__akiniForceReply;
    }
  }

  /* ---- akiniTriggerReply：表情包 / 转账后的回消息，改走 原生 模型 ---- */
  function wTrigger(cid) {
    try {
      autoReply(cid, false);
    } catch (e) {
      try {
        if (capturedOrig.trigger) return capturedOrig.trigger.apply(this, arguments);
      } catch (e2) {}
    }
  }
  wTrigger.__akiniEngine = true;

  /* ---- __akiniForceReply：底部「继续」/ 看门狗强制补一条，只发一次 ---- */
  function wForce() {
    try {
      if (window.__akiniForceReplyInFlight) return;
      window.__akiniForceReplyInFlight = true;
      setTimeout(function () {
        window.__akiniForceReplyInFlight = false;
      }, 9000);
      autoReply(null, true);
    } catch (e) {
      try {
        if (capturedOrig.force) return capturedOrig.force.apply(this, arguments);
      } catch (e2) {}
    }
  }
  wForce.__akiniEngine = true;

  /* ---- 主动发消息：原生 模型 —— 先验池，再输入中，再发，绝不空跑 ---- */
  function wTaReply(cid, minDelay) {
    try {
      if (window.Ai && window.Ai.active) return;
      if (window.__akiniToggleOn && !window.__akiniToggleOn("contactActiveMsgToggle", false)) return;
      var contacts = window.akiniContacts;
      if (!contacts) return;

      cid = cid || activeId();
      if (!cid) return;
      var target = getTarget(cid);
      if (!target) return;

      /* 主动发消息同样先验池：空则提示，绝不空跑 */
      if (!replyPool(cid).length) {
        notifyEmpty();
        return;
      }

      var dmin = num("akini_num_replyDelayMin", 3);
      var dmax = num("akini_num_replyDelayMax", 7);
      if (dmin <= 0) dmin = 3;
      if (dmax < dmin) dmax = dmin + 1;
      var delay = 1000 * (dmin + Math.random() * (dmax - dmin));
      var floor = typeof minDelay === "number" && minDelay > 0 ? minDelay : 600 + 900 * Math.random();
      if (delay < floor) delay = floor;

      var active = activeId();
      if (active === cid) showTyping(cid, target);

      setTimeout(function () {
        try {
          if (!replyPool(cid).length) {
            clearTyping(cid);
            notifyEmpty();
            return;
          }
          var behavior = null;
          try {
            behavior = window.AKR && window.AKR.pickReplyBehavior ? window.AKR.pickReplyBehavior() : null;
          } catch (e) {}
          if (!behavior || !behavior.type || behavior.type === "none") behavior = { type: "text", extra: {} };
          window.I(cid, target, behavior, true);
        } catch (e) {
          reportErr("activeSend:send", e);
          var text = pickReplyText(cid);
          if (text) fallbackAppend(cid, target, text);
          else notifyEmpty();
          clearTyping(cid);
        }
      }, delay);
    } catch (e) {
      reportErr("triggerTaReplyOnce", e);
    }
  }
  wTaReply.__akiniEngine = true;

  /* 安装（幂等）：core 已经有完整的「概率 → 输入中 → 延迟 → 1~3 条」回复链路，
     引擎不再并行挂第二套 autoReply（两套会各排一次定时器，表现为回复概率翻倍）。
     只有 core 的入口不存在时才用引擎兜底。 */
  function installEntryHooks() {
    captureOrig();
    if (capturedOrig.trigger) window.akiniTriggerReply = capturedOrig.trigger;
    else if (window.akiniTriggerReply !== wTrigger) window.akiniTriggerReply = wTrigger;
    if (capturedOrig.force) window.__akiniForceReply = capturedOrig.force;
    else if (window.__akiniForceReply !== wForce) window.__akiniForceReply = wForce;
    if (window.pickWordCards !== enginePick) window.pickWordCards = enginePick;
    if (window.triggerTaReplyOnce !== wTaReply) window.triggerTaReplyOnce = wTaReply;
  }

  /* core 的 __akiniBootComplete 在它完成全部赋值之后才置 true；
     DOMContentLoaded 监听器按注册顺序执行，core 先注册，所以这里天然后跑。 */
  function bootInstall() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        setTimeout(installEntryHooks, 0);
      });
    } else {
      setTimeout(installEntryHooks, 0);
    }
    /* 兜底：即使 core 的赋值发生在事件之后，也会在几个时间点补装回来 */
    var delays = [300, 1000, 2500, 5000];
    for (var i = 0; i < delays.length; i++) setTimeout(installEntryHooks, delays[i]);
    var n = 0;
    var iv = setInterval(function () {
      if (window.__akiniBootComplete) {
        installEntryHooks();
        clearInterval(iv);
      } else if (++n > 600) clearInterval(iv);
    }, 100);
  }
  bootInstall();

  /* ------------------------- 安装 window.I 包装 ------------------------- */
  if (!wrapI()) {
    var tries = 0;
    var iv = setInterval(function () {
      if (wrapI() || ++tries > 200) clearInterval(iv);
    }, 150);
  }
})();
