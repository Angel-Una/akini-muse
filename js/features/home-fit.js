/* 首页整屏适配 */

/* 首页整屏适配模块 确保首页在任何设备/任何容器下全部内容完整可见，绝无裁剪
   1) 先还原 .content-wrapper 原始 flex 布局，测出内容自然总高度；
   2) 内容不超高 → 完全保持原版布局（space-between 自然分布），零干预；
   3) 内容超出可用视口（小屏/内嵌浏览器/预览窗）→ 容器按内容自然高度撑开
      （从根源消除内部滚动裁剪），再整体等比缩放进视口 → 全部内容可见 */
(function () {
  function fit() {
    try {
      var pf = document.getElementById("phoneFrame") || document.body;
      var cw = document.querySelector(".content-wrapper");
      if (!cw) return;

      /* 首页存在 等比引擎时彻底让位，避免内外双层 transform 堆叠放大 */
      if (document.querySelector(".home-screen > .fit-scale-box")) {
        if (window.__akiniFitScale)
          try {
            window.__akiniFitScale();
          } catch (eA) {}
        return;
      }

      if (cw.style.flex !== "") cw.style.flex = "";
      if (cw.style.height !== "") cw.style.height = "";
      if (cw.style.transform !== "") cw.style.transform = "";
      if (cw.style.transformOrigin !== "") cw.style.transformOrigin = "";
    } catch (e) {}
  }
  function __akiniHomeInit() {
    fit();
    try {
      window.__akiniResetHomeScroll && window.__akiniResetHomeScroll();
    } catch (eA) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", __akiniHomeInit);
  else __akiniHomeInit();
  window.addEventListener("load", __akiniHomeInit);
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  


  window.__akiniOnVisible(function () { setTimeout(fit, 300); });

  /* 弹窗打开/关闭强制重算：弹窗出现时浏览器可能重排（导致 vh/svh 波动），
     等过渡动画完全结束后立即 fit 一次，保证缩放值用最终稳定尺寸计算 */
  document.addEventListener("transitionend", function (e) {
    if (!document.hidden && e && e.target && e.target.classList && e.target.classList.contains("menu-panel")) fit();
  });
  document.addEventListener("animationend", function (e) {
    if (!document.hidden && e && e.target && e.target.classList && e.target.classList.contains("menu-panel")) fit();
  });
})();
