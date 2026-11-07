/* 音乐菜单滚动锁定 */

(function () {
  function setupMusicMenuLock() {
    var overlay = document.getElementById("musicMenuOverlay");
    var panel = document.getElementById("musicMenuPanel");
    if (!overlay || !panel) return;

    // 点击遮罩空白处关闭弹窗已由 index.html 的内联 onclick 处理，这里不再重复绑定

    try {
      var bg = document.getElementById("musicBgLayer");
      if (bg) {
        try {
          var savedMusicWallpaper = localStorage.getItem("akini_music_wallpaper");
          if (savedMusicWallpaper) {
            bg.style.backgroundImage = "url(" + savedMusicWallpaper + ")";
          }
        } catch (e2) {}
      }
    } catch (e) {}

    // 5. 网易云背景图更换/清除事件绑定
    try {
      var fileInputMusicBg = document.getElementById("fileInputMusicBg");
      if (fileInputMusicBg) {
        fileInputMusicBg.addEventListener("change", function () {
          var file = this.files && this.files[0];
          this.value = "";
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            var dataUrl = ev.target && ev.target.result;
            if (!dataUrl) return;
            try {
              localStorage.setItem("akini_music_wallpaper", dataUrl);
            } catch (e) {
              if (window.__akiniCenterModal) window.__akiniCenterModal("提示", "壁纸图片过大，保存失败，请换一张试试");
              return;
            }
            var bg = document.getElementById("musicBgLayer");
            if (bg) bg.style.backgroundImage = "url(" + dataUrl + ")";
          };
          reader.onerror = function () {
            if (window.__akiniCenterModal) window.__akiniCenterModal("提示", "壁纸读取失败，请换一张试试");
          };
          reader.readAsDataURL(file);
        });
      }
      var clearMusicBgBtn = document.getElementById("clearMusicBgBtnBeautify");
      if (clearMusicBgBtn) {
        clearMusicBgBtn.addEventListener("click", function () {
          try {
            localStorage.removeItem("akini_music_wallpaper");
          } catch (e) {}
          var bg = document.getElementById("musicBgLayer");
          if (bg) bg.style.backgroundImage = "none";
        });
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupMusicMenuLock);
  } else {
    setTimeout(setupMusicMenuLock, 50);
  }
})();
