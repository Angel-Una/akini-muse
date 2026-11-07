/* 头像恢复与重绘 */

(function () {
  function restoreAvatar() {
    var changed = false;
    var my = localStorage.getItem("akini_my_avatar");
    var myIc = localStorage.getItem("akini_icity_my_avatar");
    if ((!my || my === "null" || my === "undefined") && myIc && myIc !== "null" && myIc !== "undefined") {
      try {
        localStorage.setItem("akini_my_avatar", myIc);
        changed = true;
      } catch (e) {}
    }
    var ta = localStorage.getItem("akini_ta_avatar");
    var taIc = localStorage.getItem("akini_icity_ta_avatar");
    if ((!ta || ta === "null" || ta === "undefined") && taIc && taIc !== "null" && taIc !== "undefined") {
      try {
        localStorage.setItem("akini_ta_avatar", taIc);
        changed = true;
      } catch (e) {}
    }
    if (changed) {
      try {
        window._renderIcity();
        window.renderChatList();
      } catch (e) {}
    }
  }
  restoreAvatar();
  function compress(file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      cb(e.target.result);
    };
    reader.readAsDataURL(file);
  }
  document.addEventListener(
    "change",
    function (e) {
      var t = e.target;
      if (t && t.id === "icityEditMyAvatarInput") {
        var file = t.files[0];
        if (file) {
          compress(file, function (data) {
            try {
              localStorage.setItem("akini_my_avatar", data);
              localStorage.setItem("akini_icity_my_avatar", data);
              localStorage.setItem("akini_s1_avatar", data);
              localStorage.setItem("akini_avatar_left", data);
              if (window._idbStore && window._idbStore.set) {
                window._idbStore.set("akini_my_avatar", data);
                window._idbStore.set("akini_icity_my_avatar", data);
              }
              if (window.akiniStore && window.akiniStore.memorySet) {
                window.akiniStore.memorySet("akini_my_avatar", data);
                window.akiniStore.memorySet("akini_icity_my_avatar", data);
                window.akiniStore.memorySet("akini_s1_avatar", data);
                window.akiniStore.memorySet("akini_avatar_left", data);
              }
              if (window.__akiniAvatarCache) window.__akiniAvatarCache.my = data;
            } catch (err) {}
            var p = document.getElementById("icityEditMyAvatarPreview");
            if (p) {
              p.innerHTML =
                '<img src="' + data + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
            }
            try {
              window.En(data);
            } catch (e) {}
            try {
              window.updateChatPreview();
            } catch (e) {}
            try {
              window.syncGlobalMyAvatar();
            } catch (e) {}
          });
          t.value = "";
        }
      }
    },
    true,
  );
  function it(t, e) {
    if (((e = e || ""), !t || "string" != typeof t)) return __akiniAvOrLine(e);
    t = t.trim();
    if (!t) return __akiniAvOrLine(e);
    if (0 === t.indexOf("<img")) {
      var n = t.match(/src="([^"]*)"/);
      if (!n || !n[1]) return __akiniAvOrLine(e);
      t = n[1];
    }
    return 0 === t.indexOf("data:") || 0 === t.indexOf("http")
      ? '<img src="' +
          t.replace(/"/g, "&quot;") +
          '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
      : __akiniAvOrLine(t);
  }
})();

/* 背景图恢复 */

(function () {
  function applySavedBgs() {
    try {
      var cov =
        localStorage.getItem("akini_cover_img") ||
        localStorage.getItem("akini_cover_bg") ||
        localStorage.getItem("cover_bg") ||
        localStorage.getItem("akini_s2_cover");
      if (cov) {
        var el = document.getElementById("coverAreaMain");
        if (el) {
          el.style.setProperty("background-image", 'url("' + cov + '")', "important");
          el.style.setProperty("background-size", "cover", "important");
          el.style.setProperty("background-position", "center", "important");
        }
      }
      var day =
        localStorage.getItem("akini_day_bg") ||
        localStorage.getItem("akini_anniv_bg") ||
        localStorage.getItem("aki_day_bg") ||
        localStorage.getItem("akini_bg_img");
      if (day) {
        var ba = document.getElementById("bgArea");
        if (ba) {
          ba.style.setProperty("background-image", 'url("' + day + '")', "important");
          ba.style.setProperty("background-size", "cover", "important");
          ba.style.setProperty("background-position", "center", "important");
          ba.style.setProperty("background-color", "transparent", "important");
        }
      }
    } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applySavedBgs);
  } else {
    applySavedBgs();
  }
  window.addEventListener("load", applySavedBgs);
})();


