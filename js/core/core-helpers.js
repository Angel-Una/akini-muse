var AKINI_CHAT_BATCH_SIZE = 25;
function __akiniStripTypingRows(t) {
  if (!t || "string" != typeof t) return t || "";
  var e = -1 !== t.indexOf("typingBubbleRow_") || -1 !== t.indexOf("typing-bubble"),
    n = -1 !== t.indexOf("加载更多聊天记录");
  if (!e && !n) return t;
  var i = document.createElement("div");
  if (
    ((i.innerHTML = t),
    i.querySelectorAll('[id^="typingBubbleRow_"]').forEach(function (t) {
      t.remove();
    }),
    n)
  ) {
    for (var a = i.querySelectorAll("*"), o = [], r = 0; r < a.length; r++) {
      var c = a[r];
      if (0 === c.children.length && c.textContent && -1 !== c.textContent.indexOf("加载更多聊天记录")) {
        var s = (c.closest && (c.closest(".msg-row") || c.closest('[class*="load"]'))) || c;
        -1 === o.indexOf(s) && o.push(s);
      }
    }
    o.forEach(function (t) {
      t.remove();
    });
  }
  return i.innerHTML;
}
function __akiniCountMsgRowsFast(t) {
  if (!t) return 0;
  var e = t.match(/<div[^>]*class="msg-row/g),
    n = e ? e.length : 0,
    i = t.match(/id="typingBubbleRow_/g);
  return (i && (n -= i.length), n < 0 ? 0 : n);
}
function __akiniIncTyping(t, e) {
  if (!t) return t || "";
  var n = (window.__akiniIncCache = window.__akiniIncCache || {}),
    i = (n[e] = n[e] || {});
  // 用清洗后的结果做前缀匹配：W[t] 是清洗+截断后的工作集，
  // 下一次 d = W[t] + i 能直接命中，只扫描新增的 i
  if (i.cleanTyping === t) return i.cleanTyping;
  if (i.cleanTyping && t.length > i.cleanTyping.length && 0 === t.indexOf(i.cleanTyping))
    return i.cleanTyping + __akiniStripTypingRows(t.slice(i.cleanTyping.length));
  var a = __akiniStripTypingRows(t);
  return ((i.srcTyping = t), (i.cleanTyping = a), __akiniIncCacheBound(n, e), a);
}
function __akiniIncMedia(t, e) {
  if (!t) return t || "";
  var n = (window.__akiniIncCache = window.__akiniIncCache || {}),
    i = (n[e] = n[e] || {});
  if (i.cleanMedia === t) return i.cleanMedia;
  if (i.cleanMedia && t.length > i.cleanMedia.length && 0 === t.indexOf(i.cleanMedia))
    return i.cleanMedia + __akiniStripMedia(t.slice(i.cleanMedia.length));
  var a = __akiniStripMedia(t);
  return ((i.srcMedia = t), (i.cleanMedia = a), __akiniIncCacheBound(n, e), a);
}
function __akiniIncCount(t, e, n) {
  if (!t) return 0;
  var i = (window.__akiniIncCache = window.__akiniIncCache || {}),
    a = (i[e] = i[e] || {}),
    o = "srcCount_" + n,
    r = "rows_" + n;
  if (a[o] === t) return a[r];
  if (a[o] && t.length > a[o].length && 0 === t.indexOf(a[o]))
    return ((a[r] = (a[r] || 0) + __akiniCountMsgRowsFast(t.slice(a[o].length))), (a[o] = t), a[r]);
  var c = __akiniCountMsgRowsFast(t);
  return ((a[o] = t), (a[r] = c), __akiniIncCacheBound(i, e), c);
}
function __akiniIncCacheBound(n, e) {
  try {
    var k = Object.keys(n);
    if (k.length <= 20) return;
    delete n[e];
  } catch (t) {}
}
/* 把聊天历史 HTML 截断到最近 maxRows 条 msg-row，避免内存工作集无限增长导致越用越卡。
   完整历史由 IndexedDB 持有，内存里只保留最近 150 条供渲染/计数用。 */
/* 清理旧裁切 bug 写回的裸片段：div class="msg-row ..."> 少了开头的 '<'。
   只在前面没有 '<' 时匹配，正常气泡不受影响。 */
function __akiniStripOrphanRows(html) {
  if (!html || "string" != typeof html) return html || "";
  try {
    return html.replace(/(^|[^<])div class="msg-row[^"]*"[^>]*>\s*/g, function (m, pre) {
      return pre || "";
    });
  } catch (e) {
    return html;
  }
}
function __akiniCapHistory(html, t, maxRows) {
  if (!html || "string" != typeof html) return html || "";
  try {
    html = __akiniStripOrphanRows(html);
    maxRows = maxRows || 150;
    var rows = __akiniIncCount(html, t, "cap");
    if (rows <= maxRows) return html;
    var cut = rows - maxRows, pos = -1;
    for (var i = 0; i < cut; i++) {
      pos = html.indexOf('<div class="msg-row', i === 0 ? 0 : pos + 1);
      if (pos < 0) return html;
    }
    /* 从被裁掉的那一行的 <div 开始切，不能 +1：之前 +1 会把 '<' 切掉，
       留下 'div class="msg-row other" data-ts="...">' 这段裸文本显示在聊天里 */
    return pos > 0 ? html.slice(pos) : html;
  } catch (e) {
    return html;
  }
}
/* 对齐 milk/zy 的分批渲染：DOM 里只放最近一批消息（HISTORY_BATCH_SIZE），
   往上滑再往前加载一批，完整历史始终在 __akiniChatLog 数组里。
   milk 用 messages 数组 slice，我们用 msg-row 边界切字符串。 */

