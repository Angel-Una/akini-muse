/* 首页壁纸应用 */

// 强力首页壁纸应用
window.applyAkiniHomeBg = function (url) {
  if (!url) return;
  /* 只写 CSS 变量，渲染统一交给 perf-lite.css 的最终层；
     不再往 #phoneFrame 上写内联 !important（同一件事只保留一条渲染路径）。 */
  try {
    document.documentElement.style.setProperty("--akini-home-bg", 'url("' + url + '")');
  } catch (e) {}

  // 背景图亮度感知——采样像素计算平均感知亮度，自动给 #homeIndicator 添加/移除 akini-dark-bg 类
  try {
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      var c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      var ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, 1, 1);
      var px = ctx.getImageData(0, 0, 1, 1).data;
      var luminance = 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2];
      window.__akiniApplyBgMode(luminance < 128);
    };
    img.onerror = function () {
      window.__akiniApplyBgMode(true);
    };
    img.src = url;
  } catch (e) {
    window.__akiniApplyBgMode(true);
  }
};

// 根据背景明暗切换指示点样式类；默认（含未设壁纸、异步检测前）判定为深色背景显示白色
window.__akiniApplyBgMode = function (isDark) {
  var el = document.getElementById("homeIndicator") || document.body;
  if (isDark) {
    el.classList.add("akini-dark-bg");
    el.classList.remove("akini-light-bg");
  } else {
    el.classList.add("akini-light-bg");
    el.classList.remove("akini-dark-bg");
  }
};

(function () {
  function __akiniHomeWallpaperInit() {
  // 默认判定为深色背景，指示点显示白色（避免异步检测完成前/黑夜星空下黑点隐形）
  window.__akiniApplyBgMode(true);
  try {
    var savedBg = localStorage.getItem("akini_home_bg");
    if (savedBg) window.applyAkiniHomeBg(savedBg);
  } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __akiniHomeWallpaperInit);
  } else {
    __akiniHomeWallpaperInit();
  }
})();
