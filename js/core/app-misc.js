(function () {
  try {
    [
      "akini_preview_bubble_left",
      "akini_preview_bubble_right",
      "akini_my_avatar",
      "akini_ta_avatar",
      "akini_icity_my_avatar",
      "akini_icity_ta_avatar",
    ].forEach(function (k) {
      var _v = localStorage.getItem(k);
      if (_v === "null" || _v === "undefined") localStorage.removeItem(k);
    });
  } catch (e) {}
  const KEY = "akini_preview_contact_id";
  const BUBBLE_LEFT_KEY = "akini_preview_bubble_left";
  const BUBBLE_RIGHT_KEY = "akini_preview_bubble_right";
  const LYRIC_TITLE_KEY = "akini_lyric_title";
  const LYRIC_ARTIST_KEY = "akini_lyric_artist";
  const LYRIC_QUOTE_KEY = "akini_lyric_quote";
  const DEFAULT_LEFT = "";
  const DEFAULT_RIGHT = "";
  const LYRIC_TITLE_DEFAULT = "罗生门";
  const LYRIC_ARTIST_DEFAULT = "张子豪";
  const LYRIC_QUOTE_DEFAULT = "想知道你会不会太冷";
  function $(id) {
    return document.getElementById(id);
  }
  function __akiniIsDefAv(s) {
    if (s == null) return true;
    s = String(s).trim();
    if (!s || s === "null" || s === "undefined") return true;
    s = s.replace(/️/g, "");
    var a = Array.from(s);
    return a.length <= 2 && !/^[a-zA-Z0-9一-鿿]+$/.test(s);
  }
  window.__akiniLineAvatarImg =
    window.__akiniLineAvatarImg ||
    function () {
      var u =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#f7f8fa"/><circle cx="40" cy="29" r="14" fill="none" stroke="#5a5e66" stroke-width="1.5"/><path d="M12 76c4-17 14-26 28-26s24 9 28 26" fill="none" stroke="#5a5e66" stroke-width="1.5" stroke-linecap="round"/></svg>',
        );
      return '<img src="' + u + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    };
  function __akiniAvOrLine(v) {
    return __akiniIsDefAv(v) ? window.__akiniLineAvatarImg() : v;
  }
  function it(t, e) {
    if (((e = e || ""), !t || "string" != typeof t)) return __akiniAvOrLine(e);
    t = t.trim();
    if (!t || t === "null" || t === "undefined") return __akiniAvOrLine(e);
    if (0 === t.indexOf("<img")) {
      var n = t.match(/src="([^"]*)"/);
      if (!n || !n[1]) return __akiniAvOrLine(e);
      t = n[1];
    }
    return 0 === t.indexOf("data:") || 0 === t.indexOf("http")
      ? '<img src="' +
          t.replace(/"/g, "&quot;") +
          '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
      : __akiniAvOrLine(t);
  }
  /* 头像取值工具：从任意写法里取出真实图片地址；再判断它是否真的是照片，
     避免把「灰线人形 SVG / 预设头像」当成用户设置的真实头像直接渲染成默认图。 */
  function _akiniRawAv(s) {
    if (s == null) return "";
    s = String(s).trim();
    if (!s || s === "null" || s === "undefined") return "";
    if (0 === s.indexOf("<img")) {
      var m = s.match(/src="([^"]*)"/);
      s = m && m[1] ? m[1] : "";
    }
    return s || "";
  }
  function _akiniIsPhoto(v) {
    v = _akiniRawAv(v);
    if (!v) return false;
    if (0 !== v.indexOf("data:image") && 0 !== v.indexOf("http") && 0 !== v.indexOf("blob:")) return false;
    if (0 === v.indexOf("data:image/svg")) return false;
    try {
      if (window.__akiniIsDefaultAvatarToken && window.__akiniIsDefaultAvatarToken(v)) return false;
    } catch (e) {}
    try {
      if (window.AKINI_PRESET_COLOR_AVATAR && v === window.AKINI_PRESET_COLOR_AVATAR) return false;
    } catch (e) {}
    return true;
  }
  function _akiniPickPhoto(list, fallbackHtml) {
    for (var i = 0; i < list.length; i++) {
      if (_akiniIsPhoto(list[i])) return it(_akiniRawAv(list[i]), "");
    }
    for (var j = 0; j < list.length; j++) {
      var a = _akiniRawAv(list[j]);
      if (a) return it(a, fallbackHtml || "");
    }
    return fallbackHtml !== undefined ? fallbackHtml : window.__akiniLineAvatarImg();
  }
  window.getContacts = function getContacts() {
    if (window.akiniContacts && window.akiniContacts.getContacts) {
      var api = window.akiniContacts.getContacts();
      if (Array.isArray(api) && api.length) return api;
    }
    try {
      var ls = JSON.parse(localStorage.getItem("akini_contacts") || "[]");
      if (Array.isArray(ls) && ls.length) return ls;
    } catch (e) {}
    return [];
  };
  function getSelectedContactId() {
    var contacts = getContacts();
    if (!contacts.length) return null;
    var dc = window.__akiniDefaultContact && window.__akiniDefaultContact();
    if (dc && dc.id) return dc.id;
    var def = contacts[0];
    return def && def.id ? def.id : null;
  }
  function getContactById(id) {
    if (window.akiniContacts && window.akiniContacts.getChatTarget) {
      var api = window.akiniContacts.getChatTarget(id);
      if (api) return api;
    }
    var contacts = getContacts();
    for (var i = 0; i < contacts.length; i++) if (contacts[i].id === id) return contacts[i];
    return null;
  }
  window.__akAvatarPH =
    (window.__akiniLineAvatarImg ? window.__akiniLineAvatarImg() : "") ||
    '<span style="display:inline-flex;width:100%;height:100%;align-items:center;justify-content:center;background:#ececec;border-radius:50%"></span>';
  function isSwapped() {
    var t = localStorage.getItem("akini_swap_avatar_pos");
    return "true" === t || "1" === t;
  }
  function updatePreview() {
    var id = getSelectedContactId();
    var contactAvatar = id
      ? window.getTaAvatar(id)
      : _akiniPickPhoto(
          [
            (function () {
              try {
                return localStorage.getItem("akini_ta_avatar");
              } catch (e) {
                return "";
              }
            })(),
            (function () {
              try {
                return localStorage.getItem("akini_icity_ta_avatar");
              } catch (e) {
                return "";
              }
            })(),
          ],
          window.__akAvatarPH || window.__akiniLineAvatarImg(),
        );
    var myAvatar = getMyAvatar();
    var swapped = isSwapped();
    var leftA = $("previewAvatarLeft");
    if (leftA) leftA.innerHTML = swapped ? contactAvatar : myAvatar;
    var rightA = $("previewAvatarRight");
    if (rightA) rightA.innerHTML = swapped ? myAvatar : contactAvatar;
  }
  window.updateChatPreview = updatePreview;
  (function () {
    var t = null;
    function refresh() {
      if (t) return;
      t = setTimeout(function () {
        t = null;
        try {
          updatePreview();
        } catch (e) {}
      }, 60);
    }
    try {
      window.addEventListener("akini-img-ready", refresh);
    } catch (e) {}
    try {
      window.addEventListener("pageshow", refresh);
    } catch (e) {}
    try {
      window.addEventListener("storage", function (e) {
        if (!e || !e.key || 0 === e.key.indexOf("akini_")) refresh();
      });
    } catch (e) {}
  })();
  function updateSelectOptions() {
    var sel = $("selectChatPreviewContact");
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML = "";
    var contacts = getContacts();
    if (!contacts.length) return;
    contacts.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name || "对方";
      sel.appendChild(opt);
    });
    var id = getSelectedContactId();
    var exists = contacts.some(function (c) {
      return c.id === id;
    });
    sel.value = exists
      ? id
      : prev &&
          contacts.some(function (c) {
            return c.id === prev;
          })
        ? prev
        : contacts[0] && contacts[0].id;
    if (sel.value) {
      try {
        localStorage.setItem(KEY, sel.value);
      } catch (e) {}
    }
  }
  function applyPreviewWrap(b) {
    if (!b) return;
    b.classList.add("no-wrap");
    var _t = (b.textContent || "").trim();
    b.classList.toggle("is-empty", !_t);
  }
  /* 预览气泡硬性限制：去换行、最多 8 个字，截断后光标移到末尾 */
  function clampPreviewBubble(b) {
    if (!b) return false;
    if (b.__composing) return false; /* 中文输入法组合期间绝不动 DOM，否则正在输入的文字会被吃掉 */
    var t = (b.textContent || "").replace(/[\r\n]+/g, "");
    if (t.length > 8) t = t.slice(0, 8);
    if (t !== (b.textContent || "")) {
      b.textContent = t;
      applyPreviewWrap(b);
      try {
        var r = document.createRange();
        r.selectNodeContents(b);
        r.collapse(false);
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      } catch (e) {}
      return true;
    }
    return false;
  }
  function cleanPreviewText(v) {
    if (!v || v === "null" || v === "undefined") return "";
    return String(v)
      .replace(/[\r\n]+/g, "")
      .slice(0, 8);
  }
  function updatePreviewBubbles() {
    var leftB = $("previewBubbleLeft");
    var rightB = $("previewBubbleRight");
    if (leftB) {
      var v = localStorage.getItem(BUBBLE_LEFT_KEY);
      if (v === "null" || v === "undefined") {
        try {
          localStorage.removeItem(BUBBLE_LEFT_KEY);
        } catch (e) {}
        v = null;
      }
      leftB.textContent = cleanPreviewText(v);
      if (!leftB.textContent.trim()) leftB.textContent = DEFAULT_LEFT;
    }
    if (rightB) {
      var v2 = localStorage.getItem(BUBBLE_RIGHT_KEY);
      if (v2 === "null" || v2 === "undefined") {
        try {
          localStorage.removeItem(BUBBLE_RIGHT_KEY);
        } catch (e) {}
        v2 = null;
      }
      rightB.textContent = cleanPreviewText(v2);
      if (!rightB.textContent.trim()) rightB.textContent = DEFAULT_RIGHT;
    }
    applyPreviewWrap(leftB);
    applyPreviewWrap(rightB);
  }
  function updateLyricCard() {
    var t = $("lyricTitle");
    var a = $("lyricArtist");
    var q = $("lyricQuote");
    if (t) {
      var v = localStorage.getItem(LYRIC_TITLE_KEY);
      t.textContent = v || LYRIC_TITLE_DEFAULT;
    }
    if (a) {
      var v = localStorage.getItem(LYRIC_ARTIST_KEY);
      a.textContent = v || LYRIC_ARTIST_DEFAULT;
    }
    if (q) {
      var v = localStorage.getItem(LYRIC_QUOTE_KEY);
      q.textContent = v || LYRIC_QUOTE_DEFAULT;
    }
  }
  function saveLyricCard() {
    var t = $("lyricTitle");
    var a = $("lyricArtist");
    var q = $("lyricQuote");
    try {
      if (t) localStorage.setItem(LYRIC_TITLE_KEY, t.textContent.trim());
      if (a) localStorage.setItem(LYRIC_ARTIST_KEY, a.textContent.trim());
      if (q) localStorage.setItem(LYRIC_QUOTE_KEY, q.textContent.trim());
    } catch (e) {}
  }
  function resetLyricCard() {
    try {
      localStorage.removeItem(LYRIC_TITLE_KEY);
      localStorage.removeItem(LYRIC_ARTIST_KEY);
      localStorage.removeItem(LYRIC_QUOTE_KEY);
    } catch (e) {}
    updateLyricCard();
  }
  document.addEventListener("DOMContentLoaded", function () {
    updateSelectOptions();
    updatePreviewBubbles();
    updateLyricCard();
    updatePreview();
    try {
      var _ba = document.getElementById("beautifyArea");
      if (_ba && window.MutationObserver) {
        new MutationObserver(function () {
          try {
            if (_ba.style.display !== "none") {
              updateSelectOptions();
              updatePreview();
            }
          } catch (e) {}
        }).observe(_ba, { attributes: true, attributeFilter: ["style"] });
      }
    } catch (e) {}
    var sel = $("selectChatPreviewContact");
    if (sel) {
      sel.addEventListener("change", function () {
        var id = sel.value;
        localStorage.setItem(KEY, id);
        updatePreview();
      });
    }
    var leftB = $("previewBubbleLeft");
    var rightB = $("previewBubbleRight");
    function savePreviewBubbles() {
      if (leftB)
        try {
          localStorage.setItem(BUBBLE_LEFT_KEY, leftB.textContent.trim());
        } catch (e) {}
      if (rightB)
        try {
          localStorage.setItem(BUBBLE_RIGHT_KEY, rightB.textContent.trim());
        } catch (e) {}
      applyPreviewWrap(leftB);
      applyPreviewWrap(rightB);
    }
    function bindBubble(b) {
      if (!b) return;
      // 移动端/触摸屏点击兜底：确保点中气泡即可调起输入法与进入编辑态
      b.addEventListener("click", function (e) {
        try {
          if (document.activeElement !== b) {
            b.focus();
            var r = document.createRange();
            r.selectNodeContents(b);
            r.collapse(false);
            var s = window.getSelection();
            if (s) {
              s.removeAllRanges();
              s.addRange(r);
            }
          }
        } catch (err) {}
      });
      b.addEventListener("blur", savePreviewBubbles);
      b.addEventListener("focusout", savePreviewBubbles);
      b.addEventListener("compositionstart", function () {
        b.__composing = true;
      });
      b.addEventListener("compositionend", function () {
        b.__composing = false;
        clampPreviewBubble(b);
        savePreviewBubbles();
      });
      b.addEventListener("input", function () {
        if (b.__composing) return;
        clampPreviewBubble(b);
        savePreviewBubbles();
      });
      b.addEventListener("keyup", function () {
        if (b.__composing) return;
        clampPreviewBubble(b);
        savePreviewBubbles();
      });
      // beforeinput：iOS 部分输入法换行不触发 keydown，必须在这里拦截插入段落/换行
      b.addEventListener("beforeinput", function (e) {
        try {
          var it = (e && e.inputType) || "";
          if (it === "insertParagraph" || it === "insertLineBreak") {
            e.preventDefault();
            b.blur();
            return;
          }
          if (it === "insertText" && e.data && /[\r\n]/.test(e.data)) {
            e.preventDefault();
            return;
          }
        } catch (x) {}
      });
      b.addEventListener("paste", function (e) {
        try {
          e.preventDefault();
          var t = (e.clipboardData || window.clipboardData).getData("text") || "";
          t = t.replace(/[\r\n]+/g, "").slice(0, 8);
          document.execCommand("insertText", false, t);
        } catch (x) {}
        clampPreviewBubble(b);
        savePreviewBubbles();
      });
      b.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          b.blur();
          return;
        }
        // 已达 8 字且未选中任何文字时，禁止继续输入可打印字符
        if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          var t = b.textContent || "";
          var sel = window.getSelection && window.getSelection();
          var hasSel = sel && !sel.isCollapsed;
          if (t.length >= 8 && !hasSel) e.preventDefault();
        }
      });
      clampPreviewBubble(b);
    }
    bindBubble(leftB);
    bindBubble(rightB);
    var lyricT = $("lyricTitle");
    var lyricA = $("lyricArtist");
    var lyricQ = $("lyricQuote");
    var lyricR = $("lyricResetBtn");
    [lyricT, lyricA, lyricQ].forEach(function (el) {
      if (el) {
        el.addEventListener("blur", saveLyricCard);
        el.addEventListener("input", saveLyricCard);
        el.addEventListener("keyup", saveLyricCard);
        el.addEventListener("paste", saveLyricCard);
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            el.blur();
          }
        });
      }
    });
    if (lyricR) {
      lyricR.addEventListener("click", function (e) {
        resetLyricCard();
      });
    }
    /* 不再在 pagehide/beforeunload/隐藏时保存：导入备份后页面不刷新，
       此时 DOM 里还是导入前的旧气泡文案，隐藏时回写会把刚导入的预览覆盖掉。
       气泡/歌词在 input、keyup、paste、compositionend、blur 时已实时保存。 */
    window.addEventListener("akini-data-imported", function () {
      try {
        updatePreviewBubbles();
        updateLyricCard();
        updatePreview();
      } catch (e) {}
    });
    /* 气泡与歌词在 input/keyup/paste/compositionend/blur 时实时保存，
       取消原来 60s 定时写入（滚动时的同步 localStorage 写入是掉帧来源之一）。 */
  });
})();