/* 头像与第一屏壁纸恢复 */
(function () {
  var AV_FALLBACK =
    "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20fill%3D%22%23f7f8fa%22%2F%3E%3Ccircle%20cx%3D%2240%22%20cy%3D%2229%22%20r%3D%2214%22%20fill%3D%22none%22%20stroke%3D%22%235a5e66%22%20stroke-width%3D%221.5%22%2F%3E%3Cpath%20d%3D%22M12%2076c4-17%2014-26%2028-26s24%209%2028%2026%22%20fill%3D%22none%22%20stroke%3D%22%235a5e66%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E";
  function __akiniApplyAvatar(id, url) {
    if (!url) return;
    var el = document.getElementById(id);
    if (!el) return;
    if (String(url).indexOf("<img") === 0) {
      if (el.getAttribute("data-avatar-applied") === url) return;
      el.innerHTML = url;
      el.setAttribute("data-avatar-applied", url);
      return;
    }
    // 只接受真实图片地址，避免把残缺字符串写成坏图/乱码
    if (!/^(data:image\/|https?:|blob:)/i.test(String(url))) return;
    if (el.getAttribute("data-avatar-applied") === url) return;
    var img = el.querySelector("img");
    if (!img) {
      el.innerHTML =
        '<img src="' +
        url +
        '" onerror="this.onerror=null;this.src=\'' +
        AV_FALLBACK +
        '\'" style="width:100%;height:100%;object-fit:cover;display:block;">';
    } else {
      if (!img.__akiniFb) {
        img.__akiniFb = 1;
        img.addEventListener("error", function () {
          img.onerror = null;
          img.src = AV_FALLBACK;
        });
      }
      img.src = url;
    }
    el.setAttribute("data-avatar-applied", url);
  }

  function applyHomeBg(url) {
    if (!url || typeof url !== "string" || url.length <= 10) return;
    /* 只写 CSS 变量 + 标记类，渲染交给 perf-lite.css / akini-style.css，
       不再重复写内联 !important。 */
    try {
      document.documentElement.style.setProperty("--akini-home-bg", 'url("' + url + '")');
    } catch (e) {}
    var pf = document.getElementById("phoneFrame");
    if (!pf) return;
    pf.classList.add("has-custom-bg");
  }

  /* 壁纸兜底恢复：localStorage 配额满时壁纸只存在 IndexedDB/localforage 里，
     此时同步读 localStorage 是空的，刷新后必须先异步取回再上墙。 */
  function restoreHomeBgAsync() {
    var ls = null;
    try {
      ls = localStorage.getItem("akini_home_bg") || localStorage.getItem("home_bg");
    } catch (e) {}
    if (ls && ls.length > 10) {
      applyHomeBg(ls);
      return;
    }
    var settled = false;
    function done(v) {
      if (settled) return;
      if (!v || typeof v !== "string" || v.length <= 10) return;
      settled = true;
      applyHomeBg(v);
      try {
        localStorage.setItem("akini_home_bg", v);
      } catch (e) {}
      try {
        if (window.__akiniImgCache) window.__akiniImgCache["akini_home_bg"] = v;
      } catch (e) {}
    }
    try {
      var mem = window.akiniStore && window.akiniStore.memoryGet ? window.akiniStore.memoryGet("akini_home_bg") : null;
      if (mem && mem.length > 10) {
        done(mem);
        return;
      }
    } catch (e) {}
    var fromLocalforage = function () {
      try {
        if (window.localforage && localforage.getItem)
          localforage
            .getItem("akini_home_bg")
            .then(done)
            .catch(function () {});
      } catch (e) {}
    };
    try {
      if (window._idbStore && window._idbStore.get) {
        window._idbStore.get("akini_home_bg", function (v) {
          if (v && String(v).length > 10) {
            done(v);
            return;
          }
          try {
            window._idbStore.get("snap_akini_home_bg", function (sv) {
              if (sv && String(sv).length > 10) {
                done(sv);
                return;
              }
              fromLocalforage();
            });
          } catch (e) {
            fromLocalforage();
          }
        });
        return;
      }
    } catch (e) {}
    fromLocalforage();
  }

  /* 从「内存缓存 → IndexedDB 镜像(memory) → localStorage」三处按优先级取图片值。
     配额满时图片只存在于 IndexedDB，同步读 LS 是空的，必须逐层兜底。 */
  function pickImg(k) {
    try {
      if (
        window.__akiniImgCache &&
        typeof window.__akiniImgCache[k] === "string" &&
        window.__akiniImgCache[k].length > 10
      )
        return window.__akiniImgCache[k];
    } catch (e) {}
    try {
      if (window.akiniStore && window.akiniStore.memoryGet) {
        var m = window.akiniStore.memoryGet(k);
        if (m && String(m).length > 10) return m;
      }
    } catch (e) {}
    try {
      var v = localStorage.getItem(k);
      if (v && v.length > 10) return v;
    } catch (e) {}
    return "";
  }

  /* 首页顶部大卡封面 / 背景卡：配额满时值可能只存在 IndexedDB，
     同步读不到就必须异步从 IDB 取回，否则刷新后永远是灰底空白。 */
  function applyCoverArea(url) {
    if (!url || typeof url !== "string" || url.length <= 10) return;
    var el = document.getElementById("coverAreaMain");
    if (!el) return;
    if (el.getAttribute("data-applied-bg") === url) return;
    el.setAttribute("data-applied-bg", url);
    el.style.setProperty("background-image", 'url("' + url + '")', "important");
    el.style.setProperty("background-size", "cover", "important");
    el.style.setProperty("background-position", "center", "important");
    el.style.setProperty("background-repeat", "no-repeat", "important");
  }
  function applyBgArea(url) {
    if (!url || typeof url !== "string" || url.length <= 10) return;
    var el = document.getElementById("bgArea");
    if (!el) return;
    if (el.getAttribute("data-applied-bg") === url) return;
    el.setAttribute("data-applied-bg", url);
    el.style.setProperty("background-image", 'url("' + url + '")', "important");
    el.style.setProperty("background-size", "cover", "important");
    el.style.setProperty("background-position", "center", "important");
    el.style.setProperty("background-repeat", "no-repeat", "important");
  }
  function applyPolaroid(url, el) {
    try {
      if (!el) el = document.getElementById("s1PolaroidImg");
      if (!el || !url || typeof url !== "string" || url.length <= 10) return;
      var cur = el.style.backgroundImage || "";
      if (cur && cur.indexOf(url) >= 0 && el.style.getPropertyPriority("background-image") === "important") return;
      el.setAttribute("data-applied-src", url);
      el.style.setProperty("background-image", 'url("' + url + '")', "important");
      el.style.setProperty("background-size", "cover", "important");
      el.style.setProperty("background-position", "center", "important");
      el.style.setProperty("background-repeat", "no-repeat", "important");
    } catch (e) {}
  }
  var COVER_KEYS = ["akini_cover_img", "akini_cover_bg", "akini_s2_cover", "cover_bg"];
  var DAY_KEYS = ["akini_day_bg", "akini_bg_img", "akini_anniv_bg", "akini_s2_day_bg", "day_bg"];
  function pickKeys(keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = pickImg(keys[i]);
      if (v && v.length > 10) return v;
    }
    return "";
  }
  /* 逐个从 IndexedDB 里按顺序找，找到第一个就回调（同步读全部落空时才走这里） */
  function pickKeysIdb(keys, cb) {
    var i = 0;
    function next() {
      if (i >= keys.length) return cb("");
      var k = keys[i++];
      try {
        if (window._idbStore && window._idbStore.get) {
          window._idbStore.get(k, function (v) {
            if (v && String(v).length > 10) {
              cb(String(v));
              return;
            }
            next();
          });
          return;
        }
      } catch (e) {}
      next();
    }
    next();
  }

  /* 补齐首页/照片墙/头像等所有可自定义图片位的恢复：
     原实现只恢复 home_bg + s1_avatar + 左右头像，其余图片位在配额满时只存在于 IDB，
     刷新后会一直显示默认图（看起来像"数据消失"）。 */
  function restoreMiscSlots() {
    try {
      /* 首页顶部卡片封面（用户导入的图最容易"刷新后消失"，优先同步，落空再走 IDB） */
      var cover = pickKeys(COVER_KEYS);
      if (cover) applyCoverArea(cover);
      else pickKeysIdb(COVER_KEYS, applyCoverArea);
      var day = pickKeys(DAY_KEYS);
      if (day) applyBgArea(day);
      else pickKeysIdb(DAY_KEYS, applyBgArea);
      var photo = pickImg("akini_s1_photo");
      var elPhoto = document.getElementById("s1PolaroidImg");
      applyPolaroid(photo, elPhoto);
      if (!photo && elPhoto) {
        pickKeysIdb(["akini_s1_photo"], function (v) {
          applyPolaroid(v, elPhoto);
        });
      }
      var avL =
        pickImg("akini_avatar_left") ||
        pickImg("akini_s2_avatar_left") ||
        pickImg("akini_my_avatar") ||
        pickImg("akini_s1_avatar");
      if (avL) __akiniApplyAvatar("avatarLeft", avL);
      var avR = pickImg("akini_avatar_right") || pickImg("akini_s2_avatar_right") || pickImg("akini_ta_avatar");
      if (avR) __akiniApplyAvatar("avatarRight", avR);
      var s1Av = pickImg("akini_s1_avatar") || pickImg("akini_my_avatar");
      if (s1Av) __akiniApplyAvatar("s1AvatarCircle", s1Av);
    } catch (e) {}
    /* 聊天/音乐/icity 等背景由 core 的 applyBg 统一处理，这里在数据恢复后再触发一次 */
    try {
      if (typeof applyBg === "function") applyBg();
    } catch (e) {}
    /* 自定义文字：配额恢复后重新渲染，避免刷新后只剩默认文案 */
    try {
      if (window.__akiniRenderUserText) window.__akiniRenderUserText();
    } catch (e) {}
    /* 头像互换的内联定位在重渲染后需要重新应用 */
    try {
      if (window.__akiniApplyAvatarSwap) window.__akiniApplyAvatarSwap();
    } catch (e) {}
  }

  function restoreAllImagesAndConfig() {
    try {
      var homeBg = pickImg("akini_home_bg") || pickImg("home_bg");
      applyHomeBg(homeBg);
      restoreHomeBgAsync();
    } catch (e) {}
    restoreMiscSlots();
  }

  function scheduleRestore() {
    if (window.__akiniRestoreScheduled) return;
    window.__akiniRestoreScheduled = true;
    var run = function () {
      window.__akiniRestoreScheduled = false;
      restoreAllImagesAndConfig();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      requestAnimationFrame(run);
    }
  }
  scheduleRestore();
  window.addEventListener("load", restoreAllImagesAndConfig);
  /* 图片键从 IndexedDB 回填完成后（可能晚于首屏），再补一次壁纸/头像恢复 */
  window.addEventListener("akini-img-ready", function () {
    try {
      restoreAllImagesAndConfig();
    } catch (e) {}
  });
  /* 存储层对账完成后再补一轮（IDB → LS 回填发生在首屏之后，晚到的数据必须重新上屏） */
  window.addEventListener("akini-storage-restored", function () {
    try {
      restoreAllImagesAndConfig();
    } catch (e) {}
  });
  /* 只保留一次迟到兜底；主要依赖 load / akini-img-ready / akini-storage-restored 事件，
     以前 4 个定时器会重复跑 4 遍 IDB 读取，是启动卡顿来源之一 */
  [1500].forEach(function (ms) {
    setTimeout(function () {
      try {
        restoreAllImagesAndConfig();
      } catch (e) {}
    }, ms);
  });
  /* 从后台切回前台时再补一轮：系统可能在此期间清掉/延迟写入图片，
     或者 iOS 已把页面重载——重新上屏一次，避免"要再进一次才显示"。 */
  window.__akiniOnVisible(function () { setTimeout(function () {
      try {
        restoreAllImagesAndConfig();
      } catch (e) {}
    }, 300); });

  /* core 的 ct("akini_home_bg") 会在启动后异步再写一次 background-image，
     而且不带 !important，会把上面恢复的壁纸覆盖成不生效的内联声明。
     这里在启动期补几次，只在内联优先级丢失时重设。 */
  function reapplyHomeBg() {
    try {
      var v = localStorage.getItem("akini_home_bg") || localStorage.getItem("home_bg");
      if (!v || v.length <= 10) return;
      var pf = document.getElementById("phoneFrame");
      if (!pf) return;
      if (pf.style.getPropertyPriority("background-image") === "important") return;
      applyHomeBg(v);
    } catch (e) {}
  }
  [300, 800, 1600, 3200].forEach(function (ms) {
    setTimeout(reapplyHomeBg, ms);
  });

  /* 拍立得同样会被其它脚本的普通内联赋值降级（important 标记被清掉），
     启动期多轮补几次：只在优先级丢失时重设，已带 important 的直接跳过。 */
  function reapplyPolaroid() {
    try {
      var el = document.getElementById("s1PolaroidImg");
      if (!el) return;
      if (el.style.getPropertyPriority("background-image") === "important") return;
      var v = pickImg("akini_s1_photo") || pickImg("akini_s1_polaroid_img");
      if (v) applyPolaroid(v, el);
    } catch (e) {}
  }
  [300, 800, 1600, 3200, 6000].forEach(function (ms) {
    setTimeout(reapplyPolaroid, ms);
  });
  window.addEventListener("akini-storage-restored", reapplyPolaroid);

  /* 启动早期若 localStorage 里的联系人/会话被读成空值，core 会补建默认联系人「对方」，
     akiniContacts 的内存缓存 d/u/v 也会把这份"临时数据"固化下来 —— 之后 IDB 对账
     把真实数据写回 LS，界面却仍用旧缓存渲染，表现为"联系人名字被重置"。
     对账完成后清掉缓存并重渲染聊天列表、聊天标题栏与聊天背景。 */
  function refreshContactsAndChat() {
    try {
      if (window.akiniContacts && window.akiniContacts.resetCache) window.akiniContacts.resetCache();
    } catch (e) {}
    try {
      window.renderChatList();
    } catch (e) {}
    try {
      window.refreshChatHeader();
    } catch (e) {}
    try {
      window.applyChatBackground();
    } catch (e) {}
    try {
      window.updateChatPreview();
    } catch (e) {}
  }
  ["akini-storage-restored", "akini-img-ready"].forEach(function (evt) {
    window.addEventListener(evt, refreshContactsAndChat);
  });
  [1200, 3000].forEach(function (ms) {
    setTimeout(refreshContactsAndChat, ms);
  });

  /* 清除壁纸：localStorage.removeItem 被全局拦截器挡住，这里用白名单标记真正删除，
     同时清掉 CSS 变量与 IndexedDB 镜像，避免刷新后壁纸"复活"。 */
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target;
      var btn = t && t.closest ? t.closest("#clearHomeBgBtn") : null;
      if (!btn) return;
      try {
        document.documentElement.style.removeProperty("--akini-home-bg");
      } catch (e1) {}
      try {
        window._akiniAllowRemove = true;
        localStorage.removeItem("akini_home_bg");
        localStorage.removeItem("home_bg");
        /* 快照/备份键同样带 akini_ 前缀，必须在白名单窗口内删除 */
        localStorage.removeItem("snap_akini_home_bg");
        localStorage.removeItem("snap2_akini_home_bg");
        localStorage.removeItem("akini_home_bg_ok");
        window._akiniAllowRemove = false;
      } catch (e2) {
        window._akiniAllowRemove = false;
      }
      try {
        if (window.__akiniImgCache) delete window.__akiniImgCache["akini_home_bg"];
      } catch (e3) {}
      try {
        if (window.akiniStore && window.akiniStore.memorySet) window.akiniStore.memorySet("akini_home_bg", "");
      } catch (e3b) {}
      try {
        if (window.localforage && localforage.removeItem) localforage.removeItem("akini_home_bg").catch(function () {});
      } catch (e3c) {}
      try {
        if (window._idbStore && window._idbStore.remove) {
          window._idbStore.remove("akini_home_bg");
          window._idbStore.remove("snap_akini_home_bg");
          window._idbStore.remove("snap2_akini_home_bg");
        }
      } catch (e4) {}
      try {
        var pf = document.getElementById("phoneFrame");
        if (pf) {
          pf.style.setProperty("background-image", "none", "important");
          pf.classList.remove("has-custom-bg");
        }
      } catch (e5) {}
    },
    true,
  );
})();


