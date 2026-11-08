/* 网易云扫码登录
 * 走 AKINI_NETEASE_PROXY 的 /login/qr/* 与 /login/status 接口，
 * 扫码成功后把 cookie 存到 akini_netease_cookie，供 /song/url 拉直链时带上。 */
(function () {
  "use strict";

  var CK_KEY = "akini_netease_cookie";
  var PF_KEY = "akini_netease_profile";
  var POLL_MS = 2000;
  var state = { key: "", timer: null, polling: false, tick: 0 };

  function base() {
    var b = "";
    try {
      b = String(window.AKINI_NETEASE_PROXY || "").trim();
    } catch (e) {}
    return (b || "https://api.mc666.org.cn").replace(/\/+$/, "");
  }

  function api(path, ms) {
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

  function getCookie() {
    try {
      return localStorage.getItem(CK_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function getProfile() {
    try {
      return JSON.parse(localStorage.getItem(PF_KEY) || "null") || null;
    } catch (e) {
      return null;
    }
  }

  function setCookie(ck, profile) {
    try {
      localStorage.setItem(CK_KEY, ck || "");
    } catch (e) {}
    try {
      if (profile) localStorage.setItem(PF_KEY, JSON.stringify(profile));
      else localStorage.removeItem(PF_KEY);
    } catch (e) {}
    window.__akiniNeCookie = ck || "";
  }

  function profileOf(d) {
    var p = d && d.data && d.data.profile;
    if (!p) return null;
    return { nickname: p.nickname || "", avatarUrl: p.avatarUrl || "", userId: p.userId || 0 };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    try {
      window.akiniToast ? window.akiniToast(msg) : console.log("[netease]", msg);
    } catch (e) {}
  }

  function renderRow() {
    var ck = getCookie();
    var pf = getProfile();
    var st = $("neAccountStatus");
    var loginBtn = $("neLoginBtn");
    var logoutBtn = $("neLogoutBtn");
    if (st) {
      st.textContent = ck
        ? "已登录" + (pf && pf.nickname ? " · " + pf.nickname : "") + " · 可听完整版"
        : "未登录 · 扫码登录后可听完整版";
      st.style.color = ck ? "#1a1a1a" : "#999";
    }
    if (loginBtn) loginBtn.style.display = ck ? "none" : "inline-flex";
    if (logoutBtn) logoutBtn.style.display = ck ? "inline-flex" : "none";
  }

  function setQrStatus(text, color) {
    var el = $("neQrStatus");
    if (!el) return;
    el.textContent = text;
    el.style.color = color || "#666";
  }

  function showQrImage(src) {
    var img = $("neQrImg");
    var loading = $("neQrLoading");
    if (!img) return;
    if (src) {
      img.src = src;
      img.style.display = "block";
      loading && (loading.style.display = "none");
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
      loading && (loading.style.display = "block");
    }
  }

  function stopPoll() {
    state.polling = false;
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function closeOverlay() {
    stopPoll();
    var ov = $("neQrOverlay");
    if (ov) {
      ov.style.display = "none";
      ov.classList.remove("show");
    }
  }

  function openOverlay() {
    var ov = $("neQrOverlay");
    if (!ov) return;
    ov.style.display = "flex";
    ov.classList.add("show");
    newQr();
  }

  function newQr() {
    stopPoll();
    showQrImage("");
    setQrStatus("二维码加载中…", "#999");
    state.tick = 0;
    api("/login/qr/key").then(function (d) {
      var key = d && d.data && d.data.unikey;
      if (!key) {
        setQrStatus("二维码获取失败，请点「刷新二维码」重试", "#e54d42");
        return;
      }
      state.key = key;
      api("/login/qr/create?key=" + encodeURIComponent(key) + "&qrimg=true").then(function (r) {
        var url = r && r.data && (r.data.qrimg || r.data.qrurl);
        if (!url) {
          setQrStatus("二维码生成失败，请点「刷新二维码」重试", "#e54d42");
          return;
        }
        showQrImage(url);
        setQrStatus("请用网易云音乐 App 扫码", "#666");
        startPoll();
      });
    });
  }

  function startPoll() {
    stopPoll();
    state.polling = true;
    state.timer = setInterval(function () {
      if (!state.polling || !state.key) return;
      state.tick++;
      if (state.tick > 150) {
        stopPoll();
        setQrStatus("二维码已过期，请点「刷新二维码」", "#e54d42");
        return;
      }
      api("/login/qr/check?key=" + encodeURIComponent(state.key)).then(function (d) {
        if (!d || !state.polling) return;
        var code = d.code;
        if (code === 800) {
          stopPoll();
          setQrStatus("二维码已过期，请点「刷新二维码」", "#e54d42");
        } else if (code === 801) {
          setQrStatus("等待扫码…", "#666");
        } else if (code === 802) {
          setQrStatus("已扫码，请在手机上确认登录", "#f0a020");
        } else if (code === 803) {
          stopPoll();
          var ck = d.cookie || "";
          if (!ck) {
            setQrStatus("登录失败：未拿到登录凭证", "#e54d42");
            return;
          }
          setQrStatus("登录成功", "#07c160");
          api("/login/status?cookie=" + encodeURIComponent(ck)).then(function (s) {
            var pf = profileOf(s);
            setCookie(ck, pf);
            renderRow();
            setTimeout(closeOverlay, 600);
            toast(pf && pf.nickname ? "已登录：" + pf.nickname : "网易云登录成功");
          });
        }
      });
    }, POLL_MS);
  }

  function logout() {
    setCookie("", null);
    renderRow();
    toast("已退出网易云账号");
  }

  /* 校验已保存的 cookie 是否还有效（只在打开音乐菜单时轻量检查一次） */
  var checked = false;
  function verifySession() {
    var ck = getCookie();
    if (!ck || checked) return;
    checked = true;
    api("/login/status?cookie=" + encodeURIComponent(ck)).then(function (d) {
      var pf = profileOf(d);
      if (pf && (pf.nickname || pf.userId)) {
        setCookie(ck, pf);
        renderRow();
      }
    });
  }

  function bind() {
    var loginBtn = $("neLoginBtn");
    var logoutBtn = $("neLogoutBtn");
    var cancel = $("neQrCancel");
    var regen = $("neQrRegen");
    var ov = $("neQrOverlay");
    loginBtn && loginBtn.addEventListener("click", openOverlay);
    logoutBtn && logoutBtn.addEventListener("click", logout);
    cancel && cancel.addEventListener("click", closeOverlay);
    regen && regen.addEventListener("click", newQr);
    ov &&
      ov.addEventListener("click", function (e) {
        e.target === ov && closeOverlay();
      });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopPoll();
      else if (ov && ov.style.display === "flex" && !state.polling) startPoll();
    });
    window._openMusicMenu &&
      !window.__akiniNeMenuPatched &&
      ((window.__akiniNeMenuPatched = true),
      (function (orig) {
        window._openMusicMenu = function () {
          try {
            verifySession();
          } catch (e) {}
          return orig.apply(this, arguments);
        };
      })(window._openMusicMenu));
    renderRow();
  }

  window.__akiniNeCookie = getCookie();
  window.__akiniNeLoggedIn = function () {
    return !!getCookie();
  };
  window.__akiniNeCookieParam = function () {
    var ck = getCookie();
    return ck ? "&cookie=" + encodeURIComponent(ck) : "";
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
