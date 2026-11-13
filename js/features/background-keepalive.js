
/* ===== 后台保活与后台防挂起系统 =====
 * 与 zy 一致：一个开关 → 一条静音循环音频（Audio loop + 音量 0.01）→ 防止页面被系统挂起。
 * 音频源用本地生成的静音 WAV（core-helpers.js 的 __akiniSilentUrl），离线可用，不依赖远程文件。
 * 本模块只做：开关状态读写（两套 key 同步）、转发 core 的音频启停、可见性恢复、UI 文本。
 * 之前这里另起一路远程 m4a 音频 + MutationObserver 回滚，与 core 的保活互相打架导致开关失效，已去除。
 */
(function () {
  "use strict";
  var KEY = "keepaliveAudioEnabled";
  var AKINI_KEY = "akini_toggle_keepAliveToggle";

  function _isEnabled() {
    try {
      return (
        localStorage.getItem(KEY) === "true" || localStorage.getItem(AKINI_KEY) === "1"
      );
    } catch (e) {
      return false;
    }
  }

  function _setEnabled(val) {
    try {
      localStorage.setItem(KEY, String(val));
      localStorage.setItem(AKINI_KEY, val ? "1" : "0");
    } catch (e) {}
  }

  function _start() {
    try {
      if (typeof window._akiniKeepAliveAudioStart === "function") {
        window._akiniKeepAliveAudioStart();
      }
    } catch (e) {}
    try {
      if (typeof window.startKeepAliveIsland === "function") window.startKeepAliveIsland();
    } catch (e) {}
    try {
      if (typeof window.requestWakeLock === "function") window.requestWakeLock();
    } catch (e) {}
  }

  function _stop() {
    try {
      if (typeof window._akiniKeepAliveAudioStop === "function") {
        window._akiniKeepAliveAudioStop();
      }
    } catch (e) {}
    try {
      if (typeof window.stopKeepAliveIsland === "function") window.stopKeepAliveIsland();
    } catch (e) {}
    try {
      if (typeof window.releaseWakeLock === "function") window.releaseWakeLock();
    } catch (e) {}
  }

  function _updateUI() {
    var toggle = document.getElementById("keepAliveToggle");
    if (toggle) toggle.classList.toggle("on", _isEnabled());
  }

  /* 统一落地：两套键 + class + 音频 + 唤醒锁 + 保活岛，一次写齐 */
  function _applyState(on, silent) {
    _setEnabled(on);
    var toggle = document.getElementById("keepAliveToggle");
    if (toggle) toggle.classList.toggle("on", on);
    if (on) _start();
    else _stop();
    _updateUI();
    if (!silent && typeof window.showNotification === "function") {
      window.showNotification(on ? "后台保活已开启 🎵" : "后台保活已关闭", on ? "success" : "info", on ? 2000 : 1500);
    }
  }

  /* 点击仲裁：等 core 的处理器跑完后统一写回结果 */
  document.addEventListener(
    "click",
    function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("#keepAliveToggle") : null;
      if (!el) return;
      var wasOn = el.classList.contains("on");
      /* 用户手动点了，标记为手动设置，启动纠偏不再重置 */
      try { localStorage.setItem("akini_toggle_keepAliveToggle_user", "1"); } catch (e) {}
      setTimeout(function () {
        _applyState(!wasOn);
      }, 0);
    },
    true,
  );

  /* 切回前台：如音频被系统暂停则恢复 */
  if (typeof window.__akiniOnVisible === "function") {
    window.__akiniOnVisible(function () {
      if (_isEnabled()) _start();
    });
  } else {
    document.addEventListener("visibilitychange", function () {
      if (_isEnabled() && document.visibilityState === "visible") _start();
    });
  }

  /* 页面加载：按权威状态恢复 class，开了就启动 */
  function __akiniKeepaliveInit() {
    _setEnabled(_isEnabled()); /* 两套 key 归一 */
    _updateUI();
    if (_isEnabled()) _start();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __akiniKeepaliveInit);
  } else {
    __akiniKeepaliveInit();
  }
})();
