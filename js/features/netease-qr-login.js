/* 网易云扫码登录（与旧版 akini-music.js 中的实现保持一致）
 * 流程：/login/qr/key → /login/qr/create → 每 4.5s 轮询 /login/qr/check
 * 二维码本地用 QRCode 渲染（js/vendor/qrcode.min.js），不依赖接口返回图片
 * 登录成功后 cookie 落盘（AKINI_NE / akini_netease_cookie / akini_ne_ck 三处），
 * 供 /song/url 拉直链时带上，可播 VIP / 已购歌曲完整版。 */
(function () {
  "use strict";

  var KEY_QR = "akini_ne_qr";
  var KEY_COOKIE = "akini_netease_cookie";
  var KEY_CK = "akini_ne_ck";
  var KEY_OBJ = "AKINI_NE";
  var POLL_MS = 4500;
  var RETRY = [5000, 10000, 20000, 40000, 60000];
  var RISK_PAUSE_MS = 120000;

  var pollTimer = null;
  var keepTimer = null;
  var qrKey = "";
  var lastGenAt = 0;
  var netErrs = 0;
  var backoffIdx = 0;
  var expiredCount = 0;
  var cancelled = false;
  var sessionCache = null;
  var sessionPromise = null;

  function $(id) {
    return document.getElementById(id);
  }

  function base() {
    var b = "";
    try {
      b = String(window.AKINI_NETEASE_PROXY || "").trim();
    } catch (e) {}
    return (b || "https://api.mc666.org.cn").replace(/\/+$/, "");
  }

  function neGet(path, ms) {
    var url = base() + path + (path.indexOf("?") < 0 ? "?" : "&") + "timestamp=" + Date.now();
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl
      ? setTimeout(function () {
          try {
            ctrl.abort();
          } catch (e) {}
        }, ms || 12000)
      : null;
    var p = fetch(url, { signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
    return p.then(function (v) {
      timer && clearTimeout(timer);
      return v;
    });
  }

  function profileOf(d) {
    var p = d && d.data && d.data.profile;
    if (!p) return null;
    return { nickname: p.nickname || "", avatarUrl: p.avatarUrl || "", userId: p.userId || 0 };
  }

  /* 与原实现相同的接口映射 */
  function api(action, params, ms) {
    var n = params || {};
    ms = ms || 12000;
    if (action === "qr/new")
      return neGet("/login/qr/key", ms).then(function (d) {
        var k = d && d.data && d.data.unikey;
        if (!k) return null;
        return neGet("/login/qr/create?key=" + encodeURIComponent(k) + "&qrimg=true", ms).then(function (r) {
          if (!r || !r.data || !r.data.qrurl) return null;
          return { key: k, qrurl: r.data.qrurl, qrimg: r.data.qrimg || "" };
        });
      });
    if (action === "qr/check") {
      var qk = n.key || "";
      if (!qk) return Promise.resolve(null);
      return neGet("/login/qr/check?key=" + encodeURIComponent(qk), ms).then(function (d) {
        if (!d) return null;
        var o = { code: d.code, message: d.message || d.msg || "" };
        if (d.code === 803 && d.cookie) {
          o.ck = d.cookie;
          return neGet("/login/status?cookie=" + encodeURIComponent(d.cookie), ms).then(
            function (s) {
              var pf = profileOf(s);
              if (pf) o.profile = pf;
              return o;
            },
            function () {
              return o;
            }
          );
        }
        return o;
      });
    }
    if (action === "session" || action === "session/adopt") {
      var ck = n.cookie || readCookie() || "";
      if (!ck) return Promise.resolve({ loggedIn: false, code: 401, msg: "未登录" });
      return neGet("/login/status?cookie=" + encodeURIComponent(ck), ms).then(function (d) {
        var pf = profileOf(d);
        if (pf && (pf.nickname || pf.userId)) return { loggedIn: true, ck: ck, profile: pf };
        return { loggedIn: false, code: 401, msg: "网易云登录已失效，请重新扫码" };
      });
    }
    if (action === "logout") {
      var c3 = n.cookie || readCookie() || "";
      return neGet("/logout" + (c3 ? "?cookie=" + encodeURIComponent(c3) : ""), ms).then(
        function () {
          return { ok: true };
        },
        function () {
          return { ok: true };
        }
      );
    }
    return Promise.resolve(null);
  }

  /* ---------- 登录态存取（兼容旧版三个键） ---------- */
  function writeCookie(ck) {
    window.__akiniNeCk = ck;
    window.__akiniNeCookie = ck || "";
    var obj = {
      cookie: ck,
      uid: (window.__akiniNeProfile && window.__akiniNeProfile.userId) || 0,
      nickname: (window.__akiniNeProfile && window.__akiniNeProfile.nickname) || "",
      ts: Date.now(),
    };
    var str = "";
    try {
      str = JSON.stringify(obj);
    } catch (e) {
      str = "";
    }
    if (str) {
      try {
        localStorage.setItem(KEY_OBJ, str);
      } catch (e) {}
      try {
        sessionStorage.setItem(KEY_OBJ, str);
      } catch (e) {}
    }
    try {
      localStorage.setItem(KEY_CK, ck);
    } catch (e) {}
    try {
      sessionStorage.setItem(KEY_CK, ck);
    } catch (e) {}
    try {
      localStorage.setItem(KEY_COOKIE, ck);
    } catch (e) {}
  }

  function readCookie() {
    if (window.__akiniNeCk) return window.__akiniNeCk;
    var raw = "";
    try {
      raw = localStorage.getItem(KEY_OBJ) || "";
    } catch (e) {}
    if (!raw) {
      try {
        raw = sessionStorage.getItem(KEY_OBJ) || "";
      } catch (e) {}
    }
    if (raw) {
      try {
        var o = JSON.parse(raw);
        if (o && o.cookie) {
          window.__akiniNeCk = o.cookie;
          if (o.nickname && !window.__akiniNeProfile)
            window.__akiniNeProfile = { nickname: o.nickname, userId: o.uid };
          return o.cookie;
        }
      } catch (e) {}
    }
    try {
      var a = localStorage.getItem(KEY_CK);
      if (a) return (window.__akiniNeCk = a), a;
    } catch (e) {}
    try {
      var b = sessionStorage.getItem(KEY_CK);
      if (b) return (window.__akiniNeCk = b), b;
    } catch (e) {}
    try {
      var c = localStorage.getItem(KEY_COOKIE);
      if (c) return (window.__akiniNeCk = c), c;
    } catch (e) {}
    return "";
  }

  function clearCookie() {
    window.__akiniNeCk = "";
    window.__akiniNeCookie = "";
    window.__akiniNeLoggedIn = false;
    [KEY_OBJ, KEY_CK, KEY_COOKIE].forEach(function (k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
      try {
        sessionStorage.removeItem(k);
      } catch (e) {}
    });
  }

  function saveQR(key) {
    try {
      localStorage.setItem(KEY_QR, JSON.stringify({ key: key, ts: Date.now() }));
    } catch (e) {}
  }

  function loadQR() {
    try {
      var raw = localStorage.getItem(KEY_QR);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && o.key && Date.now() - (o.ts || 0) < 300000) return o.key;
    } catch (e) {}
    return null;
  }

  function clearQR() {
    try {
      localStorage.removeItem(KEY_QR);
    } catch (e) {}
  }

  /* ---------- 界面 ---------- */
  function setRow(text, loggedIn) {
    var el = $("neAccountStatus");
    if (el) el.textContent = text;
    var loginBtn = $("neLoginBtn");
    var logoutBtn = $("neLogoutBtn");
    if (loginBtn) loginBtn.style.display = loggedIn ? "none" : "";
    if (logoutBtn) logoutBtn.style.display = loggedIn ? "" : "none";
  }

  function showProfile(profile) {
    var el = $("neAccountStatus");
    if (!el) return;
    var name = profile && profile.nickname ? String(profile.nickname) : "已登录";
    var avatar = profile && profile.avatarUrl ? String(profile.avatarUrl) : "";
    if (!avatar) {
      el.textContent = "已登录 · " + name;
      return;
    }
    el.innerHTML = "";
    var img = document.createElement("img");
    img.src = avatar;
    img.alt = name;
    img.style.cssText =
      "width:40px;height:40px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 6px;border:1px solid #eee;background:#f2f2f7;";
    img.onerror = function () {
      this.style.display = "none";
    };
    el.appendChild(img);
    var d1 = document.createElement("div");
    d1.textContent = name;
    d1.style.cssText = "font-size:13px;color:#1a1a1a;font-weight:600;";
    el.appendChild(d1);
    var d2 = document.createElement("div");
    d2.textContent = "已登录 · VIP歌曲可播完整版";
    d2.style.cssText = "font-size:11px;color:#777;margin-top:2px;";
    el.appendChild(d2);
  }

  function setStatus(text) {
    var el = $("neQrStatus");
    if (el) el.textContent = text;
  }

  function drawQR(url) {
    var box = $("neQrBox");
    if (!box) return;
    box.innerHTML = "";
    if (typeof QRCode === "undefined") {
      var n = parseInt(box.getAttribute("data-retry") || "0", 10);
      if (n < 4) {
        box.setAttribute("data-retry", String(n + 1));
        box.innerHTML =
          '<div style="font-size:12px;color:#999;padding:8px;text-align:center">二维码组件加载中…</div>';
        setTimeout(function () {
          var ov = $("neQrOverlay");
          if (ov && ov.style.display !== "none") drawQR(url);
        }, 400);
        return;
      }
      box.innerHTML =
        '<div style="font-size:11px;color:#666;padding:8px;text-align:center;line-height:1.7">二维码组件加载失败<br>请长按复制下方链接，粘贴到浏览器打开后扫码：<br><span style="user-select:text;-webkit-user-select:text;word-break:break-all;color:#1a6fd4;font-size:10px">' +
        String(url) +
        "</span><br>或点「重新获取」重试</div>";
      return;
    }
    box.removeAttribute("data-retry");
    try {
      new QRCode(box, { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
    } catch (e) {
      box.innerHTML =
        '<div style="font-size:11px;color:#666;padding:8px;text-align:center;line-height:1.7">二维码渲染失败<br>请长按复制链接到浏览器打开：<br><span style="user-select:text;-webkit-user-select:text;word-break:break-all;color:#1a6fd4;font-size:10px">' +
        String(url) +
        "</span></div>";
    }
  }

  function stopPoll() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function schedulePoll(ms) {
    stopPoll();
    pollTimer = setTimeout(poll, ms);
  }

  function closeOverlay() {
    var ov = $("neQrOverlay");
    if (ov) ov.style.display = "none";
    stopPoll();
  }

  /* ---------- 轮询 ---------- */
  function poll() {
    if (!qrKey) return;
    api("qr/check", { key: qrKey }, 12000).then(function (e) {
      if (!qrKey || cancelled) return;
      if (!e) {
        netErrs++;
        var wait = RETRY[Math.min(backoffIdx, RETRY.length - 1)];
        if (netErrs > 1) backoffIdx++;
        setStatus("网络异常，" + Math.round(wait / 1000) + "秒后重试（二维码仍有效）");
        schedulePoll(wait);
        return;
      }
      netErrs = 0;
      backoffIdx = 0;

      if (e.code === 401 || e.code === 502) {
        stopPoll();
        setStatus(String((e && (e.msg || e.message)) || "登录服务异常") + "，请点「重新获取」");
        return;
      }
      if (e.code === 400) {
        clearQR();
        newQR(true);
        return;
      }
      if (e.code === 8030) {
        stopPoll();
        setStatus(String((e && (e.msg || e.message)) || "授权凭据获取失败，请重新扫码"));
        return;
      }
      var msg = String((e && (e.message || e.msg)) || "");
      /* 风控：网易云要求验证 / 判定频繁时暂停 2 分钟，避免越请求越严格 */
      if (e.code === 405 || e.code === -462 || msg.indexOf("验证") >= 0 || msg.indexOf("频繁") >= 0) {
        setStatus("网易云要求验证/限频，已暂停查询2分钟，请稍后再试");
        schedulePoll(RISK_PAUSE_MS);
        return;
      }
      if (e.code === 801) {
        expiredCount = 0;
        setStatus("等待扫码登录…");
        schedulePoll(POLL_MS);
      } else if (e.code === 802) {
        expiredCount = 0;
        setStatus("已扫码，请在APP中确认登录");
        schedulePoll(POLL_MS);
      } else if (e.code === 800) {
        expiredCount++;
        if (expiredCount <= 3) {
          setStatus("二维码已过期，正在等待最后的确认结果…");
          schedulePoll(4000);
        } else {
          setStatus("二维码显示已过期，正在刷新…");
          newQR(true);
        }
      } else if (e.code === 803) {
        var ck = e.ck || (e.profile && e.profile.nickname ? readCookie() : "");
        qrKey = "";
        stopPoll();
        clearQR();
        if (!ck) {
          setStatus("检测到历史确认记录，已为你换新二维码，请重新扫码");
          newQR(true);
          return;
        }
        writeCookie(ck);
        window.__akiniNeLoggedIn = true;
        window.__akiniNeProfile = e.profile || null;
        showProfile(e.profile);
        setStatus("✓ 已登录" + (e.profile && e.profile.nickname ? " · " + e.profile.nickname : ""));
        setTimeout(function () {
          closeOverlay();
          refreshSession(true);
        }, 1000);
      } else {
        setStatus("状态查询异常(code:" + (e && e.code) + (e && e.msg ? " " + String(e.msg) : "") + ")，继续等待…");
        schedulePoll(POLL_MS);
      }
    });
  }

  function startPoll(key) {
    qrKey = key;
    netErrs = 0;
    backoffIdx = 0;
    expiredCount = 0;
    schedulePoll(1200);
  }

  function newQR(force) {
    var now = Date.now();
    if (!force && now - lastGenAt < 4500) {
      setStatus("操作太频繁，请" + Math.ceil((4500 - (now - lastGenAt)) / 1000) + "秒后再获取");
      return;
    }
    lastGenAt = now;
    stopPoll();
    setStatus("正在生成二维码…");
    api("qr/new", {}, 10000).then(function (res) {
      if (res && res.key && res.qrurl) {
        drawQR(res.qrurl);
        saveQR(res.key);
        setStatus("等待扫码登录…");
        startPoll(res.key);
      } else {
        setStatus("生成失败，请点击「重新获取」重试");
      }
    });
  }

  function resumeQR() {
    if (qrKey) {
      setStatus("正在恢复扫码状态…");
      schedulePoll(800);
      return;
    }
    var saved = loadQR();
    if (saved) {
      setStatus("正在恢复扫码状态…");
      startPoll(saved);
    } else {
      clearQR();
    }
  }

  function openOverlay() {
    var ov = $("neQrOverlay");
    if (ov) ov.style.display = "flex";
    cancelled = false;
    clearQR();
    newQR(true);
    stopKeep();
    var until = Date.now() + 6000;
    keepTimer = setInterval(function () {
      if (Date.now() > until) return stopKeep();
      if (cancelled || window.__akiniNeLoggedIn) return stopKeep();
      var o = $("neQrOverlay");
      if (o && o.style.display === "none") {
        o.style.display = "flex";
        setStatus("二维码仍在，请继续扫码登录…");
      }
    }, 500);
  }

  function stopKeep() {
    if (keepTimer) {
      clearInterval(keepTimer);
      keepTimer = null;
    }
  }

  /* ---------- 会话校验 ---------- */
  function refreshSession(force) {
    var now = Date.now();
    if (!force && sessionCache && now - (sessionCache.ts || 0) < 60000) return Promise.resolve(sessionCache);
    if (sessionPromise) return sessionPromise;
    sessionPromise = api("session", {}, 15000).then(function (e) {
      sessionPromise = null;
      sessionCache = e && { loggedIn: !!e.loggedIn, profile: e.profile, ts: Date.now() };
      if (e && e.loggedIn) {
        window.__akiniNeLoggedIn = true;
        window.__akiniNeProfile = e.profile || null;
        showProfile(e.profile);
        var lb = $("neLoginBtn");
        var ob = $("neLogoutBtn");
        if (lb) lb.style.display = "none";
        if (ob) ob.style.display = "";
      } else {
        window.__akiniNeLoggedIn = false;
        var ck = readCookie();
        if (ck && ck.indexOf("MUSIC_U=") >= 0) {
          window.__akiniNeLoggedIn = true;
          if (window.__akiniNeProfile && window.__akiniNeProfile.nickname)
            setRow("已登录 · " + window.__akiniNeProfile.nickname, true);
          else setRow("已登录", true);
          api("session/adopt", { cookie: ck }, 15000).then(function (r) {
            if (r && r.loggedIn) {
              if (r.ck) writeCookie(r.ck);
              sessionCache = null;
              window.__akiniNeLoggedIn = true;
              window.__akiniNeProfile = r.profile || null;
              showProfile(r.profile);
            }
          });
        } else {
          setRow("未登录 · VIP歌曲仅可试听", false);
        }
      }
      return e;
    });
    return sessionPromise;
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    var loginBtn = $("neLoginBtn");
    var logoutBtn = $("neLogoutBtn");
    var cancel = $("neQrCancel");
    var regen = $("neQrRegen");
    var ov = $("neQrOverlay");

    if (loginBtn && !loginBtn._neBound) {
      loginBtn._neBound = 1;
      loginBtn.onclick = function () {
        openOverlay();
      };
    }
    if (logoutBtn && !logoutBtn._neBound) {
      logoutBtn._neBound = 1;
      logoutBtn.onclick = function () {
        api("logout", {});
        clearCookie();
        sessionCache = null;
        setRow("未登录 · VIP歌曲仅可试听", false);
        try {
          window.akiniToast && window.akiniToast("已退出网易云账号");
        } catch (e) {}
      };
    }
    if (cancel && !cancel._neBound) {
      cancel._neBound = 1;
      cancel.onclick = function () {
        cancelled = true;
        stopKeep();
        qrKey = "";
        stopPoll();
        clearQR();
        closeOverlay();
      };
    }
    if (regen && !regen._neBound) {
      regen._neBound = 1;
      regen.onclick = function () {
        newQR(false);
      };
    }
    if (ov && !ov._neBound) {
      ov._neBound = 1;
      ov.addEventListener("click", function (e) {
        if (e.target === ov) {
          cancelled = true;
          qrKey = "";
          stopPoll();
          closeOverlay();
        }
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        stopPoll();
        return;
      }
      var o = $("neQrOverlay");
      if (o && o.style.display !== "none") resumeQR();
    });
    window.addEventListener("pagehide", stopPoll);
    window.addEventListener("pageshow", function () {
      var o = $("neQrOverlay");
      if (o && o.style.display !== "none" && qrKey) schedulePoll(800);
      if (!qrKey && loadQR()) resumeQR();
    });

    var ck = readCookie();
    if (ck && ck.indexOf("MUSIC_U=") >= 0) {
      window.__akiniNeLoggedIn = true;
      setRow("已登录", true);
      refreshSession(true);
    } else {
      setRow("未登录 · VIP歌曲仅可试听", false);
    }
  }

  window.__akiniNeCookie = readCookie();
  window.__akiniNeLoggedIn = !!readCookie();
  window.__akiniNeCookieParam = function () {
    var ck = readCookie();
    return ck ? "&cookie=" + encodeURIComponent(ck) : "";
  };
  window.__akiniNeRefresh = refreshSession;
  window.__akiniNeOpenQr = openOverlay;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