(function () {
  "use strict";

  function _empty(v) {
    return !v || v === "null" || v === "undefined" || v === "{}" || v === "[]";
  }

  function mirrorIcons() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf("akini_app_icon_") !== 0) continue;
        var v = localStorage.getItem(k);
        if (v && v.length < 90000) localStorage.setItem("akini_iconvault_" + k.slice("akini_app_icon_".length), v);
      }
    } catch (e) {}
  }

  function restoreIcons() {
    try {
      if (window.__akiniRestoredDone) return;
    } catch (e0) {}
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf("akini_iconvault_") !== 0) continue;
        var orig = "akini_app_icon_" + k.slice("akini_iconvault_".length);
        if (_empty(localStorage.getItem(orig))) {
          try {
            var exists = false;
            try {
              if (window._idbStore && window._idbStore.get) {
                window._idbStore.get(orig, function (v) {
                  if (v) exists = true;
                });
              }
            } catch (eP) {}
            if (!exists) {
              try {
                localStorage.setItem(orig, localStorage.getItem(k));
              } catch (e) {}
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  restoreIcons();
  var __RestoreRan = false;
  function __RunRestoreUI() {
    if (__RestoreRan) return;
    __RestoreRan = true;
    
window.__akiniRestoredDone = true;

  }
  __RunRestoreUI();
  window.addEventListener("load", __RunRestoreUI);
  window.__akiniOnHidden(function () { 
      try {
        mirrorIcons();
      } catch (e) {}
     });

  (function () {
    var modal = document.getElementById("mailDetailModal");
    if (!modal) return;
    var lastShown = 0;
    function visible() {
      try {
        return getComputedStyle(modal).display !== "none" && modal.offsetParent !== null;
      } catch (e) {
        return false;
      }
    }
    /* 已读语义调整：仅点开某封信才标记该封已读，不再整箱标记 */
  })();

  function syncSentMailStatus() {
    /* 寄出的信仅在对方回信真正投递（app.js checkStatus）时才置为已读，不再按时间自动置读 */
    return;
    try {
      var raw = localStorage.getItem("akini_mail_sent");
      if (!raw) return;
      var list = JSON.parse(raw);
      if (!Array.isArray(list) || !list.length) return;
      var now = Date.now();
      var dirty = false;
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (!m) continue;
        if (m.replyTime && now >= m.replyTime && (!m.isRead || !m.repliedByTa)) {
          m.isRead = true;
          m.read = true;
          m.repliedByTa = true;
          dirty = true;
        } else if (!m.replyTime && m.ts && now - m.ts >= 60000 && !m.isRead) {
          m.isRead = true;
          m.read = true;
          dirty = true;
        }
      }
      if (dirty) {
        /* 单通道：akiniStore.set 内部已包含 localStorage + IndexedDB */
        if (window.akiniStore && window.akiniStore.set)
          window.akiniStore.set("akini_mail_sent", JSON.stringify(list));
        else localStorage.setItem("akini_mail_sent", JSON.stringify(list));
        if (window.__renderMail) window.__renderMail();
      }
    } catch (e) {}
  }
  syncSentMailStatus();
  /* 对齐 原生：去掉 30 秒常驻轮询，改为页面回到前台时同步一次 */
  window.__akiniOnVisible(function () { 
      try {
        syncSentMailStatus();
      } catch (e) {}
     });
})();

