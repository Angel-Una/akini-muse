/* ===== Round 6/7 features: music/companion home, histories, invite/end cards, contact skip, probabilities ===== */
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }
  function isAvatarSwapped() {
    /* 唯一开关源：设置页写 '1'/'0'，旧数据可能是 'true'/'false'，两种都要认；
       若 core 已提供 window.isSwapped（同一读取规则），直接复用，避免各处规则漂移 */
    try {
      return !!window.isSwapped();
      var v = localStorage.getItem("akini_swap_avatar_pos");
      return "1" === v || "true" === v;
    } catch (e) {
      return false;
    }
  }
  /* 头像 HTML 只有 core 的 renderAvatarHtml 一套实现，这里只补尺寸外框 */
  function avHTML(avatar, size) {
    size = size || 64;
    return (
      '<div style="width:' +
      size +
      "px;height:" +
      size +
      'px;border-radius:50%;background:#f7f8fa;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
      (window.renderAvatarHtml ? window.renderAvatarHtml(avatar, size) : "") +
      "</div>"
    );
  }

  /* 网易云一起听式双头像：重叠 3px 并排 */
  function avatarPair(myAv, taAv, size, gap) {
    var swapped = isAvatarSwapped();
    if (swapped) {
      var _t = myAv;
      myAv = taAv;
      taAv = _t;
    }
    if (gap == null) gap = -3;
    var sp = gap > 0 ? gap : 0;
    var ml = gap < 0 ? "margin-left:" + gap + "px;" : "";
    return (
      '<div class="akini-avatar-pair" data-pair-swapped="' +
      (swapped ? "1" : "0") +
      '" style="display:flex;align-items:center;justify-content:center;gap:' +
      sp +
      'px;">' +
      '<div data-pair-cell="left" style="position:relative;z-index:1;">' +
      avHTML(myAv, size) +
      "</div>" +
      '<div data-pair-cell="right" style="position:relative;z-index:2;' +
      ml +
      '">' +
      avHTML(taAv, size) +
      "</div>" +
      "</div>"
    );
  }
  /* 静止心电图：一比一还原参考图的单次完整心搏
     基线 → 小 Q 波下沉 → 高 R 尖峰 → 深 S 波 → 圆润 T 波 → 基线 */
  function ecgSVG(w, h, color) {
    var c = color || "#000000";
    /* viewBox 164×100 与参考图同比例，宽高按同一比例输出，波形不会被压扁 */
    h = h || Math.round(w * 0.61);
    var d =
      "M0 51H40.6C42 51 43 67 45.3 67C47.6 67 48.5 51 50 51H64.6" +
      "C67.4 51 71 0 75 0C79 0 82.5 100 86.3 100C90 100 91.5 51 94.3 51H119.3" +
      "C122 51 125 32.4 128.3 32.4C131.6 32.4 134 51 137.7 51H164";
    return (
      '<svg width="' +
      w +
      '" height="' +
      h +
      '" viewBox="0 0 164 100" fill="none" style="display:block;overflow:visible;flex-shrink:0;">' +
      '<path d="' +
      d +
      '" stroke="' +
      c +
      '" stroke-width="2.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>"
    );
  }
  /* 双头像紧贴心电图两端：左头像—波形—右头像首尾相接，中间不留空隙 */
  function avatarPairECG(myAv, taAv, size, opts) {
    var swapped = isAvatarSwapped();
    if (swapped) {
      var _t = myAv;
      myAv = taAv;
      taAv = _t;
    }
    opts = opts || {};
    var w = opts.ecgWidth || Math.round(size * 1.9);
    return (
      '<div class="akini-ecg-pair" data-pair-swapped="' +
      (swapped ? "1" : "0") +
      '" style="display:inline-flex;align-items:center;justify-content:center;gap:0;line-height:0;">' +
      '<div class="akini-ecg-avatar" data-pair-cell="left" style="position:relative;z-index:1;flex-shrink:0;line-height:0;">' +
      avHTML(myAv, size) +
      "</div>" +
      '<div class="akini-ecg-line" style="position:relative;z-index:1;flex-shrink:0;line-height:0;">' +
      ecgSVG(w, Math.round(w * 0.61), opts.ecgColor) +
      "</div>" +
      '<div class="akini-ecg-avatar" data-pair-cell="right" style="position:relative;z-index:1;flex-shrink:0;line-height:0;">' +
      avHTML(taAv, size) +
      "</div>" +
      "</div>"
    );
  }
  /* 开关切换时，已渲染到页面里的双头像（历史一起听总结卡片、已打开的详情）也要跟着换。
     这两个 cell 的占位/尺寸/层级不变，只交换各自内容，所以不会破坏心电图布局 */
  window.__akiniReswapAvatarPairs = function () {
    try {
      var want = isAvatarSwapped() ? "1" : "0";
      var nodes = document.querySelectorAll("[data-pair-swapped]");
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.getAttribute("data-pair-swapped") === want) continue;
        var l = n.querySelector('[data-pair-cell="left"]');
        var r = n.querySelector('[data-pair-cell="right"]');
        if (l && r) {
          var h = l.innerHTML;
          l.innerHTML = r.innerHTML;
          r.innerHTML = h;
        }
        n.setAttribute("data-pair-swapped", want);
      }
    } catch (e) {}
  };

  function getMyAvatar() {
    try {
      {
        var a = window.getMyAvatar();
        if (a) return a;
      }
    } catch (e) {}
    try {
      return localStorage.getItem("akini_my_avatar") || "";
    } catch (e) {
      return "";
    }
  }
  function getDefaultContact() {
    try {
      return window.__akiniDefaultContact && window.__akiniDefaultContact();
    } catch (e) {
      return null;
    }
  }
  function getMyName() {
    try {
      return localStorage.getItem("akini_my_name") || "我";
    } catch (e) {
      return "我";
    }
  }

  /* ============ PROBABILITIES (可在设置自定义) ============ */
  function getProb(key, def) {
    try {
      var v = parseFloat(localStorage.getItem(key));
      if (!isNaN(v) && v >= 0 && v <= 100) return v;
    } catch (e) {}
    return def;
  }
  function getInviteProb() {
    return getProb("akini_prob_invite", 10);
  }
  function getSkipProb() {
    return getProb("akini_prob_skip", 5);
  }

  /* ============ MUSIC HOME PAGE ============ */
  function showMusicHome() {
    var ov = $("musicHomeOverlay");
    if (!ov) return;
    var myAv = getMyAvatar();
    var ta = getDefaultContact();
    var taAv = ta ? ta.avatar || "" : "";
    if (isAvatarSwapped()) {
      var _t = myAv;
      myAv = taAv;
      taAv = _t;
    }
    var myEl = $("musicHomeMyAvatar");
    var taEl = $("musicHomeTaAvatar");
    if (myEl) myEl.innerHTML = avHTML(myAv, 72);
    if (taEl) taEl.innerHTML = avHTML(taAv, 72);
    ov.style.display = "flex";
  }
  function hideMusicHome() {
    var ov = $("musicHomeOverlay");
    if (ov) ov.style.display = "none";
  }

  function goHomeFromMusic() {
    hideMusicHome();
    try {
      if (window.navTo) window.navTo("home");
    } catch (e) {}
  }

  function startListeningFromHome() {
    hideMusicHome();
    /* 我发起的一起听：标记邀请方为我自己，结束时总结卡片由我发出 */
    try {
      localStorage.setItem("akini_music_invited_by_ta", "0");
    } catch (e) {}
    try {
      var app = $("app-music");
      if (app) {
        app.style.display = "flex";
        app.classList.add("show");
      }
    } catch (e) {}
    startMusicSessionTracking();
  }

  /* ============ MUSIC HISTORY (一起听记录) - 图三样式黑白 ============ */
  function getMusicHistory() {
    try {
      return JSON.parse(localStorage.getItem("akini_music_history") || "[]");
    } catch (e) {
      return [];
    }
  }
  function saveMusicHistory(arr) {
    try {
      localStorage.setItem("akini_music_history", JSON.stringify(arr));
    } catch (e) {}
  }
  function addMusicHistory(entry) {
    var arr = getMusicHistory();
    arr.unshift(entry);
    if (arr.length > 100) arr = arr.slice(0, 100);
    saveMusicHistory(arr);
  }
  function fmtDate(ts) {
    try {
      var d = new Date(ts);
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0") +
        " " +
        String(d.getHours()).padStart(2, "0") +
        ":" +
        String(d.getMinutes()).padStart(2, "0")
      );
    } catch (e) {
      return "";
    }
  }
  function fmtDuration(sec) {
    sec = Math.floor(sec || 0);
    var h = Math.floor(sec / 3600),
      m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + "小时" + (m ? m + "分钟" : "");
    return m + "分钟";
  }
  function dateKey(ts) {
    try {
      var d = new Date(ts);
      return d.getMonth() + 1 + "月" + d.getDate() + "日";
    } catch (e) {
      return "";
    }
  }

  function renderMusicHistory() {
    var body = $("musicHistoryBody");
    if (!body) return;
    var arr = getMusicHistory();
    if (!arr.length) {
      body.innerHTML =
        '<div style="text-align:center;color:#999;padding:60px 20px;font-size:14px;">暂无一起听记录</div>';
      return;
    }
    // 汇总
    var totalSec = 0,
      totalSongs = 0;
    arr.forEach(function (it) {
      totalSec += it.duration || 0;
      totalSongs += it.songCount || 0;
    });
    var ta = getDefaultContact();
    var taAv = ta ? ta.avatar || "" : "";
    var myAv = getMyAvatar();

    var html = "";
    // 汇总卡片（双方头像重叠 3px 并排）
    html +=
      '<div style="background:#f5f5f5;border-radius:16px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:14px;">' +
      '<div style="flex-shrink:0;">' +
      avatarPair(myAv, taAv, 52, -3) +
      "</div>" +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">你和' +
      (ta ? ta.name || "TA" : "TA") +
      "</div>" +
      '<div style="display:flex;gap:16px;font-size:12px;color:#666;">' +
      "<span>陪伴彼此 " +
      fmtDuration(totalSec) +
      "</span>" +
      "<span>一起听过 " +
      totalSongs +
      " 首歌</span>" +
      "</div>" +
      "</div>" +
      "</div>";
    // 历史列表，按日期分组
    html += '<div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">一起听历史</div>';
    var curDate = "";
    arr.forEach(function (it) {
      var dk = dateKey(it.startTs);
      if (dk !== curDate) {
        curDate = dk;
        html += '<div style="font-size:12px;color:#999;margin:14px 0 8px;font-weight:600;">' + dk + "</div>";
      }
      var time = fmtDate(it.startTs).split(" ")[1];
      html +=
        '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;">' +
        avHTML(it.taAvatar || "", 40) +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:14px;font-weight:600;color:#1a1a1a;">' +
        String(it.taName || "TA").replace(/</g, "&lt;") +
        "</div>" +
        '<div style="font-size:12px;color:#999;margin-top:2px;">' +
        time +
        " · 听了" +
        fmtDuration(it.duration) +
        ", " +
        (it.songCount || 0) +
        "首歌</div>" +
        "</div>" +
        "</div>";
    });
    body.innerHTML = html;
  }
  function openMusicHistory() {
    renderMusicHistory();
    var ov = $("musicHistoryOverlay");
    if (ov) ov.style.display = "flex";
  }
  function closeMusicHistory() {
    var ov = $("musicHistoryOverlay");
    if (ov) ov.style.display = "none";
  }

  /* ============ CONTACT AUTO-SKIP SONG (概率) ============ */
  var _contactSkipTimer = null;
  function scheduleContactSkip() {
    if (_contactSkipTimer) {
      clearTimeout(_contactSkipTimer);
      _contactSkipTimer = null;
    }
    // 每隔 30~60 秒摇一次，按设置概率切歌
    var delay = 30000 + Math.random() * 30000;
    _contactSkipTimer = setTimeout(function () {
      _contactSkipTimer = null;
      try {
        var active = false;
        try {
          active = "1" === localStorage.getItem("akini_music_listening_active");
        } catch (e) {}
        var app = $("app-music");
        if (active && app && app.style.display !== "none") {
          var prob = getSkipProb();
          if (Math.random() * 100 < prob) {
            if (typeof window.musicControlNext === "function") {
              window.musicControlNext();
            } else {
              var nb = $("musicNextBtn");
              if (nb) nb.click();
            }
          }
        }
      } catch (e) {}
      scheduleContactSkip();
    }, delay);
  }
  function stopContactSkip() {
    if (_contactSkipTimer) {
      clearTimeout(_contactSkipTimer);
      _contactSkipTimer = null;
    }
  }

  /* ============ MUSIC INVITE CARD (随机定时器 + 独立概率，与联系人主动来电一致) ============ */
  var _lastInviteTs = 0;
  var _inviteTimer = null;
  function maybeSendInvite() {
    try {
      // 概率与「主动来电」独立：各自读各自的键，但默认值相同（均为 10%）
      if (Math.random() * 100 >= getInviteProb()) return;
      sendMusicInviteCard();
    } catch (e) {}
  }
  /* 与「联系人主动来电」完全相同：5~10 分钟随机间隔的触发点上独立判定概率 */
  function scheduleMusicInvite() {
    clearTimeout(_inviteTimer);
    var ms = 1e3 * (300 + 300 * Math.random()); // 300~600 秒 = 5~10 分钟
    _inviteTimer = setTimeout(function () {
      maybeSendInvite();
      scheduleMusicInvite();
    }, ms);
  }

  function sendMusicInviteCard() {
    try {
      var now = Date.now();
      if (now - _lastInviteTs < 60000) return false;
      var listening = false;
      try {
        listening = "1" === localStorage.getItem("akini_music_listening_active");
      } catch (e) {}
      if (listening) return false;
      var ipopup = $("musicInvitePopup");
      if (ipopup && ipopup.style.display === "flex") return false;
      _lastInviteTs = now;
      /* TA 发起的一起听邀请：标记邀请方为 TA，结束时总结卡片由 TA 发出 */
      try {
        localStorage.setItem("akini_music_invited_by_ta", "1");
      } catch (e) {}
      var ta = getDefaultContact();
      var taName = ta ? ta.name || "TA" : "TA";
      try {
        /* 局内通知：有好友邀请你来网易云一起听歌了 */
        if (typeof window.showInAppNotif === "function") {
          window.showInAppNotif({
            app: "网易云",
            avatar: ta ? ta.avatar || "" : "",
            name: taName,
            msg: "有好友邀请你来网易云一起听歌了",
            fullContent: true,
            onTap: function () {
              try {
                window.__akiniOpenMusicInvitePopup && window.__akiniOpenMusicInvitePopup();
              } catch (e) {}
            },
          });
        }
      } catch (e) {}
      try {
        /* 后台通知：页面不可见时走系统推送 */
        if (document.hidden && typeof window.__akiniSystemNotify === "function") {
          window.__akiniSystemNotify("网易云", {
            body: "有好友邀请你来网易云一起听歌了",
            tag: "akini-music-invite",
          });
        }
      } catch (e) {}
      window.__akiniOpenMusicInvitePopup && window.__akiniOpenMusicInvitePopup();
      return true;
    } catch (e) {
      console.warn("[r6] invite popup error", e);
    }
    return false;
  }

  function disableInviteCards() {
    try {
      var body = $("chatBody");
      if (!body) return;
      body.querySelectorAll(".music-invite-bubble").forEach(function (b) {
        b.removeAttribute("onclick");
        b.style.opacity = "0.7";
        b.style.cursor = "default";
        var hint = b.querySelector(".music-invite-hint");
        b.setAttribute("data-invite-done", "1");
        if (!hint) {
          hint = document.createElement("div");
          hint.className = "music-invite-hint";
          hint.style.cssText = "font-size:11px;color:#999;margin-top:6px;text-align:right;";
          hint.textContent = "已处理";
          b.appendChild(hint);
        }
      });
    } catch (e) {}
  }

  window.__akiniAcceptMusicInvite = function () {
    try {
      disableInviteCards();
      closeMusicInvitePopup();
      /* 先标记会话进行中，navTo('music') 才会直接进播放器（否则会停在音乐首页） */
      startMusicSessionTracking();
      if (window.navTo) window.navTo("music");
      else {
        var app = $("app-music");
        if (app) {
          app.style.display = "flex";
          app.classList.add("show");
        }
      }
    } catch (e) {}
  };

  /* ============ MUSIC INVITE POPUP (黑白, 双方头像, 叉=拒绝 对号=同意, 均为线条样式) ============ */
  window.__akiniOpenMusicInvitePopup = function () {
    var ov = $("musicInvitePopup");
    if (!ov) return;
    var ta = getDefaultContact();
    var taName = ta ? ta.name || "TA" : "TA";
    var taAv = ta ? ta.avatar || "" : "";
    var myAv = getMyAvatar();
    var body = $("musicInvitePopupBody");
    if (body) {
      body.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;text-align:center;">' +
        '<div style="display:flex;align-items:center;justify-content:center;margin-bottom:36px;">' +
        avatarPairECG(myAv, taAv, 64, { ecgWidth: 88 }) +
        "</div>" +
        '<div style="font-size:17px;font-weight:700;color:#1a1a1a;line-height:1.3;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        String(taName).replace(/</g, "&lt;") +
        "</div>" +
        '<div style="font-size:13px;color:#666;margin-top:6px;">邀请你一起听</div>' +
        '<div style="display:flex;gap:40px;margin-top:40px;">' +
        '<button id="musicInviteRejectBtn" style="width:46px;height:46px;border-radius:50%;border:1.5px solid #1a1a1a;background:#fff;color:#1a1a1a;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;" type="button">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>' +
        "</button>" +
        '<button id="musicInviteAcceptBtn" style="width:46px;height:46px;border-radius:50%;border:1.5px solid #1a1a1a;background:#fff;color:#1a1a1a;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;" type="button">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M20 6L9 17l-5-5"/></svg>' +
        "</button>" +
        "</div>" +
        "</div>";
    }
    ov.style.display = "flex";
    // bind buttons
    setTimeout(function () {
      var rj = $("musicInviteRejectBtn");
      var ac = $("musicInviteAcceptBtn");
      if (rj)
        rj.onclick = function () {
          rejectMusicInvite();
        };
      if (ac)
        ac.onclick = function () {
          window.__akiniAcceptMusicInvite();
        };
    }, 0);
  };
  function closeMusicInvitePopup() {
    var ov = $("musicInvitePopup");
    if (ov) ov.style.display = "none";
  }
  function rejectMusicInvite() {
    disableInviteCards();
    closeMusicInvitePopup();
    /* 拒绝邀请：清除邀请方标记，避免影响下次会话 */
    try {
      localStorage.setItem("akini_music_invited_by_ta", "0");
    } catch (e) {}
    try {
      var ta = getDefaultContact();
      var taName = ta ? ta.name || "TA" : "TA";
      var myName = getMyName();
      var text =
        String(myName).replace(/</g, "&lt;") + " 拒绝了 " + String(taName).replace(/</g, "&lt;") + " 的一起听邀请";
      var sysHtml =
        '<div class="msg-row system" data-ts="' +
        __akiniNextTs() +
        '">' +
        '<div class="msg-content-line"><div class="bubble-wrap"><div class="bubble">' +
        text +
        "</div></div></div>" +
        "</div>";
      var cid = null;
      try {
        cid = window.akiniContacts && window.akiniContacts.getActiveChatId && window.akiniContacts.getActiveChatId();
      } catch (e) {}
      if (!cid) {
        try {
          var dc = window.__akiniDefaultContact && window.__akiniDefaultContact();
          if (dc) cid = dc.id;
        } catch (e) {}
      }
      if (cid) window.__akiniAppendMessageHTML(cid, sysHtml, { lastMsg: text });
    } catch (e) {}
  }

  /* ============ MUSIC END CARD (白底黑描边圆角长方形，右侧双圆形头像) ============ */
  /* 时长文案长度不固定（4秒 / 12分钟3秒 / 12小时34分钟56秒），字号跟着长度缩放，
     否则长时长会撑破卡片或换行成一坨 */
  function durFontSize(text, base) {
    var n = String(text == null ? "" : text).length;
    if (n >= 10) return Math.round(base * 0.6);
    if (n >= 8) return Math.round(base * 0.7);
    if (n >= 6) return Math.round(base * 0.82);
    return base;
  }
  function sendMusicEndCard(durationSec, songCount, myCount, taCount) {
    try {
      /* cid 兜底：不在聊天页时 getActiveChatId 可能为空，用默认联系人 id 顶上，
         否则总结卡片发不出去（用户以为没有一起听记录） */
      var cid = null;
      try {
        cid = window.akiniContacts && window.akiniContacts.getActiveChatId && window.akiniContacts.getActiveChatId();
      } catch (e) {}
      if (!cid) {
        var dc = getDefaultContact();
        if (dc && dc.id) cid = dc.id;
      }
      if (!cid) return;
      var myAv = getMyAvatar();
      var ta = getDefaultContact();
      var taAv = ta ? ta.avatar || "" : "";
      var taName = ta ? ta.name || "TA" : "TA";
      var durText = fmtDurationFull(durationSec);
      var total = (myCount || 0) + (taCount || 0);
      var dataAttr =
        'data-dur="' +
        (durationSec || 0) +
        '" data-songs="' +
        (songCount || 0) +
        '" data-my="' +
        (myCount || 0) +
        '" data-ta="' +
        (taCount || 0) +
        '"';
      /* 判断邀请方：TA 邀请 → 卡片由 TA 发出（other，头像在左）；我邀请 → 卡片由我发出（me，头像在右） */
      var invitedByTa = false;
      try {
        invitedByTa = "1" === localStorage.getItem("akini_music_invited_by_ta");
      } catch (e) {}
      var bubbleInner =
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">' +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;color:#888;line-height:1.3;margin-bottom:1px;">我们一起听了</div>' +
        '<div style="font-size:' +
        durFontSize(durText, 22) +
        'px;font-weight:700;color:#1a1a1a;line-height:1.15;">' +
        durText +
        "</div>" +
        "</div>" +
        '<div style="flex-shrink:0;">' +
        avatarPair(myAv, taAv, 32, -3) +
        "</div>" +
        "</div>" +
        /* 头尾不连接的横线：约 88% 宽度居中，把「一起听时间」与「聊天记录数量」隔开 */
        '<div class="akini-card-divider" style="width:88%;height:1px;background:#ececec;margin:6px auto 5px;"></div>' +
        '<div style="font-size:12px;color:#888;line-height:1.3;">' +
        total +
        " 条聊天记录</div>";
      var bubble =
        '<div class="bubble music-end-bubble" ' +
        dataAttr +
        ' onclick="event.stopPropagation();window.__akiniOpenMusicEndPopup &amp;&amp; window.__akiniOpenMusicEndPopup(this)" style="background:#fff !important;border:1px solid #e8e8e8 !important;border-radius:16px !important;padding:8px 14px !important;width:236px !important;min-width:236px !important;max-width:236px !important;cursor:pointer;color:#1a1a1a !important;box-shadow:0 4px 14px rgba(0,0,0,.07) !important;">' +
        bubbleInner +
        "</div>";
      var html;
      if (invitedByTa) {
        /* TA 邀请：头像在左，气泡在右，class="other" */
        html =
          '<div class="msg-row other" data-ts="' +
          __akiniNextTs() +
          '">' +
          '<div class="msg-avatar" data-sender-name="' +
          String(taName).replace(/"/g, "&quot;") +
          '" style="background:transparent;border-radius:50%;padding:0;">' +
          avHTML(taAv, 42) +
          "</div>" +
          '<div class="msg-content-line">' +
          bubble +
          "</div>" +
          "</div>";
        window.__akiniAppendMessageHTML(cid, html, { lastMsg: "一起听已结束 · " + durText, lastSenderName: taName });
      } else {
        /* 我邀请：气泡在左，头像在右，class="me" */
        html =
          '<div class="msg-row me" data-ts="' +
          __akiniNextTs() +
          '">' +
          '<div class="msg-content-line">' +
          bubble +
          "</div>" +
          '<div class="msg-avatar" data-sender-name="' +
          String(getMyName()).replace(/"/g, "&quot;") +
          '" style="background:transparent;border-radius:50%;padding:0;">' +
          avHTML(myAv, 42) +
          "</div>" +
          "</div>";
        window.__akiniAppendMessageHTML(cid, html, {
          lastMsg: "一起听已结束 · " + durText,
          lastSenderName: getMyName(),
        });
      }
      var body = $("chatBody");
      if (body) body.scrollTop = body.scrollHeight;
    } catch (e) {
      console.warn("[r6] end card error", e);
    }
  }

  window.__akiniOpenMusicEndPopup = function (el) {
    var ov = $("musicEndPopup");
    if (!ov) return;
    var dur = 0,
      songs = 0,
      myCount = 0,
      taCount = 0;
    if (el && el.getAttribute) {
      dur = parseFloat(el.getAttribute("data-dur") || "0") || 0;
      songs = parseInt(el.getAttribute("data-songs") || "0", 10) || 0;
      myCount = parseInt(el.getAttribute("data-my") || "0", 10) || 0;
      taCount = parseInt(el.getAttribute("data-ta") || "0", 10) || 0;
    }
    var total = myCount + taCount;
    var durStr = fmtDurationFull(dur);
    var myAv = getMyAvatar();
    var ta = getDefaultContact();
    var taAv = ta ? ta.avatar || "" : "";

    // 累计数据
    var hist = getMusicHistory();
    var cumSec = 0,
      cumSongs = 0;
    hist.forEach(function (it) {
      cumSec += it.duration || 0;
      cumSongs += it.songCount || 0;
    });

    // 日期
    var now = new Date();
    var dateStr =
      now.getFullYear() +
      "." +
      String(now.getMonth() + 1).padStart(2, "0") +
      "." +
      String(now.getDate()).padStart(2, "0");

    var body = $("musicEndPopupBody");
    if (body) {
      body.innerHTML =
        '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;"><span style="font-size:12px;color:#999;">' +
        dateStr +
        "</span></div>" +
        '<div style="display:flex;justify-content:center;margin-bottom:18px;">' +
        avatarPairECG(myAv, taAv, 48, { ecgWidth: 100 }) +
        "</div>" +
        '<div style="background:#fff;border-radius:16px;padding:18px 16px;box-shadow:0 2px 12px rgba(0,0,0,.08);">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:18px;color:#999;font-size:13px;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
        "<span>TA 就在你身边</span>" +
        "</div>" +
        '<div style="display:flex;gap:12px;margin-bottom:16px;">' +
        '<div style="flex:1;text-align:center;">' +
        '<div style="font-size:12px;color:#999;margin-bottom:4px;">本次一起听了</div>' +
        '<div style="font-size:22px;font-weight:700;color:#1a1a1a;">' +
        songs +
        '<span style="font-size:13px;font-weight:400;color:#666;margin-left:2px;">首歌曲</span></div>' +
        "</div>" +
        '<div style="flex:1;text-align:center;">' +
        '<div style="font-size:12px;color:#999;margin-bottom:4px;">本次陪伴彼此</div>' +
        '<div style="font-size:' +
        durFontSize(durStr, 22) +
        'px;font-weight:700;color:#1a1a1a;line-height:1.2;">' +
        durStr +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div style="text-align:center;font-size:12px;color:#999;padding-top:12px;border-top:1px solid #f0f0f0;">累计 ' +
        cumSongs +
        " 首歌曲、" +
        fmtDuration(cumSec) +
        "</div>" +
        "</div>" +
        '<div style="margin-top:14px;background:#fff;border-radius:16px;padding:18px 16px;box-shadow:0 2px 12px rgba(0,0,0,.08);">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:18px;color:#999;font-size:13px;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.4 9.4 0 0 1-3.2-.8L3 21l1.9-5.1a8.3 8.3 0 0 1-.9-4.4 8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8 8.4z"/></svg>' +
        "<span>互发消息</span>" +
        "</div>" +
        '<div style="display:flex;gap:12px;">' +
        '<div style="flex:1;text-align:center;">' +
        '<div style="font-size:12px;color:#999;margin-bottom:4px;">我</div>' +
        '<div style="font-size:22px;font-weight:700;color:#1a1a1a;">' +
        myCount +
        '<span style="font-size:13px;font-weight:400;color:#666;margin-left:2px;">条</span></div>' +
        "</div>" +
        '<div style="flex:1;text-align:center;">' +
        '<div style="font-size:12px;color:#999;margin-bottom:4px;">TA</div>' +
        '<div style="font-size:22px;font-weight:700;color:#1a1a1a;">' +
        taCount +
        '<span style="font-size:13px;font-weight:400;color:#666;margin-left:2px;">条</span></div>' +
        "</div>" +
        "</div>" +
        '<div style="text-align:center;font-size:12px;color:#999;padding-top:12px;border-top:1px solid #f0f0f0;margin-top:16px;">本次共互发 ' +
        total +
        " 条消息</div>" +
        "</div>";
    }
    ov.style.display = "flex";
  };
  function closeMusicEndPopup() {
    var ov = $("musicEndPopup");
    if (ov) ov.style.display = "none";
  }

  /* 一起听总结卡片：core 在 document 冒泡阶段把任何 .bubble 的点击转成消息右键菜单，
     会抢掉卡片自身的详情点击。这里在 document 捕获阶段先接住（捕获一定先于冒泡），
     直接打开详情并阻止事件继续传播，历史旧卡片（没有内联 onclick）也照样能点开。 */
  (function () {
    if (window.__akiniMusicEndClickBound) return;
    window.__akiniMusicEndClickBound = true;
    document.addEventListener(
      "click",
      function (e) {
        try {
          if (!e.target || !e.target.closest) return;
          var card = e.target.closest(".music-end-bubble");
          if (!card) return;
          e.stopPropagation();
          e.preventDefault();
          if (window.__akiniOpenMusicEndPopup) window.__akiniOpenMusicEndPopup(card);
        } catch (err) {}
      },
      true,
    );
  })();

  /* 卡片类气泡（商店代付/赠送、问卷、一起听邀请/总结）自身已有点击逻辑；
     core 在 document 冒泡阶段会把任意 .bubble 点击转成消息右键菜单，抢掉卡片详情。
     在 #chatBody（document 的下一层祖先）冒泡阶段截断事件，就能先让卡片自己的
     onclick / 问卷委托执行，又不会冒泡到 core 的 document 监听。 */
  (function () {
    if (window.__akiniCardClickGuardBound) return;
    window.__akiniCardClickGuardBound = true;
    function guardCards() {
      var body = document.getElementById("chatBody");
      if (!body || body.__akiniCardGuard) return false;
      body.__akiniCardGuard = 1;
      body.addEventListener(
        "click",
        function (e) {
          try {
            if (!e.target || !e.target.closest) return;
            if (
              !e.target.closest(
                ".shop-card-bubble,.survey-bubble,.music-invite-bubble,.music-end-bubble,.transfer-bubble,.sticker-bubble,.redpacket-bubble",
              )
            )
              return;
            e.stopPropagation();
          } catch (err) {}
        },
        false,
      );
      return true;
    }
    if (!guardCards()) {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", guardCards);
      else setTimeout(guardCards, 300);
    }
  })();

  var _musicSessionStart = 0;
  var _musicSessionSongCount = 0;
  var _musicSessionMyMsgs = 0;
  var _musicSessionTaMsgs = 0;

  function startMusicSessionTracking() {
    _musicSessionStart = Date.now();
    _musicSessionSongCount = 0;
    _musicSessionMyMsgs = 0;
    _musicSessionTaMsgs = 0;
    /* 进会话时如果已经有一首歌在播（或列表已选好），先把这一首算上，
       否则只听了这一首就退出时仍然是 0 首。 */
    try {
      var cur = window.getMusicCurrentTrack && window.getMusicCurrentTrack();
      if (cur && (cur.id || cur.name || cur.url)) _musicSessionSongCount = 1;
    } catch (e) {}
    try {
      localStorage.setItem("akini_music_listening_active", "1");
    } catch (e) {}
    try {
      localStorage.setItem("akini_music_playing", "0");
    } catch (e) {}
    scheduleContactSkip();
  }
  function endMusicSessionTracking() {
    stopContactSkip();
    /* 先把会话标记归零再走后续流程：退出确认弹窗、包装器、兜底守卫可能先后触发，
       不归零的话两个路径都通过检查，总结卡片就会发两遍。 */
    var startTs = _musicSessionStart;
    _musicSessionStart = 0;
    if (!startTs) {
      try {
        localStorage.setItem("akini_music_listening_active", "0");
      } catch (e) {}
      return;
    }
    var duration = Math.floor((Date.now() - startTs) / 1000);
    if (duration >= 1) {
      var ta = getDefaultContact();
      addMusicHistory({
        startTs: startTs,
        duration: duration,
        songCount: _musicSessionSongCount,
        myMsgs: _musicSessionMyMsgs,
        taMsgs: _musicSessionTaMsgs,
        taName: ta ? ta.name || "TA" : "TA",
        taAvatar: ta ? ta.avatar || "" : "",
      });
      sendMusicEndCard(duration, _musicSessionSongCount, _musicSessionMyMsgs, _musicSessionTaMsgs);
    }
    try {
      localStorage.setItem("akini_music_listening_active", "0");
    } catch (e) {}
    /* 会话结束，清除邀请方标记，下次会话从零开始判定 */
    try {
      localStorage.setItem("akini_music_invited_by_ta", "0");
    } catch (e) {}
  }


  /* ============ COMPANION HOME PAGE ============ */
  var COMPANION_PRESETS = ["睡觉", "吃饭", "散步"];
  function showCompanionHome() {
    var ov = $("companionHomeOverlay");
    if (!ov) return;
    var myAv = getMyAvatar();
    var myEl = $("companionHomeMyAvatar");
    if (myEl) myEl.innerHTML = avHTML(myAv, 90);
    var presetsEl = $("companionHomePresets");
    if (presetsEl) {
      presetsEl.innerHTML = COMPANION_PRESETS.map(function (p) {
        return (
          '<button type="button" data-preset="' +
          p +
          '" style="padding:10px 20px;border:1.5px solid #1a1a1a;border-radius:20px;background:#fff;color:#1a1a1a;font-size:14px;cursor:pointer;font-weight:500;">' +
          p +
          "</button>"
        );
      }).join("");
    }
    var ci = $("companionHomeCustomInput");
    if (ci) ci.value = "";
    ov.style.display = "flex";
  }
  function hideCompanionHome() {
    var ov = $("companionHomeOverlay");
    if (ov) ov.style.display = "none";
  }

  function goHomeFromCompanion() {
    hideCompanionHome();
    try {
      if (window.navTo) window.navTo("home");
    } catch (e) {}
  }

  function startCompanionWithContent(content) {
    hideCompanionHome();
    try {
      localStorage.setItem("akini_companion_content", content || "");
    } catch (e) {}
    if (typeof window.__openCompanion === "function") {
      window.__openCompanion();
    } else {
      var app = $("app-companion");
      if (app) {
        app.style.display = "flex";
        app.classList.add("show");
      }
    }
  }

  /* ============ COMPANION HISTORY ============ */
  function getCompanionHistory() {
    try {
      return JSON.parse(localStorage.getItem("akini_companion_history") || "[]");
    } catch (e) {
      return [];
    }
  }
  function fmtDurationFull(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600),
      m = Math.floor((sec % 3600) / 60),
      s = sec % 60;
    if (h > 0) return h + "小时" + m + "分钟" + s + "秒";
    if (m > 0) return m + "分钟" + s + "秒";
    return s + "秒";
  }
  /* 陪伴历史时长固定 00:00:00 格式 */
  function fmtHMS(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    function p(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return p(Math.floor(sec / 3600)) + ":" + p(Math.floor((sec % 3600) / 60)) + ":" + p(sec % 60);
  }
  function renderCompanionHistory() {
    var list = $("companionHistoryList");
    if (!list) return;
    var arr = getCompanionHistory();
    if (!arr.length) {
      list.innerHTML = '<div style="text-align:center;color:#999;padding:60px 20px;font-size:14px;">暂无陪伴历史</div>';
      return;
    }
    list.innerHTML = arr
      .map(function (it) {
        var durSec = Math.floor((it.duration || 0) / 1000);
        return (
          '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0;width:100%;">' +
          '<div style="flex-shrink:0;">' +
          avHTML(it.avatar || it.taAvatar || "", 44) +
          "</div>" +
          '<div style="flex:1;min-width:0;text-align:left;">' +
          '<div style="font-size:14px;font-weight:600;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          String(it.name || it.taName || "TA").replace(/</g, "&lt;") +
          " · " +
          String(it.content || "陪伴").replace(/</g, "&lt;") +
          "</div>" +
          '<div style="font-size:11px;color:#999;margin-top:3px;">' +
          fmtDate(it.startTs).split(" ")[0] +
          "</div>" +
          "</div>" +
          '<div style="flex-shrink:0;text-align:right;">' +
          '<div style="font-size:13px;font-weight:600;color:#1a1a1a;white-space:nowrap;">' +
          fmtHMS(durSec) +
          "</div>" +
          '<div style="font-size:11px;color:#999;margin-top:3px;">' +
          (it.msgCount || 0) +
          " 条聊天记录</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }
  function openCompanionHistory() {
    renderCompanionHistory();
    var ov = $("companionHistoryOverlay");
    if (ov) ov.style.display = "flex";
  }
  function closeCompanionHistory() {
    var ov = $("companionHistoryOverlay");
    if (ov) ov.style.display = "none";
  }

  /* ============ PROBABILITY SETTINGS (统一到设置页自定义概率模块) ============ */
  function openProbSettings() {
    try {
      // 关闭音乐相关界面，打开设置页概率模块
      var app = $("app-music");
      if (app) {
        app.style.display = "none";
        app.classList.remove("show");
      }
      var menu = $("musicMenuPanel");
      if (menu) menu.style.display = "none";
      var sa = $("settingsArea");
      if (sa) sa.style.display = "flex";
      if (typeof window.__openProbArea === "function") {
        window.__openProbArea();
      } else {
        var pa = $("akiniProbArea");
        if (pa) pa.style.display = "flex";
      }
    } catch (e) {}
  }
  function closeProbSettings() {
    var ov = $("probSettingsOverlay");
    if (ov) ov.style.display = "none";
  }

  /* ============ BINDINGS ============ */
  function bind() {
    // 消息统计
    try {
      if (typeof window.__akiniAppendMessageHTML === "function" && !window.__akiniAppendMessageHTML.__r6wrapped) {
        var origAppend = window.__akiniAppendMessageHTML;
        window.__akiniAppendMessageHTML = function () {
          try {
            var html = arguments[1] || "";
            var active = false;
            try {
              active = "1" === localStorage.getItem("akini_music_listening_active");
            } catch (e) {}
            if (active) {
              if (/msg-row me\b/.test(html)) _musicSessionMyMsgs++;
              else if (/msg-row (other|ta)\b/.test(html)) _musicSessionTaMsgs++;
            }
          } catch (e) {}
          return origAppend.apply(this, arguments);
        };
        window.__akiniAppendMessageHTML.__r6wrapped = true;
      }
    } catch (e) {}

    /* 歌曲计数：core 的切歌函数 a() 里会回调 __akiniMusicTrackSwitch。
       上一首/下一首/自动续播/概率切歌全都走那个函数，所以这里一处就能统计全。
       以前只包了 window.musicControlNext / Prev（只有悬浮控件调用），
       普通点播放器的上一首/下一首、以及歌曲自动播完切下一首都不会计数，
       于是「本次一起听了 N 首歌曲 / 累计 N 首」永远显示 0。 */
    window.__akiniMusicTrackSwitch = function () {
      try {
        if ("1" === localStorage.getItem("akini_music_listening_active")) _musicSessionSongCount++;
      } catch (e) {}
    };

    // 邀请听歌定时器：与联系人主动来电同一套（随机间隔触发 + 独立概率）
    scheduleMusicInvite();

    // Music home
    var startBtn = $("musicHomeStartBtn");
    if (startBtn) startBtn.addEventListener("click", startListeningFromHome);
    var histBtn = $("musicHomeHistoryBtn");
    if (histBtn) histBtn.addEventListener("click", openMusicHistory);
    var musicBack = $("musicHomeBackBtn");
    if (musicBack) musicBack.addEventListener("click", goHomeFromMusic);

    // Music history
    var mhBack = $("musicHistoryBack");
    if (mhBack) mhBack.addEventListener("click", closeMusicHistory);

    // Music end popup
    var endClose = $("musicEndPopupClose");
    if (endClose) endClose.addEventListener("click", closeMusicEndPopup);
    var endOverlay = $("musicEndPopup");
    if (endOverlay)
      endOverlay.addEventListener("click", function (e) {
        if (e.target === endOverlay) closeMusicEndPopup();
      });

    // Music invite popup
    var inviteOverlay = $("musicInvitePopup");
    /* 点空白处不关闭：邀请弹窗只有「接受/拒绝」两个按钮，
       点空白就消失会让用户以为邀请没了/操作失败。 */
    if (inviteOverlay) {
      inviteOverlay.addEventListener("click", function (e) {
        if (e.target === inviteOverlay) e.stopPropagation();
      });
    }

    // Companion home
    var presets = $("companionHomePresets");
    if (presets) {
      presets.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("[data-preset]") : null;
        if (b) startCompanionWithContent(b.getAttribute("data-preset") || "");
      });
    }
    var customConfirm = $("companionHomeCustomConfirm");
    var customInput = $("companionHomeCustomInput");
    if (customConfirm)
      customConfirm.addEventListener("click", function () {
        var v = customInput ? customInput.value.trim() : "";
        if (!v) {
          try {
            window.__akiniToast && window.__akiniToast("请输入陪伴内容");
          } catch (e) {}
          return;
        }
        startCompanionWithContent(v);
      });
    if (customInput)
      customInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          var v = customInput.value.trim();
          if (v) startCompanionWithContent(v);
        }
      });
    var compHistBtn = $("companionHomeHistoryBtn");
    if (compHistBtn) compHistBtn.addEventListener("click", openCompanionHistory);
    var compBack = $("companionHomeBackBtn");
    if (compBack) compBack.addEventListener("click", goHomeFromCompanion);

    // Companion history
    var chBack = $("companionHistoryBack");
    if (chBack) chBack.addEventListener("click", closeCompanionHistory);

    // 音乐返回：和陪伴返回键逻辑一致——不结束一起听会话，只隐藏界面回首页。
    // 下次再进网易云时，若会话仍在则直接回播放器（陪伴也是这样）。
    var musicPlayerBack = $("musicBackBtn");
    if (musicPlayerBack && !musicPlayerBack.__r6bound) {
      musicPlayerBack.__r6bound = true;
      musicPlayerBack.addEventListener(
        "click",
        function (e) {
          try {
            e.stopImmediatePropagation();
            e.preventDefault();
          } catch (_) {}
          setTimeout(function () {
            try {
              var app = $("app-music");
              if (app) {
                app.style.display = "none";
                app.classList.remove("show");
              }
              hideMusicHome();
              var menu = $("musicMenuOverlay");
              if (menu) {
                menu.style.display = "none";
                menu.classList.remove("show");
              }
              var picker = $("musicContactPicker");
              if (picker) {
                picker.style.display = "none";
                picker.classList.remove("show");
              }
            } catch (e) {}
            // 清掉导航栈里残留的 music 记录，防止之后按返回又把播放器带回来
            try {
              if (window.__navHistory) {
                window.__navHistory = window.__navHistory.filter(function (it) {
                  return !(it && it.id === "music");
                });
              }
            } catch (e) {}
            try {
              if (window.navTo) window.navTo("home");
            } catch (e) {}
          }, 50);
        },
        true,
      );
    }

    // 陪伴返回：正在陪伴时点返回 → 直接回首页（保持陪伴状态，下次进陪伴继续）
    var compMainBack = $("companionMainBackBtn");
    if (compMainBack && !compMainBack.__r6bound) {
      compMainBack.__r6bound = true;
      compMainBack.addEventListener(
        "click",
        function (e) {
          // 不结束陪伴，保持 companionState
          try {
            e.stopImmediatePropagation();
            e.preventDefault();
          } catch (_) {}
          setTimeout(function () {
            try {
              var app = $("app-companion");
              if (app) {
                app.style.display = "none";
                app.classList.remove("show");
              }
              hideCompanionHome();
            } catch (e) {}
            try {
              if (window.navTo) window.navTo("home");
            } catch (e) {}
          }, 50);
        },
        true,
      );
    }

    // 包装 _exitListenTogether：结束会话（归档历史、发结束卡片、listening_active 置 0），
    // 然后回到「开始一起听」首页（musicHomeOverlay），不回手机首页。
    // 同时清掉历史栈里残留的 _akini_music_open 标记，避免之后按返回键又把一起听界面带回来。
    try {
      if (typeof window._exitListenTogether === "function" && !window._exitListenTogether.__r6wrapped) {
        var origExit = window._exitListenTogether;
        window._exitListenTogether = function () {
          try {
            var active = false;
            try {
              active = "1" === localStorage.getItem("akini_music_listening_active");
            } catch (e) {}
            if (active) {
              /* 先置 0 再走结束流程：内部会归档历史 + 发结束卡片 + 清理标记 */
              try {
                localStorage.setItem("akini_music_listening_active", "0");
              } catch (e) {}
              endMusicSessionTracking();
            }
          } catch (e) {}
          try {
            origExit.apply(this, arguments);
          } catch (e) {}
          // origExit 会把 app-music / musicContactPicker 重新显示出来，这里全部收掉。
          try {
            var app = $("app-music");
            if (app) {
              app.style.display = "none";
              app.classList.remove("show");
            }
            var picker = $("musicContactPicker");
            if (picker) {
              picker.style.display = "none";
              picker.classList.remove("show");
            }
            var menu = $("musicMenuOverlay");
            if (menu) {
              menu.style.display = "none";
              menu.classList.remove("show");
            }
            var endPop = $("musicEndPopup");
            if (endPop) {
              endPop.style.display = "none";
              endPop.classList.remove("show");
            }
          } catch (e) {}
          // 清掉浏览器历史里残留的一起听标记，防止返回键误触发
          try {
            if (window.history && typeof history.replaceState === "function") {
              var st = history.state || {};
              if (st._akini_music_open) {
                var cleaned = {};
                for (var k in st) if (st.hasOwnProperty(k) && k !== "_akini_music_open") cleaned[k] = st[k];
                history.replaceState(cleaned, "", location.href);
              }
            }
          } catch (e) {}
          // 清掉导航栈里残留的 music 记录，防止之后按返回又把播放器带回来
          try {
            if (window.__navHistory) {
              window.__navHistory = window.__navHistory.filter(function (it) {
                return !(it && it.id === "music");
              });
            }
          } catch (e) {}
          // 回音乐开始页（不回手机首页）
          showMusicHome();
        };
        window._exitListenTogether.__r6wrapped = true;
      }
    } catch (e) {}

    // 概率设置
    var probSave = $("probSettingsSave");
    if (probSave)
      probSave.addEventListener("click", function () {
        var inv = $("probInviteInput");
        var sk = $("probSkipInput");
        var iv = inv ? parseFloat(inv.value) : NaN;
        var sv = sk ? parseFloat(sk.value) : NaN;
        /* 概率键是 akiniStore 的 critical 键：读取走内存缓存优先。
         必须走 akiniStore.set 同步 memCache，否则本次会话读到的还是旧值（设成 100 也不触发） */
        var _setProb = function (k, v) {
          try {
            if (window.akiniStore && window.akiniStore.set) window.akiniStore.set(k, String(v));
            else localStorage.setItem(k, String(v));
          } catch (e) {}
        };
        if (!isNaN(iv) && iv >= 0 && iv <= 100) _setProb("akini_prob_invite", iv);
        if (!isNaN(sv) && sv >= 0 && sv <= 100) _setProb("akini_prob_skip", sv);
        closeProbSettings();
        try {
          window.__akiniToast && window.__akiniToast("概率已保存");
        } catch (e) {}
      });
    var probClose = $("probSettingsClose");
    if (probClose) probClose.addEventListener("click", closeProbSettings);

    window.__akiniSendMusicInviteCard = sendMusicInviteCard;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

  window.__akiniShowMusicHome = showMusicHome;
  window.__akiniHideMusicHome = hideMusicHome;
  window.__akiniShowCompanionHome = showCompanionHome;

  (function () {
    try {
      var store = window.akiniStore;
      if (!store || typeof store.rawLSSet !== "function" || store.rawLSSet.__r6perf) return;
      var origRaw = store.rawLSSet;
      var pending = {};
      var flushTimer = null;
      var lastWrite = {};
      var THROTTLE = 8000;
      var unloading = false;

      function doFlush() {
        flushTimer = null;
        var keys = Object.keys(pending);
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          var v = pending[k];
          delete pending[k];
          lastWrite[k] = Date.now();
          try {
            origRaw.call(store, k, v);
          } catch (e) {}
        }
      }
      function forceAll() {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        doFlush();
      }

      var wrapped = function (k, v) {
        var key = String(k == null ? "" : k);
        var len = typeof v === "string" ? v.length : 0;
        // 只延迟聊天记录这类超大字符串；其他键保持原有同步行为
        if (key.indexOf("akini_chat_history_") === 0 && len > 204800) {
          if (unloading || document.hidden) {
            lastWrite[key] = Date.now();
            return origRaw.call(store, k, v);
          }
          if (lastWrite[key] && Date.now() - lastWrite[key] < THROTTLE) return true;
          pending[key] = v;
          if (!flushTimer) flushTimer = setTimeout(doFlush, 1500);
          return true;
        }
        return origRaw.call(store, k, v);
      };
      wrapped.__r6perf = true;
      store.rawLSSet = wrapped;

      window.addEventListener(
        "pagehide",
        function () {
          unloading = true;
          forceAll();
        },
        true,
      );
      window.addEventListener(
        "beforeunload",
        function () {
          unloading = true;
          forceAll();
        },
        true,
      );
      window.__akiniOnHidden(function () { forceAll(); });
    } catch (e) {}
  })();

  /* 历史消息头像净化：旧版本消息里可能存了 emoji 头像，渲染时统一替换为线条默认头像 */
  (function () {
    function isEmojiOnly(t) {
      return !!t && t.replace(/[\s\u200d\ufe0f]/g, "").length <= 2 && !/[A-Za-z0-9\u4e00-\u9fa5]/.test(t);
    }
    function applyLine(el, size) {
      if (!window.__akiniLineAvatarImg) return;
      el.innerHTML = window.__akiniLineAvatarImg();
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.borderRadius = "50%";
      el.style.overflow = "hidden";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.background = "#f7f8fa";
    }
    function fixAv(a, size) {
      if (!a || a.nodeType !== 1) return;
      if (a.querySelector && a.querySelector("img,svg")) return;
      var t = (a.textContent || "").trim();
      if (isEmojiOnly(t)) applyLine(a, size || 36);
    }
    /* 历史一起听卡片统一样式（旧卡片内联尺寸/黑描边）：与商店、问卷、转账小卡片一致的浅灰描边白底 */
    function normalizeEndCard(card) {
      if (!card.classList) return;
      var isEnd = card.classList.contains("music-end-bubble");
      var isInvite = card.classList.contains("music-invite-bubble");
      if (!isEnd && !isInvite) return;
      card.style.setProperty("padding", "13px 14px", "important");
      card.style.setProperty("width", "236px", "important");
      card.style.setProperty("min-width", "236px", "important");
      card.style.setProperty("max-width", "236px", "important");
      card.style.setProperty("border", "1px solid #e8e8e8", "important");
      card.style.setProperty("border-radius", "16px", "important");
      card.style.setProperty("background", "#fff", "important");
      card.style.setProperty("box-shadow", "0 4px 14px rgba(0,0,0,.07)", "important");
      /* 旧总结卡片没有分隔线：在「N 条聊天记录」前面补一条头尾不连接的居中细线 */
      if (isEnd && !card.querySelector(".akini-card-divider")) {
        try {
          var rows = card.querySelectorAll("div,span,p");
          for (var i = 0; i < rows.length; i++) {
            var n = rows[i];
            if (n.children.length === 0 && /条聊天记录/.test(n.textContent || "")) {
              var dv = document.createElement("div");
              dv.className = "akini-card-divider";
              dv.style.cssText = "width:88%;height:1px;background:#ececec;margin:8px auto 7px;";
              n.parentNode.insertBefore(dv, n);
              break;
            }
          }
        } catch (e) {}
      }
    }
    function fixCard(card) {
      if (!card || card.nodeType !== 1) return;
      normalizeEndCard(card);
      fixAv(card, 36);
      var nodes = card.querySelectorAll("*");
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        if (node.children && node.children.length) continue;
        fixAv(node, 36);
      }
    }
    /* 全量扫描：聊天消息头像 + 一起听卡片内嵌头像（含历史存下来的旧卡片） */
    function scan() {
      try {
        if (document.hidden) return;
        var app = document.getElementById("app-chat");
        if (app && app.style.display === "none") return;
        var chatBody = document.getElementById("chatBody");
        if (chatBody) {
          var avs = chatBody.querySelectorAll(".msg-avatar");
          for (var i = 0; i < avs.length; i++) {
            var el = avs[i];
            if (el.querySelector && el.querySelector("img,svg")) continue;
            var row = el.closest ? el.closest(".msg-row") : null;
            var size = row && row.classList.contains("me") ? 42 : 38;
            fixAv(el, size);
          }
        }
        var cards = document.querySelectorAll(".music-end-bubble,.music-invite-bubble");
        for (var k = 0; k < cards.length; k++) fixCard(cards[k]);
      } catch (e) {}
    }
    /* 立即扫描 + 多时点补扫（旧聊天内容会在 navTo/恢复后异步渲染，单次扫描会漏） */
    [0, 600, 2000].forEach(function (ms) {
      setTimeout(scan, ms);
    });
    /* 用 MutationObserver 监听 chatBody 新增消息，替代 30s 轮询：
       新消息进来时只扫描新增的头像，而不是全量遍历。 */
    try {
      var _r6Ob = new MutationObserver(function (muts) {
        for (var mi = 0; mi < muts.length; mi++) {
          var added = muts[mi].addedNodes;
          for (var ni = 0; ni < added.length; ni++) {
            var node = added[ni];
            if (node.nodeType !== 1) continue;
            var avs = node.querySelectorAll ? node.querySelectorAll(".msg-avatar") : [];
            for (var ai = 0; ai < avs.length; ai++) {
              var el = avs[ai];
              if (el.querySelector && el.querySelector("img,svg")) continue;
              var row = el.closest ? el.closest(".msg-row") : null;
              var size = row && row.classList.contains("me") ? 42 : 38;
              fixAv(el, size);
            }
            if (
              node.classList &&
              (node.classList.contains("music-end-bubble") || node.classList.contains("music-invite-bubble"))
            ) {
              fixCard(node);
            }
            var cards = node.querySelectorAll ? node.querySelectorAll(".music-end-bubble,.music-invite-bubble") : [];
            for (var ci = 0; ci < cards.length; ci++) fixCard(cards[ci]);
          }
        }
      });
      var _r6Cb = document.getElementById("chatBody");
      if (_r6Cb) _r6Ob.observe(_r6Cb, { childList: true, subtree: true });
    } catch (e) {}
  })();
})();