(function () {
  var MAP_KEY = "akini_msg_mb";
  var PROCESSED_KEY = "akini_msg_mb_processed"; /* 记录联系人已摇过的消息 ts，避免重复摇 */

  function rd(k, d) {
    /* localStorage 与内存镜像取并集，绝不因为某一层是旧的空表就丢掉另一层的数据 */
    var a = null,
      b = null;
    try {
      var raw = localStorage.getItem(k);
      if (raw != null) a = JSON.parse(raw);
    } catch (e) {}
    try {
      var m = window.akiniStore && window.akiniStore.memoryGet ? window.akiniStore.memoryGet(k) : null;
      if (m) b = JSON.parse(m);
    } catch (e) {}
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      var out = {},
        cid;
      for (cid in a) {
        if (Object.prototype.hasOwnProperty.call(a, cid)) out[cid] = a[cid];
      }
      for (cid in b) {
        if (!Object.prototype.hasOwnProperty.call(b, cid)) continue;
        if (!out[cid]) {
          out[cid] = b[cid];
          continue;
        }
        if (typeof out[cid] === "object" && typeof b[cid] === "object") {
          for (var kk in b[cid]) {
            if (!Object.prototype.hasOwnProperty.call(out[cid], kk)) out[cid][kk] = b[cid][kk];
          }
        }
      }
      return out;
    }
    return a || b || d;
  }
  function wr(k, v) {
    var str;
    try {
      str = JSON.stringify(v);
    } catch (e) {
      return;
    }
    /* 原生 式：同步写 localStorage，再写内存镜像和 IndexedDB 兜底，不做多层合并/仲裁 */
    try {
      localStorage.setItem(k, str);
    } catch (e) {}
    try {
      window.akiniStore && window.akiniStore.memorySet && window.akiniStore.memorySet(k, str);
    } catch (e) {}
    try {
      window._idbStore && window._idbStore.set && window._idbStore.set(k, str);
    } catch (e) {}
  }
  var _dirty = 0;
  function curCid() {
    try {
      return window.akiniContacts && window.akiniContacts.getActiveChatId
        ? String(window.akiniContacts.getActiveChatId() || "")
        : "";
    } catch (e) {
      return "";
    }
  }
  function mapAll() {
    var m = rd(MAP_KEY, {});
    return m && typeof m === "object" && !Array.isArray(m) ? m : {};
  }
  function cidMap(m, id) {
    var x = m[id];
    return x && typeof x === "object" && !Array.isArray(x) ? x : {};
  }

  function bubblePool() {
    var arr = [];
    try {
      arr = rd("akini_wordbank", []);
    } catch (e) {
      arr = [];
    }
    var seen = {},
      pool = [];
    (Array.isArray(arr) ? arr : []).forEach(function (it) {
      if (!it || typeof it !== "object") return;
      if ((it.tab || "main") !== "bubble") return;
      var t = String(it.text || it.content || "").trim();
      if (!t || seen[t]) return;
      if (window.__wbIsBlocked && window.__wbIsBlocked("bubble", t)) return;
      seen[t] = 1;
      pool.push(t);
    });
    return pool;
  }
  function pick() {
    var pool = bubblePool();
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "";
  }

  function apply(row, mp) {
    if (!row || !row.getAttribute) return;
    var ts = row.getAttribute("data-ts");
    var bubble = row.querySelector(".bubble");
    if (!bubble) return;
    /* 小气泡只禁止出现在转账/问卷/商店/音乐卡片上；表情包、图片、视频、语音气泡允许贴小气泡 */
    var CARD_CLS = /transfer-bubble|survey-bubble|shop-card-bubble|music-invite-bubble|music-end-bubble/;
    if (CARD_CLS.test(bubble.className)) {
      if (bubble.hasAttribute("data-mb")) bubble.removeAttribute("data-mb");
      row.classList.remove("has-mini-bubble");
      return;
    }
    var txt = ts ? mp[ts] : "";
    if (txt) {
      if (bubble.getAttribute("data-mb") !== String(txt)) bubble.setAttribute("data-mb", String(txt));
      row.classList.add("has-mini-bubble");
    } else {
      /* 数据还没水合完成时不要急着把小气泡从界面上摘掉（那看起来就是"重进后消失"） */
      if (!window.__akiniStorageRestored) return;
      if (bubble.hasAttribute("data-mb")) bubble.removeAttribute("data-mb");
      row.classList.remove("has-mini-bubble");
    }
  }

  var busy = false;
  function processedAll() {
    var m = rd(PROCESSED_KEY, {});
    return m && typeof m === "object" && !Array.isArray(m) ? m : {};
  }
  function scan() {
    if (busy) return;
    var body = document.getElementById("chatBody");
    if (!body) return;
    var id = curCid();
    if (!id) return;
    busy = true;
    try {
      var rows = body.querySelectorAll(".msg-row");
      if (!rows.length) return;
      var all = mapAll(),
        mp = cidMap(all, id);
      /* 启动期内存/本地还没水合完时读到的是空表：此时绝不能写回，否则会把真实的
         小气泡表整个覆盖掉（表现为"重进后小气泡莫名消失一部分"） */
      var _notReady = !Object.keys(all).length && !window.__akiniStorageRestored;
      var pa = processedAll(),
        pp = cidMap(pa, id); /* pp: 本会话已被联系人摇过的 ts 集合 {ts:true} */
      var changed = false,
        ppChanged = false;
      rows.forEach(function (r) {
        var ts = r.getAttribute("data-ts");
        if (!ts) return;
        if (r.classList.contains("system")) return;
        var b = r.querySelector(".bubble");
        if (!b) return;
        /* 只有转账/问卷/商店/音乐卡片不参与小气泡；表情包/图片/视频/语音允许 */
        if (/transfer-bubble|survey-bubble|shop-card-bubble|music-invite-bubble|music-end-bubble/.test(b.className))
          return;
        /* 联系人每条消息只摇一次（不论我是否手动贴过），用 PROCESSED_KEY 记录 */
        if (_notReady || pp[ts]) return;
        pp[ts] = true;
        ppChanged = true;
        /* 按概率摇小气泡；摇中则覆盖已有（联系人后贴的覆盖我手动贴的，显示最新） */
        var p = window.AKR && window.AKR.getProb ? window.AKR.getProb("miniBubble") : 0.1;
        if (Math.random() >= p) return;
        var t = pick();
        if (t && !mp[ts]) {
          mp[ts] = t;
          changed = true;
        }
      });
      if (!_notReady) {
        if (changed || _dirty) {
          all[id] = mp;
          wr(MAP_KEY, all);
          _dirty = 0;
        }
        if (ppChanged) {
          pa[id] = pp;
          wr(PROCESSED_KEY, pa);
        }
      }
      rows.forEach(function (r) {
        apply(r, mp);
      });
    } catch (e) {
    } finally {
      busy = false;
    }
  }

  /* 只上屏、不摇骰子、不写盘：重进/重渲染/水合完成后都能把已有小气泡贴回去 */
  function applyAll() {
    try {
      var body = document.getElementById("chatBody");
      if (!body) return;
      var id = curCid();
      if (!id) return;
      var mp = cidMap(mapAll(), id);
      var rows = body.querySelectorAll(".msg-row");
      for (var i = 0; i < rows.length; i++) apply(rows[i], mp);
    } catch (e) {}
  }

  function setFor(row, text) {
    if (!row) return false;
    var id = curCid();
    if (!id) return false;
    var ts = row.getAttribute("data-ts");
    if (!ts) return false;
    var all = mapAll(),
      mp = cidMap(all, id);
    text = String(text || "").trim();
    if (text) {
      mp[ts] = text;
    } else {
      delete mp[ts];
    }
    all[id] = mp;
    wr(MAP_KEY, all);
    apply(row, mp);
    return true;
  }

  function openPicker(row) {
    if (!row) return;
    var id = curCid();
    if (!id) {
      window.__akiniToast && window.__akiniToast("请先进入聊天");
      return;
    }
    var old = document.getElementById("akiniMbPicker");
    if (old) old.remove();
    var ts = row.getAttribute("data-ts");
    var cur = "";
    try {
      cur = cidMap(mapAll(), id)[ts] || "";
    } catch (e) {}

    var wrap = document.createElement("div");
    wrap.id = "akiniMbPicker";
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;";
    var inner = document.createElement("div");
    inner.style.cssText =
      "width:100%;max-width:480px;background:#fff;border-radius:20px 20px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:12px;box-sizing:border-box;";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;flex-shrink:0;";
    var title = document.createElement("div");
    title.style.cssText = "font-size:16px;font-weight:700;color:#1a1a1a";
    title.textContent = "添加小气泡";
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "✕";
    close.style.cssText = "border:none;background:none;font-size:20px;color:#999;cursor:pointer;padding:0 4px;";
    close.addEventListener("click", function () {
      wrap.remove();
    });
    head.appendChild(title);
    head.appendChild(close);

    var input = document.createElement("input");
    input.type = "text";
    input.maxLength = 20;
    input.placeholder = "输入小气泡内容…";
    input.value = cur || "";
    input.style.cssText =
      "width:100%;box-sizing:border-box;padding:12px 14px;border-radius:13px;border:1.5px solid #000;background:#fff;color:#000;font-size:15px;outline:none;";

    var tip = document.createElement("div");
    tip.style.cssText = "font-size:11px;color:#999;flex-shrink:0;line-height:1.5;";
    tip.textContent = "自己输入的小气泡只在这条消息上显示；联系人会从字卡库「小气泡」随机抽内容";

    var confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "确定";
    confirmBtn.style.cssText =
      "width:100%;padding:12px;border-radius:13px;border:none;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;cursor:pointer;flex-shrink:0;";
    function doConfirm() {
      var t = input.value;
      if (!t || !t.trim()) {
        input.focus();
        return;
      }
      if (setFor(row, t)) {
        wrap.remove();
        window.__akiniToast && window.__akiniToast("✓ 已添加小气泡");
      }
    }
    confirmBtn.addEventListener("click", doConfirm);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        doConfirm();
      }
    });

    inner.appendChild(head);
    inner.appendChild(input);
    inner.appendChild(tip);

    if (cur) {
      var rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "移除当前小气泡";
      rm.style.cssText =
        "width:100%;padding:11px;border-radius:13px;border:1.5px solid #f0c4c4;background:#fff5f5;color:#c0392b;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;";
      rm.addEventListener("click", function () {
        setFor(row, "");
        wrap.remove();
        window.__akiniToast && window.__akiniToast("已移除小气泡");
      });
      inner.appendChild(rm);
    }

    inner.appendChild(confirmBtn);
    wrap.appendChild(inner);
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) wrap.remove();
    });
    document.body.appendChild(wrap);
    setTimeout(function () {
      try {
        input.focus();
      } catch (e) {}
    }, 80);
  }
  window.__akiniOpenMiniBubblePicker = openPicker;

  function boot() {
    var body = document.getElementById("chatBody");
    if (body && body !== _mbObsBody) {
      _mbObsBody = body;
      body.__mbObs = 1;
      try {
        var _mbScanTimer = null,
          _mbApplyRaf = null,
          _mbMutBatch = [],
          _mbMutPending = false;
        var _mbObserve = function (t, c, f) {
          var o = new MutationObserver(f);
          o.observe(t, c);
          return o;
        };
        var _mbRaf =
          window.requestAnimationFrame ||
          function (f) {
            return setTimeout(f, 16);
          };
        _mbObserve(body, { childList: true, subtree: true }, function (muts) {
          /* 同帧合并：一帧内的多次变动先攒起来，统一处理一次，不丢弃任何一条 */
          for (var k = 0; k < muts.length; k++) _mbMutBatch.push(muts[k]);
          if (_mbMutPending) return;
          _mbMutPending = true;
          _mbRaf(function () {
            _mbMutPending = false;
            var batch = _mbMutBatch;
            _mbMutBatch = [];
            if (!batch.length) return;
            if (!_mbApplyRaf) {
              _mbApplyRaf = _mbRaf(function () {
                _mbApplyRaf = null;
                try {
                  applyAll();
                } catch (e) {}
              });
            }
            /* 摇骰子只对新消息有意义，仍然防抖，避免连续 DOM 变动触发大量 scan */
            if (_mbScanTimer) clearTimeout(_mbScanTimer);
            _mbScanTimer = setTimeout(scan, 300);
          });
        });
      } catch (e) {}
    }
    /* 本地两层都没数据时，从 IndexedDB 异步补一次（同步接口拿不到异步值） */
    try {
      if (!localStorage.getItem(MAP_KEY) && window._idbStore && window._idbStore.get) {
        window._idbStore.get(MAP_KEY, function (v) {
          if (v && !localStorage.getItem(MAP_KEY)) {
            try {
              localStorage.setItem(MAP_KEY, v);
            } catch (e) {}
            try {
              window.akiniStore && window.akiniStore.memorySet && window.akiniStore.memorySet(MAP_KEY, v);
            } catch (e) {}
            try {
              applyAll();
            } catch (e) {}
          }
        });
      }
    } catch (e) {}
    scan();
    /* 启动对账完成后重新贴一次已保存的小气泡（启动早期表可能还没水合完） */
    try {
      window.addEventListener("akini-storage-restored", function () {
        if (boot_bodyChanged()) return;
        try {
          applyAll();
        } catch (e) {}
      });
    } catch (e) {}
    /* 低频兜底：聊天重渲染（core 可能整块替换 DOM 或重算 data-ts）后，
       把已保存的小气泡重新贴回去；不摇骰子、不写盘，开销很小 */
    if (!_mbTick) {
      _mbTick = setInterval(function () {
        if (document.hidden) return;
        try {
          if (boot_bodyChanged()) return; /* 换了新 chatBody：重挂观察者并重新扫描 */
          applyAll();
        } catch (e) {}
      }, 5000);
    }
  }
  var _mbObsBody = null,
    _mbTick = null;
  function boot_bodyChanged() {
    var body = document.getElementById("chatBody");
    if (!body) return false;
    if (body !== _mbObsBody) {
      boot();
      return true;
    }
    return false;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(boot, 1000);
})();

