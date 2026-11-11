/* 等比缩放引擎 */

(function () {
  function __akiniFitScale() {
    try {
      var boxes = document.querySelectorAll(".home-screen > .fit-scale-box");
      if (!boxes || !boxes.length) return;

      var _bar = document.getElementById("bottomBar");
      if (_bar) {
        _bar.style.removeProperty("transform");
        _bar.style.removeProperty("transform-origin");
      }
      var barTop = 0;
      try {
        var br = _bar && _bar.getBoundingClientRect();
        if (br && br.height > 0 && br.width > 0) barTop = br.top;
      } catch (eB) {}

      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        /* 每一轮先复原，才能量到真实自然高度 */
        b.style.removeProperty("transform");
        b.style.removeProperty("transform-origin");
        b.style.removeProperty("margin-bottom");

        var sc = b.closest(".home-screen");
        if (!sc) continue;
        /* 首页固定整屏：不再上下滚动，放不下时只做等比缩放 */
        sc.style.setProperty("overflow-x", "hidden", "important");
        sc.style.setProperty("overflow-y", "hidden", "important");
        if (sc.scrollTop) sc.scrollTop = 0;
        var _wrap = document.getElementById("homeScreens");
        if (_wrap) {
          _wrap.style.setProperty("overflow-x", "hidden", "important");
          _wrap.style.setProperty("overflow-y", "hidden", "important");
          if (_wrap.scrollTop) _wrap.scrollTop = 0;
        }

        var scRect = sc.getBoundingClientRect();
        if (scRect.height < 40) continue; // 隐藏的首页（高度 0）跳过

        var cs = getComputedStyle(sc);
        var padT = parseFloat(cs.paddingTop) || 0;
        var padB = parseFloat(cs.paddingBottom) || 0;
        var avail = (sc.clientHeight || scRect.height) - padT - padB;
        /* 底栏是 fixed 覆盖层，可用高度不能算到它下面 */
        if (barTop > 0 && barTop > scRect.top) {
          var aboveBar = barTop - scRect.top - padT;
          if (aboveBar < avail) avail = aboveBar;
        }
        if (avail < 200) continue;

        var top = b.getBoundingClientRect().top;
        var bottom = top;
        for (var k = 0; k < b.children.length; k++) {
          var ch = b.children[k];
          if (!ch || !ch.getClientRects().length) continue;
          var r = ch.getBoundingClientRect();
          if (r.height <= 0) continue;
          if (r.bottom > bottom) bottom = r.bottom;
        }
        var natural = bottom - top;
        if (natural <= 0) continue;
        if (natural <= avail + 1) continue; // 放得下：保持原样

        var s = avail / natural;
        if (s > 1) s = 1;
        if (s < 0.45) s = 0.45; // 没有纵向滚动兜底，最小缩放再压低一点确保整屏放得下
        if (1 - s < 0.01) continue;

        /* 样式表里有 transform:none!important，必须用 inline important 才能压过它 */
        b.style.setProperty("transform-origin", "top center", "important");
        b.style.setProperty("transform", "scale(" + s.toFixed(4) + ")", "important");
        b.style.setProperty("margin-bottom", (-(natural * (1 - s))).toFixed(0) + "px", "important");
      }
    } catch (e) {}

    /* 图片晚加载会改变自然高度，加载完重算一次 */
    try {
      if (!window.__akiniFitImgBound) {
        window.__akiniFitImgBound = 1;
        for (var bi = 0; bi < boxes.length; bi++) {
          var __imgs = boxes[bi].querySelectorAll("img");
          for (var ii = 0; ii < __imgs.length; ii++) {
            __imgs[ii].addEventListener("load", function () {
              setTimeout(function () {
                try {
                  window.__akiniFitScale();
                } catch (eI) {}
              }, 80);
            });
          }
        }
      }
    } catch (e2) {}

    /* 只绑一次：窗口/可视区尺寸变化、旋转、回到前台时重算 */
    try {
      if (!window.__akiniFitEvtBound) {
        window.__akiniFitEvtBound = 1;
        var _fitT = 0;
        var _fitRun = function () {
          clearTimeout(_fitT);
          _fitT = setTimeout(function () {
            try {
              window.__akiniFitScale();
            } catch (eR) {}
          }, 120);
        };
        window.addEventListener("resize", _fitRun);
        window.addEventListener("orientationchange", function () {
          setTimeout(_fitRun, 320);
        });
        window.addEventListener("load", _fitRun);
        if (window.visualViewport) {
          try {
            window.visualViewport.addEventListener("resize", _fitRun);
          } catch (eVV) {}
        }
        window.__akiniOnVisible(function () { setTimeout(_fitRun, 260); });
      }
    } catch (e3) {}
  }
  window.__akiniFitScale = __akiniFitScale;
  /* 软键盘弹出会临时压低视口高度，若此时重算会把整屏缩小到很局促，
     用户关掉输入框后要等好几秒才恢复。输入框聚焦期间不重算，失焦后再补一次 */
  window.addEventListener("resize", function () {
    var ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return;
    __akiniFitScale();
  });
  document.addEventListener(
    "focusout",
    function () {
      setTimeout(__akiniFitScale, 350);
    },
    true,
  );
  window.addEventListener("orientationchange", function () {
    setTimeout(__akiniFitScale, 300);
  });
  setTimeout(__akiniFitScale, 900);
  setTimeout(__akiniFitScale, 2600);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      __akiniFitScale();
      setTimeout(__akiniFitScale, 60);
      setTimeout(__akiniFitScale, 200);
      setTimeout(__akiniFitScale, 600);
      setTimeout(__akiniFitScale, 1500);
    });
  } else {
    __akiniFitScale();
    setTimeout(__akiniFitScale, 60);
    setTimeout(__akiniFitScale, 200);
    setTimeout(__akiniFitScale, 600);
    setTimeout(__akiniFitScale, 1500);
  }
  window.addEventListener("load", function () {
    __akiniFitScale();
    setTimeout(__akiniFitScale, 300);
  });
})();
