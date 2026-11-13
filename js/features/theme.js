(function () {
  window._akiniThemeToast = function (msg, dur) {
    dur = dur || 1500;
    try {
      var el = document.createElement("div");
      el.textContent = msg;
      el.style.cssText =
        "position:fixed;top:45%;left:50%;transform:translateX(-50%);padding:10px 18px;background:rgba(0,0,0,0.82);color:#fff;border-radius:22px;font-size:14px;z-index:99999;pointer-events:none;opacity:0;transition:opacity .18s ease;box-shadow:0 4px 16px rgba(0,0,0,.25);font-family:inherit;max-width:80vw;text-align:center;";
      document.body.appendChild(el);
      requestAnimationFrame(function () {
        el.style.opacity = "1";
      });
      setTimeout(function () {
        el.style.opacity = "0";
        setTimeout(function () {
          try {
            el.parentNode && el.parentNode.removeChild(el);
          } catch (e) {}
        }, 220);
      }, dur);
    } catch (e) {}
  };
})();


/* ============ 气泡美化 & CSS 自定义 ============ */
(function () {
  var KEY = "akini_bubble_css";
  var input = document.getElementById("bubbleCssInput");
  var styleEl = document.getElementById("akini-bubble-css");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "akini-bubble-css";
    document.head.appendChild(styleEl);
  }

  /* 自动为每个声明添加 !important，跳过已带 !important 与 CSS 变量、content。
     按「括号/引号深度 0 才切分 ;」解析，避免把值里的分号当声明分隔符：
     url("data:image/svg+xml;utf8,...") 这类 data-URI 若被切开，会注入
     url("data:image/svg+xml !important;utf8,...")，背景图直接失效。 */
  function addImportant(css) {
    // 逐个规则块处理：对 {...} 内的每条声明补 !important（即使末尾无分号也能覆盖）
    return css.replace(/([^{}]*?)\{([^{}]*)\}/g, function (m, sel, body) {
      var parts = [],
        cur = "",
        depth = 0,
        quote = "";
      for (var i = 0; i < body.length; i++) {
        var ch = body.charAt(i);
        if (quote) {
          cur += ch;
          if (ch === quote && body.charAt(i - 1) !== "\\") quote = "";
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          cur += ch;
          continue;
        }
        if (ch === "(" || ch === "[") {
          depth++;
          cur += ch;
          continue;
        }
        if (ch === ")" || ch === "]") {
          if (depth > 0) depth--;
          cur += ch;
          continue;
        }
        if (ch === ";" && depth === 0) {
          parts.push(cur);
          cur = "";
          continue;
        }
        cur += ch;
      }
      if (cur) parts.push(cur);
      var fixedBody = parts
        .map(function (decl) {
          if (!decl.trim()) return "";
          var mm = /^([\s\S]*?):([\s\S]*)$/.exec(decl);
          if (!mm) return "";
          var prop = mm[1].trim(),
            val = mm[2];
          if (/^content$/i.test(prop)) return decl;
          if (/^--/.test(prop)) return decl;
          if (/!important/i.test(val)) return decl;
          return prop + ":" + val + " !important";
        })
        .filter(function (x) {
          return x !== "";
        })
        .join(";");
      return sel + "{" + fixedBody + "}";
    });
  }

  function stripNoise(css) {
    var s = String(css || "");
    s = s.replace(/\/\*[\s\S]*?\*\//g, "");
    var fb = s.indexOf("{");
    if (fb > 0) {
      var head = s.slice(0, fb),
        rest = s.slice(fb);
      var lines = head.split(/\r?\n/),
        start = -1;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (!ln) continue;
        if (
          /[.#*:\[\]@(,]/.test(ln) ||
          /^(html|body|div|span|p|a|ul|li|img|button|input|textarea|svg|section|header|footer|main|nav)\b/i.test(ln)
        ) {
          start = i;
          break;
        }
      }
      if (start < 0) {
        head = "";
      } else {
        var kept = [];
        for (var j = start; j < lines.length; j++) {
          var l2 = lines[j];
          /* 选择器行里混入的中文/emoji（标题粘连）直接剔除；带引号的属性选择器不动 */
          if (/[^\x00-\x7F]/.test(l2) && !/["']/.test(l2)) l2 = l2.replace(/[^\x00-\x7F]/g, "");
          kept.push(l2);
        }
        head = kept.join("\n").trim();
      }
      s = head + rest;
    }
    return s.trim();
  }

  /* 原生 一致：把粘贴的 CSS 原样注入（补 html body 前缀提升优先级）。
     这样即使不做选择器映射，依赖 .message / .message-sent / .message-received
     这类原生类名的美化代码也能直接生效（气泡渲染时会同步补上这些类名）。
     命中 .message-sent / .message-received 的规则再补一份带 #app-chat .msg-row.me
     的高优先级版本，确保能压过默认气泡底色/内边距。 */
  function boostRaw(css) {
    try {
      return String(css || "").replace(/([^{}]+)\{([^{}]*)\}/g, function (_, sel, body) {
        var parts = sel.split(","),
          out = [];
        for (var i = 0; i < parts.length; i++) {
          var raw0 = parts[i].trim();
          if (!raw0) continue;
          if (/^@|^from$|^to$|^\d/.test(raw0)) {
            out.push(raw0);
            continue;
          }
          var base = raw0
            .replace(/^(html|body)\s+/i, "")
            .replace(/^(html|body)\s+/i, "")
            .trim();
          if (!base) continue;
          out.push("html body " + base);
          if (/\.message\.message-sent/.test(base)) {
            [
              "#app-chat .msg-row.me",
              "#companionMsgs .msg-row.me",
              "#watchChatBody .msg-row.me",
              "#bubbleCssPreview .msg-row.me",
            ].forEach(function (p) {
              out.push("html body " + p + " " + base);
            });
          } else if (/\.message\.message-received/.test(base)) {
            [
              "#app-chat .msg-row.other",
              "#app-chat .msg-row.ta",
              "#companionMsgs .msg-row.other",
              "#watchChatBody .msg-row.other",
              "#bubbleCssPreview .msg-row.other",
            ].forEach(function (p) {
              out.push("html body " + p + " " + base);
            });
          }
        }
        return (out.length ? out.join(", ") : sel) + " {" + body + "}";
      });
    } catch (e) {
      return "";
    }
  }

  /* 将常见气泡选择器映射到本应用结构，并加 html body.bubble-css-on 顶级特异性前缀；排除转账与表情包气泡，同时无缝覆盖设置页实时预览框 */
  function translateSelectors(css) {
    if (!css) return "";
    var meBases = [
      "html body.bubble-css-on #app-chat .chat-body .msg-row.me .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #app-chat .msg-row.me .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #bubbleCssPreview .msg-row.me .bubble",
      "html body.bubble-css-on #bubbleCssPreview .bubble.me",
      "html body.bubble-css-on #companionMsgs .msg-row.me .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #watchChatBody .msg-row.me .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
    ];
    var otherBases = [
      "html body.bubble-css-on #app-chat .chat-body .msg-row.other .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #app-chat .msg-row.other .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #app-chat .msg-row.ta .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #bubbleCssPreview .msg-row.other .bubble",
      "html body.bubble-css-on #bubbleCssPreview .bubble.other",
      "html body.bubble-css-on #companionMsgs .msg-row.other .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #companionMsgs .msg-row.ta .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #watchChatBody .msg-row.other .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #watchChatBody .msg-row.ta .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
    ];
    var anyBases = [
      "html body.bubble-css-on #app-chat .chat-body .msg-row .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #app-chat .msg-row .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #bubbleCssPreview .bubble",
      "html body.bubble-css-on #companionMsgs .msg-row .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
      "html body.bubble-css-on #watchChatBody .msg-row .bubble:not(.transfer-bubble):not(.sticker-bubble):not(.survey-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble)",
    ];

    try {
      return css.replace(/([^{}]+)\{([^{}]+)\}/g, function (_, selectors, body) {
        var selList = selectors.split(",");
        var newSelList = [];
        for (var i = 0; i < selList.length; i++) {
          var s = selList[i].trim();
          if (!s) continue;
          var isMe =
            /\.message\.message-sent|\.message-sent|\.bubble\.me|\.bubble-right|\.msg-row\.me|\.msg-bubble\.me|\.sent|\.self|\.my-bubble/.test(
              s,
            );
          var isOther =
            /\.message\.message-received|\.message-received|\.bubble\.other|\.bubble-left|\.msg-row\.other|\.msg-row\.ta|\.msg-bubble\.other|\.received|\.other|\.ta|\.ta-bubble/.test(
              s,
            );
          var bases = isMe ? meBases : isOther ? otherBases : anyBases;
          var cleaned = s
            .replace(
              /(html|body|\.bubble-css-on|\.chat-body|#app-chat|#bubbleCssPreview|\.msg-row|\.bubble-wrap)\s*/g,
              "",
            )
            .replace(
              /(\.message\.message-sent|\.message\.message-received|\.bubble\.me|\.bubble\.other|\.message-sent|\.message-received|_bubble|\.msg-bubble|\.chat-bubble|\.bubble|\.bom|\.message|\.sent|\.received|\.self|\.other|\.ta|\.bubble-right|\.bubble-left)/g,
              "",
            )
            .trim();
          /* 选择器里若还残留中文/emoji，说明是标题噪音，直接丢弃这段后缀，
             否则会生成非法选择器，导致整条规则被浏览器丢弃 */
          if (/[^\x00-\x7F]/.test(cleaned)) cleaned = "";
          var suffix = cleaned && !cleaned.startsWith(":") && !cleaned.startsWith(".") ? " " + cleaned : cleaned;
          // 支持小部件与伪元素挂件及直接类名
          if (
            cleaned &&
            (cleaned.indexOf("widget") !== -1 ||
              cleaned.indexOf("badge") !== -1 ||
              cleaned.indexOf("decor") !== -1 ||
              cleaned.indexOf("avatar") !== -1)
          ) {
            var widgetSel = cleaned.startsWith(".") ? cleaned : "." + cleaned;
            newSelList.push("html body.bubble-css-on #app-chat .chat-body .msg-row .bubble " + widgetSel);
            newSelList.push("html body.bubble-css-on #bubbleCssPreview .bubble " + widgetSel);
            newSelList.push("html body.bubble-css-on #app-chat .chat-body .msg-row .bubble-wrap " + widgetSel);
            newSelList.push("html body.bubble-css-on #companionMsgs .msg-row .bubble " + widgetSel);
            newSelList.push("html body.bubble-css-on #watchChatBody .msg-row .bubble " + widgetSel);
          }
          for (var b = 0; b < bases.length; b++) {
            newSelList.push(bases[b] + suffix);
          }
        }
        return (newSelList.length ? newSelList.join(", ") : selectors) + " {" + body + "}";
      });
    } catch (e) {
      return css;
    }
  }

  /* 生成最终注入的 CSS：正式应用与实时预览共用同一份结果，
     保证「输入时看到的效果」和「点应用后的效果」完全一致。 */
  function buildBubbleCss(raw) {
    var final = "";
    var hasCss = !!(raw && raw.trim());
    if (hasCss) {
      final =
        "\nbody.bubble-css-on #app-chat .bubble:not(.transfer-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble):not(.survey-bubble), body.bubble-css-on #companionMsgs .bubble:not(.transfer-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble):not(.survey-bubble), body.bubble-css-on #watchChatBody .bubble:not(.transfer-bubble):not(.shop-card-bubble):not(.music-invite-bubble):not(.music-end-bubble):not(.survey-bubble) { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\n";
      var _clean = stripNoise(raw);
      if (!_clean) {
        _clean = "";
      }
      final += addImportant(translateSelectors(_clean));
      final += addImportant(boostRaw(_clean));
      final +=
        "\nhtml body #app-chat .bubble.transfer-bubble,html body #app-chat .bubble.shop-card-bubble,html body #app-chat .bubble.survey-bubble{background:#ffffff !important;background-color:#ffffff !important;color:#1a1a1a !important;border:1px solid #e8e8e8 !important;box-shadow:0 4px 14px rgba(0,0,0,0.07) !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}\nhtml body #app-chat .bubble.transfer-bubble *,html body #app-chat .bubble.shop-card-bubble *,html body #app-chat .bubble.survey-bubble *{text-shadow:none !important;}\nhtml body #app-chat .bubble.transfer-bubble .tr-amount{color:#1a1a1a !important;}\nhtml body #app-chat .bubble.transfer-bubble .tr-note{color:#666666 !important;}\nhtml body #app-chat .bubble.transfer-bubble .tr-type{color:#888888 !important;}\nhtml body #app-chat .bubble.transfer-bubble .tr-claim-tip{color:#666666 !important;}\nhtml body #app-chat .bubble.shop-card-bubble .shop-card-bubble-title,html body #app-chat .bubble.shop-card-bubble .shop-card-bubble-item{color:#1a1a1a !important;}\nhtml body #app-chat .bubble.survey-bubble .survey-bubble-title{color:#1a1a1a !important;}\nhtml body #app-chat .bubble.survey-bubble .survey-bubble-sub{color:#666666 !important;}\nhtml body #app-chat .bubble.survey-bubble .survey-bubble-count{color:#888888 !important;}\n";
    }
    return { css: final, has: hasCss };
  }

  function applyCss(css) {
    var raw = css || "";
    /* 自愈：历史云/IDB 恢复链路曾把字面 "null" 写进存储——脏值会让 body 打开
       bubble-css-on（磨砂玻璃被清除）却注入无效 CSS，气泡全透明。检测到脏值立即视为空、
       清掉主键脏值，并异步从 IDB 主键抢救真实 CSS 回填。 */
    if (raw === "null" || raw === "undefined") {
      raw = "";
      try {
        localStorage.removeItem(KEY);
        if (window._idbStore && window._idbStore.get) {
          window._idbStore.get(KEY, function (bv) {
            if (!bv || bv === "null" || bv === "undefined") return;
            try {
              localStorage.setItem(KEY, bv);
            } catch (e) {}
            try {
              if (window.applyBubbleCss) window.applyBubbleCss(bv);
            } catch (e) {}
          });
        }
      } catch (e) {}
    }
    /* 应用样式与打标：失败时整块放弃，但下面的保存/刷新仍会执行 */
    try {
      var _bb = buildBubbleCss(raw);
      var final = _bb.css;
      var hasCss = _bb.has;
      styleEl.textContent = final;
      /* 正式样式已接管预览区，移除输入时的临时预览规则，避免两套规则叠加 */
      if (previewStyleEl) previewStyleEl.textContent = "";
      /* 有自定义气泡 CSS 时给 body 打标：自带气泡底色/阴影整体停用，美化样式完全接管 */
      if (document.body) {
        document.body.classList.toggle("bubble-css-on", hasCss);
        if (hasCss) {
          document.body.classList.remove("bubble-pink", "bubble-blue", "bubble-green", "bubble-black", "bubble-gray");
        } else {
          var savedC = localStorage.getItem("akini_bubble_color") || "gray";
          document.body.classList.remove("bubble-pink", "bubble-blue", "bubble-green", "bubble-black", "bubble-gray");
          document.body.classList.add("bubble-" + savedC);
        }
      }
    } catch (e) {}
    try {
      localStorage.setItem(KEY, raw);
    } catch (e) {}
    _previewDirty = false;
    /* 刷新当前聊天渲染与美化页预览，让新样式立即生效 */
    try {
      if (window.akiniContacts && window.akiniContacts.getActiveChatId && window.openChat) {
        var actId = window.akiniContacts.getActiveChatId();
        if (actId) window.openChat(actId, true);
      }
      window.reRenderAll && window.reRenderAll();
      updateBubblePreview();
    } catch (e) {}
    requestAnimationFrame(function () {
      window.dispatchEvent(new CustomEvent("akini:bubble-css-updated"));
    });
  }
  var previewStyleEl = null;
  var _previewDirty = false;
  /* 实时预览 = 正式应用的同一份 CSS：输入时就按「应用后」的效果渲染，
     小挂件、伪元素、背景图都会立即出现；不写存储，不重排聊天。 */
  function livePreview(css) {
    try {
      var raw = String(css || "");
      if (raw === "null" || raw === "undefined") raw = "";
      var bb = buildBubbleCss(raw);
      styleEl.textContent = bb.css;
      if (document.body) document.body.classList.toggle("bubble-css-on", bb.has);
      if (previewStyleEl) previewStyleEl.textContent = "";
      _previewDirty = true;
      updateBubblePreview();
    } catch (e) {}
  }
  /* 离开美化页但没点「应用 CSS」时，恢复成已保存的样式，避免未保存的预览留在聊天里 */
  window.__akiniRestoreBubblePreview = function () {
    if (!_previewDirty) return;
    _previewDirty = false;
    try {
      applyCss(localStorage.getItem(KEY) || "");
    } catch (e) {}
  };
  function updateBubblePreview() {
    var preview = document.getElementById("bubbleCssPreview");
    if (!preview) return;
    preview.classList.remove("bubble-css-preview-active");
    void preview.offsetWidth;
    preview.classList.add("bubble-css-preview-active");
  }
  window.applyBubbleCss = applyCss;

  /* 同步取 akini_bubble_css：优先 store.get（读 akiniStore 内存 / localStorage）→ localStorage 兜底。
     store.js 现在是只读预热层，唯一数据源仍是 akiniStore。 */
  var saved = "";
  try {
    if (window.store && typeof store.get === "function") saved = store.get(KEY) || "";
  } catch (_e) {}
  if (!saved) {
    try { saved = localStorage.getItem(KEY) || ""; } catch (_e) {}
  }
  if (
    !saved ||
    saved === "null" ||
    saved === "undefined" ||
    !saved.trim() ||
    saved.trim() === "null" ||
    saved.trim() === "undefined"
  )
    saved = "";
  if (input) input.value = saved;
  applyCss(saved);
  /* localStorage 可能因配额丢失，从 IndexedDB 主键兜底恢复气泡 CSS（boot.js 已镜像） */
  if (!saved && window._idbStore && window._idbStore.get) {
    window._idbStore.get(KEY, function (v) {
      if (v && v !== "null" && v !== "undefined" && v.trim() && v.trim() !== "null" && v.trim() !== "undefined") {
        if (input) input.value = v;
        applyCss(v);
        try {
          localStorage.setItem(KEY, v);
        } catch (e) {}
      }
    });
  }

  if (input) {
    input.addEventListener("input", function () {
      livePreview(input.value);
    });
    var applyBtn = document.getElementById("bubbleCssApply");
    if (applyBtn)
      applyBtn.addEventListener("click", function () {
        applyCss(input.value);
        window._akiniThemeToast && window._akiniThemeToast("样式已应用");
      });
    var clearBtn = document.getElementById("bubbleCssClear");
    if (clearBtn)
      clearBtn.addEventListener("click", function () {
        input.value = "";
        applyCss("");
        window._akiniThemeToast && window._akiniThemeToast("样式已清除");
      });
  }
})();


/* ============ 全局自定义字体（字体名 + 字体链接，应用到全站所有文字） ============ */
(function () {
  /* 存储（localStorage + IDB 备份 + 云同步共用 akini_ 前缀）：
     akini_bubble_font       → JSON：{ name: 字体名, url: 字体链接 }
     旧版可能存过纯链接（http...）或系统字体族名，启动恢复时自动兼容迁移。 */
  var KEY = "akini_bubble_font";
  var NAME_KEY = "akini_bubble_font_name";
  var urlInput = document.getElementById("bubbleFontInput");
  var applyBtn = document.getElementById("bubbleFontApply");
  var clearBtn = document.getElementById("bubbleFontClear");
  var statusEl = document.getElementById("bubbleFontStatus");

  function setStatus(msg, type) {
    if (!statusEl) return;
    if (!msg) {
      statusEl.style.display = "none";
      statusEl.textContent = "";
      return;
    }
    statusEl.style.display = "block";
    statusEl.textContent = msg;
    statusEl.style.color = type === "error" ? "#e5484d" : type === "ok" ? "#30a46c" : "#888";
  }
  function readStoredFont() {
    var raw = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch (e) {}
    if (!raw)
      try {
        if (window.akiniStore && window.akiniStore.getSync) raw = window.akiniStore.getSync(KEY, null);
      } catch (e) {}
    if (!raw) return null;
    raw = String(raw).trim();
    if (!raw || raw === "null" || raw === "undefined") return null;
    var o = null;
    try {
      o = JSON.parse(raw);
    } catch (e) {
      o = null;
    }
    if (o && typeof o === "object" && o.url) {
      return { name: "AkiniCustomFont", url: o.url };
    }
    if (/^https?:\/\//i.test(raw)) {
      return { name: "AkiniCustomFont", url: raw };
    }
    return null;
  }
  function persist(name, url) {
    var obj = JSON.stringify({ name: "AkiniCustomFont", url: url });
    try {
      localStorage.setItem(KEY, obj);
    } catch (e) {}
    try {
      localStorage.setItem(NAME_KEY, "AkiniCustomFont");
    } catch (e) {}
  }
  function activateGlobalFont(name, url) {
    var st = document.getElementById("akini-global-font");
    if (st) st.remove();
    st = document.createElement("style");
    st.id = "akini-global-font";
    st.textContent =
      "\n@font-face{font-family:'AkiniCustomFont';src:url('" +
      url +
      "') format('truetype');font-display:swap;font-weight:normal;font-style:normal;}\nhtml,body,html body,html body *:not(style):not(script){font-family:'AkiniCustomFont','PingFang SC','Microsoft YaHei',sans-serif !important;}\n";
    document.head.insertBefore(st, document.head.firstChild);
    try {
      if (document.fonts && document.fonts.load) {
        document.fonts
          .load("16px 'AkiniCustomFont'")
          .then(function () {
            setStatus("字体已生效，全站文字已更换", "ok");
          })
          .catch(function () {
            setStatus("字体链接无法加载（需允许跨域/直链），全站文字未更换", "error");
          });
        setTimeout(function () {
          if (document.fonts && document.fonts.status !== "loaded" && document.fonts.status !== "loading") {
            try {
              if (!document.fonts.check("16px 'AkiniCustomFont'"))
                setStatus("字体加载失败：请确认直链可访问且允许跨域", "error");
            } catch (e) {}
          }
        }, 4000);
      } else {
        setStatus("字体已应用", "ok");
      }
    } catch (e) {}
  }
  var initStored = readStoredFont();
  if (initStored && initStored.url) {
    if (urlInput) urlInput.value = initStored.url;
    activateGlobalFont("AkiniCustomFont", initStored.url);
  }

  applyBtn.addEventListener("click", function () {
    var url = (urlInput ? urlInput.value : "").trim();
    /* 链接校验——网盘分享页不是字体文件，浏览器无法加载，必须 .ttf/.woff/.woff2/.otf 直链 */
    if (url && /pan\.(quark|baidu|aliyun)|aliyundrive|lanzou|cloud\.189|115\.com|weiyun/i.test(url)) {
      setStatus(
        "这是网盘分享页，不是字体文件直链，无法生效。请下载字体文件后传到 GitHub Raw / jsdelivr 等空间，粘贴以 .ttf/.woff2 结尾的链接",
        "error",
      );
      return;
    }
    if (url && !/\.(ttf|otf|woff2?)(\?|$)/i.test(url)) {
      setStatus("链接需以 .ttf/.otf/.woff/.woff2 结尾（直链），当前链接无法作为字体加载", "error");
      return;
    }
    if (!url) {
      setStatus("请填入字体文件链接", "error");
      return;
    }
    if (!/^https?:\/\//i.test(url) && !/^data:font\//i.test(url)) {
      setStatus("链接格式不正确，需以 http:// 或 https:// 开头", "error");
      return;
    }
    setStatus("正在加载并应用字体...", "");
    activateGlobalFont("AkiniCustomFont", url);
    persist("AkiniCustomFont", url);
    setStatus("字体已应用，离线亦可使用", "ok");
    window._akiniThemeToast && window._akiniThemeToast("字体已应用");
  });
  function applyCustomFont(name, url) {
    try {
      if (url) {
        activateGlobalFont(name || "AkiniCustomFont", url);
        persist(name || "AkiniCustomFont", url);
      } else {
        try {
          if (window.__akiniClearGlobalFont) window.__akiniClearGlobalFont();
        } catch (e1) {}
        try {
          document.documentElement.style.fontFamily = "";
        } catch (e2) {}
        try {
          persist("", "");
        } catch (e3) {}
      }
    } catch (e) {}
  }
  clearBtn.addEventListener("click", function () {
    if (urlInput) urlInput.value = "";
    if (statusEl) setStatus("", "");
    applyCustomFont("", "");
    window._akiniThemeToast && window._akiniThemeToast("已恢复默认字体");
  });

  /* 启动恢复 */
  var st = readStoredFont();
  if (st) {
    applyCustomFont(st.name, st.url);
  } else if (window._idbStore && window._idbStore.get) {
    window._idbStore.get(KEY, function (v) {
      if (v && v !== "null" && v !== "undefined") {
        try {
          var o = JSON.parse(v);
          if (o && o.url) applyCustomFont(o.name || "MyFont", o.url);
        } catch (e) {}
      }
    });
  }
})();


(function () {
  "use strict";
  var AKINI_APP_ICONS = [
    { id: "appBtnChat", label: "\u804a\u5929" },
    { id: "appBtnFriends", label: "\u670b\u53cb\u5708" },
    { id: "appBtnIcity", label: "iCity" },
    { id: "appBtnShop", label: "\u5546\u5e97" },
    { id: "appBtnMusic", label: "\u97f3\u4e50" },
    { id: "appBtnTaPhone", label: "TA\u7684\u624b\u673a" },
    { id: "appBtnWatch", label: "\u89c2\u5f71" },
    { id: "appBtnMail", label: "\u4fe1\u7bb1" },
    { id: "appBtnNovel", label: "\u5c0f\u8bf4" },
    { id: "appBtnCompanion", label: "\u966a\u4f34" },
    { id: "settingsBtn", label: "\u8bbe\u7f6e" },
    { id: "beautifyBtn", label: "\u7f8e\u5316" },
    { id: "wordBtn", label: "\u5b57\u5361" },
  ];
  var AKINI_DEFAULT_ICONS = {
    appBtnChat:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    appBtnFriends:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    appBtnMail:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    appBtnMusic:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    appBtnTaPhone:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    appBtnWatch:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/></svg>',
    appBtnIcity:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    appBtnShop:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    appBtnNovel:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/></svg>',
    appBtnCompanion:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    settingsBtn:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    beautifyBtn:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r="1.6" fill="currentColor" stroke="none"/><path d="M12 22a10 10 0 1 1 10-10c0 3-2.5 3-4 3h-2a2 2 0 0 0-1.6 3.2c.4.6.6 1.3.6 1.8A2 2 0 0 1 12 22z"/></svg>',
    wordBtn:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:100%;height:100%;object-fit:contain;color:#666" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  };
  var AKINI_ORIG_ICONS = {};

  var AKINI_EDITING_ID = null;
  var AKINI_PENDING_VAL = null;
  function G(id) {
    return document.getElementById(id);
  }
  function removeWhiteBg(dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      // 统一输出 128x128 圆角正方形图标，居中裁剪原图，避免整张图被压扁
      var size = 128;
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // 填充白色底，避免上传图透明区域透出壁纸
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      // 居中裁剪为正方形
      var s = Math.min(img.width, img.height);
      var sx = (img.width - s) / 2;
      var sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      // 圆角遮罩
      try {
        ctx.globalCompositeOperation = "destination-in";
        ctx.beginPath();
        var r = size * 0.22;
        ctx.moveTo(r, 0);
        ctx.lineTo(size - r, 0);
        ctx.quadraticCurveTo(size, 0, size, r);
        ctx.lineTo(size, size - r);
        ctx.quadraticCurveTo(size, size, size - r, size);
        ctx.lineTo(r, size);
        ctx.quadraticCurveTo(0, size, 0, size - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } catch (e) {}
      cb(canvas.toDataURL("image/png"));
    };
    img.onerror = function () {
      cb(dataUrl);
    };
    img.src = dataUrl;
  }
  function saveOriginalIcons() {
    // 在首次加载时把 DOM 中的原始图标保存到每个容器的 data-orig-html 上，用于恢复默认
    if (!AKINI_ORIG_ICONS._saved) {
      AKINI_ORIG_ICONS._saved = true;
      AKINI_APP_ICONS.forEach(function (c) {
        var b = G(c.id);
        if (!b) return;
        var w = b.querySelector(".icon-wrap");
        if (!w) return;
        if (!w.classList.contains("custom-icon")) {
          w.setAttribute("data-orig-html", w.innerHTML);
        }
      });
    }
  }
  function applyAppIcon(id, val) {
    var b = G(id);
    if (!b) return;
    var w = b.querySelector(".icon-wrap");
    if (!w) return;
    // 幂等：值未变化时不重建 innerHTML
    if (w.__akiniAppliedIconVal === val) return;
    w.__akiniAppliedIconVal = val;
    if (!val) {
      // 恢复默认：优先使用 data-orig-html，否则使用硬编码默认图标
      var orig = w.getAttribute("data-orig-html") || AKINI_DEFAULT_ICONS[id];
      if (orig) {
        w.innerHTML = orig;
      }
      w.classList.remove("custom-icon");
      w.removeAttribute("data-orig-html");
      w.removeAttribute("data-custom");
      return;
    }
    // 首次替换时保存原始图标到容器上
    if (!w.classList.contains("custom-icon")) {
      w.setAttribute("data-orig-html", w.innerHTML);
    }
    w.classList.add("custom-icon");
    w.setAttribute("data-custom", "1");
    if (val.indexOf("data:image") === 0) {
      // 保留容器圆角/边框/背景，图片居中覆盖显示为圆角正方形
      w.innerHTML =
        '<img src="' + val + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px">';
    } else {
      w.innerHTML =
        '<span style="font-size:26px;line-height:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%">' +
        val +
        "</span>";
    }
  }
  function loadAppIcons() {
    AKINI_APP_ICONS.forEach(function (c) {
      try {
        // zza：用户恢复默认后立墓碑，任何残留（IDB/快照/缓存）都不得再回读旧图标
        if (localStorage.getItem("akini_app_icon_tomb_" + c.id)) {
          try {
            if (window._idbStore && window._idbStore.remove) {
              window._idbStore.remove("akini_app_icon_" + c.id);
            }
          } catch (e) {}
          applyAppIcon(c.id, null);
          return;
        }
        var s = localStorage.getItem("akini_app_icon_" + c.id);
        if (s) {
          applyAppIcon(c.id, s);
        }
        if (window._idbStore && window._idbStore.get) {
          window._idbStore.get("akini_app_icon_" + c.id, function (v) {
            if (v) {
              var ls2 = null;
              try {
                ls2 = localStorage.getItem("akini_app_icon_" + c.id);
              } catch (eL) {}
              if (!ls2 || ls2 !== v) {
                try {
                  localStorage.setItem("akini_app_icon_" + c.id, v);
                } catch (eS) {}
              }
              applyAppIcon(c.id, v);
            } else if (!s) {
              applyAppIcon(c.id, null);
            }
          });
        } else if (!s) {
          applyAppIcon(c.id, null);
        }
      } catch (e) {
        applyAppIcon(c.id, null);
      }
    });
  }
  function buildIconGrid() {
    var grid = G("akiniAppIconGrid");
    if (!grid) return;
    grid.innerHTML = "";
    AKINI_APP_ICONS.forEach(function (c) {
      var b = G(c.id);
      var cell = document.createElement("div");
      cell.className = "akini-icon-cell";
      if (AKINI_EDITING_ID === c.id) {
        cell.classList.add("active");
      }
      cell.setAttribute("data-btn-id", c.id);
      var thumb = document.createElement("div");
      thumb.className = "akini-icon-thumb";
      if (b) {
        var w = b.querySelector(".icon-wrap");
        if (w) {
          // 复制当前显示内容，并保留恢复默认用的原始图标
          thumb.innerHTML = w.innerHTML;
          var orig = w.getAttribute("data-orig-html") || AKINI_DEFAULT_ICONS[c.id];
          if (orig) {
            thumb.setAttribute("data-orig-html", orig);
          }
        }
      }
      var name = document.createElement("div");
      name.className = "akini-icon-name";
      name.textContent = c.label;
      cell.appendChild(thumb);
      cell.appendChild(name);
      cell.addEventListener("click", function () {
        openIconEditor(c.id);
      });
      grid.appendChild(cell);
    });
  }
  function updateIconGridCell(id, val) {
    // 保存后立即单独更新网格对应项，不依赖整页重建
    var grid = G("akiniAppIconGrid");
    if (!grid) return;
    var cell = grid.querySelector('.akini-icon-cell[data-btn-id="' + id + '"]');
    if (!cell) return;
    var thumb = cell.querySelector(".akini-icon-thumb");
    if (!thumb) return;
    if (!val) {
      var orig = thumb.getAttribute("data-orig-html") || AKINI_DEFAULT_ICONS[id];
      if (orig) {
        thumb.innerHTML = orig;
      }
      thumb.classList.remove("custom-icon");
      thumb.removeAttribute("data-orig-html");
      return;
    }
    if (!thumb.classList.contains("custom-icon")) {
      thumb.setAttribute("data-orig-html", thumb.innerHTML);
    }
    thumb.classList.add("custom-icon");
    if (val.indexOf("data:image") === 0) {
      thumb.innerHTML =
        '<img src="' + val + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px">';
    } else {
      thumb.innerHTML =
        '<span style="font-size:26px;line-height:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%">' +
        val +
        "</span>";
    }
  }
  function openIconEditor(id) {
    AKINI_EDITING_ID = id;
    var c = AKINI_APP_ICONS.filter(function (x) {
      return x.id === id;
    })[0];
    if (!c) return;
    var ed = G("akiniAppIconEditor");
    var lb = G("akiniAppIconEditLabel");
    var ei = G("akiniAppIconEmojiInput");
    if (ed) {
      ed.style.display = "block";
    }
    if (lb) {
      lb.textContent = c.label;
    }
    if (ei) {
      ei.value = "";
    }
    AKINI_PENDING_VAL = null;
    updatePreview(null);
    var cells = document.querySelectorAll(".akini-icon-cell");
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].getAttribute("data-btn-id") === id) {
        cells[i].classList.add("active");
      } else {
        cells[i].classList.remove("active");
      }
    }
  }
  function updatePreview(val) {
    var p = G("akiniAppIconPreview");
    if (!p) return;
    if (val === null) {
      if (AKINI_EDITING_ID) {
        var b = G(AKINI_EDITING_ID);
        if (b) {
          var w = b.querySelector(".icon-wrap");
          if (w) {
            p.innerHTML = w.innerHTML;
            return;
          }
        }
      }
      p.innerHTML = "";
    } else if (val.indexOf("data:image") === 0) {
      p.innerHTML =
        '<img src="' + val + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px">';
    } else {
      p.innerHTML =
        '<span style="font-size:26px;line-height:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%">' +
        val +
        "</span>";
    }
  }
  function initAppIcons() {
    saveOriginalIcons();
    loadAppIcons();
    buildIconGrid();
    var ei = G("akiniAppIconEmojiInput");
    if (ei) {
      ei.addEventListener("input", function () {
        var v = (this.value || "").trim();
        if (v) {
          AKINI_PENDING_VAL = v;
          updatePreview(v);
        } else {
          AKINI_PENDING_VAL = null;
          updatePreview(null);
        }
      });
    }
    var fi = G("akiniAppIconFileInput");
    if (fi) {
      fi.addEventListener("change", function () {
        var f = this.files[0];
        if (!f) return;
        if (f.size > 2097152) {
          alert("\u56fe\u7247\u8fc7\u5927\uff0c\u8bf7\u9009\u62e9\u5c0f\u4e8e 2MB \u7684\u56fe\u7247");
          this.value = "";
          return;
        }
        var r = new FileReader();
        r.onload = function (e) {
          // 自动去除图片白底，保证自定义图标在深色背景上无白色底图
          try {
            removeWhiteBg(e.target.result, function (processed) {
              /* 去白底异步回调与点击保存存在竞态——若用户已点保存(清空待存值)，
               本次迟到的处理结果不得再覆写，避免保存时机错乱(一直不成功) */
              if (window.__akiniIconSaving) {
                return;
              }
              AKINI_PENDING_VAL = processed;
              updatePreview(AKINI_PENDING_VAL);
              if (ei) {
                ei.value = "";
              }
            });
          } catch (err) {
            AKINI_PENDING_VAL = e.target.result;
            updatePreview(AKINI_PENDING_VAL);
            if (ei) {
              ei.value = "";
            }
          }
        };
        r.onerror = function () {
          alert("图片读取失败，请重新选择图片");
          try {
            fi.value = "";
          } catch (_e) {}
        };
        r.readAsDataURL(f);
        setTimeout(function () {
          try {
            fi.value = "";
          } catch (_e) {}
        }, 1200);
      });
    }
    var rb = G("akiniAppIconResetBtn");
    if (rb) {
      rb.addEventListener("click", function () {
        if (!AKINI_EDITING_ID) return;
        // 同步先移除，避免全局 removeItem 拦截导致本地没删掉
        applyAppIcon(AKINI_EDITING_ID, null);
        // zza：立墓碑——恢复默认后定时重应用/快照恢复等任何路径都不允许再回读旧图标
        try {
          localStorage.setItem("akini_app_icon_tomb_" + AKINI_EDITING_ID, "1");
        } catch (e) {}
        AKINI_PENDING_VAL = null;
        updatePreview(null);
        buildIconGrid();
        // 再异步清理 IndexedDB、快照、Cache API 中的残留，确保恢复默认不反弹
        if (window._akiniPurgeIcon) {
          window._akiniPurgeIcon(AKINI_EDITING_ID);
        } else {
          try {
            localStorage.removeItem("akini_app_icon_" + AKINI_EDITING_ID);
          } catch (e) {}
          try {
            if (window._idbStore && window._idbStore.remove) {
              window._idbStore.remove("akini_app_icon_" + AKINI_EDITING_ID);
            }
          } catch (e) {}
        }
      });
    }
    var sb = G("akiniAppIconSaveBtn");
    if (sb) {
      sb.addEventListener("click", function () {
        if (!AKINI_EDITING_ID) return;
        /* 进入保存流程置守卫——去白底异步回调若此刻迟到不得覆写已保存的值 */
        window.__akiniIconSaving = true;
        // 兜底：如果用户在上传图片异步处理完成前点击保存，从预览区读取当前值
        if (!AKINI_PENDING_VAL) {
          var p = G("akiniAppIconPreview");
          if (p) {
            var img = p.querySelector("img");
            if (img && img.src) {
              AKINI_PENDING_VAL = img.src;
            } else {
              var sp = p.querySelector("span");
              if (sp) {
                AKINI_PENDING_VAL = (sp.textContent || "").trim();
              }
            }
          }
        }
        if (!AKINI_PENDING_VAL) {
          alert("请先上传图片或输入 Emoji，并等预览显示新图标后再点保存");
          return;
        }
        if (AKINI_PENDING_VAL) {
          var key = "akini_app_icon_" + AKINI_EDITING_ID;
          var saved = false;
          var dropTomb = function () {
            try {
              localStorage.removeItem("akini_app_icon_tomb_" + AKINI_EDITING_ID);
            } catch (e) {}
          };
          try {
            localStorage.setItem(key, AKINI_PENDING_VAL);
            saved = true;
          } catch (e) {}
          if (!saved) {
            try {
              for (var k = localStorage.length - 1; k >= 0; k--) {
                var rk = localStorage.key(k);
                if (!rk || rk === key) continue;
                if (
                  /^akini_stickers/.test(rk) ||
                  /^akini_chat_bg_/.test(rk) ||
                  /^akini_icity_ta_bg_/.test(rk) ||
                  rk === "akini_localstorage_snapshot"
                ) {
                  localStorage.removeItem(rk);
                }
              }
              localStorage.setItem(key, AKINI_PENDING_VAL);
              saved = true;
            } catch (e) {}
          }
          if (!saved) {
            try {
              for (var k2 = localStorage.length - 1; k2 >= 0; k2--) {
                var rk2 = localStorage.key(k2);
                if (!rk2 || rk2 === key) continue;
                if (/^akini_app_icon_/.test(rk2)) {
                  localStorage.removeItem(rk2);
                }
              }
              localStorage.setItem(key, AKINI_PENDING_VAL);
              saved = true;
            } catch (e) {}
          }
          dropTomb();
          /* 单通道：localStorage.setItem 已由存储层同步到内存 + IndexedDB */
          try {
            if (AKINI_PENDING_VAL.length < 90000) {
              localStorage.setItem("akini_iconvault_" + AKINI_EDITING_ID, AKINI_PENDING_VAL);
            }
          } catch (eV) {}
          applyAppIcon(AKINI_EDITING_ID, AKINI_PENDING_VAL);
          updateIconGridCell(AKINI_EDITING_ID, AKINI_PENDING_VAL);
          if (!saved) {
            // 提示用户空间不足，但 IndexedDB 仍保留一份
            setTimeout(function () {
              alert("本地存储空间不足，图标已尽可能保存。建议导出备份并清理数据，避免其他记录丢失。");
            }, 0);
          }
        }
        AKINI_PENDING_VAL = null;
        window.__akiniIconSaving = false;
      });
    }
    var ba = G("beautifyArea");
    if (ba && window.MutationObserver) {
      var obs = new MutationObserver(function () {
        if (ba.classList.contains("show")) {
          buildIconGrid();
        }
      });
      obs.observe(ba, { attributes: true, attributeFilter: ["class"] });
    }
  }
  function init() {
    try {
      initAppIcons();
    } catch (e) {
      console.error("[Akini Custom] initAppIcons error", e);
    }
    function _retryLoadIcons() {
      if (window._idbStore && window._idbStore.get) {
        try {
          loadAppIcons();
        } catch (e) {}
      } else {
        setTimeout(_retryLoadIcons, 100);
      }
    }
    setTimeout(_retryLoadIcons, 0);
    // 从后台切回/页面恢复时重新应用自定义图标，防止被 DOM 重建还原
    function _reapplyIcons() {
      try {
        saveOriginalIcons();
        loadAppIcons();
      } catch (e) {}
    }
    /* 图标为静态资源，切后台不会丢——回前台全量重刷(遍历DOM+逐图标LS/IDB读)是回前台卡顿源。
     加 10s 节流，30s 巡检兜底不变 */
    function _reapplyIconsThrottled() {
      var _now = Date.now();
      if (window.__reapplyIconsTs && _now - window.__reapplyIconsTs < 10000) return;
      window.__reapplyIconsTs = _now;
      _reapplyIcons();
    }
    window.addEventListener("pageshow", _reapplyIconsThrottled);
    window.__akiniOnVisible(function () { 
        _reapplyIconsThrottled();
       });
    /* 图标为静态资源，用户改图标时已有保存链路即时刷新；
     pageshow/visibilitychange 已覆盖回前台场景，删除 30s 轮询。 */
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
