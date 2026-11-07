/* 后台保活与防挂起 */

/* ===== 后台保活与后台防挂起系统 =====
 * 1. 采用实测挂机数日不掉线的 silence.m4a 循环音频流
 * 2. 结合 Screen WakeLock 屏幕常亮 API
 * 3. 页面切入后台 (visibilitychange hidden) 时执行轻量级数据快速落盘
 * 4. 页面切回前台 (visibilityState visible) 时自动唤醒保活音频，防 iOS/Android 杀死
 */
(function () {
  "use strict";
  var KEY = "keepaliveAudioEnabled";
  var AKINI_KEY = "akini_toggle_keepAliveToggle";
  var SRC = "https://img.heliar.top/file/1772885159972_silence.m4a";
  var _audio = null;
  var _wakeLock = null;
  var _unlockBound = false;
  var _arbitrating = false;

  function _isEnabled() {
    try {
      return localStorage.getItem(KEY) === "true";
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

  function _createAudio() {
    if (_audio) return _audio;
    try {
      _audio = new Audio(SRC);
      console.warn("[Akini Audio New]", "_audio @ background-keepalive.js");
      _audio.loop = true;
      _audio.volume = 0.01;
      console.warn("[Akini Vol]", _audio.volume, "_audio @ background-keepalive.js");
      _audio.preload = "auto";
      _audio.setAttribute("playsinline", "");
      _audio.setAttribute("webkit-playsinline", "");
      _audio.setAttribute("x5-playsinline", "");
      _audio.addEventListener("play", function () {
        _updateUI(true);
      });
      _audio.addEventListener("pause", function () {
        _updateUI(false);
      });
      return _audio;
    } catch (e) {
      return null;
    }
  }

  async function _requestWakeLock() {
    if ("wakeLock" in navigator && !_wakeLock) {
      try {
        _wakeLock = await navigator.wakeLock.request("screen");
        _wakeLock.addEventListener("release", function () {
          _wakeLock = null;
        });
      } catch (e) {}
    }
  }

  function _releaseWakeLock() {
    if (_wakeLock) {
      try {
        _wakeLock.release();
      } catch (e) {}
      _wakeLock = null;
    }
  }

  function _updateUI(playing) {
    var toggle = document.getElementById("keepAliveToggle");
    var dot = document.getElementById("keepalive-dot");
    var desc = document.getElementById("keepalive-audio-desc");
    var uptimeEl = document.getElementById("kaUptime");
    var enabled = _isEnabled();

    if (toggle) {
      if (enabled) toggle.classList.add("on");
      else toggle.classList.remove("on");
    }
    if (dot) {
      dot.className = "keepalive-dot" + (playing ? " alive" : "");
    }
    if (desc) {
      if (!enabled) desc.textContent = "静音循环音频，防止页面被系统挂起";
      else if (playing) desc.textContent = "运行中 · 页面已保活";
      else desc.textContent = "等待交互后启动…";
    }
  }

  function _start() {
    var a = _createAudio();
    if (a) {
      var p = a.play();
      if (p && p.then) {
        p.catch(function () {
          _updateUI(false);
          if (!_unlockBound) {
            _unlockBound = true;
            function unlock() {
              if (_isEnabled() && _audio) _audio.play().catch(function () {});
              _requestWakeLock();
              _unlockBound = false;
            }
            document.addEventListener("touchstart", unlock, { once: true, passive: true });
            document.addEventListener("click", unlock, { once: true });
          }
        });
      }
    }
    _requestWakeLock();
  }

  function _stop() {
    if (_audio) {
      try {
        _audio.pause();
        _audio.currentTime = 0;
      } catch (e) {}
    }
    _releaseWakeLock();
    _updateUI(false);
  }

  /* 统一落地：两套键 + class + 音频 + 唤醒锁 + 保活岛，一次写齐，杜绝多重绑定互相打架 */
  function _applyState(on, silent) {
    _setEnabled(on);
    var toggle = document.getElementById("keepAliveToggle");
    if (toggle) toggle.classList.toggle("on", on);
    if (on) {
      _start();
      try {
        window._akiniKeepAliveAudioStart();
      } catch (e) {}
      try {
        window.startKeepAliveIsland();
      } catch (e) {}
    } else {
      _stop();
      try {
        window._akiniKeepAliveAudioStop();
      } catch (e) {}
      try {
        window.stopKeepAliveIsland();
      } catch (e) {}
    }
    _updateUI(on && _audio && !_audio.paused);
    if (!silent && typeof window.showNotification === "function") {
      window.showNotification(on ? "后台保活已开启 🎵" : "后台保活已关闭", on ? "success" : "info", on ? 2000 : 1500);
    }
  }

  /* 用户没有主动开启（keepaliveAudioEnabled 非 true）时，任何被外部打开的状态一律回滚 */
  function _forceOff() {
    if (_isEnabled()) return;
    var toggle = document.getElementById("keepAliveToggle");
    var dirty = !!(toggle && toggle.classList.contains("on"));
    if (!dirty) {
      try {
        dirty = localStorage.getItem(AKINI_KEY) === "1";
      } catch (e) {}
    }
    if (!dirty) return;
    _setEnabled(false);
    if (toggle) toggle.classList.remove("on");
    _stop();
    try {
      window._akiniKeepAliveAudioStop();
    } catch (e) {}
    try {
      window.stopKeepAliveIsland();
    } catch (e) {}
    _updateUI(false);
  }


  /* 点击仲裁：先记下用户看到的原始状态，等 core 的处理器全部跑完后统一写回结果 */
  document.addEventListener(
    "click",
    function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("#keepAliveToggle") : null;
      if (!el) return;
      var wasOn = el.classList.contains("on");
      _arbitrating = true;
      setTimeout(function () {
        _applyState(!wasOn);
        _arbitrating = false;
      }, 0);
    },
    true,
  );

  // visibilitychange 对齐后台：切回前台瞬间唤醒播放
  window.__akiniOnVisible(function () {
    if (!_isEnabled()) return;
    if (_audio && _audio.paused) {
      _audio.play().catch(function () {});
    }
    _requestWakeLock();
  });

  // 页面加载：按权威状态恢复，并清理被外部自动打开的历史脏状态
  function __akiniKeepaliveInit() {
    var toggle = document.getElementById("keepAliveToggle");
    if (toggle) {
      // core 若按 akini_toggle_* 初始化了 class，这里立即以权威状态纠正
      toggle.classList.toggle("on", _isEnabled());
      try {
        new MutationObserver(function () {
          if (!_arbitrating) _forceOff();
        }).observe(toggle, { attributes: true, attributeFilter: ["class"] });
      } catch (e) {}
    }
    _forceOff();
    _updateUI(false);
    if (_isEnabled()) _start();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __akiniKeepaliveInit);
  } else {
    __akiniKeepaliveInit();
  }

  // 延迟 1.5s 二次自检唤醒
  setTimeout(function () {
    if (_isEnabled()) {
      if (!_audio || _audio.paused) _start();
      _updateUI(_audio && !_audio.paused);
    }
  }, 1500);
})();
