/* 首屏图片预热层（只读）。
   唯一数据源是 storage.js 的 akiniStore（localStorage 拦截 + IndexedDB 镜像）。
   本文件不再安装第二套 localStorage 桥、也不再写第二份 IndexedDB —— 对齐 milk/zy
   的「一个键一条写入通道」，避免每个键被重复写两三遍造成卡顿与互相覆盖。 */

(function (global) {
  "use strict";


  function get(key) {
    var k = String(key);
    try {
      var m = global.akiniStore && global.akiniStore.memoryGet && global.akiniStore.memoryGet(k);
      if (m != null && m !== "") return m;
    } catch (e) {}
    try {
      return global.localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }

  function set(key, value) {
    var k = String(key);
    try {
      if (global.akiniStore && typeof global.akiniStore.set === "function") {
        global.akiniStore.set(k, value);
        return;
      }
    } catch (e) {}
    try {
      global.localStorage.setItem(k, value);
    } catch (e) {}
  }

  function remove(key) {
    var k = String(key);
    try {
      if (global.akiniStore && typeof global.akiniStore.remove === "function") {
        global.akiniStore.remove(k);
        return;
      }
    } catch (e) {}
    try {
      global.localStorage.removeItem(k);
    } catch (e) {}
  }

  function keys() {
    try {
      if (global.akiniStore && typeof global.akiniStore.memoryKeys === "function")
        return global.akiniStore.memoryKeys();
    } catch (e) {}
    var out = [];
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (k && k.indexOf("akini_") === 0) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  var store = {
    get: get,
    set: set,
    remove: remove,
    keys: keys,
    /* 数据就绪统一由 storage.js 的 akiniStore 负责，这里不再二次等待 */
    ready: Promise.resolve(),
    isReady: function () {
      return true;
    },
  };

  /* 图片预热（preloadImages / preloadChatBackgrounds / blob URL 缓存）已无调用方：
     开屏早已不再预热图片，聊天背景走 akiniStore 直接读。整层删除。 */

  global.store = store;
})(window);