/* ===== 一次性清理旧版误标墓碑（只执行一次）=====
   旧版启动钩子把「本次写入比上次短」中缺失的 id 全部当成删除，
   导致朋友圈动态 / iCity 日记被永久隐藏（表现为帖子凭空消失）。
   真实删除时数据本身已从 localStorage、IndexedDB 与备份中移除，
   清空墓碑列表不会让已删内容复活，只会让被误伤的帖子重新显示。 */
(function () {
  var FLAG = "akini_tombstone_purge_v1";
  try {
    if (localStorage.getItem(FLAG) === "1") return;
  } catch (e) {
    return;
  }
  function run() {
    try {
      if (localStorage.getItem(FLAG) === "1") return;
    } catch (e) {
      return;
    }
    try {
      localStorage.setItem("akini_deleted_posts", "[]");
    } catch (e) {}
    try {
      localStorage.setItem("akini_deleted_icity", "[]");
    } catch (e) {}
    try {
      if (window._idbStore && window._idbStore.set) {
        window._idbStore.set("akini_deleted_posts", "[]");
        window._idbStore.set("akini_deleted_icity", "[]");
      }
    } catch (e) {}
    try {
      localStorage.setItem(FLAG, "1");
    } catch (e) {}
    try {
      window._renderPosts();
    } catch (e) {}
    try {
      window._renderIcity();
    } catch (e) {}
  }
  var done = false;
  window.addEventListener("akini-storage-restored", function () {
    if (done) return;
    done = true;
    setTimeout(run, 0);
  });
  setTimeout(function () {
    if (done) return;
    done = true;
    run();
  }, 5000);
})();
