/* 网易云唱片 mini 悬浮球：
   在其他界面显示（一起听界面自动隐藏），可播放/暂停、切换上下曲、打开歌单。
   位置可拖动并记忆；是否显示由设置里的「音乐悬浮球」开关控制。 */
(function () {
  var KEY_ON = "akini_toggle_musicMiniToggle";
  var KEY_POS = "akini_music_mini_pos";
  var root = null;
  var coverEl = null;
  var iconEl = null;
  var timer = null;
  var lastShow = null;
  var lastPlaying = null;
  var lastCover = null;
  var lastOpacity = null;

  var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  var PAUSE_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  var PREV_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14l-11-7z"/></svg>';
  var NEXT_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>';
  var LIST_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M4 12h10M4 17h10M17 7v9"/><circle cx="19" cy="6.5" r="1.8" fill="currentColor" stroke="none"/></svg>';

  function isOn() {
    return "1" === localStorage.getItem(KEY_ON);
  }
  function isPageVisible(id) {
    var el = document.getElementById(id);
    return !!el && "none" !== el.style.display;
  }
  function isPlaying() {
    try {
      return !!(window.__akiniMusicControl && window.__akiniMusicControl.playing());
    } catch (e) {
      return false;
    }
  }
  function applyPos(el) {
    try {
      var p = JSON.parse(localStorage.getItem(KEY_POS) || "null");
      if (p && isFinite(p.x) && isFinite(p.y)) {
        el.style.left = Math.max(4, Math.min(p.x, window.innerWidth - 40)) + "px";
        el.style.top = Math.max(4, Math.min(p.y, window.innerHeight - 40)) + "px";
        el.style.right = "auto";
        el.style.bottom = "auto";
      }
    } catch (e) {}
  }

  function build() {
    if (document.getElementById("akiniMusicMiniBall")) return;
    var el = document.createElement("div");
    el.id = "akiniMusicMiniBall";
    el.className = "akini-music-mini";
    el.style.display = "none";
    el.innerHTML =
      '<div class="amm-disc"><img id="ammCover" alt=""><span class="amm-ring"></span></div>' +
      '<div class="amm-ctrl">' +
      '<button type="button" class="amm-btn" data-act="prev" aria-label="上一首">' +
      PREV_SVG +
      "</button>" +
      '<button type="button" class="amm-btn" data-act="toggle" aria-label="播放暂停"><span id="ammPlayIco">' +
      PLAY_SVG +
      "</span></button>" +
      '<button type="button" class="amm-btn" data-act="next" aria-label="下一首">' +
      NEXT_SVG +
      "</button>" +
      '<button type="button" class="amm-btn" data-act="list" aria-label="歌单">' +
      LIST_SVG +
      "</button>" +
      "</div>";
    document.body.appendChild(el);
    root = el;
    coverEl = document.getElementById("ammCover");
    iconEl = document.getElementById("ammPlayIco");

    /* 歌单浮层原本在一个听页面里，挪到 body 才能从其他界面打开 */
    try {
      var pl = document.getElementById("musicPlaylistOverlay");
      if (pl && pl.parentNode !== document.body) document.body.appendChild(pl);
    } catch (e) {}

    var ctrl = el.querySelector(".amm-ctrl");
    ctrl.addEventListener("click", function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest(".amm-btn") : null;
      if (!b) return;
      ev.stopPropagation();
      var act = b.getAttribute("data-act");
      var C = window.__akiniMusicControl;
      if (!C) return;
      if ("prev" === act) C.prev();
      else if ("next" === act) C.next();
      else if ("list" === act) C.playlist();
      else C.toggle();
      setTimeout(sync, 200);
    });

    bindDrag(el);
  }

  function bindDrag(el) {
    var sx = 0,
      sy = 0,
      ox = 0,
      oy = 0,
      active = false,
      moved = false;
    function down(ev) {
      if (ev.target && ev.target.closest && ev.target.closest(".amm-ctrl")) return;
      active = true;
      moved = false;
      sx = ev.clientX;
      sy = ev.clientY;
      var r = el.getBoundingClientRect();
      ox = r.left;
      oy = r.top;
      el.style.left = ox + "px";
      el.style.top = oy + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
    }
    function move(ev) {
      if (!active) return;
      var dx = ev.clientX - sx,
        dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (!moved) return;
      var w = el.offsetWidth || 60,
        h = el.offsetHeight || 90;
      var L = Math.max(4, Math.min(ox + dx, window.innerWidth - w - 4));
      var T = Math.max(4, Math.min(oy + dy, window.innerHeight - h - 4));
      el.style.left = L + "px";
      el.style.top = T + "px";
      if (ev.cancelable) ev.preventDefault();
    }
    function up() {
      if (!active) return;
      active = false;
      if (moved) {
        try {
          localStorage.setItem(
            KEY_POS,
            JSON.stringify({ x: parseInt(el.style.left, 10), y: parseInt(el.style.top, 10) }),
          );
        } catch (e) {}
      } else {
        /* 轻点唱片：展开/收起下方的播放控制条，不跳转一起听界面 */
        el.classList.toggle("open");
        if (el.classList.contains("open")) {
          var r = el.getBoundingClientRect();
          var bottomLimit = window.innerHeight - 6;
          if (r.bottom > bottomLimit) {
            var t = Math.max(6, window.innerHeight - el.offsetHeight - 6);
            el.style.top = t + "px";
            el.style.left = r.left + "px";
            el.style.right = "auto";
            el.style.bottom = "auto";
          }
        }
      }
    }
    if (window.PointerEvent) {
      el.addEventListener("pointerdown", down);
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    } else {
      el.addEventListener("mousedown", down);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      el.addEventListener("touchstart", function (ev) {
        var p = ev.touches && ev.touches[0];
        if (!p) return;
        down({ clientX: p.clientX, clientY: p.clientY, target: ev.target, cancelable: ev.cancelable });
      });
      el.addEventListener(
        "touchmove",
        function (ev) {
          var p = ev.touches && ev.touches[0];
          if (!p) return;
          move({ clientX: p.clientX, clientY: p.clientY, cancelable: ev.cancelable, preventDefault: function () {} });
        },
        { passive: false },
      );
      el.addEventListener("touchend", up);
    }
  }

  function sync() {
    if (!root) return;
    var pl = document.getElementById("musicPlaylistOverlay");
    var playlistOpen = !!pl && "none" !== pl.style.display;
    var show =
      isOn() &&
      "1" === localStorage.getItem("akini_music_listening_active") &&
      !isPageVisible("app-music") &&
      !playlistOpen;
    if (show !== lastShow) {
      root.style.display = show ? "flex" : "none";
      lastShow = show;
    }
    if (!show) {
      if (root.classList.contains("open")) root.classList.remove("open");
      lastPlaying = null;
      return;
    }
    var playing = isPlaying();
    if (playing !== lastPlaying) {
      root.classList.toggle("playing", playing);
      if (iconEl) iconEl.innerHTML = playing ? PAUSE_SVG : PLAY_SVG;
      lastPlaying = playing;
    }
    var coverSrc = document.getElementById("musicCover");
    if (coverEl) {
      var cover = "";
      try {
        cover = (coverSrc && (coverSrc.currentSrc || coverSrc.src)) || "";
      } catch (e) {}
      if (cover !== lastCover) {
        if (cover && coverEl.getAttribute("src") !== cover) coverEl.setAttribute("src", cover);
        lastCover = cover;
      }
      var opacity = cover ? "1" : "0";
      if (opacity !== lastOpacity) {
        coverEl.style.opacity = opacity;
        lastOpacity = opacity;
      }
    }
  }

  function init() {
    build();
    if (!root) return;
    applyPos(root);
    sync();
    if (timer) clearInterval(timer);
    timer = setInterval(sync, 700);
    window.addEventListener("resize", function () {
      if ("auto" === root.style.left) return;
      applyPos(root);
    });
    window.__akiniOnVisible(function () {
      setTimeout(sync, 150);
    });
    window.__akiniOnHidden(function () {
      setTimeout(sync, 150);
    });
    /* 设置里点开关后立即生效 */
    document.addEventListener(
      "click",
      function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest("#musicMiniToggle") : null;
        if (t) {
          /* 用户手动点了，标记为手动设置，启动纠偏不再重置 */
          try { localStorage.setItem("akini_toggle_musicMiniToggle_user", "1"); } catch (e) {}
          setTimeout(sync, 120);
        }
      },
      true,
    );
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
