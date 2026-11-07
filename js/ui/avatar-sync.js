/* 全局头像同步（首页双头像 / 第一屏 / 美化页预览） */

(function () {
  var DEFAULT_AV =
    "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20fill%3D%22%23f7f8fa%22%2F%3E%3Ccircle%20cx%3D%2240%22%20cy%3D%2229%22%20r%3D%2214%22%20fill%3D%22none%22%20stroke%3D%22%235a5e66%22%20stroke-width%3D%221.5%22%2F%3E%3Cpath%20d%3D%22M12%2076c4-17%2014-26%2028-26s24%209%2028%2026%22%20fill%3D%22none%22%20stroke%3D%22%235a5e66%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E";

  function _clean(v) {
    return typeof v === "string" && v.trim() && v !== "null" && v !== "undefined" ? v.trim() : "";
  }
  function _usable(v) {
    v = _clean(v);
    if (!v) return "";
    if (v.charAt(0) === "<") return "";
    try {
      if (window.__akiniIsDefaultAvatarToken && window.__akiniIsDefaultAvatarToken(v)) return "";
    } catch (e) {}
    if (v.indexOf("data:") === 0 || /^https?:/i.test(v) || v.indexOf("blob:") === 0) return v;
    return "";
  }
  function _myAvatar() {
    return window.getMyAvatarSrc ? window.getMyAvatarSrc() : "";
  }
  function _taAvatar() {
    var id = null;
    try {
      var u = window.akiniContacts.getHomeAvatars();
      id = (u && u.right) || null;
    } catch (e) {}
    return window.getTaAvatarSrc ? window.getTaAvatarSrc(id) : "";
  }
  function _setCell(cellId, src) {
    var cell = document.getElementById(cellId);
    if (!cell || !src) return;
    var img = cell.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.setAttribute("alt", "");
      img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;display:block";
      cell.appendChild(img);
    }
    _armFallback(img);
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.style.display = "block";
  }
  /* 图片地址失效时立刻回退成蓝底问号占位，绝不停留在浏览器破图图标上 */
  function _fallback(img) {
    if (!img || img.getAttribute("data-fb-done")) return;
    img.setAttribute("data-fb-done", "1");
    img.setAttribute("src", DEFAULT_AV);
  }
  function _armFallback(img) {
    if (!img || img.__fbArmed) return;
    img.__fbArmed = 1;
    img.addEventListener("error", function () {
      _fallback(img);
    });
  }
  function _setPreview(src) {
    var prev = document.getElementById("myAvatarPreviewBeautify");
    if (!prev || !src) return;
    var img = prev.querySelector("img");
    if (!img) {
      prev.innerHTML = "";
      img = document.createElement("img");
      img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;display:block";
      prev.appendChild(img);
    }
    _armFallback(img);
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
  }
  function _setS1(src) {
    var e = document.getElementById("s1AvatarImg");
    if (e) {
      _armFallback(e);
      if (e.getAttribute("src") !== src) e.setAttribute("src", src);
      return;
    }
    var c = document.getElementById("s1AvatarCircle");
    if (c) {
      c.innerHTML =
        '<img id="s1AvatarImg" src="' +
        src +
        '" onerror="this.onerror=null;this.src=\'' +
        DEFAULT_AV +
        '\'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    }
  }

  /* 立即把头像应用到三个界面；newMy 传新选的「我的头像」dataURL 可强制刷新 */
  window.__akiniApplyHomeAvatars = function (newMy) {
    try {
      var my = _usable(newMy) || _myAvatar();
      var ta = _taAvatar();
      var left = my || DEFAULT_AV;
      var right = ta || DEFAULT_AV;
      try {
        if (window.isSwapped()) {
          var tmp = left;
          left = right;
          right = tmp;
        }
      } catch (e) {}
      _setCell("avatarLeft", left);
      _setCell("avatarRight", right);
      _setS1(my || DEFAULT_AV);
      _setPreview(my || DEFAULT_AV);
    } catch (e) {}
  };

  window.syncGlobalMyAvatar = function () {
    window.__akiniApplyHomeAvatars("");
  };
  // 兼容旧调用

  /* 选完头像后的强制刷新：core 的 En() 有一个并发守卫 __akiniSyncingAvatars，
     只要中途抛错就会永远停在 true，之后所有 En() 都被直接吞掉，
     表现为「换头像不生效、要重进两三次」。这里强制解锁并立即重绘。 */
  window.__akiniForceApplyAvatars = function (newMy) {
    
window.__akiniSyncingAvatars = false;
      window.__akiniAvatarNeedsRefresh = false;

    window.__akiniApplyHomeAvatars(newMy);
    // 异步渲染/IndexedDB 回填会再次覆盖，错峰补几次
    var delays = [80, 240, 600, 1200];
    for (var i = 0; i < delays.length; i++) {
      (function (d) {
        setTimeout(function () {
          window.__akiniApplyHomeAvatars(newMy);
        }, d);
      })(delays[i]);
    }
  };

  // 兜底看门狗：守卫卡死时自动解锁并补一次重绘（En 是同步执行，不会误伤正常流程）
  setInterval(function () {
    if (!window.__akiniSyncingAvatars || document.hidden) return;
    window.__akiniSyncingAvatars = false;
    window.__akiniApplyHomeAvatars("");
  }, 5000);

  function _bootSync() {
    window.__akiniApplyHomeAvatars("");
    var tries = 0;
    var timer = setInterval(function () {
      window.__akiniApplyHomeAvatars("");
      tries++;
      // 头像从 IndexedDB 异步恢复后自动补上，最多尝试 3 次
      if ((_myAvatar() && _taAvatar()) || tries >= 3) clearInterval(timer);
    }, 600);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _bootSync);
  else _bootSync();
  window.addEventListener("load", function () {
    window.__akiniApplyHomeAvatars("");
  });
  window.addEventListener("pageshow", function () {
    window.__akiniApplyHomeAvatars("");
  });
  window.__akiniOnVisible(function () { window.__akiniApplyHomeAvatars(""); });

  document.addEventListener("DOMContentLoaded", function () {
    var observer = new MutationObserver(function () {
      window.syncGlobalMyAvatar();
    });
    var pal = document.getElementById("previewAvatarLeft");
    if (pal) observer.observe(pal, { attributes: true, attributeFilter: ["style"] });
  });
})();
