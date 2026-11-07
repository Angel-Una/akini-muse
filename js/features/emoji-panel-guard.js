/* 进入聊天时关闭表情面板 */

/* ============ 进入聊天界面时表情包面板必须默认关闭（防自动弹出） ============ */
(function () {
  function _akHideEmojiPanelNow() {
    try {
      var p = document.getElementById("emojiPanel");
      if (p) {
        p.style.display = "none";
        p.style.visibility = "hidden";
        p.style.pointerEvents = "none";
        p.classList.remove("show");
      }
    } catch (e) {}
  }
  try {
    var _chat = document.getElementById("app-chat");
    if (_chat && window.MutationObserver) {
      var _mo = new MutationObserver(function () {
        /* #app-chat 每次从隐藏变为可见（重进网站后打开聊天/切换会话）都强制收起表情包面板 */
        if (_chat.style.display !== "none") _akHideEmojiPanelNow();
      });
      _mo.observe(_chat, { attributes: true, attributeFilter: ["style", "class"] });
    }
    /* 兜底：切回前台（PWA 闪退重进/后台切回）时也确保收起 */
    window.__akiniOnVisible(function () { setTimeout(_akHideEmojiPanelNow, 60); });
  } catch (e) {}
})();
