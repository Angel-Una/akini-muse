/* 发送与隐藏发送设置 */

(function () {
  function syncHideSendState() {
    var cb = document.getElementById("hideSendCheckbox");
    if (!cb) return;

    var isHidden = localStorage.getItem("akini_hide_send_btn") === "1";
    cb.checked = isHidden;
    if (typeof window.__akiniApplyHideSendBtn === "function") {
      window.__akiniApplyHideSendBtn();
    } else {
      if (isHidden) {
        document.body.classList.add("hide-send-btn");
        var btn = document.getElementById("sendBtn");
        if (btn) {
          btn.classList.add("is-hidden");
          btn.style.display = "none";
        }
      } else {
        document.body.classList.remove("hide-send-btn");
        var btn = document.getElementById("sendBtn");
        if (btn) {
          btn.classList.remove("is-hidden");
          btn.style.display = "";
        }
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncHideSendState);
  } else {
    syncHideSendState();
  }

  // 绑定整行点击
  document.addEventListener(
    "click",
    function (ev) {
      var row = ev.target.closest("#toggleHideSendBtn");
      if (!row) return;
      if (ev.target.closest && ev.target.closest(".mp-switch")) return; // 开关本身由原生 label 处理
      var cb = document.getElementById("hideSendCheckbox");
      if (!cb) return;
      if (ev.target !== cb) {
        cb.checked = !cb.checked;
      }
      var val = cb.checked ? "1" : "0";
      try {
        localStorage.setItem("akini_hide_send_btn", val);
      } catch (e) {}
      syncHideSendState();
    },
    true,
  );
})();
