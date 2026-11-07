

// 长方圆角日历动态与系统同步更新
window.updateS1Calendar = function () {
  var now = new Date();

  /* 日历时间格式彻底与设置面板时间戳解绑！
     固定格式：12小时制 hh:mm:ss AM/PM，绝不重复拼接秒单位，绝不被设置时间戳覆盖 */
  var _rawH = now.getHours();
  var minutes = now.getMinutes();
  var seconds = now.getSeconds();
  var ampm = _rawH >= 12 ? "PM" : "AM";
  var hours12 = _rawH % 12;
  hours12 = hours12 ? hours12 : 12;
  var _hh = (hours12 < 10 ? "0" : "") + hours12;
  var _mm = (minutes < 10 ? "0" : "") + minutes;
  var _ss = (seconds < 10 ? "0" : "") + seconds;
  var timeStr = _hh + ":" + _mm + ":" + _ss + " " + ampm;

  var timeEl = document.getElementById("calLiveTime");
  if (timeEl) timeEl.textContent = timeStr;

  // 格式化日期 2026/10/3
  var year = now.getFullYear();
  var month = now.getMonth() + 1;
  var date = now.getDate();
  var dateStr = year + "/" + month + "/" + date;
  var dateEl = document.getElementById("calLiveDate");
  if (dateEl) dateEl.textContent = dateStr;

  // 星期名称 Saturday
  var weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var dayIdx = now.getDay();
  var weekEl = document.getElementById("calLiveWeekday");
  if (weekEl) weekEl.textContent = weekdays[dayIdx];

  // 星期网格高亮
  var items = document.querySelectorAll("#calWeekGrid .w-item");
  items.forEach(function (item) {
    var w = parseInt(item.getAttribute("data-w"), 10);
    if (w === dayIdx) {
      item.classList.add("today-active");
    } else {
      item.classList.remove("today-active");
    }
  });
};

window.editCalCustomText = function () {
  var el = document.getElementById("calCustomCenter");
  if (!el) return;
  var cur = el.textContent || "xxx";
  {
    window.__akiniPromptModal(
      "日历中间自定义文字",
      "请输入自定义文字",
      function (val) {
        if (val !== null && String(val).trim() !== "") {
          var str = String(val).trim();
          el.textContent = str;
          try {
            localStorage.setItem("akini_cal_custom_center", str);
          } catch (e) {}
        }
      },
      { value: cur === "xxx" ? "" : cur, maxLength: 30 },
    );
    return;
  }
  try {
    var val = prompt("请输入日历中间自定义文字：", cur === "xxx" ? "" : cur);
    if (val !== null && val.trim() !== "") {
      el.textContent = val.trim();
      try {
        localStorage.setItem("akini_cal_custom_center", val.trim());
      } catch (e) {}
    }
  } catch (e) {}
};

