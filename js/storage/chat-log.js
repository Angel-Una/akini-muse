






(function () {
  "use strict";
  if (window.__akiniChatLog) return;

  var PREFIX = "akini_chat_history_";
  var _rows = {}; /* chatId -> [{ts,html}] */
  var _html = {}; /* chatId -> 已 join 的完整 HTML 缓存 */
  var _dirty = {};
  var _timers = {};
  var _stale = {}; /* 启动对账完成前读到的空数据，对账后必须重新水合 */
  


  var _order = [],
    _size = {},
    _htmlSize = {};
  var _BUDGET = (function () {
    try {
      var dm = navigator.deviceMemory || 0;
      if (dm && dm <= 2) return 6 * 1024 * 1024;
      if (dm && dm <= 4) return 10 * 1024 * 1024;
    } catch (e) {}
    return 14 * 1024 * 1024;
  })();
  function _rowsSize(a) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] && a[i].html ? a[i].html.length : 0) + 24;
    return s;
  }
  function _touch(id) {
    var i = _order.indexOf(id);
    if (i >= 0) _order.splice(i, 1);
    _order.push(id);
  }
  function _drop(id) {
    delete _rows[id];
    delete _html[id];
    delete _size[id];
    delete _htmlSize[id];
    var i = _order.indexOf(id);
    if (i >= 0) _order.splice(i, 1);
  }
  function _evict(keep) {
    var total = 0;
    for (var i = 0; i < _order.length; i++) {
      var k = _order[i];
      total += (_size[k] || 0) + (_htmlSize[k] || 0);
    }
    var guard = _order.length * 2;
    while (total > _BUDGET && _order.length > 1 && guard-- > 0) {
      var victim = _order[0];
      if (victim === keep || _stale[victim] || _dirty[victim] || _timers[victim]) {
        _order.push(_order.shift());
        continue;
      }
      var freed = (_size[victim] || 0) + (_htmlSize[victim] || 0);
      _drop(victim);
      total -= freed;
    }
  }

  var ROW_RE = /<div\b[^>]*class="[^"]*\bmsg-row\b[^"]*"[^>]*>/g;

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
      



      if (window.akiniStore && akiniStore.rawLSGet) return akiniStore.rawLSGet(key(id)) || "";
      return localStorage.getItem(key(id)) || "";
    } catch (e) {}
    return "";
  }

  function ensure(id) {
    if (_rows[id]) {
      _touch(id);
      return _rows[id];
    }
    var a = normalize(readRaw(id));
    /* 冷启动对账还没完成：这份快照可能是空的/只有刚发的一条，
       先标记待水合，等 akini-storage-restored 后与完整历史合并。 */
    if (!window.__akiniStorageRestored) _stale[id] = 1;
    /* 该会话的历史在 IDB 里被标记为「按需水合」（我们不希望启动时全量驻留）：
       内存里空数组不代表真的空，必须先读回完整历史再写，否则会把历史覆盖没。 */
    else {
      try {
        if (!a.length && window.__akiniDeferredKeys && window.__akiniDeferredKeys[key(id)]) _stale[id] = 1;
      } catch (eD) {}
    }
    /* 旧历史里的内联图片外置成 data-mh 占位，避免 JSON 里塞整段 base64 */
    for (var i = 0; i < a.length; i++) {
      try {
        if (window.__akiniStripMedia && a[i].html.indexOf("data:image") >= 0)
          a[i].html = window.__akiniStripMedia(a[i].html);
      } catch (e) {}
    }
    _rows[id] = a;
    _size[id] = _rowsSize(a);
    _touch(id);
    _evict(id);
    return a;
  }

  function invalidate(id) {
    delete _html[id];
    delete _htmlSize[id];
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
    /* 内存里没有任何新消息（只是被读过一次）：没有需要合并的东西，
       直接摘标记，绝不能为了「对账」把整段历史从 IDB 读进内存。 */
    if (!cur.length) {
      delete _stale[id];
      return;
    }
    var finish = function (raw) {
      var merged = mergeRows(normalize(raw), cur);
      delete _stale[id];
      /* 没有新行就不写：以前这里无条件 persist，deferred 会话内存里是空数组，
         会把 "[]" 写回去把完整历史清空（切会话后历史消失）。 */
      if (merged.length !== cur.length) {
        _rows[id] = merged;
        _size[id] = _rowsSize(merged);
        _touch(id);
        invalidate(id);
        persistSoon(id);
      }
    };
    var raw = readRaw(id);
    if (raw) {
      finish(raw);
      return;
    }
    /* deferred：正常同步读取拿不到内容，权威历史在 IndexedDB，按需读一次 */
    if (window._idbStore && window._idbStore.get) {
      try {
        window._idbStore.get(key(id), function (v) {
          try {
            finish(v || "");
          } catch (e) {}
        });
        return;
      } catch (e) {}
    }
    finish("");
  }

  function full(id) {
    if (typeof _html[id] === "string") return _html[id];
    var a = ensure(id);
    var s = "";
    for (var i = 0; i < a.length; i++) s += a[i].html;
    _html[id] = s;
    _htmlSize[id] = s.length;
    _touch(id);
    _evict(id);
    return s;
  }

  function tail(id, n) {
    var a = ensure(id);
    if (!n || n <= 0 || n >= a.length) return full(id);
    var s = "";
    for (var i = a.length - n; i < a.length; i++) s += a[i].html;
    return s;
  }
  /* 窗口化渲染：取 [start, end) 区间的行拼成 HTML，供上滑/下滑加载使用。
     不缓存（调用方按需取），避免和 full() 的整段缓存冲突。 */
  function range(id, start, end) {
    var a = ensure(id);
    if (start < 0) start = 0;
    if (end > a.length) end = a.length;
    if (start >= end) return "";
    var s = "";
    for (var i = start; i < end; i++) s += a[i].html;
    return s;
  }

  function count(id) {
    return ensure(id).length;
  }

  function last(id) {
    var a = _rows[id];
    if (a && a.length) return a[a.length - 1];
    /* 列表预览只需要最后一条：不水合整段数组，直接从 JSON 尾部切出最后一个对象。
       否则联系人一多，启动时光列表就要把所有会话的历史都解析进内存。 */
    var raw = readRaw(id);
    if (!raw) return null;
    try {
      var cut = raw.lastIndexOf("},{");
      if (cut > 0) return normObj(JSON.parse(raw.slice(cut + 2, raw.length - 1)));
    } catch (e) {}
    a = normalize(raw);
    return a.length ? a[a.length - 1] : null;
  }

  var _persisting = {};
  function _write(id, a) {
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
  function persist(id) {
    delete _timers[id];
    /* 没有任何内存数据（只是被读过/被调度过）：不要为了“合并”把整段历史读进内存。
       注意这里必须保留 _stale：之后如果有局部内容写回，还要靠它触发「先读回再合并」。 */
    if (_stale[id] && !((_rows[id] || []).length)) {
      delete _dirty[id];
      return;
    }
    /* 内存里只有增量、权威历史还在 IDB（启动期按需水合模式）：
       绝不能把短数组直接写回覆盖完整历史，先读回来合并再写。 */
    if (_stale[id] && window._idbStore && window._idbStore.get) {
      if (_persisting[id]) {
        _dirty[id] = 1;
        return;
      }
      _persisting[id] = 1;
      try {
        window._idbStore.get(key(id), function (raw) {
          delete _persisting[id];
          try {
            var cur = _rows[id] || [];
            var merged = mergeRows(normalize(raw), cur);
            delete _stale[id];
            _rows[id] = merged;
            _size[id] = _rowsSize(merged);
            _touch(id);
            invalidate(id);
            _write(id, merged);
          } catch (e) {}
        });
        return;
      } catch (e) {
        delete _persisting[id];
      }
    }
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
    _write(id, _rows[id] || []);
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
    var add = 0;
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var h = seg.html;
      try {
        if (window.__akiniStripMedia && h.indexOf("data:image") >= 0)
          h = window.__akiniStripMedia(h);
      } catch (e) {}
      a.push({ ts: seg.ts || tsOf(h), html: h });
      add += h.length + 24;
    }
    _size[id] = (_size[id] || 0) + add;
    invalidate(id);
    persistSoon(id);
  }

  function append(id, html) {
    if (!id || !html) return;
    pushRows(id, splitHtml(html));
  }

  /* opts: true 或 {silent, authoritative}
     silent        —— 内容刚从 IDB 读出来，不需要再整段写回；
     authoritative —— 这份就是完整历史（IDB/备份恢复），可以清掉待水合标记。 */
  function replace(id, v, opts) {
    var silent = opts === true || (opts && opts.silent);
    var authoritative = opts === true || (opts && opts.authoritative);
    var _loadedBefore = !!(_rows[id] && _rows[id].length);
    var _deferred = false;
    try {
      _deferred = !!(window.__akiniDeferredKeys && window.__akiniDeferredKeys[key(id)]);
    } catch (eD) {}
    var a = normalize(v);
    var old = full(id);
    /* 内容完全相同就不动，避免 restore/对账反复写库 */
    if (a.length && _rows[id] && a.length === _rows[id].length && a[_rows[id].length - 1].html === _rows[id][_rows[id].length - 1].html) {
      var joined = "";
      for (var i = 0; i < a.length; i++) joined += a[i].html;
      if (joined === old) return;
    }
    _rows[id] = a;
    _size[id] = _rowsSize(a);
    /* 只有确认是完整历史才摘掉待水合标记。普通 replace 的入参可能只是
       「内存为空 + 新内容」拼出来的局部字符串（会话被 LRU 淘汰/启动未加载），
       保留标记后 persist 会先读回 IDB 再合并，避免整段覆盖丢历史。 */
    if (authoritative && window.__akiniStorageRestored) delete _stale[id];
    else if (!authoritative && !_loadedBefore && _deferred && window.__akiniStorageRestored) _stale[id] = 1;
    _touch(id);
    _evict(id);
    invalidate(id);
    if (!silent) persistSoon(id);
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
    _size[id] = _rowsSize(a);
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
      _size[id] = _rowsSize(a);
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
      delete _size[k];
      delete _htmlSize[k];
      var oi = _order.indexOf(k);
      if (oi >= 0) _order.splice(oi, 1);
      delete _persisting[k];
    }
    if (!id) {
      _rows = {};
      _html = {};
      _dirty = {};
      _timers = {};
      _stale = {};
      _order = [];
      _size = {};
      _htmlSize = {};
      _persisting = {};
    }
  }

  window.__akiniChatLog = {
    key: key,
    rows: ensure,
    html: full,
    has: has,
    raw: readRaw,
    tail: tail,
    range: range,
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