/* ===== 启动自救：会话表丢失 / 数据晚到时，不用重进聊天也能自动恢复 =====
   ① 会话表 akini_chat_sessions 为空但聊天记录还在 → 用记录重建会话；
   ② 已经进入聊天页但消息区是空的（历史还在，只是水合晚到）→ 自动重渲染，
      用户不需要退出再重进。 */
(function () {
  "use strict";
  if (window.__akiniSessionRepairReady) return;
  window.__akiniSessionRepairReady = true;

  function readHist(cid, cb) {
    var v = "";
    try {
      v =
        (window.akiniStore && window.akiniStore.memoryGet
          ? window.akiniStore.memoryGet("akini_chat_history_" + cid)
          : "") || "";
    } catch (e) {}
    if (!v) {
      try {
        v = localStorage.getItem("akini_chat_history_" + cid) || "";
      } catch (e) {}
    }
    if (v) {
      cb(v);
      return;
    }
    try {
      if (window._idbStore && window._idbStore.get) {
        window._idbStore.get("akini_chat_history_" + cid, function (iv) {
          cb(String(iv || ""));
        });
        return;
      }
    } catch (e) {}
    cb("");
  }

  function activeId() {
    try {
      var C = window.akiniContacts;
      if (!C) return "";
      if (C.getActiveChatIdStrict) return String(C.getActiveChatIdStrict() || "");
      return String(C.getActiveChatId ? C.getActiveChatId() || "" : "");
    } catch (e) {
      return "";
    }
  }

  /* 消息区空但历史其实在 → 直接重渲染，不要求用户重进 */
  function ensureChat() {
    try {
      var id = activeId();
      if (!id) return;
      var screen = document.getElementById("app-chat");
      if (!screen || !screen.classList.contains("show") || "none" === screen.style.display) return;
      var body = document.getElementById("chatBody");
      if (!body) return;
      if (body.querySelectorAll(".msg-row").length) return;
      var C = window.akiniContacts;
      var sess = (C && C.getSessions ? C.getSessions() : {}) || {};
      var html = (sess[id] && sess[id].messagesHTML) || "";
      if (!html) {
        try {
          html =
            (window.akiniStore && window.akiniStore.memoryGet
              ? window.akiniStore.memoryGet("akini_chat_history_" + id)
              : "") || "";
        } catch (e0) {}
      }
      if (!html || html.indexOf("msg-row") < 0) return;
      if (window.openChat) window.openChat(id, true);
    } catch (e) {}
  }

  /* 同一份问卷卡在会话里被写了两遍时，只保留第一张 */
  function dedupeSurveyRows(html) {
    if (!html || html.indexOf("survey-bubble") < 0) return null;
    try {
      var wrap = document.createElement("div");
      wrap.innerHTML = html;
      var seen = {},
        changed = false;
      var rows = wrap.querySelectorAll(".msg-row");
      for (var i = 0; i < rows.length; i++) {
        /* 顺带把已存的问卷卡时间戳改回设置里的时间格式 */
        try {
          var ts = rows[i].getAttribute("data-ts");
          var tsEl = ts ? rows[i].querySelector(".msg-ts") : null;
          if (ts && tsEl && window.__akiniFmtTs) {
            var nv = window.__akiniFmtTs(parseInt(ts, 10));
            if (nv && tsEl.textContent !== nv) {
              tsEl.textContent = nv;
              changed = true;
            }
          }
        } catch (eTs) {}
        var b = rows[i].querySelector(".bubble.survey-bubble[data-survey-id]");
        if (!b) continue;
        var id = b.getAttribute("data-survey-id") || "";
        if (!id) continue;
        if (seen[id]) {
          if (rows[i].parentNode) {
            rows[i].parentNode.removeChild(rows[i]);
            changed = true;
          }
        } else seen[id] = 1;
      }
      return changed ? wrap.innerHTML : null;
    } catch (e) {
      return null;
    }
  }

  function repair() {
    try {
      var C = window.akiniContacts;
      if (!C || !C.getContacts || !C.getSessions || !C.updateSession) {
        ensureChat();
        return;
      }
      if (!window.__akiniStorageRestored && !window.__akiniRestoreSettled) {
        ensureChat();
        return;
      }
      var contacts = C.getContacts() || [];
      /* 默认联系人被清空时自动补回：和 原生 一样只有这一个对话框，而不是空白 */
      if (!contacts.length) {
        try {
          var nc = C.addContact ? C.addContact("对方") : null;
          if (nc && nc.id) {
            contacts = C.getContacts() || [];
            try {
              if (window.__akiniRefreshChatListBadges) window.__akiniRefreshChatListBadges();
            } catch (e1) {}
            console.log("[联系人自救] 已补回默认联系人");
          }
        } catch (e2) {}
      }
      try {
        if (!window.__akiniSurveyDupFixed && C.getSessions) {
          window.__akiniSurveyDupFixed = true;
          var sessAll = C.getSessions() || {};
          Object.keys(sessAll).forEach(function (sid) {
            var h = sessAll[sid] && sessAll[sid].messagesHTML;
            var fixed = dedupeSurveyRows(h);
            if (fixed) {
              try {
                C.updateSession(sid, { messagesHTML: fixed });
                console.log("[问卷自救] 已清理重复的问卷卡：" + sid);
              } catch (e3) {}
            }
          });
        }
      } catch (e4) {}
      var sessions = C.getSessions() || {};
      if (!Object.keys(sessions).length && contacts.length) {
        var c = contacts[0];
        if (c && c.id) {
          readHist(c.id, function (h) {
            if (h && h.indexOf("msg-row") >= 0) {
              try {
                C.updateSession(c.id, { messagesHTML: h });
                console.log("[会话自救] 已从聊天记录重建会话：" + c.id);
              } catch (e) {}
            }
            ensureChat();
          });
          setTimeout(ensureChat, 50);
          return;
        }
      }
      ensureChat();
    } catch (e) {}
  }

  var _repairTimer = 0;
  function scheduleRepair(delay) {
    if (document.hidden) return;
    if (_repairTimer) return;
    _repairTimer = setTimeout(
      function () {
        _repairTimer = 0;
        if (document.hidden) return;
        repair();
      },
      delay > 0 ? delay : 0,
    );
  }
  window.addEventListener("akini-storage-restored", function () {
    scheduleRepair(600);
  });
  window.addEventListener("akini-img-ready", function () {
    scheduleRepair(600);
  });
  window.addEventListener("pageshow", function () {
    scheduleRepair(300);
  });
  window.__akiniOnVisible(function () { scheduleRepair(300); });
  setTimeout(function () {
    scheduleRepair(0);
  }, 3000);
})();

