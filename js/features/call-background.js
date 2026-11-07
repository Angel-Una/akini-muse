/* 通话背景换图 */

(function () {
  var CB = {
    fileInputCallBgBeautify: {
      keys: ["akini_call_bg"],
      name: "通话背景",
      apply: "__applyCallBg",
      style: "akiniCallBgStyle",
    },
    fileInputCallMiniBgBeautify: {
      keys: ["akini_callmini_bg", "akini_call_mini_bg"],
      name: "通话mini背景",
      apply: "__applyCallMiniBg",
      style: "akiniCallMiniBgStyle",
    },
    fileInputMusicInviteBgBeautify: {
      keys: ["akini_music_invite_bg"],
      name: "一起听邀请弹窗背景",
      apply: "__applyMusicInviteBg",
      style: "akiniMusicInviteBgStyle",
    },
  };
  var __tok = null;
  function AK(m) {
    try {
      var f = window.akiniToast;
      if (f) {
        f(m);
        return;
      }
      var d = document.createElement("div");
      d.textContent = String(m);
      d.style.cssText =
        "position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:9900;background:rgba(0,0,0,.78);color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;max-width:80vw;";
      document.body.appendChild(d);
      setTimeout(function () {
        try {
          document.body.removeChild(d);
        } catch (e) {}
      }, 2400);
    } catch (e) {}
  }
  function __sig(f) {
    return (f.name || "") + "|" + (f.size || 0) + "|" + (f.lastModified || 0);
  }
  function __process(f, cfg, entry) {
    var r = new FileReader();
    r.onload = function (ev) {
      var d = ev.target.result;
      var fin = function (url) {
        try {
          if (window[cfg.apply]) window[cfg.apply](url);
        } catch (e1) {}
        var st = document.getElementById(cfg.style);
        var okCss = !!(st && st.textContent && st.textContent.indexOf(String(url).slice(0, 40)) >= 0);
        for (var i = 0; i < cfg.keys.length; i++) {
          try {
            localStorage.setItem(cfg.keys[i], url);
          } catch (ex) {}
        }
        /* 用户要求隐藏更换通话界面和mini界面成功的弹窗，静默更新 */
      };
      var img = new Image();
      img.onload = function () {
        /* 对齐极简 原图直存，不压缩任何画质 */
        fin(d);
      };
      img.onerror = function () {
        AK('这张图片的格式当前浏览器显示不了（多为 HEIC/原图），请改选 JPG/PNG，或选图时不要勾选"原图"');
      };
      img.src = d;
    };
    r.readAsDataURL(f);
  }
  function __route(t, entry) {
    try {
      if (!t || !t.id) return false;
      var cfg = CB[t.id];
      if (!cfg) return false;
      var f = t.files && t.files[0];
      /* 用户取消选图或多次触发空事件时静默返回，杜绝误报“未读取到图片” */
      if (!f) {
        return false;
      }
      var s = __sig(f),
        now = Date.now();
      if (__tok && __tok.s === s && now - __tok.at < 2000) return true;
      __tok = { s: s, at: now };
      __process(f, cfg, entry);
      return true;
    } catch (ex) {
      return false;
    }
  }
  /* 一起听邀请弹窗背景：把 #musicInvitePopup 内的白色卡片换成用户选择的图片 */
  window.__applyMusicInviteBg = function (t) {
    var apply = function (url) {
      try {
        var st = document.getElementById("akiniMusicInviteBgStyle");
        if (!st) {
          st = document.createElement("style");
          st.id = "akiniMusicInviteBgStyle";
          document.head.appendChild(st);
        }
        st.textContent = url
          ? '#musicInvitePopup>div{background:linear-gradient(rgba(255,255,255,.78),rgba(255,255,255,.78)) center/cover no-repeat,url("' +
            url +
            '") center/cover no-repeat!important;}'
          : "";
      } catch (e) {}
    };
    if (t !== undefined) {
      apply(t);
      return;
    }
    try {
      var v = "";
      try {
        if (window.akiniStore && window.akiniStore.memoryGet) {
          var m = window.akiniStore.memoryGet("akini_music_invite_bg");
          if (m) v = m;
        }
      } catch (e) {}
      if (!v) v = localStorage.getItem("akini_music_invite_bg") || "";
      apply(v);
    } catch (e) {
      apply("");
    }
  };
  /* 补定义 inline 引用的 handler（此前从未定义，inline 调用一直抛 TypeError） */
  window.handleBeautifyCallBg = function (e) {
    try {
      __route(e && e.target, "inline");
    } catch (ex) {}
  };
  window.handleBeautifyCallMiniBg = function (e) {
    try {
      __route(e && e.target, "inline");
    } catch (ex) {}
  };
  window.handleBeautifyMusicInviteBg = function (e) {
    try {
      __route(e && e.target, "inline");
    } catch (ex) {}
  };
  /* 捕获总闸：document 捕获阶段接住两个通话背景 input 的 change */
  document.addEventListener(
    "change",
    function (ev) {
      try {
        var t = ev.target;
        if (!t || t.tagName !== "INPUT" || (t.type || "").toLowerCase() !== "file") return;
        __route(t, "总闸");
      } catch (ex) {}
    },
    true,
  );
  /* 显式绑定（双时机，防绑定丢失） */
  function __bind() {
    for (var id in CB) {
      var inp = document.getElementById(id);
      if (!inp || inp.__Bound) continue;
      inp.__Bound = true;
      (function (node) {
        node.addEventListener("change", function () {
          __route(node, "绑定");
        });
      })(inp);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      __bind();
      setTimeout(__bind, 400);
    });
  } else {
    __bind();
    setTimeout(__bind, 400);
  }
  if (document.readyState === "complete") {
    __bind();
    setTimeout(function () {
      try {
        if (window.__applyCallBg) window.__applyCallBg();
        if (window.__applyCallMiniBg) window.__applyCallMiniBg();
        if (window.__applyMusicInviteBg) window.__applyMusicInviteBg();
      } catch (e) {}
    }, 600);
  } else {
    window.addEventListener("load", function () {
      __bind();
      setTimeout(function () {
        try {
          if (window.__applyCallBg) window.__applyCallBg();
          if (window.__applyCallMiniBg) window.__applyCallMiniBg();
          if (window.__applyMusicInviteBg) window.__applyMusicInviteBg();
        } catch (e) {}
      }, 600);
    });
  }
})();
