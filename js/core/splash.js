/* 开屏动画与卸载 */

(function () {
  /* 开屏总时长固定 2.5 秒：2.1s 淡出起点 + 0.4s 淡出。
     用户可点屏幕直接跳过；主线程卡顿时以下定时器仍会兜底触发。 */
  var SPLASH_MS = 2100,
    FADE_MS = 400;
  var t0 = Date.now(),
    done = false;
  function hide() {
    if (done) return;
    var s = document.getElementById("akiniBootSplash");
    if (!s) return;
    done = true;
    document.documentElement.classList.remove("akini-boot-lock");
    s.style.pointerEvents = "none";
    s.style.transition = "opacity " + FADE_MS + "ms ease";
    s.style.opacity = "0";
    setTimeout(function () {
      try {
        s.style.display = "none";
      } catch (e) {}
    }, FADE_MS + 20);
    if (window.__akiniFitScale)
      try {
        window.__akiniFitScale();
      } catch (e) {}
  }

  var READY_TIMEOUT_MS = 6000;

  /* storage.js 启动恢复完成信号：它异步对账 IDB→内存，完成时置
     window.__akiniStorageRestored / __akiniRestoreSettled 并派发 akini-storage-restored。
     这里只做等待，不触发任何恢复逻辑。 */
  function storageRestored() {
    return new Promise(function (resolve) {
      if (window.__akiniStorageRestored || window.__akiniRestoreSettled) return resolve();
      var settled = false,
        iv = null;
      function finish() {
        if (settled) return;
        settled = true;
        if (iv) clearInterval(iv);
        try { window.removeEventListener("akini-storage-restored", finish); } catch (e) {}
        resolve();
      }
      try { window.addEventListener("akini-storage-restored", finish); } catch (e) {}
      /* 标志位轮询兜底：主线程被长任务占住时事件可能晚到，标志位仍可信 */
      iv = setInterval(function () {
        if (window.__akiniStorageRestored || window.__akiniRestoreSettled) finish();
      }, 100);
      setTimeout(finish, READY_TIMEOUT_MS);
    });
  }

  var _origHide = hide;
  var _preloading = false;
  hide = function () {
    if (done || _preloading) return;
    _preloading = true;
    var settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      _origHide();
    }
    try {
      /* 和 milk/zy 一样：撤开屏只等 storage.js 的数据恢复，不排队预热图片。
         之前同时等头像、壁纸、全部会话聊天背景和外链图，几十个 IDB 读取
         叠加起来会把开屏拖到 6s 上限，还抢主线程。 */
      Promise.race([
        storageRestored(),
        new Promise(function (r) { setTimeout(r, READY_TIMEOUT_MS); })
      ]).then(finish, finish);
    } catch (e) {
      finish();
    }
  };

  function tick() {
    if (done) return;
    if (Date.now() - t0 > SPLASH_MS) {
      hide();
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  /* 不绑定点击/触摸跳过：数据没就绪前提早撤屏只会看到空白页。
     开屏最短展示 2.1s，数据就绪后（最多 6s）自动淡出。 */
  if (document.readyState !== "loading") {
    setTimeout(hide, SPLASH_MS);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(hide, SPLASH_MS);
    });
  }
  window.addEventListener("load", function () {
    setTimeout(hide, SPLASH_MS);
  });
  setTimeout(hide, SPLASH_MS);
})();