/* 时间模块每秒刷新，确保永远实时；独立 IIFE 保护，不受其他启动脚本异常影响 */
(function () {
  function _tick() {
    try {
      if (window.updateS1Calendar) window.updateS1Calendar();
    } catch (e) {}
  }
  /* 自定义日历文字：DOM 就绪后回填，并在异步恢复完成后再应用一次 */
  window.__akiniApplyCalText = function () {
    try {
      var saved = localStorage.getItem("akini_cal_custom_center");
      if (saved) {
        var el = document.getElementById("calCustomCenter");
        if (el) el.textContent = saved;
      }
    } catch (e) {}
  };
  function _boot() {
    _tick();
    window.__akiniApplyCalText();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", _boot);
  else _boot();
  /* 每秒刷新日历时间，前台可见时持续走秒；后台自动暂停节省资源 */
  setInterval(function () {
    if (!document.hidden) _tick();
  }, 1000);
  // 前台可见时立即更新
  window.__akiniOnVisible(function () { _tick(); });
  /* 设置里切换时间格式 → 日历立即按新格式刷新 */
  window.addEventListener("storage", function (ev) {
    try {
      if (ev && ev.key === "akini_timeFormat" && !document.hidden) _tick();
    } catch (e) {}
  });
  setTimeout(window.__akiniApplyCalText, 1200);
  setTimeout(window.__akiniApplyCalText, 3000);
  window.addEventListener("load", window.__akiniApplyCalText);
})();


/* 聊天设置菜单：打开/关闭 + 全局事件委托 */
window.openChatMenuModal = function () {
  var cmo = document.getElementById("chatMenuOverlay");
  if (!cmo) return;
  cmo.style.display = "flex";
  cmo.classList.add("show");
  cmo.style.pointerEvents = "auto";
  cmo.style.zIndex = "99999";
  try {
    window.__akiniSyncChatMenuUI();
  } catch (e) {}
};

window.closeChatMenuModal = function () {
  var cmo = document.getElementById("chatMenuOverlay");
  if (!cmo) return;
  cmo.style.display = "none";
  cmo.classList.remove("show");
  cmo.style.pointerEvents = "none";
};

document.addEventListener("click", function (e) {
  var t = e.target;
  if (!t || !t.closest) return;

  if (
    t.id === "menuBg" ||
    (t.classList && t.classList.contains("menu-bg")) ||
    t.id === "chatMenuOverlay" ||
    t.id === "mpCloseBtn"
  ) {
    window.closeChatMenuModal();
    return;
  }

  var menuBtn = t.closest("#chatContactMenuBtn, .chat-contact-menu-btn, #chatTaName, .ta-name-pill");
  if (menuBtn) {
    var appChat = document.getElementById("app-chat");
    if (appChat && appChat.style.display !== "none") window.openChatMenuModal();
    return;
  }

  var homeBtn = t.closest("#changeHomeBgBtnBeautify");
  if (homeBtn) {
    e.preventDefault();
    window.triggerPickImage("akini_home_bg", function (dataUrl) {
      if (window.__akiniSaveImageKey) window.__akiniSaveImageKey("akini_home_bg", dataUrl);
      else {
        try {
          localStorage.setItem("akini_home_bg", dataUrl);
        } catch (ex) {}
      }
      if (window.applyAkiniHomeBg) {
        window.applyAkiniHomeBg(dataUrl);
        return;
      }
      var el = document.getElementById("phoneFrame");
      if (el) el.style.setProperty("background-image", 'url("' + dataUrl + '")', "important");
    });
    return;
  }

  var friendsBtn = t.closest("#changeFriendsBgBtnBeautify");
  if (friendsBtn) {
    e.preventDefault();
    window.triggerPickImage("akini_friends_bg", function (dataUrl) {
      if (window.__akiniSaveImageKey) window.__akiniSaveImageKey("akini_friends_bg", dataUrl);
      else {
        try {
          localStorage.setItem("akini_friends_bg", dataUrl);
        } catch (ex) {}
      }
      var el = document.getElementById("friendsHeader");
      if (el) el.style.setProperty("background-image", 'url("' + dataUrl + '")', "important");
    });
  }
});

window.compressImageDataUrl = function (dataUrl, callback, opts) {
  try {
    /* 对齐：小图（<300KB 二进制 ≈ dataURL <41万字符）直接返回原图，不压缩不重编码，
       避免 JPEG 重编码导致的画质损失和透明底被填白。只有真正的大图才压缩。 */
    if (dataUrl && typeof dataUrl === "string" && dataUrl.length < 410000) {
      if (typeof callback === "function") callback(dataUrl);
      return;
    }
    var img = new Image();
    img.onload = function () {
      try {
        var maxSide = (opts && opts.maxSide) || 2000;
        var q = (opts && opts.quality) || 0.92;
        var w = img.width,
          hh = img.height;
        if (w > 0 && hh > 0 && Math.max(w, hh) > maxSide) {
          var r = maxSide / Math.max(w, hh);
          w = Math.round(w * r);
          hh = Math.round(hh * r);
        }
        var cv = document.createElement("canvas");
        cv.width = w;
        cv.height = hh;
        var ctx = cv.getContext("2d");
        /* 不填充白底：保留 PNG 透明通道，头像/表情包透明底不被破坏 */
        ctx.drawImage(img, 0, 0, w, hh);
        /* 检测原图是否为 PNG（可能含透明），是则输出 PNG 无损；否则 JPEG 高质 */
        var isPng = /^data:image\/png/i.test(dataUrl);
        var out = isPng ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", q);
        if (out && out.length < String(dataUrl).length) {
          if (typeof callback === "function") callback(out);
          return;
        }
        if (typeof callback === "function") callback(dataUrl);
      } catch (err) {
        if (typeof callback === "function") callback(dataUrl);
      }
    };
    img.onerror = function () {
      if (typeof callback === "function") callback(dataUrl);
    };
    img.src = dataUrl;
  } catch (e) {
    if (typeof callback === "function") callback(dataUrl);
  }
};

window.triggerPickImage = function (targetKey, callback) {
  var input = document.getElementById("akini_universal_picker");
  if (!input) {
    input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.id = "akini_universal_picker";
    input.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(input);
  }
  input.onchange = function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (evt) {
      window.compressImageDataUrl(evt.target.result, function (compressed) {
        if (targetKey) {
          if (window.__akiniSaveImageKey) window.__akiniSaveImageKey(targetKey, compressed);
          else {
            try {
              localStorage.setItem(targetKey, compressed);
            } catch (ex) {}
          }
        }
        if (callback) callback(compressed);
      });
    };
    reader.readAsDataURL(file);
    input.value = "";
  };
  input.click();
};