(window.addEventListener("akini-img-ready", function () {
  try {
    setTimeout(function () {
      var cb = document.getElementById("chatBody");
      window.__akiniMedia && cb && window.__akiniMedia.resolve(cb);
    }, 2500);
  } catch (t) {}
  try {
    setTimeout(function () {
      var cb = document.getElementById("chatBody");
      window.__akiniMedia && cb && window.__akiniMedia.resolve(cb);
    }, 8e3);
  } catch (t) {}
}),
  (window.__akiniSilentUrl = function () {
    try {
      if (window.__akiniSilentBlobUrl) return window.__akiniSilentBlobUrl;
      var t = 8e3,
        e = new ArrayBuffer(4800044),
        n = new DataView(e),
        i = function (t, e) {
          for (var i = 0; i < e.length; i++) n.setUint8(t + i, e.charCodeAt(i));
        };
      return (
        i(0, "RIFF"),
        n.setUint32(4, 4800036, !0),
        i(8, "WAVEfmt "),
        n.setUint32(16, 16, !0),
        n.setUint16(20, 1, !0),
        n.setUint16(22, 1, !0),
        n.setUint32(24, t, !0),
        n.setUint32(28, 2 * t, !0),
        n.setUint16(32, 2, !0),
        n.setUint16(34, 16, !0),
        i(36, "data"),
        n.setUint32(40, 48e5, !0),
        (window.__akiniSilentBlobUrl = URL.createObjectURL(
          new Blob([e], {
            type: "audio/wav",
          }),
        )),
        window.__akiniSilentBlobUrl
      );
    } catch (t) {
      return "";
    }
  }),
  (window.__akiniSilentOsc = function () {
    try {
      if (window.__akiniSilentCtx) return window.__akiniSilentCtx;
      var t = window.AudioContext || window.webkitAudioContext;
      if (!t) return null;
      var e = new t(),
        n = e.createOscillator(),
        i = e.createGain();
      return ((i.gain.value = 0), n.connect(i), i.connect(e.destination), n.start(), (window.__akiniSilentCtx = e), e);
    } catch (t) {
      return null;
    }
  }),
  document.addEventListener(
    "pointerdown",
    function () {
      try {
        var t = window.__akiniSilentCtx;
        if (t && "suspended" === t.state) {
          var e = t.resume();
          e && e.catch && e.catch(function () {});
        }
      } catch (t) {}
    },
    {
      passive: !0,
    },
  ),
  (window.__akiniReportErr = function (t, e) {
    try {
      ((window.__akiniDbgErr = t + ": " + String(e || "").slice(0, 80)), (window.__akiniDbgErrT = Date.now()));
    } catch (t) {}
  }),
  window.addEventListener("error", function (t) {
    try {
      t &&
        t.message &&
        window.__akiniReportErr(
          "JS错误",
          String(t.message).slice(0, 55) +
            " @" +
            String(t.filename || "")
              .split("/")
              .pop() +
            ":" +
            t.lineno,
        );
    } catch (t) {}
  }),
  window.addEventListener("unhandledrejection", function (t) {
    try {
      var e = t && t.reason,
        n = e && e.name ? e.name + " " : "";
      e && window.__akiniReportErr("Promise错误", n + String((e && e.message) || e).slice(0, 70));
    } catch (t) {}
  }),
  (window.__akiniStripTypingRows = __akiniStripTypingRows),
  (window.__akiniCountMsgRowsFast = __akiniCountMsgRowsFast),
  (window.__akiniIncTyping = __akiniIncTyping),
  (window.__akiniIncMedia = __akiniIncMedia),
  (window.__akiniIncCount = __akiniIncCount));
function setHtmlKeepInput(t, e) {
  if (t) {
    var n = t.querySelector('input[type="file"]'),
      i = t.getAttribute && t.getAttribute("for");
    if ("string" == typeof e) {
      var cm = (t.innerHTML || "").match(/<img[^>]*src=["']([^"']*)["']/i),
        em = e.match(/<img[^>]*src=["']([^"']*)["']/i);
      if (cm && em && cm[1] === em[1]) return;
      if ((t.innerHTML || "").replace(/<input[^>]*>/g, "").trim() === e.trim()) return;
    }
    ((t.innerHTML = e), n && (t.appendChild(n), i && t.setAttribute("for", i)));
  }
}
function requestPersistentStorage() {
  if (window.__akiniFileProtocol) console.warn("[Akini] 本地文件模式：跳过持久化存储请求");
  else if ("undefined" != typeof navigator && navigator.storage && navigator.storage.persist)
    try {
      var t = navigator.storage.persist();
      t &&
        "function" == typeof t.then &&
        t
          .then(function (t) {
            t || console.warn("[Akini] 浏览器未授予持久存储权限，重新进入页面可能导致数据丢失");
          })
          .catch(function (t) {
            console.warn("[Akini] 持久存储请求失败", t);
          });
    } catch (t) {
      console.warn("[Akini] 持久存储请求异常", t);
    }
}
