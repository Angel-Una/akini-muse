/* 音乐消息设置项 */

(function () {
  function __akiniMusicSettingsInit() {
    var _ttlInp = document.getElementById("musicMsgTtlInput");
    if (_ttlInp) {
      try {
        _ttlInp.value = parseFloat(localStorage.getItem("akini_music_msg_ttl") || "20") || 20;
      } catch (e) {}
    }
    /* 「继续说」只委托统一回复入口，输入动态由回复轮次管理 */
    window.__akiniContinueTalk = function () {
      if (window.__akiniForceReply) window.__akiniForceReply();
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
