/* 音乐消息设置项 */

(function () {
  function __akiniMusicSettingsInit() {
  var _ttlInp = document.getElementById("musicMsgTtlInput");
  if (_ttlInp) {
    try {
      _ttlInp.value = parseFloat(localStorage.getItem("akini_music_msg_ttl") || "20") || 20;
    } catch (e) {}
  }
  window.__akiniContinueTalk = function () {
    if (window.__akiniForceReply) {
      window.__akiniForceReply();
      return;
    }
    var chatId = window.akiniContacts ? window.akiniContacts.getActiveChatId() : null;
    if (!chatId) return;
    var target = window.akiniContacts ? window.akiniContacts.getChatTarget(chatId) : null;
    if (!target) return;
    var ti = document.getElementById("typingIndicator");
    if (ti) ti.style.display = "block";
    if (typeof showTypingBubble === "function") {
      showTypingBubble(chatId, null);
    }
    setTimeout(
      function () {
        try {
          if (typeof window.I === "function") {
            var bh = window.AKR ? window.AKR.pickReplyBehavior() : { type: "text" };
            window.I(chatId, target, bh);
          } else if (typeof window.taPokeWithText === "function") {
            window.taPokeWithText(chatId, null);
          } else if (typeof b === "function") {
            b(chatId);
          }
        } catch (e) {
          console.error("mic continue talk error:", e);
        }
        var ti2 = document.getElementById("typingIndicator");
        if (ti2) ti2.style.display = "none";
      },
      1500 + Math.random() * 2000,
    );
  };
  var micBtn = document.getElementById("akiniMicContinueBtn");
  if (micBtn) micBtn.addEventListener("click", window.__akiniContinueTalk);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __akiniMusicSettingsInit);
  } else {
    __akiniMusicSettingsInit();
  }
})();
