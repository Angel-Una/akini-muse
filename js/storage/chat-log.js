/*
 * 聊天历史：数组对象模型（对齐 milk/zy）
 * 每条消息是一个 { ts, html } 对象，追加是 O(1) push；
 * 渲染/备份需要字符串时才 join，不再整段拼接、整段正则清洗。
 * 存储仍写回 akini_chat_history_<id>，值为 JSON 数组；旧数据是 HTML 字符串，
 * 首次读取时自动按 msg-row 行边界拆成数组（无损迁移）。
 */
(function () {
  "use strict";
  if (window.__akiniChatLog) return;

  var PREFIX = "akini_chat_history_";
  var _rows = {}; /* chatId -> [{ts,html}] */
  var _html = {}; /* chatId -> 已 join 的完整 HTML 缓存 */
  var _dirty = {};
  var _timers = {};
  var _stale = {}; /* 启动对账完成前读到的空数据，对账后必须重新水合 */
  var ROW_RE = /<div\b[^>]*class="[^"]*\bmsg-row\b[^"]*"[^>]*>/g;
  /* 单会话历史上限：数组模型是内存里的权威副本，不设上限会随使用时间无限增长，
     最终启动时整段 HTML 注入 DOM / 反复 join 导致手机 OOM 闪退。
     只裁掉最旧的消息，最近 400 条 / 512KB 足够覆盖正常使用与滚动回看。 */
  var MAX_ROWS = 400;
  var MAX_CHARS = 512 * 1024;

  function key(id) {
    return PREFIX + id;
  }

  function tsOf(seg) {
    try {
      var m = seg.match(/data-ts="(\d+)"/);
      if (m) return parseInt(m[1], 10) || 0;
    } catch (e) {}
    return 0;
  }

  /* 按 msg-row 起始标签切段：消息行都是平级 div，不含嵌套 msg-row */
  function splitHtml(html) {
    var out = [];
    var m;
    var start = -1;
    ROW_RE.lastIndex = 0;
    while ((m = ROW_RE.exec(html))) {
      if (start >= 0) {
        var seg = html.slice(start, m.index);
        if (seg) out.push({ ts: tsOf(seg), html: seg });
      }
      start = m.index;
    }
    if (start >= 0) {
      var last = html.slice(start);
      if (last) out.push({ ts: tsOf(last), html: last });
    } else if (html && html.trim()) {
      out.push({ ts: 0, html: html });
    }
    return out;
  }

  function normObj(o) {
    if (!o || typeof o !== "object") return null;
    var h = typeof o.html === "string" ? o.html : typeof o.text === "string" ? o.text : "";
    if (!h) return null;
    return { ts: typeof o.ts === "number" ? o.ts : parseInt(o.ts, 10) || tsOf(h), html: h };
  }

  function normalize(v) {
    var out = [];
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) {
        var o = normObj(v[i]);
        if (o) out.push(o);
      }
      return out;
    }
    if (typeof v !== "string" || !v.trim()) return out;
    if (v.charAt(0) === "[") {
      try {
        var a = JSON.parse(v);
        if (Array.isArray(a)) return normalize(a);
      } catch (e) {}
    }
    return splitHtml(v);
  }

  function readRaw(id) {
    try {
      if (window.akiniStore && akiniStore.memoryGet) {
        var m = akiniStore.memoryGet(key(id));
        if (typeof m === "string" && m) return m;
      }
    } catch (e) {}
    try {
      return localStorage.getItem(key(id)) || "";
    } catch (e) {}
    return "";
  }

  function ensure(id) {
    if (_rows[id]) return _rows[id];
    var a = normalize(readRaw(id));
    /* 冷启动对账还没完成：这份快照可能是空的/只有刚发的一条，
       先标记待水合，等 akini-storage-restored 后与完整历史合并。 */
    if (!window.__akiniStorageRestored) _stale[id] = 1;
    /* 旧历史里的内联图片外置成 data-mh 占位，避免 JSON 里塞整段 base64 */
    for (var i = 0; i < a.length; i++) {
      try {
        if (window.__akiniStripMedia && a[i].html.indexOf("data:image") >= 0)
          a[i].html = window.__akiniStripMedia(a[i].html);
      } catch (e) {}
    }
    _rows[id] = a;
    if (enforce(id)) persistSoon(id);
    return a;
  }

  function invalidate(id) {
    delete _html[id];
  }

  /* 把单会话历史裁剪到条数 / 字符上限之内（从最旧的开始丢） */
  function enforce(id) {
    var a = _rows[id];
    if (!a || !a.length) return 0;
    var cut = a.length > MAX_ROWS ? a.length - MAX_ROWS : 0;
    var total = 0;
    for (var i = cut; i < a.length; i++) total += a[i].html.length;
    while (cut < a.length - 1 && total > MAX_CHARS) {
      total -= a[cut].html.length;
      cut++;
    }
    if (cut > 0) {
      a.splice(0, cut);
      invalidate(id);
    }
    return cut;
  }

  function has(id) {
    if (_rows[id] && _rows[id].length) return true;
    var raw = readRaw(id);
    return !!raw && raw !== "[]" && raw !== "null" && raw !== "undefined";
  }

  /* 合并两份数组：以完整历史 base 为准，把启动对账前新增的消息补到末尾。
     用 ts+html 去重，避免同一条消息出现两遍。 */
  function mergeRows(base, extra) {
    var seen = {};
    var out = [];
    function add(o) {
      var k = (o.ts || 0) + "|" + o.html;
      if (seen[k]) return;
      seen[k] = 1;
      out.push(o);
    }
    for (var i = 0; i < base.length; i++) add(base[i]);
    for (var j = 0; j < extra.length; j++) add(extra[j]);
    return out;
  }

  /* 启动对账完成后：把对账前读到的旧快照替换成权威历史，并保留期间新增的消息 */
  function rehydrate(id) {
    if (!_stale[id]) return;
    var cur = _rows[id] || [];
    var merged = mergeRows(normalize(readRaw(id)), cur);
    delete _stale[id];
    if (merged.length !== cur.length) {
      _rows[id] = merged;
      invalidate(id);
    }
    persistSoon(id);
  }

  function full(id) {
    if (typeof _html[id] === "string") return _html[id];
    var a = ensure(id);
    var s = "";
    for (var i = 0; i < a.length; i++) s += a[i].html;
    _html[id] = s;
    return s;
  }

  function tail(id, n) {
    var a = ensure(id);
    if (!n || n <= 0 || n >= a.length) return full(id);
    var s = "";
    for (var i = a.length - n; i < a.length; i++) s += a[i].html;
    return s;
  }

  function count(id) {
    return ensure(id).length;
  }

  function last(id) {
    var a = ensure(id);
    return a.length ? a[a.length - 1] : null;
  }

  function persist(id) {
    /* 对账完成前写回会把「只有新消息」的短数组覆盖到完整历史上（表现就是聊天消失）。
       先不落盘，等 akini-storage-restored 合并后再写。 */
    if (_stale[id] && !window.__akiniStorageRestored) {
      delete _timers[id];
      _dirty[id] = 1;
      _timers[id] = setTimeout(function () {
        persist(id);
      }, 800);
      return;
    }
    delete _timers[id];
    enforce(id);
    var a = _rows[id] || [];
    var json = "[]";
    try {
      json = JSON.stringify(a);
    } catch (e) {}
    try {
      if (window.akiniStore && typeof akiniStore.set === "function")
        akiniStore.set(key(id), json, null, { authoritative: true, rows: a.length });
      else localStorage.setItem(key(id), json);
    } catch (e) {}
    delete _dirty[id];
  }

  function persistSoon(id) {
    _dirty[id] = 1;
    if (_timers[id]) clearTimeout(_timers[id]);
    _timers[id] = setTimeout(function () {
      persist(id);
    }, 300);
  }

  function pushRows(id, segments) {
    if (!segments || !segments.length) return;
    var a = ensure(id);
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var h = seg.html;
      try {
        if (window.__akiniStripMedia && h.indexOf("data:image") >= 0)
          h = window.__akiniStripMedia(h);
      } catch (e) {}
      a.push({ ts: seg.ts || tsOf(h), html: h });
    }
    enforce(id);
    invalidate(id);
    persistSoon(id);
  }

  function append(id, html) {
    if (!id || !html) return;
    pushRows(id, splitHtml(html));
  }

  function replace(id, v) {
    var a = normalize(v);
    var old = full(id);
    /* 内容完全相同就不动，避免 restore/对账反复写库 */
    if (a.length && _rows[id] && a.length === _rows[id].length && a[_rows[id].length - 1].html === _rows[id][_rows[id].length - 1].html) {
      var joined = "";
      for (var i = 0; i < a.length; i++) joined += a[i].html;
      if (joined === old) return;
    }
    _rows[id] = a;
    enforce(id);
    invalidate(id);
    persistSoon(id);
  }

  /* session.messagesHTML 的兼容入口：整体字符串写回时，
     是「在旧内容后面追加」就只 push 新增的行，否则整段替换。 */
  function setFromHtml(id, s) {
    if (!id || typeof s !== "string") return;
    var cur = full(id);
    if (s === cur) return;
    if (cur && s.length >= cur.length && s.indexOf(cur) === 0) {
      append(id, s.slice(cur.length));
      return;
    }
    replace(id, s);
  }

  function flush() {
    var ids = Object.keys(_dirty);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (_timers[id]) {
        clearTimeout(_timers[id]);
        delete _timers[id];
      }
      persist(id);
    }
  }
  function trim(id, maxRows) {
    var a = ensure(id);
    if (!maxRows || a.length <= maxRows) return 0;
    var cut = a.length - maxRows;
    a.splice(0, cut);
    invalidate(id);
    persistSoon(id);
    return cut;
  }

  /* 把某段 HTML/文本替换应用到所有行（头像地址替换等功能） */
  function mapRows(id, fn) {
    var a = ensure(id);
    var changed = false;
    for (var i = 0; i < a.length; i++) {
      try {
        var nv = fn(a[i].html, a[i]);
        if (nv && nv !== a[i].html) {
          a[i].html = nv;
          a[i].ts = tsOf(nv) || a[i].ts;
          changed = true;
        }
      } catch (e) {}
    }
    if (changed) {
      invalidate(id);
      persistSoon(id);
    }
    return changed;
  }

  /* 导入/清空数据时丢弃内存快照，避免刷新前的 pagehide flush 把旧数组写回覆盖导入值 */
  function reset(id) {
    var ids = id ? [id] : Object.keys(_rows).concat(Object.keys(_timers), Object.keys(_dirty), Object.keys(_stale));
    for (var i = 0; i < ids.length; i++) {
      var k = ids[i];
      if (_timers[k]) clearTimeout(_timers[k]);
      delete _timers[k];
      delete _dirty[k];
      delete _stale[k];
      delete _rows[k];
      delete _html[k];
    }
    if (!id) {
      _rows = {};
      _html = {};
      _dirty = {};
      _timers = {};
      _stale = {};
    }
  }

  window.__akiniChatLog = {
    key: key,
    rows: ensure,
    html: full,
    has: has,
    raw: readRaw,
    tail: tail,
    count: count,
    last: last,
    append: append,
    replace: replace,
    setFromHtml: setFromHtml,
    trim: trim,
    mapRows: mapRows,
    persist: persist,
    schedule: persistSoon,
    flush: flush,
    reset: reset,
  };

  /* 让 session.messagesHTML 变成数组模型的视图：
     读 = 现 join，写 = 增量追加/整段替换。 */
  var _bound = new WeakMap();
  window.__akiniBindChatHTML = function (sess, id) {
    if (!sess || typeof sess !== "object") return sess;
    try {
      if (_bound.get(sess) === id) return sess;
      Object.defineProperty(sess, "messagesHTML", {
        configurable: true,
        enumerable: true,
        get: function () {
          return window.__akiniChatLog ? window.__akiniChatLog.html(id) : "";
        },
        set: function (v) {
          if (window.__akiniChatLog) window.__akiniChatLog.setFromHtml(id, v);
        },
      });
      _bound.set(sess, id);
    } catch (e) {}
    return sess;
  };

  /* 确保启动/切会话时落盘缓冲区能及时写出 */
  try {
    window.addEventListener("pagehide", function () {
      flush();
    });
    window.addEventListener("beforeunload", function () {
      flush();
    });
    window.__akiniOnHidden(function () { flush(); });
    window.addEventListener("akini-storage-restored", function () {
      Object.keys(_stale).forEach(function (id) {
        try {
          rehydrate(id);
        } catch (e) {}
      });
      flush();
    });
  } catch (e) {}
})();
