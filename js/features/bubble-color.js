/* 气泡颜色预加载 */

/* 页面预先加载气泡颜色，防止渲染闪烁或默认蓝覆盖 */
(function () {
  try {
    var c = localStorage.getItem("akini_bubble_color") || "gray";
    if (c && document.body) {
      document.body.classList.remove("bubble-pink", "bubble-blue", "bubble-green", "bubble-black", "bubble-gray");
      document.body.classList.add("bubble-" + c);
    }
  } catch (e) {}
})();
