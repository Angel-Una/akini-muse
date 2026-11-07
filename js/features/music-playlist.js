/* 播放列表浮层渲染 */

// 播放列表浮层：兜底保障，确保原浮层内歌曲能渲染
(function () {
  var appMusic = document.getElementById("app-music");
  if (!appMusic) return;

  // 把播放列表和选人浮层都归到 app-music 内部，保证只在“一起听”页面出现
  ["musicPlaylistOverlay"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.parentNode !== appMusic) appMusic.appendChild(el);
  });

  var sheet = document.getElementById("musicPlaylistOverlay");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "musicPlaylistOverlay";
    sheet.style.cssText =
      "display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:999;align-items:flex-end;-webkit-tap-highlight-color:transparent";
    sheet.innerHTML =
      '<div style="width:100%;max-height:60vh;background:#2a2a30;border-radius:20px 20px 0 0;padding:16px;color:#fff">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<span style="font-size:16px;font-weight:600">播放列表</span>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<button id="musicPlaylistClearAll" type="button" style="background:0 0;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:4px 10px;font-size:12px;color:rgba(255,255,255,.8);cursor:pointer;-webkit-tap-highlight-color:transparent">删除全部</button>' +
      '<button id="musicPlaylistClose" type="button" style="background:0 0;border:none;font-size:20px;color:rgba(255,255,255,.5);cursor:pointer;-webkit-tap-highlight-color:transparent">✕</button>' +
      "</div>" +
      "</div>" +
      '<div id="musicPlaylistContainer" style="overflow-y:auto;max-height:45vh;-webkit-overflow-scrolling:touch"></div>' +
      "</div>";
    appMusic.appendChild(sheet);
  }

  function openSheet() {
    try {
      window.__akiniOpenPlaylist && window.__akiniOpenPlaylist();
    } catch (e) {}
    try {
      window._renderPlaylist();
    } catch (e) {}
    sheet.style.display = "flex";
  }
  function closeSheet() {
    sheet.style.display = "none";
  }

  appMusic.addEventListener("click", function (e) {
    var t = e.target;
    if (t && (t.id === "musicPlaylistBtn" || (t.closest && t.closest("#musicPlaylistBtn")))) openSheet();
  });

  function bind(el, fn) {
    if (!el) return;
    el.addEventListener("click", fn);
  }
  bind(document.getElementById("musicPlaylistClose"), closeSheet);
  bind(document.getElementById("musicPlaylistClearAll"), function () {
    try {
      window.__clearAll && window.__clearAll();
    } catch (e) {}
    closeSheet();
  });
  sheet.addEventListener("click", function (e) {
    if (e.target === sheet) closeSheet();
  });
})();
