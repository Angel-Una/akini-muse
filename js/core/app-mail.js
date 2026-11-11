(function () {
  "use strict";
  if (window.akiniMailEngine) return;

  function fmtDate() {
    return new Date().toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  function fmtDateAt(ts) {
    return new Date(ts).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // 记录最近活跃时间，用于离线补发来信时还原"离线期间"的时间段
  function markActive() {
    if (document.hidden) return;
    try {
      localStorage.setItem("akini_mail_last_active", String(Date.now()));
    } catch (e) {}
  }
  // getSync 返回原始存储值（JSON 字符串或 null），统一解析成数组
  function _asArr(v) {
    if (!v) return [];
    if (typeof v === "string") {
      try {
        var a = JSON.parse(v);
        return Array.isArray(a) ? a : [];
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(v) ? v : [];
  }
  /* raw LS 权威读优先（内存镜像可能滞后），LS 无值再退内存/IDB */
  function _rawFirst(key) {
    try {
      if (window.akiniStore && window.akiniStore.rawLSGet) {
        var raw = window.akiniStore.rawLSGet(key);
        if (raw) return _asArr(raw);
      }
    } catch (e) {}
    return _asArr(window.akiniStore && window.akiniStore.getSync ? window.akiniStore.getSync(key, []) : []);
  }
  function getSent() {
    return _rawFirst("akini_mail_sent");
  }
  function getReceived() {
    return _rawFirst("akini_mail_received");
  }
  function saveSent(arr) {
    var n = JSON.stringify(arr || []);
    {
      window.saveMailSent(arr);
      return;
    }
    try {
      localStorage.setItem("akini_mail_sent", n);
    } catch (eLS) {}
  }
  function saveReceived(arr) {
    var n = JSON.stringify(arr || []);
    {
      window.saveMailReceived(arr);
      return;
    }
    try {
      localStorage.setItem("akini_mail_received", n);
    } catch (eLR) {}
  }
  // 生成随机来信内容（compat envelope 式合成：字卡库随机 5-12 句，句号连接成段，
  // 并在随机 1-3 个句号后插入换行，形成信件排版）
  function genLetter(count) {
    count = parseInt(count, 10);
    if (isNaN(count) || count < 1) count = Math.floor(Math.random() * 8) + 5;
    if (!window.pickWordCards) return "";
    var raw = window.pickWordCards(count);
    if (!raw) return "";
    var sentences = raw
      .split("\n")
      .filter(function (s) {
        return s && s.trim();
      })
      .map(function (s) {
        return s.trim().replace(/。+$/, "") + "。";
      });
    var content = sentences.join("");
    // 随机选 1-3 个句号位置插入换行（不拆分句子）
    var periodPositions = [];
    for (var i = 0; i < content.length; i++) {
      if (content[i] === "。") periodPositions.push(i);
    }
    var breakCount = Math.min(Math.floor(Math.random() * 3) + 1, periodPositions.length);
    var shuffled = periodPositions.sort(function () {
      return Math.random() - 0.5;
    });
    for (var b = 0; b < breakCount; b++) {
      var pos = shuffled[b] + 1;
      content = content.substring(0, pos) + "\n" + content.substring(pos);
      for (var j = b + 1; j < shuffled.length; j++) {
        if (shuffled[j] > pos - 1) shuffled[j]++;
      }
    }
    return content.trim();
  }

  // compat 照搬：回信内容生成（8~12 句，每句随机标点 20%「！」/20%「...」/其余「。」）
  function genReplyText() {
    if (!window.pickWordCards) return "";
    var count = Math.floor(Math.random() * 5) + 8;
    var raw = window.pickWordCards(count);
    if (!raw) return "";
    var sentences = raw.split("\n").filter(function (s) {
      return s && s.trim();
    });
    var out = "";
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i].trim().replace(/[。！!]+$/, "");
      var r = Math.random();
      out += s + (r < 0.2 ? "！" : r < 0.4 ? "..." : "。");
    }
    return out;
  }

  // ========== 离线回信投递：检查所有已预约 replyTime 且到点的回信 ==========
  function checkStatus() {
    if (document.hidden) return;
    try {
      var now = Date.now();
      var sent = getSent();
      var changed = false;
      var delivered = [];
      for (var i = 0; i < sent.length; i++) {
        var s = sent[i];
        if (s && s.replyTime && !s.repliedByTa && now >= s.replyTime) {
          var recv = getReceived();
          recv.push({
            content: s.replyContent || genReplyText() || genLetter(),
            // 用回信预约时间作为显示时间，还原"离线期间"对方回信的时间段
            date: fmtDateAt(s.replyTime),
            ts: s.replyTime,
            from: s.replyFromName || s.to || "对方",
            fromId: s.replyFromId || s.toId,
            subtype: "reply",
            originalContent: s.content,
            read: false,
            isRead: false,
          });
          saveReceived(recv);
          s.repliedByTa = true;
          s.isRead = true;
          s.read = true;
          changed = true;
          delivered.push(s);
        } else if (s && s.replyTime && now >= s.replyTime && (!s.isRead || !s.repliedByTa)) {
          // 回信时间到达，确保寄信状态置为已读
          s.repliedByTa = true;
          s.isRead = true;
          s.read = true;
          changed = true;
        }
      }
      if (changed) saveSent(sent);
      // 每次投递/状态变更后推进已读游标（同 saveMailReceived 内逻辑）
      var _lrt2 = 0;
      try {
        (sent || []).forEach(function (m) {
          if (m && (m.read || m.isRead) && m.ts && m.ts > _lrt2) _lrt2 = m.ts;
        });
      } catch (eL3) {}
      if (_lrt2 > 0) {
        try {
          var _cur2 = parseFloat(localStorage.getItem("akini_mail_latest_read_ts") || "0") || 0;
          if (_lrt2 > _cur2) localStorage.setItem("akini_mail_latest_read_ts", String(_lrt2));
        } catch (eL4) {}
      }
      // 通知 UI（回信与其它互动一致：站内弹窗 / 后台系统通知都走 showInAppNotif）
      for (var d = 0; d < delivered.length; d++) {
        var s2 = delivered[d];
        /* TA 的手机信箱只收藏"我寄出的信 / 我回复 TA 的回信"，
           联系人回给我的信属于我自己的信箱，这里不再收藏。 */
        if (window.showInAppNotif) {
          // 头像实时从联系人取：预约时存的 replyAvatar 可能是换头像前的旧值
          var _rc = null;
          try {
            if (window.akiniContacts && s2.replyFromId) _rc = window.akiniContacts.getChatTarget(s2.replyFromId);
          } catch (e) {}
          var _rava = (_rc && _rc.avatar && String(_rc.avatar).trim()) || s2.replyAvatar || "";
          window.showInAppNotif({
            app: "信箱",
            avatar: window.nt ? window.nt(_rava, 40) : "",
            chatId: s2.replyFromId || "",
            name: s2.replyFromName || "对方",
            fullContent: true,
            msg: (s2.replyFromName || "对方") + "回复了你的信件",
            onTap: function () {
              if (window.o) window.o("mail");
              if (window.__mailShowTab) window.__mailShowTab("received");
            },
          });
        }
      }
      if (delivered.length && window.__renderMail) window.__renderMail();
    } catch (e) {
      console.warn("[akini-mail-engine] checkStatus error", e);
    }
  }

  // ========== 主动来信定时器（原生 自调度模型 + 离线补发） ==========
  // 模型：单一自调度定时器；开关关则 return；按用户设置的最小~最大范围随机取一个间隔；
  // 触发后发信并自调度下一次；排期写入 akini_next_mailAutoSend，离线错过的在启动/回到前台时补发。
  var autoTimer = null;

  // 时间段解析（HH:MM → 当天分钟数；跨午夜，时间段外不发、顺延到下一次进入时间段）
  function _parseMin(t) {
    var p = String(t || "").split(":");
    return parseInt(p[0] || "0", 10) * 60 + parseInt(p[1] || "0", 10);
  }
  function _rangeInfo() {
    var rStart = localStorage.getItem("akini_time_mail_start") || "";
    var rEnd = localStorage.getItem("akini_time_mail_end") || "";
    var start = _parseMin(rStart),
      end = _parseMin(rEnd);
    // 两个值都为 0 且未设置 → 视为全天允许
    var configured = !!(rStart || rEnd) && !(start === 0 && end === 0 && !rStart && !rEnd);
    return { start: start, end: end, configured: configured };
  }
  function _nowMin() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  // 距离下一次进入时间段开始还有多少毫秒（全天允许返回 0）
  function _nextRangeDelay(info) {
    if (!info.configured) return 0;
    var cur = _nowMin();
    var start = info.start,
      end = info.end;
    var inRange = start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
    if (inRange) return 0;
    // 跨午夜计算下一次 start
    var target;
    if (start <= end) target = cur < start ? start : start + 1440;
    else target = cur >= end && cur < start ? start : start + 1440;
    var diff = (target - cur + 1440) % 1440;
    if (diff <= 0) diff = 1;
    return diff * 60000;
  }

  // 计算下一封主动来信的随机延迟（毫秒），仅依据用户设置的间隔
  function _randomIntervalMs() {
    var minH = parseFloat(localStorage.getItem("akini_num_activeMailMin") || "");
    var maxH = parseFloat(localStorage.getItem("akini_num_activeMailMax") || "");
    var minMs, maxMs;
    if (!isNaN(minH) && minH > 0) {
      minMs = minH * 3600e3;
      maxMs = (!isNaN(maxH) && maxH >= minH ? maxH : minH) * 3600e3;
    } else {
      var min = parseFloat(localStorage.getItem("akini_num_mailAutoSendMin") || "30");
      var max = parseFloat(localStorage.getItem("akini_num_mailAutoSendMax") || "90");
      if (isNaN(min) || min < 1) min = 30;
      if (isNaN(max) || max < min) max = min + 30;
      minMs = min * 60e3;
      maxMs = max * 60e3;
    }
    return minMs + Math.random() * Math.max(0, maxMs - minMs);
  }

  function _toggleOn() {
    var tg = localStorage.getItem("akini_toggle_contactMailToggle");
    // 未显式开启时一律视为关闭，避免旧数据/未初始化导致联系人擅自来信
    if (tg === null) return false;
    return tg !== "0";
  }
  function _nextKey() {
    return "akini_next_mailAutoSend";
  }
  function _readNext() {
    return parseFloat(localStorage.getItem(_nextKey()) || "0") || 0;
  }
  function _clearNext() {
    try {
      localStorage.removeItem(_nextKey());
    } catch (e) {}
  }

  // 投递一封主动来信；ts 为计划发送时间（离线补发时用它还原"离线期间"的时间）
  function deliverActiveLetter(ts) {
    var c = window.__akiniDefaultContact ? window.__akiniDefaultContact() : null;
    if (!c && window.akiniContacts) {
      var contacts = window.akiniContacts.getContacts() || [];
      c = contacts[0] || null;
    }
    if (!c) return false;
    var content = genLetter();
    if (!content) return false;
    ts = ts || Date.now();
    var recv = getReceived();
    recv.push({
      content: content,
      date: fmtDateAt(ts),
      ts: ts,
      from: c.name,
      fromId: c.id,
      subtype: "letter",
      read: false,
      isRead: false,
    });
    saveReceived(recv);
    if (window.showInAppNotif) {
      window.showInAppNotif({
        app: "信箱",
        avatar: window.nt ? window.nt(c.avatar, 40) : "",
        chatId: c.id || "",
        name: c.name,
        fullContent: true,
        msg: c.name + "给你写了一封信",
        onTap: function () {
          if (window.o) window.o("mail");
          if (window.__mailShowTab) window.__mailShowTab("received");
        },
      });
    }
    if (window.__renderMail) window.__renderMail();
    return true;
  }

  function _arm(delay) {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(
      function () {
        autoTimer = null;
        _clearNext();
        if (!_toggleOn()) return;
        try {
          deliverActiveLetter(Date.now());
        } catch (e) {
          console.warn("[akini-mail-engine] 发信异常", e);
        }
        manageAutoSendTimer();
      },
      Math.max(1000, delay),
    );
  }

  function manageAutoSendTimer() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    if (!_toggleOn()) {
      _clearNext();
      return;
    }

    var info = _rangeInfo();
    var outDelay = info.configured ? _nextRangeDelay(info) : 0;
    // 不在允许时间段内：顺延到下一次进入时间段；否则按最小~最大范围随机取间隔
    var delay = outDelay > 0 ? outDelay : _randomIntervalMs();
    try {
      localStorage.setItem(_nextKey(), String(Date.now() + delay));
    } catch (e) {}
    _arm(delay);
  }

  /* 离线补发：应用关闭期间错过的那一封，在启动/回到前台时补上（只补一封，避免刷屏） */
  function catchUpActiveLetter() {
    if (!_toggleOn()) {
      _clearNext();
      return;
    }
    var next = _readNext();
    if (next <= 0 || Date.now() < next) return;
    _clearNext();
    try {
      deliverActiveLetter(next);
    } catch (e) {
      console.warn("[akini-mail-engine] 离线补发异常", e);
    }
    manageAutoSendTimer();
  }

  function start() {
    // 启动时先投递离线期间到点的回信与主动来信，再启动定时器
    checkStatus();
    catchUpActiveLetter();
    manageAutoSendTimer();
    // 每 30 秒巡检一次，确保应用保持打开时也能按时投递离线回信
    setInterval(function () {
      if (!document.hidden) checkStatus();
    }, 60000);
  }

  window.__akiniGenReplyText = genReplyText;

  window.akiniMailEngine = {
    checkStatus: checkStatus,
    start: start,
    markActive: markActive,
    deliverActiveLetter: deliverActiveLetter,
    catchUp: catchUpActiveLetter,
    // 设置页变更开关/间隔时调用：立即按新配置重排主动来信
    resetAutoSend: function () {
      catchUpActiveLetter();
      manageAutoSendTimer();
    },
  };

  // 等待数据恢复完成后启动
  function boot() {
    ["akini_mail_backfill_done", "akini_mail_engine_last_rearm"].forEach(function (k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    });
    if (window.__akiniBooted) {
      start();
      return;
    }
    var waited = 0;
    var iv = setInterval(function () {
      waited += 200;
      if (window.__akiniBooted || waited > 8000) {
        clearInterval(iv);
        start();
      }
    }, 200);
  }
  boot();

  // 应用回到前台：刷新活跃时间、投递离线到点的回信，并补发离线错过的主动来信
  window.__akiniOnVisible(function () { 
      if (window.akiniMailEngine && window.akiniMailEngine.checkStatus) window.akiniMailEngine.checkStatus();
      catchUpActiveLetter();
      markActive();
     });
  // 周期性更新活跃时间（应用在前台时）
  setInterval(markActive, 60000);

  console.log("[akini-mail-engine] 信箱离线回信/主动来信引擎已加载（原生 自调度模型）");
})();