/* 聊天记录恢复 */

/* ===== 增强：聊天记录防丢失与恢复 ===== */
(function () {
  function restoreSessionMessages() {
    try {
      if (window._restoringData) return;
      var sessions = null;
      try {
        sessions = JSON.parse(localStorage.getItem("akini_chat_sessions") || "{}");
      } catch (e) {
        sessions = {};
      }
      if (!sessions) return;
      var changed = false;
      for (var sid in sessions) {
        if (!sessions.hasOwnProperty(sid)) continue;
        var sess = sessions[sid];
        if (!sess) continue;
        if (sess.messagesHTML && sess.messagesHTML.trim().length > 0) continue;
        var html = "";
        try {
          html = window.__akiniChatLog ? window.__akiniChatLog.html(sid) : "";
        } catch (e) {}
        if (!html)
          html =
            localStorage.getItem("akini_chat_history_" + sid) ||
            localStorage.getItem("akini_chat_history_backup_" + sid);
        if (html && html.trim() !== "" && html.trim() !== "null" && html.trim() !== "undefined") {
          sess.messagesHTML = html;
          try {
            if (window.__akiniChatLog) window.__akiniChatLog.replace(sid, html);
          } catch (e) {}
          changed = true;
        }
      }
      if (changed) {
        /* 单通道：只走 saveSessions（内部已落 localStorage + IndexedDB），不再重复写一遍 */
        if (window.akiniContacts && window.akiniContacts.saveSessions) {
          try {
            window.akiniContacts.saveSessions(sessions);
          } catch (e) {}
        }
        console.log("[Akini] restored session messagesHTML");
      }
    } catch (e) {
      console.warn("[Akini] restore session messages error", e);
    }
  }

  function restoreFromSnapshot() {
    return;
  }

  function restoreChatBody() {
    try {
      if (window._restoringData || window._restoringChatHistory) return;
      var chatBody = document.getElementById("chatBody");
      if (!chatBody) return;
      var html = chatBody.innerHTML || "";
      if (html.trim() !== "" && html.trim() !== "null" && html.trim() !== "undefined") return;
      var activeId = window.akiniContacts ? window.akiniContacts.getActiveChatId() : null;
      if (!activeId) return;
      var sess = null;
      if (window.akiniContacts && window.akiniContacts.getSession) {
        sess = window.akiniContacts.getSession(activeId);
      }
      var best = "";
      if (sess && sess.messagesHTML && sess.messagesHTML.trim().length > 0) {
        best = sess.messagesHTML;
      }
      if (!best) {
        best =
          localStorage.getItem("akini_chat_history_" + activeId) ||
          localStorage.getItem("akini_chat_history_backup_" + activeId) ||
          localStorage.getItem("akini_full_backup_" + activeId) ||
          "";
      }
      if (best && best.trim() !== "" && best.trim() !== "null" && best.trim() !== "undefined") {
        // 已渲染过同一聊天且 DOM 非空：跳过周期重建，避免每 30 秒把正在翻阅记录的用户拽回底部
        if (chatBody.getAttribute("data-rendered-chat-id") === activeId && chatBody.innerHTML.trim() !== "") return;
        chatBody.innerHTML = best;
        chatBody.setAttribute("data-rendered-chat-id", activeId);
        /* 清掉旧 HTML 里残留的空引用条 / 空消息行 */
        if (window.__akiniCleanGhostBubbles) {
          try {
            window.__akiniCleanGhostBubbles(chatBody);
          } catch (e) {}
        }
        chatBody.scrollTop = chatBody.scrollHeight;
        // 直接恢复的 HTML 也要跑一遍 meta 结构处理（时间戳布局/图标升级），避免旧结构残留
        if (window.__akiniSetupChatMetaObserver) {
          try {
            window.__akiniSetupChatMetaObserver();
          } catch (e) {}
        }
        if (window.akiniContacts && window.akiniContacts.updateSession) {
          window.akiniContacts.updateSession(activeId, { messagesHTML: best });
        }
        console.log("[Akini] restored chat body directly");
      }
    } catch (e) {
      console.warn("[Akini] restore chat body error", e);
    }
  }

  function runAll() {
    restoreFromSnapshot();
    restoreSessionMessages();
    restoreChatBody();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAll);
  } else {
    runAll();
  }
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) runAll();
  });
})();

