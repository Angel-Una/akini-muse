/* 聊天顶栏模糊开关 */

(function () {
  function initChatTopBlurToggle() {
    var cb = document.getElementById("chatTopBlurCheckbox");
    var row = document.getElementById("toggleChatTopBlurBtn");
    var blurEl = document.getElementById("chatTopBarBlur");
    var saved = localStorage.getItem("akini_chat_top_blur");
    var isEnabled = saved === "true"; // 默认关闭：只有用户明确打开过才显示
    if (cb) cb.checked = isEnabled;
    if (blurEl) blurEl.style.display = isEnabled ? "" : "none";

    function setBlur(enable) {
      isEnabled = !!enable;
      if (cb) cb.checked = isEnabled;
      if (blurEl) blurEl.style.display = isEnabled ? "" : "none";
      try {
        localStorage.setItem("akini_chat_top_blur", isEnabled ? "true" : "false");
      } catch (e) {}
    }

    if (cb) {
      cb.addEventListener("change", function () {
        setBlur(this.checked);
      });
    }
    if (row) {
      row.addEventListener("click", function (e) {
        if (e.target && (e.target.tagName === "INPUT" || e.target.closest(".mp-switch"))) return;
        setBlur(!cb.checked);
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatTopBlurToggle);
  } else {
    initChatTopBlurToggle();
  }
})();
