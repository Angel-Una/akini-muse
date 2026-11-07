/* 音乐歌名滚动 */

function akiniCheckScrollText() {
  if (document.hidden) return;
  var appM = document.getElementById("app-music");
  if (!appM || appM.style.display === "none") return;

  var song = document.getElementById("musicSongName");
  var artist = document.getElementById("musicArtist");

  function updateScroll(el, maxW) {
    if (!el) return;
    var raw = el.getAttribute("data-raw");
    if (!raw) {
      var wrap = el.querySelector(".akini-scroll-wrap");
      if (wrap) {
        var cur = (wrap.querySelector(".akini-scroll-text") || wrap).textContent || "";
        var parts = cur.split("\u00a0\u00a0\u00a0\u00a0");
        raw = parts[0] ? parts[0].trim() : el.textContent.trim();
      } else {
        raw = (el.textContent || "").trim();
      }
      el.setAttribute("data-raw", raw);
    }
    if (!raw) return;

    if (raw.length > 6) {
      var currentWrap = el.querySelector(".akini-scroll-wrap");
      if (!currentWrap || el.getAttribute("data-scroll-rendered") !== raw) {
        var duplicated = raw + "&nbsp;&nbsp;&nbsp;&nbsp;" + raw + "&nbsp;&nbsp;&nbsp;&nbsp;";
        el.innerHTML =
          '<span class="akini-scroll-wrap" style="max-width:' +
          maxW +
          'px"><span class="akini-scroll-text">' +
          duplicated +
          "</span></span>";
        el.setAttribute("data-scroll-rendered", raw);
      }
    } else {
      if (el.querySelector(".akini-scroll-wrap")) {
        el.textContent = raw;
        el.removeAttribute("data-scroll-rendered");
      }
    }
  }

  updateScroll(song, 180);
  updateScroll(artist, 140);
}