/* 基础 JSON 备份兜底 */

// 兼容旧版 JSON 备份的轻量兜底：如果 core 风格备份引擎未加载，仍允许导出基础 JSON
(function () {
  function fallbackExport() {
    try {
      var data = {};
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k)
          try {
            data[k] = localStorage.getItem(k);
          } catch (e) {}
      }
      if (Object.keys(data).length === 0) {
        alert("没有数据");
        return;
      }
      var blob = new Blob(
        [
          JSON.stringify(
            { app: "akini", version: 2, exportedAt: new Date().toISOString(), localStorage: data, indexedDB: {} },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      var url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "akini-backup-" + new Date().toISOString().slice(0, 10) + "-fallback.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      }, 60000);
    } catch (e) {
      alert("导出失败：" + e.message);
    }
  }
  function fallbackImport(file) {
    if (!file) return;
    var r = new FileReader();
    r.onload = function (ev) {
      try {
        var p = JSON.parse(ev.target.result),
          lsData = null;
        if (p && p.version === 2) lsData = p.localStorage;
        else if (p && p.data) lsData = p.data;
        else if (p && typeof p === "object" && !Array.isArray(p)) lsData = p;
        if (!lsData || typeof lsData !== "object" || Array.isArray(lsData)) throw new Error("备份格式不正确");
        if (!confirm("导入将覆盖当前全部本地数据，确定继续？")) return;
        window._restoringData = true;
        try {
          localStorage.clear();
        } catch (e) {}
        var count = 0;
        for (var k in lsData) {
          if (Object.prototype.hasOwnProperty.call(lsData, k)) {
            try {
              localStorage.setItem(k, String(lsData[k]));
              count++;
            } catch (e) {}
          }
        }
        alert("导入成功 " + count + " 项，即将刷新");
        location.reload();
      } catch (e) {
        alert("导入失败：" + e.message);
      }
    };
    r.readAsText(file);
  }
  function bind() {
    var exp = document.getElementById("exportBackupBtn");
    var imp = document.getElementById("importBackupInput");
    if (exp)
      exp.addEventListener("click", function () {
        if (window.__akiniBackupEngineReady) {
          return;
        }
        fallbackExport();
      });
    if (imp)
      imp.addEventListener("change", function () {
        if (window.__akiniBackupEngineReady) {
          imp.value = "";
          return;
        }
        fallbackImport(imp.files && imp.files[0]);
        imp.value = "";
      });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();

/* 图片弹窗与持久化 */

// 弹窗更换与图片持久化引擎
/* 统一持久化：压缩 → 写 localStorage（可能因配额失败）→ __akiniImgSet 负责内存 + IndexedDB 镜像。
   存储层已拦截 localStorage.setItem 并做 IDB 落盘，不再额外直写 _idbStore / 默认 localforage。 */
window.__akiniSaveImageKey = function (key, url) {
  if (!key || !url) return;
  try {
    localStorage.setItem(key, url);
  } catch (ex) {}
  try {
    if (window.__akiniImgSet) window.__akiniImgSet(key, url);
  } catch (ex) {}
};
window.__akiniPersistImage = function (key, url, callback) {
  if (!key || !url) {
    if (callback) callback(url);
    return;
  }
  var save = function (v) {
    v = v || url;
    window.__akiniSaveImageKey(key, v);
    if (callback) callback(v);
  };
  if (typeof window.compressImageDataUrl === "function") {
    window.compressImageDataUrl(url, save, { maxSide: 2000, quality: 0.92 });
  } else {
    save(url);
  }
};

document.addEventListener("DOMContentLoaded", function () {
});

/* 数据持久化环境检测 */

/* ===== 数据持久化检测 ===== */
(function () {
  function lsWorks() {
    try {
      var ls = window.localStorage;
      ls.setItem("__akini_persist_test__", "1");
      ls.removeItem("__akini_persist_test__");
      return true;
    } catch (e) {
      return false;
    }
  }
  function idbWorks(cb) {
    try {
      if (!window.indexedDB) {
        cb(false);
        return;
      }
      var req = window.indexedDB.open("__akini_env_test__", 1);
      req.onsuccess = function () {
        try {
          req.result.close();
        } catch (e1) {}
        try {
          window.indexedDB.deleteDatabase("__akini_env_test__");
        } catch (e2) {}
        cb(true);
      };
      req.onerror = function () {
        cb(false);
      };
      req.onblocked = function () {
        cb(true);
      }; /* 被占用说明 IDB 本身可用 */
    } catch (e) {
      cb(false);
    }
  }
  function dismissed() {
    try {
      return localStorage.getItem("akini_env_warn_dismissed") === "1";
    } catch (e) {
      return false;
    }
  }
  function show() {
    if (dismissed()) return;
    var warn = document.createElement("div");
    warn.id = "akiniEnvWarnBar";
    warn.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:500;background:#ff4d4f;color:#fff;padding:12px 34px 12px 16px;font-size:14px;line-height:1.4;text-align:center;box-sizing:border-box;";
    warn.innerHTML =
      "当前环境无法持久化保存数据，刷新后聊天记录/设置/美化数据会丢失。请用浏览器打开本页面，或安装到主屏幕后再使用。";
    var x = document.createElement("span");
    x.textContent = "✕";
    x.style.cssText =
      "position:absolute;right:10px;top:50%;transform:translateY(-50%);width:28px;height:28px;line-height:28px;cursor:pointer;font-size:15px;opacity:.9;-webkit-tap-highlight-color:transparent;";
    x.onclick = function () {
      try {
        localStorage.setItem("akini_env_warn_dismissed", "1");
      } catch (e) {}
      warn.remove();
    };
    warn.appendChild(x);
    document.body.appendChild(warn);
    /* 3s 后复测：首帧误判（浏览器预热/存储延迟）自动撤下，并清除关闭标记 */
    setTimeout(function () {
      if (lsWorks()) {
        try {
          localStorage.removeItem("akini_env_warn_dismissed");
        } catch (e) {}
        warn.remove();
        return;
      }
      idbWorks(function (ok2) {
        if (ok2) {
          try {
            localStorage.removeItem("akini_env_warn_dismissed");
          } catch (e) {}
          warn.remove();
        }
      });
    }, 3000);
  }
  function tryShow() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", show);
    } else {
      show();
    }
  }
  if (lsWorks()) return; /* LS 正常：永无忧 */
  if (!window.indexedDB) {
    tryShow();
    return;
  } /* LS 与 IDB 对象双失：立即提示 */
  /* LS 失败但 IDB 存在：异步验证——IDB 真可用就不提示（Edge 场景在此静默） */
  idbWorks(function (ok) {
    if (!ok) tryShow();
  });
})();

/* bfcache/微信 WebView 后台原样恢复（pageshow persisted）时，退出前停在聊天界面
   会被浏览器把整个页面原样捞回 → 表现为"重进自动跳转到聊天界面"。
   用户要求重进一律回首页：persisted 恢复瞬间强制 akiniGoBack('home')。 */
window.addEventListener("pageshow", function (e) {
  if (e && e.persisted) {
    try {
      window.akiniGoBack("home");
    } catch (err) {}
  }
});
