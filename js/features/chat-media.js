/* 聊天图片媒体占位符还原 */

(function () {
  function resolveChatMedia() {
    try {
      var chatBody = document.getElementById("chatBody") || document.querySelector(".chat-body");
      if (chatBody && window.__akiniMedia && typeof window.__akiniMedia.resolve === "function") {
        window.__akiniMedia.resolve(chatBody);
      }
    } catch (e) {}
  }
  // 监听进入聊天界面及消息增加（防抖：避免连续 DOM 变动反复全量扫描 img[data-mh]）
  var _mediaT = null;
  var _obs = new MutationObserver(function () {
    if (_mediaT) clearTimeout(_mediaT);
    _mediaT = setTimeout(resolveChatMedia, 250);
  });
  function __akiniChatMediaInit() {
    var cb = document.getElementById("chatBody") || document.querySelector(".chat-body");
    if (cb) _obs.observe(cb, { childList: true, subtree: true });
    resolveChatMedia();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __akiniChatMediaInit);
  } else {
    __akiniChatMediaInit();
  }
})();
